import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# echo=True imprimía en el log del servidor CADA consulta SQL con sus
# parámetros, incluidos los hashes de contraseña al registrar o iniciar
# sesión (hallazgo de la semana 6 del bootcamp, al leer el log de los tests
# de integración). Ahora solo se activa a propósito, para depurar en local.
SQL_ECHO = os.getenv("SQL_ECHO", "").lower() in ("1", "true", "si", "sí")
engine = create_engine(settings.DATABASE_URL, echo=SQL_ECHO)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# Importar todos los modelos DESPUÉS de crear Base
# Esto es necesario para que SQLAlchemy registre todas las tablas
from app.models import *  # noqa: F403, E402 -- necesario para registrar todas las tablas en Base.metadata
