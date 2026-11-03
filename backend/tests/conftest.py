"""
Fixtures compartidas por toda la suite de tests del backend.

Motor SQLite en memoria + fixture `db` por test, extraído de la
duplicación exacta que tenían test_delete_exceptions.py,
test_destino_servicio_delete.py, test_reservas_pagos.py y
test_verificacion_email.py antes de esta reorganización -- cada uno
definía su propio engine, su propio parche ARRAY->JSON y su propia
fixture `db`, palabra por palabra iguales. Con esto centralizado acá,
cada archivo de test solo necesita importar los modelos/repositorios/
rutas que usa de verdad en sus casos, no copiar 15 líneas de setup.

`from app.models import *` importa (y por lo tanto registra en el mapper
de SQLAlchemy) TODOS los modelos de la app antes de armar las tablas --
sin esto, configurar cualquier mapper revienta con "failed to locate a
name" apenas se toca una relationship() que apunte a una clase que ningún
test individual haya importado (mismo import que usa
app/core/database.py para construir su propio Base.metadata).
"""

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy import ARRAY, create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.models import *  # noqa: F401, F403
from app.models.cliente_model import Cliente
from app.models.user_model import Usuario
from tests.fakes import RedisEnMemoria

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
# StaticPool (semana 4 del bootcamp): TestClient ejecuta las rutas síncronas
# en OTRO hilo. Con el pool por defecto de SQLite en memoria, cada hilo
# abría su propia conexión, es decir, una BD vacía distinta: la ruta no veía
# lo que el test acababa de insertar. Con StaticPool todos comparten una.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# SQLite no soporta ARRAY (usado en preferencias_cliente.intereses --
# ARRAY(String) genérico de sqlalchemy, no el de postgresql.dialects). Se
# cambia a JSON solo para este motor de pruebas en memoria.
for table in Base.metadata.tables.values():
    for column in table.columns:
        if isinstance(column.type, ARRAY):
            column.type = sa.JSON()

Base.metadata.create_all(bind=engine)


@pytest.fixture
def db():
    """Base de datos SQLite en memoria fresca para cada test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.rollback()
    # Hallazgo de la semana 1 (bootcamp): un test de test_mensajes_chat.py
    # activa "PRAGMA foreign_keys=ON" para probar un ON DELETE CASCADE, y
    # como el motor en memoria reutiliza LA MISMA conexión en toda la
    # suite, el PRAGMA quedaba prendido para los tests siguientes:
    # test_reservas_pagos.py fallaba (15 tests) al correr la suite
    # completa, pero pasaba en verde corriendo ese archivo solo. Cada test
    # debe dejar la BD como la encontró (FIRST: Independent).
    session.execute(text("PRAGMA foreign_keys=OFF"))
    session.close()
    Base.metadata.drop_all(bind=engine)


# ─── Pruebas de API (semana 4) ────────────────────────────────────────────
# El API real (app.main.app) con la BD aislada: la dependencia get_db se
# reemplaza por la sesión SQLite en memoria del test. Ningún test de API
# toca PostgreSQL ni necesita datos previos.


@pytest.fixture
def client(db):
    from app.main import app

    def _get_db_de_prueba():
        yield db

    app.dependency_overrides[get_db] = _get_db_de_prueba
    # raise_server_exceptions=False: un error no controlado llega como la
    # respuesta 500 que vería el frontend, no como excepción del test.
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def redis_falso(monkeypatch):
    """Cada test usa un Redis en memoria vacío (ver tests/fakes.py), nunca
    el Redis real del CI o de docker compose. Se reemplaza en los tres
    módulos que guardan su propia referencia a redis_client."""
    falso = RedisEnMemoria()
    monkeypatch.setattr("app.core.cache.redis_client", falso)
    monkeypatch.setattr("app.middlewares.security_middleware.redis_client", falso)
    monkeypatch.setattr("app.routes.resena_route.redis_client", falso)
    return falso


@pytest.fixture
def crear_usuario(db):
    """Crea un usuario (opcionalmente con su perfil de cliente) y devuelve
    (usuario, headers) con un JWT válido con los roles pedidos."""
    contador = {"n": 0}

    def _crear(roles=("cliente",), con_cliente=True, activo=True):
        contador["n"] += 1
        n = contador["n"]
        cliente = None
        if con_cliente:
            cliente = Cliente(
                nombre="Cliente", apellido=f"Prueba{n}", cedula=f"10000000{n:02d}", correo=f"c{n}@test.com"
            )
            db.add(cliente)
            db.commit()
        usuario = Usuario(
            username=f"usuario{n}",
            correo_electronico=f"usuario{n}@test.com",
            password_hash="no-se-usa-en-estos-tests",
            id_cliente=cliente.id_cliente if cliente else None,
            activo=activo,
            verificado=True,
        )
        db.add(usuario)
        db.commit()
        db.refresh(usuario)
        token = create_access_token(data={"sub": str(usuario.id_usuario), "roles": list(roles)})
        return usuario, {"Authorization": f"Bearer {token}"}

    return _crear
