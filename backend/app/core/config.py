import sys

from pydantic import ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str

    SECRET_KEY: str

    ALGORITHM: str

    ACCESS_TOKEN_EXPIRE_MINUTES: int

    REDIS_URL: str = "redis://redis:6379/0"

    # URL de conexión de Cloudinary (formato
    # cloudinary://API_KEY:API_SECRET@CLOUD_NAME, tal como la muestra el
    # dashboard de Cloudinary en "API Environment variable"). Opcional: si
    # se deja vacía, las fotos de perfil y los banners se guardan en disco
    # local exactamente como antes (ver app/core/image_storage.py) — así
    # `docker compose up --build` sigue funcionando de cero sin que nadie
    # tenga que crear una cuenta externa.
    CLOUDINARY_URL: str = ""

    # DSN de Sentry para monitoreo de errores. Vacío por defecto: si no se
    # define, el backend arranca igual pero sin reportar errores a Sentry
    # (ver app/main.py).  Formato: https://clave@ingest.sentry.io/12345
    SENTRY_DSN: str = ""
    # Porcentaje de transacciones (trazas con datos de rendimiento) que se
    # envían a Sentry, 0-1. 0 desactiva el tracing y solo manda errores.
    SENTRY_TRACES_SAMPLE_RATE: float = 0.0

    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str
    MAIL_PORT: int
    MAIL_SERVER: str
    MAIL_FROM_NAME: str
    MAIL_STARTTLS: bool = False
    MAIL_SSL_TLS: bool = False

    # API key de Brevo (Settings → SMTP y API → pestaña "API Keys" -- NO la
    # pestaña "SMTP" de MAIL_PASSWORD, son dos credenciales distintas en
    # Brevo aunque se generen ambas desde la misma sección). Opcional: sin
    # ella, send_email() sigue usando SMTP (smtplib) tal como siempre --
    # ver el comentario en app/core/mail.py sobre por qué hace falta esto
    # específicamente en Render (bloquea los puertos SMTP salientes en el
    # plan gratis desde septiembre de 2025, pero no el 443 de HTTPS).
    BREVO_API_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env")

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_debe_ser_fuerte(cls, v: str) -> str:
        # El backend NUNCA debe arrancar (ni en dev, ni en producción) con
        # un SECRET_KEY corto: con JWT firmado en HS256, un secret débil se
        # puede forzar por fuerza bruta en segundos y permite falsificar
        # tokens de admin (hallazgo crítico del plan de mejora, Fase 0).
        # Generar uno real con:
        #   python -c "import secrets; print(secrets.token_urlsafe(48))"
        if not v or len(v) < 32:
            raise ValueError(
                "SECRET_KEY es demasiado corta o está vacía (mínimo 32 caracteres). "
                'Genera una real con: python -c "import secrets; print(secrets.token_urlsafe(48))" '
                "y ponla en backend/.env (o en la variable de entorno del hosting real)."
            )
        return v


def _cargar_settings() -> Settings:
    """Carga la configuración y, si falta o sobra algo, explica qué hacer.

    Sin esto, una variable faltante tumbaba el arranque con un traceback
    largo de Pydantic. Ahora el proceso termina con un mensaje corto que
    dice qué variable falta, en qué archivo ponerla y dónde está el ejemplo.
    """
    try:
        return Settings()
    except ValidationError as error:
        lineas = []
        for e in error.errors():
            campo = ".".join(str(p) for p in e.get("loc", ())) or "configuración"
            if e.get("type") == "missing":
                lineas.append(f"  - {campo}: falta definirla")
            else:
                lineas.append(f"  - {campo}: {e.get('msg')}")
        mensaje = (
            "\n[AlekTours] No se pudo iniciar el backend: revisa las variables de entorno.\n"
            + "\n".join(lineas)
            + "\nCopia backend/.env.example a backend/.env (desarrollo) o defínelas en el hosting "
            "(Render: Environment). Guía: docs/entrega-final/04-despliegue-y-variables.md\n"
        )
        print(mensaje, file=sys.stderr)
        raise SystemExit(1) from None


settings = _cargar_settings()
