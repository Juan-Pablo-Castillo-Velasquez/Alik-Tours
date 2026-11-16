"""Límite de intentos (rate limiting) por endpoint e IP.

Auditoría de producción (nov. 2026):
- Formularios públicos (contacto, corporativo) y escrituras de la comunidad
  no tenían límite: se podían usar para spam.
- Detrás del proxy de Render todos los usuarios llegaban con la MISMA IP y
  compartían el contador del login.
- Sin Redis, el límite se apagaba por completo.
"""

import pytest
import redis

from app.core import cache
from app.middlewares import security_middleware


def _contacto(i: int) -> dict:
    return {
        "nombre": "Ana Ríos",
        "correo": f"ana{i}@test.com",
        "telefono": "3001234567",
        "asunto": "Consulta de viaje",
        "mensaje": "Quiero cotizar un viaje a Cartagena para dos personas en diciembre.",
    }


def test_el_formulario_de_contacto_tiene_limite(client):
    respuestas = [client.post("/api/contacto", json=_contacto(i)).status_code for i in range(7)]
    assert 429 in respuestas
    assert respuestas.index(429) == 5  # 5 envíos permitidos en la ventana


def test_la_respuesta_429_dice_cuando_reintentar(client):
    for i in range(6):
        r = client.post("/api/contacto", json=_contacto(i))
    assert r.status_code == 429
    assert r.headers["retry-after"] == "600"


def test_leer_la_comunidad_no_se_limita(client):
    codigos = {client.get("/api/comunidad/publicaciones").status_code for _ in range(15)}
    assert 429 not in codigos


def test_cada_ip_real_tiene_su_propio_contador(client):
    """Detrás del proxy cuenta la IP de X-Forwarded-For (la última)."""
    for i in range(5):
        client.post("/api/contacto", json=_contacto(i), headers={"X-Forwarded-For": "200.1.1.1"})
    bloqueada = client.post("/api/contacto", json=_contacto(9), headers={"X-Forwarded-For": "200.1.1.1"})
    otra = client.post("/api/contacto", json=_contacto(10), headers={"X-Forwarded-For": "200.2.2.2"})
    assert bloqueada.status_code == 429
    assert otra.status_code != 429


def test_falsificar_x_forwarded_for_no_evade_el_limite(client):
    """El cliente puede anteponer IPs inventadas, pero el proxy agrega la real
    al final: esa es la que se usa."""
    for i in range(5):
        client.post("/api/contacto", json=_contacto(i), headers={"X-Forwarded-For": f"9.9.9.{i}, 200.1.1.1"})
    r = client.post("/api/contacto", json=_contacto(99), headers={"X-Forwarded-For": "8.8.8.8, 200.1.1.1"})
    assert r.status_code == 429


def test_sin_redis_el_limite_sigue_funcionando(client, monkeypatch):
    class RedisCaido:
        def incr(self, *a):
            raise redis.exceptions.ConnectionError("caído")

        def __getattr__(self, nombre):
            raise redis.exceptions.ConnectionError("caído")

    monkeypatch.setattr(security_middleware, "redis_client", RedisCaido())
    monkeypatch.setattr(cache, "redis_client", RedisCaido())
    codigos = [
        client.post("/auth/login", json={"username": "nadie@test.com", "password": "Clave1234"}).status_code
        for _ in range(7)
    ]
    assert 429 in codigos


@pytest.mark.parametrize(
    ("metodo", "ruta", "bucket"),
    [
        ("POST", "/api/reservas", "/crear-reserva"),
        ("POST", "/api/reservas/12/pagar", "/pagar"),
        ("POST", "/api/reservas/12/solicitud-cancelacion", "/cancelacion"),
        ("POST", "/api/pagos/3/comprobante", "/comprobante"),
        ("POST", "/api/comunidad/publicaciones", "/publicar"),
        ("POST", "/api/comunidad/publicaciones/4/comentarios", "/comentar"),
        ("POST", "/api/resenas", "/resena"),
        ("POST", "/api/solicitudes-corporativas", "/corporativo"),
    ],
)
def test_escrituras_sensibles_tienen_regla(metodo, ruta, bucket):
    assert security_middleware._rate_limit_base_config_for(ruta, metodo)[0] == bucket


@pytest.mark.parametrize(
    ("metodo", "ruta"),
    [("GET", "/api/comunidad/publicaciones"), ("GET", "/api/reservas/12"), ("GET", "/api/hoteles/")],
)
def test_las_lecturas_no_tienen_regla(metodo, ruta):
    assert security_middleware._rate_limit_base_config_for(ruta, metodo) is None


# ─── Validaciones: solo espacios ya no es un dato válido ────────────────────


@pytest.mark.parametrize(
    "cambios",
    [{"nombre": "    "}, {"asunto": "     "}, {"mensaje": "              "}],
)
def test_contacto_rechaza_campos_con_solo_espacios(client, cambios):
    r = client.post("/api/contacto", json={**_contacto(1), **cambios})
    assert r.status_code == 422


def test_contacto_guarda_los_textos_sin_espacios_sobrantes(client, monkeypatch):
    recibido = {}

    def falso(nombre, correo, asunto, mensaje):
        recibido.update(nombre=nombre, asunto=asunto)

    class HiloInmediato:
        def __init__(self, target, args=(), kwargs=None, **_):
            self._t, self._a, self._k = target, args, kwargs or {}

        def start(self):
            self._t(*self._a, **self._k)

    monkeypatch.setattr("app.routes.contacto_route._enviar_contacto_en_hilo", falso)
    monkeypatch.setattr("app.routes.contacto_route.threading.Thread", HiloInmediato)
    r = client.post("/api/contacto", json={**_contacto(1), "nombre": "  Ana Ríos  ", "asunto": "  Hola agencia  "})
    assert r.status_code in (200, 201, 202)
    assert recibido == {"nombre": "Ana Ríos", "asunto": "Hola agencia"}


def test_publicar_en_la_comunidad_con_titulo_de_espacios(client, crear_usuario):
    _, headers = crear_usuario()
    r = client.post(
        "/api/comunidad/publicaciones",
        data={"titulo": "      ", "contenido": "Un viaje increíble por el Caribe colombiano."},
        headers=headers,
    )
    assert r.status_code == 422
