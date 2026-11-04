"""Middleware de seguridad: límite de intentos (rate limiting) sobre
endpoints sensibles y headers HTTP de buenas prácticas en toda respuesta.

Antes vivía embebido en app/main.py junto con el registro de FastAPI(),
Sentry, CORS y el resto del cableado de la app -- se separa acá para que
main.py quede como lo que debería ser: el punto donde se ARMA la
aplicación, no donde vive la lógica de cada pieza.

Esto es la alternativa de código a lo que se pidió originalmente como
"Cisco Secure Web Appliance": eso es un dispositivo de seguridad de
red/perímetro que se contrata e instala en la infraestructura de la
empresa, no algo que se pueda agregar a este repositorio. Esto cubre, en
cambio, lo que sí es código: límite de intentos sobre endpoints sensibles
(fuerza bruta) y headers de respuesta estándar de buenas prácticas.
"""

import os

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.cache import redis_client

# (ruta exacta o prefijo) -> (máximo de solicitudes, ventana en segundos)
RATE_LIMITED_PATHS = {
    "/auth/login": (5, 60),
    "/auth/register": (5, 60),
    "/auth/forgot-password": (3, 60),
    "/auth/reset-password": (5, 60),
    # Mismo caso que /api/metodos-pago-guardados/{id}/verificar más abajo:
    # un código de 6 dígitos (1,000,000 combinaciones) protegido solo por
    # un límite de intentos a nivel de cuenta (CODIGO_VERIFICACION_MAX_INTENTOS
    # en auth_service.py) es más débil sin un límite por IP encima -- esto
    # es defensa en profundidad, no el único control.
    "/auth/verify-email-code": (5, 60),
    # Sin límite, este endpoint es un vector de spam/mail-bombing (generar
    # correos reales hacia la bandeja de cualquier víctima con solo su
    # email) y agota la cuota diaria de envíos del proveedor SMTP (300/día
    # en el plan gratis de Brevo, ver backend/.env.example) sin que la
    # víctima haya pedido nada. Mismo límite que /forgot-password, que
    # tiene el mismo riesgo.
    "/auth/resend-verification": (3, 60),
    # Chat privado admin<->cliente (mensaje_chat_route.py) -- ambos son
    # paths de ESCRITURA propios (nunca compartidos con un GET de polling
    # a proposito, ver el comentario de ese router): sin limite, alguien
    # con sesion podria mandar mensajes/imagenes en bucle y llenar el hilo
    # o agotar el almacenamiento de Cloudinary.
    "/api/mensajes/enviar": (20, 60),
    "/api/mensajes/me/enviar": (20, 60),
}


# Multiplicador de los límites, SOLO para entornos de prueba. Las pruebas E2E
# registran e inician sesión decenas de veces por minuto desde la misma IP y
# chocaban con el 429. En producción no se define y queda en 1 (sin cambio).
RATE_LIMIT_MULTIPLIER = max(1, int(os.getenv("RATE_LIMIT_MULTIPLIER", "1") or "1"))


def _rate_limit_config_for(path: str):
    config = _rate_limit_base_config_for(path)
    if config is None:
        return None
    bucket, limit, window = config
    return bucket, limit * RATE_LIMIT_MULTIPLIER, window


def _rate_limit_base_config_for(path: str):
    if path in RATE_LIMITED_PATHS:
        limit, window = RATE_LIMITED_PATHS[path]
        return path, limit, window
    # /api/reservas/{id}/pagar es dinámica (el id varía) — se agrupa bajo
    # una sola clave "/pagar" para que el límite sea real por IP, no por id.
    if path.startswith("/api/reservas/") and path.endswith("/pagar"):
        return "/pagar", 10, 60
    # /api/metodos-pago-guardados/{id}/verificar valida un PIN de 4-6
    # dígitos (solo 10,000-1,000,000 combinaciones) contra un hash bcrypt —
    # sin límite de intentos, alguien con un token de sesión robado podía
    # forzarlo por fuerza bruta para autorizar pagos con el método guardado
    # de la víctima. Mismo agrupamiento por prefijo que "/pagar".
    if path.startswith("/api/metodos-pago-guardados/") and path.endswith("/verificar"):
        return "/verificar-metodo-pago", 5, 60
    return None


async def seguridad_middleware(request: Request, call_next):
    config = _rate_limit_config_for(request.url.path)
    if config:
        bucket, limit, window = config
        ip = request.client.host if request.client else "desconocido"
        key = f"ratelimit:{bucket}:{ip}"
        try:
            intentos = redis_client.incr(key)
            if intentos == 1:
                redis_client.expire(key, window)
            if intentos > limit:
                response = JSONResponse(
                    status_code=429,
                    content={"detail": "Demasiadas solicitudes. Intenta de nuevo en un momento."},
                )
                response.headers["X-Content-Type-Options"] = "nosniff"
                response.headers["X-Frame-Options"] = "DENY"
                return response
        except Exception:
            # Si Redis no responde, no se bloquea tráfico real (login,
            # registro) por un problema de infraestructura ajeno al
            # usuario — el rate limit es una capa extra, no la única.
            pass

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    # HSTS no tiene efecto sobre HTTP plano (dev en localhost) — el
    # navegador la ignora ahí y queda lista para cuando haya HTTPS real en
    # producción, sin necesidad de un segundo cambio después.
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response
