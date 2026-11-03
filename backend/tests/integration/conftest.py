"""Integración contra PostgreSQL REAL (semana 6 del bootcamp).

Estos tests solo corren si TEST_DATABASE_URL apunta a la BD de pruebas
(docker-compose.test.yml, puerto 5433). Sin esa variable se SALTAN: el CI
de unitarias sigue en verde sin base de datos. Se usa una variable propia
(y no DATABASE_URL) para que nadie los corra por error contra la BD de
desarrollo, que la app ya lee de DATABASE_URL.

Limpieza: TRANSACCIÓN CON ROLLBACK. Cada test abre una transacción en su
propia conexión, la sesión de la app trabaja dentro de ella con
SAVEPOINTs (join_transaction_mode="create_savepoint": los commit() de las
rutas y repositorios solo liberan un savepoint) y al final todo se
deshace. Se eligió en vez de TRUNCATE porque las migraciones siembran
datos que la app necesita (roles, tipos de habitación, métodos de pago):
truncar los borraría y habría que volver a sembrarlos antes de cada test.
"""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.database import get_db

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


def pytest_collection_modifyitems(config, items):
    if TEST_DATABASE_URL:
        return
    saltar = pytest.mark.skip(reason="TEST_DATABASE_URL no definida: se salta la integración con PostgreSQL")
    for item in items:
        if "integration" in item.path.parts:
            item.add_marker(saltar)


@pytest.fixture(scope="session")
def motor_real():
    motor = create_engine(TEST_DATABASE_URL)
    yield motor
    motor.dispose()


@pytest.fixture
def db_real(motor_real):
    conexion = motor_real.connect()
    transaccion = conexion.begin()
    sesion = Session(bind=conexion, join_transaction_mode="create_savepoint", autoflush=False)
    yield sesion
    sesion.close()
    transaccion.rollback()
    conexion.close()


@pytest.fixture
def client_real(db_real):
    from app.main import app

    def _get_db_real():
        yield db_real

    app.dependency_overrides[get_db] = _get_db_real
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()
