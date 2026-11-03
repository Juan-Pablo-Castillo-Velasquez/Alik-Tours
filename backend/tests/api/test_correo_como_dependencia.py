"""El correo (SMTP) como dependencia externa del registro.

Autor (semana 5, capa BD, dependencia externa): Juan Pablo Castillo.

En el grupo de 3 nadie tiene la capa API esta semana, así que la
dependencia externa del backend la toma quien tiene BD. Tipo de doble:
FAKE de SMTP (ServidorSMTPFalso, tests/fakes.py) que deja los correos en
el fixture `buzon`. Se verifica que el correo sale con los datos
correctos, que NO sale cuando no debe, y que la app resiste si falla.
"""

import re
import threading

import pytest

from app.routes import auth_route
from tests.fakes import ServidorSMTPFalso

DATOS = {"username": "viajera", "correo_electronico": "viajera@correo.com", "password": "Clave123!"}


class _HiloSincrono(threading.Thread):
    """El registro manda el correo en un hilo aparte; aquí corre en el
    mismo hilo para que el test vea el resultado sin esperas."""

    def start(self):
        self.run()


@pytest.fixture(autouse=True)
def hilos_sincronos(monkeypatch):
    monkeypatch.setattr(auth_route.threading, "Thread", _HiloSincrono)


def _texto(correo):
    return "".join(p.get_payload(decode=True).decode("utf-8") for p in correo.walk() if not p.is_multipart())


def test_registrarse_envia_un_correo_de_verificacion_al_correo_registrado(client, buzon):
    r = client.post("/auth/register", json=DATOS)

    assert r.status_code == 201
    assert len(buzon) == 1
    assert buzon[0]["To"] == "viajera@correo.com"
    assert re.search(r"\b\d{6}\b", _texto(buzon[0])), "el correo debe traer el código de 6 dígitos"


def test_un_registro_rechazado_no_envia_ningun_correo(client, buzon):
    client.post("/auth/register", json=DATOS)
    buzon.clear()

    r = client.post("/auth/register", json=DATOS)  # mismo usuario y correo

    assert r.status_code == 409
    assert buzon == []


def test_si_el_servidor_de_correo_esta_caido_el_registro_igual_funciona(client, buzon, monkeypatch, db):
    from app.core import mail
    from app.models.user_model import Usuario

    caido = ServidorSMTPFalso(buzon, falla=True)
    monkeypatch.setattr(mail.smtplib, "SMTP", caido)

    r = client.post("/auth/register", json=DATOS)

    assert r.status_code == 201
    assert buzon == []
    # La cuenta quedó creada: la persona puede pedir que le reenvíen el código.
    assert db.query(Usuario).filter_by(correo_electronico="viajera@correo.com").count() == 1
