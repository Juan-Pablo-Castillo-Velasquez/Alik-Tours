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
import re
import threading
import time

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core import cache
from app.core.cache import redis_client
from app.core.security import decode_token

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


def _rate_limit_config_for(path: str, method: str = "POST"):
    config = _rate_limit_base_config_for(path, method)
    if config is None:
        return None
    bucket, limit, window = config
    return bucket, limit * RATE_LIMIT_MULTIPLIER, window


# Escrituras públicas o costosas que también se limitan (auditoría de
# producción, nov. 2026): spam en contacto/corporativo, publicaciones y
# comentarios, reseñas, reservas y comprobantes. Solo cuentan los métodos
# indicados: leer la comunidad o el catálogo (GET) nunca se limita aquí.
# (método, expresión de ruta, bucket, límite, ventana en segundos)
RATE_LIMIT_RULES: list[tuple[str, re.Pattern, str, int, int]] = [
    ("POST", re.compile(r"^/api/reservas/\d+/pagar$"), "/pagar", 10, 60),
    ("POST", re.compile(r"^/api/metodos-pago-guardados/\d+/verificar$"), "/verificar-metodo-pago", 5, 60),
    ("POST", re.compile(r"^/api/contacto/?$"), "/contacto", 5, 600),
    ("POST", re.compile(r"^/api/solicitudes-corporativas/?$"), "/corporativo", 5, 600),
    ("POST", re.compile(r"^/api/reservas/?$"), "/crear-reserva", 10, 600),
    ("POST", re.compile(r"^/api/reservas/cotizar$"), "/cotizar", 60, 60),
    ("POST", re.compile(r"^/api/reservas/\d+/solicitud-cancelacion$"), "/cancelacion", 5, 600),
    ("POST", re.compile(r"^/api/pagos/\d+/comprobante$"), "/comprobante", 10, 600),
    ("POST", re.compile(r"^/api/comunidad/publicaciones/?$"), "/publicar", 5, 3600),
    ("POST", re.compile(r"^/api/comunidad/(publicaciones|videos)/\d+/comentarios$"), "/comentar", 20, 600),
    ("POST", re.compile(r"^/api/resenas/?$"), "/resena", 5, 3600),
    # PQR (Ley 1755): radicar, escribir, desistir y calificar.
    ("POST", re.compile(r"^/api/pqr/?$"), "/pqr-radicar", 10, 3600),
    ("POST", re.compile(r"^/api/pqr/\d+/(mensajes|desistir|calificar)$"), "/pqr-escribir", 30, 600),
    ("POST", re.compile(r"^/api/pqr/gestion/ejemplos$"), "/pqr-ejemplos", 5, 600),
    # Buscador de clientes del panel (autocompletar mientras se escribe).
    ("GET", re.compile(r"^/api/clientes/buscar$"), "/buscar-clientes", 120, 60),
    # Formularios de perfil y cuenta.
    ("PUT", re.compile(r"^/api/clientes/\d+$"), "/editar-perfil", 20, 600),
    ("POST", re.compile(r"^/api/metodos-pago-guardados/?$"), "/guardar-metodo-pago", 10, 600),
    ("POST", re.compile(r"^/api/preferencias"), "/preferencias", 20, 600),
    # Telemetría IoT: un dispositivo manda una lectura cada pocos segundos;
    # más de 2 por segundo desde la misma IP es un error o un abuso.
    ("POST", re.compile(r"^/api/iot/lecturas$"), "/iot-lecturas", 120, 60),
]


# Red de seguridad para TODOS los demás formularios: cualquier escritura
# (POST/PUT/PATCH/DELETE) a /api o /auth que no tenga una regla propia
# arriba. Holgado para el uso normal (incluido el panel), pero corta bucles
# y bots que envían un formulario cientos de veces.
ESCRITURA_GENERAL = ("/escritura", 120, 60)
_METODOS_ESCRITURA = {"POST", "PUT", "PATCH", "DELETE"}


def _rate_limit_base_config_for(path: str, method: str = "POST"):
    if path in RATE_LIMITED_PATHS:
        if method == "GET":
            return None
        limit, window = RATE_LIMITED_PATHS[path]
        return path, limit, window
    for metodo, patron, bucket, limit, window in RATE_LIMIT_RULES:
        if method == metodo and patron.match(path):
            return bucket, limit, window
    if method in _METODOS_ESCRITURA and (path.startswith("/api/") or path.startswith("/auth/")):
        return ESCRITURA_GENERAL
    return None


def ip_cliente(request: Request) -> str:
    """IP real de quien hace la petición. En Render (y cualquier proxy) la
    conexión llega desde el proxy: sin esto TODOS los usuarios compartían
    el mismo contador y unos pocos intentos fallidos bloqueaban el login de
    todo el mundo. Se usa la ÚLTIMA IP de X-Forwarded-For (la que agrega el
    proxy de confianza; las anteriores las puede inventar el cliente).
    CONFIAR_PROXY=false la desactiva (servidor expuesto directo)."""
    if os.getenv("CONFIAR_PROXY", "true").lower() not in ("0", "false", "no"):
        reenviado = request.headers.get("x-forwarded-for", "")
        partes = [p.strip() for p in reenviado.split(",") if p.strip()]
        if partes:
            return partes[-1][:64]
    return request.client.host if request.client else "desconocido"


def identidad(request: Request) -> str:
    """A quién se le cuentan los intentos: al usuario si viene con una sesión
    válida (así varios asesores detrás de la misma IP de la oficina no se
    bloquean entre sí, y un usuario no evade el límite cambiando de red) y,
    si no, a la IP."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        datos = decode_token(auth[7:].strip())
        if datos and datos.get("sub"):
            return f"u{datos['sub']}"
    return f"ip{ip_cliente(request)}"


# Respaldo en memoria por si Redis no responde: antes, sin Redis, el límite
# simplemente se apagaba (login sin protección contra fuerza bruta).
_contadores_locales: dict[str, tuple[int, float]] = {}
_contadores_lock = threading.Lock()


def _incrementar_local(clave: str, ventana: int) -> int:
    ahora = time.monotonic()
    with _contadores_lock:
        if len(_contadores_locales) > 10_000:
            for k in [k for k, (_, vence) in _contadores_locales.items() if vence <= ahora]:
                _contadores_locales.pop(k, None)
        intentos, vence = _contadores_locales.get(clave, (0, ahora + ventana))
        if vence <= ahora:
            intentos, vence = 0, ahora + ventana
        intentos += 1
        _contadores_locales[clave] = (intentos, vence)
        return intentos


def _incrementar(clave: str, ventana: int) -> int:
    if not cache._redis_disponible():
        return _incrementar_local(clave, ventana)
    try:
        intentos = redis_client.incr(clave)
        if intentos == 1:
            redis_client.expire(clave, ventana)
        return int(intentos)
    except Exception:
        cache._marcar_redis_caido("contar intentos de", clave)
        return _incrementar_local(clave, ventana)


async def seguridad_middleware(request: Request, call_next):
    config = _rate_limit_config_for(request.url.path, request.method)
    if config:
        bucket, limit, window = config
        key = f"ratelimit:{bucket}:{identidad(request)}"
        intentos = _incrementar(key, window)
        if intentos > limit:
            minutos = max(1, round(window / 60))
            espera = f"{window} segundos" if window < 60 else f"{minutos} minuto{'s' if minutos != 1 else ''}"
            response = JSONResponse(
                status_code=429,
                content={
                    "detail": f"Hiciste demasiados envíos seguidos. Espera {espera} e inténtalo de nuevo.",
                    "reintentar_en": window,
                },
                headers={"Retry-After": str(window)},
            )
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            return response

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
