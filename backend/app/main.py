import logging
import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.cors import VERCEL_PREVIEW_REGEX, get_cors_origins
from app.core.database import get_db
from app.core.error_handlers import global_exception_handler
from app.middlewares.logging_middleware import log_requests
from app.middlewares.security_middleware import seguridad_middleware

# NOTA: este archivo ya no importa los modelos uno por uno a mano -- ese
# import (Usuario, Cliente, Hotel, Reserva, etc.) era en realidad
# redundante: la linea de arriba (from app.core.database import get_db)
# ya ejecuta app/core/database.py, que a su vez hace
# "from app.models import *" (con su propio noqa documentado ahi) y eso
# ya registra TODAS las tablas/relaciones en SQLAlchemy antes de que este
# modulo siga ejecutandose. Verificado con configure_mappers() tras la
# limpieza de Ruff: los 27 endpoints siguen registrandose sin error.
# Routers
from app.routes.auth_route import router as auth_router
from app.routes.banner_route import router as banner_router
from app.routes.cliente_route import router as cliente_router
from app.routes.comunidad_route import router as comunidad_router
from app.routes.configuracion_route import router as configuracion_router
from app.routes.contacto_route import router as contacto_router
from app.routes.dashboard_route import router as dashboard_router
from app.routes.destino_route import router as destino_router
from app.routes.empresa_route import router as empresa_router
from app.routes.favorito_route import router as favorito_router
from app.routes.hotel_route import router as hotel_router
from app.routes.mensaje_chat_route import router as mensaje_chat_router
from app.routes.metodo_pago_guardado_route import router as metodo_pago_guardado_router
from app.routes.notificacion_route import router as notificacion_router
from app.routes.preferencias_route import router as preferencias_router
from app.routes.promociones_route import router as promociones_router
from app.routes.resena_route import router as resena_route
from app.routes.reserva_route import router as reserva_router
from app.routes.servicio_route import router as servicio_router
from app.routes.solicitud_cancelacion_route import router as solicitud_cancelacion_router
from app.routes.tema_route import router as tema_router
from app.routes.usuario_route import permisos_router, roles_router
from app.routes.usuario_route import router as usuario_router

# ============================================================================
# CONFIGURACIÓN LOGGING
# ============================================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# CREACIÓN AUTOMÁTICA DE TABLAS
# ============================================================================

# ELIMINADO (2026-08-26): Base.metadata.create_all(bind=engine) creaba
# directamente en Postgres cualquier tabla que SQLAlchemy detectara como
# "faltante", en paralelo a Alembic. En dev, con uvicorn --reload y el
# volumen bind-mount de ./backend, cualquier edición de un modelo (por
# ejemplo al agregar Favorito) dispara un reload que reimporta este módulo
# ANTES de que la migración de Alembic correspondiente llegue a correr,
# así que create_all() crea la tabla primero por su cuenta. Cuando el
# contenedor se reinicia y entrypoint.sh corre `alembic upgrade head`,
# Alembic todavía cree que esa migración está pendiente e intenta el mismo
# CREATE TABLE, y Postgres responde con "relation ya existe" — justo el
# crash-loop que viste en los logs con la tabla `favoritos`.
# Alembic (backend/alembic/versions/) ya es la única fuente de verdad del
# esquema en este proyecto; create_all() no debería seguir compitiendo con
# él. Si alguna vez hace falta recrear el esquema desde cero en un entorno
# nuevo, usa `alembic upgrade head`, no create_all().

# ============================================================================
# APP
# ============================================================================

app = FastAPI(
    title="Alik Tours API",
    description="API para gestión de hoteles y reservas",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ============================================================================
# OBSERVABILIDAD: SENTRY (monitoreo de errores)
# ============================================================================
# Sustituye a Prometheus/Grafana como herramienta de monitoreo. Captura en
# tiempo real las excepciones no controladas (y opcionalmente trazas de
# rendimiento) y las reporta al panel de Sentry.
#
# Solo se activa si SENTRY_DSN está definido en el entorno (ver
# app/core/config.py): sin DSN la app arranca igual, sin enviar nada — así
# el desarrollo local y la CI no requieren ni la cuenta ni la clave.
# El integrador de FastAPI registra los handlers para que el global
# exception_handler de abajo siga devolviendo HTTP 500 genérico al cliente.
if settings.SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        # Los 4xx (no-autenticado, recurso no encontrado, etc.) no son
        # errores: solo se reportan los 5xx y excepciones no controladas.
        ignore_errors=[],
    )
    logger.info("Sentry inicializado (SENTRY_DSN definido)")
else:
    logger.info("Sentry desactivado (no hay SENTRY_DSN en el entorno)")


@app.get("/health", tags=["Salud"])
def health_check(db: Session = Depends(get_db)):
    """Liveness/readiness check real (consulta la base de datos, no un valor
    fijo) — usado por el HEALTHCHECK del Dockerfile de producción y por
    cualquier balanceador/orquestador que necesite saber si el contenedor
    está listo para recibir tráfico."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "up"}
    except Exception as e:
        logger.error(f"Health check falló: {e}")
        return JSONResponse(status_code=503, content={"status": "error", "database": "down"})


# ============================================================================
# CORS
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=VERCEL_PREVIEW_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# MIDDLEWARES + MANEJADOR DE ERRORES GLOBAL
# ============================================================================
# La lógica de cada uno vive en su propio módulo (app/middlewares/ y
# app/core/error_handlers.py) -- acá solo se registran, en el mismo orden
# en el que se registraban cuando vivían embebidos en este archivo:
# seguridad (rate limiting + headers) -> manejador de errores -> logging.

app.middleware("http")(seguridad_middleware)
app.exception_handler(Exception)(global_exception_handler)
app.middleware("http")(log_requests)

# ============================================================================
# ROUTERS
# ============================================================================

app.include_router(auth_router)
app.include_router(hotel_router)
app.include_router(cliente_router)
app.include_router(reserva_router)
app.include_router(preferencias_router)
app.include_router(promociones_router)
app.include_router(contacto_router)
app.include_router(resena_route)
app.include_router(usuario_router)
app.include_router(roles_router)
app.include_router(permisos_router)
app.include_router(destino_router)
app.include_router(servicio_router)
app.include_router(solicitud_cancelacion_router)
app.include_router(favorito_router)
app.include_router(metodo_pago_guardado_router)
app.include_router(configuracion_router)
app.include_router(notificacion_router)
app.include_router(mensaje_chat_router)
app.include_router(empresa_router)
app.include_router(dashboard_router)
app.include_router(banner_router)
app.include_router(tema_router)
app.include_router(comunidad_router)

# ============================================================================
# ARCHIVOS ESTATICOS (fotos de perfil, etc.)
# ============================================================================

_UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "static", "uploads")
os.makedirs(os.path.join(_UPLOADS_DIR, "perfiles"), exist_ok=True)
os.makedirs(os.path.join(_UPLOADS_DIR, "comprobantes"), exist_ok=True)
# Capturas de pantalla adjuntas al chat admin<->cliente (mensaje_chat_route.py)
# -- guardar_imagen() ya crea este directorio sola si falta, pero se
# precrea aca igual que "perfiles"/"comprobantes" arriba, mismo criterio
# defensivo.
os.makedirs(os.path.join(_UPLOADS_DIR, "chat"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOADS_DIR), name="uploads")

# ============================================================================
# ENDPOINTS
# ============================================================================


@app.get("/")
def root():
    return {"message": "API Alik Tours funcionando"}
