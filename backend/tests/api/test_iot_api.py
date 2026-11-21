"""Prototipo IoT: un dispositivo registrado en el panel envía lecturas por
HTTP con su clave (X-Device-Key) y el panel ve su estado y su historial."""

import pytest


@pytest.fixture
def admin(crear_usuario):
    return crear_usuario(roles=("admin",), con_cliente=False)[1]


@pytest.fixture
def dispositivo(client, admin):
    r = client.post(
        "/api/iot/dispositivos", json={"nombre": "Van 01", "descripcion": "Traslados Cartagena"}, headers=admin
    )
    assert r.status_code == 201, r.text
    return r.json()


def _enviar(client, clave, **datos):
    return client.post("/api/iot/lecturas", json=datos, headers={"X-Device-Key": clave})


class TestDispositivoEnvia:
    def test_crear_dispositivo_entrega_la_clave_una_sola_vez(self, client, admin, dispositivo):
        assert len(dispositivo["clave"]) >= 40
        assert dispositivo["estado"] == "sin_datos"
        listado = client.get("/api/iot/dispositivos", headers=admin).json()
        assert "clave" not in listado[0]

    def test_lectura_valida_se_guarda_y_pone_en_linea(self, client, admin, dispositivo):
        r = _enviar(client, dispositivo["clave"], latitud=10.42, longitud=-75.54, velocidad_kmh=42, temperatura_c=24.5)
        assert r.status_code == 201, r.text
        assert r.json()["alertas"] == []
        d = client.get("/api/iot/dispositivos", headers=admin).json()[0]
        assert d["estado"] == "en_linea"
        assert d["ultima_lectura"]["temperatura_c"] == 24.5

    def test_alertas_de_temperatura_velocidad_y_bateria(self, client, dispositivo):
        r = _enviar(client, dispositivo["clave"], temperatura_c=31, velocidad_kmh=120, bateria_pct=9)
        assert r.status_code == 201
        alertas = " ".join(r.json()["alertas"])
        assert "Temperatura" in alertas and "velocidad" in alertas and "Batería" in alertas

    def test_sin_clave_o_con_clave_falsa_es_401(self, client, dispositivo):
        assert client.post("/api/iot/lecturas", json={"temperatura_c": 20}).status_code == 401
        assert _enviar(client, "clave-inventada", temperatura_c=20).status_code == 401

    def test_dispositivo_desactivado_no_puede_enviar(self, client, admin, dispositivo):
        r = client.patch(f"/api/iot/dispositivos/{dispositivo['id_dispositivo']}/activo?activo=false", headers=admin)
        assert r.status_code == 200 and r.json()["activo"] is False
        assert _enviar(client, dispositivo["clave"], temperatura_c=20).status_code == 401

    @pytest.mark.parametrize(
        "datos",
        [
            {},
            {"latitud": 10.4},
            {"latitud": 95, "longitud": 0},
            {"temperatura_c": 200},
            {"pasajeros": -1},
            {"temperatura_c": 20, "campo_raro": 1},
        ],
    )
    def test_lecturas_invalidas_son_422(self, client, dispositivo, datos):
        assert _enviar(client, dispositivo["clave"], **datos).status_code == 422


class TestPanelIoT:
    def test_historial_en_orden_inverso_con_limite(self, client, admin, dispositivo):
        for t in (20, 21, 22):
            _enviar(client, dispositivo["clave"], temperatura_c=t)
        r = client.get(f"/api/iot/dispositivos/{dispositivo['id_dispositivo']}/lecturas?limite=2", headers=admin)
        assert [x["temperatura_c"] for x in r.json()] == [22, 21]

    def test_solo_admin_ve_el_panel(self, client, crear_usuario):
        cliente = crear_usuario()[1]
        assert client.get("/api/iot/dispositivos", headers=cliente).status_code == 403
        assert client.post("/api/iot/dispositivos", json={"nombre": "X1"}).status_code == 401

    def test_dispositivo_inexistente_es_404(self, client, admin):
        assert client.get("/api/iot/dispositivos/999/lecturas", headers=admin).status_code == 404
