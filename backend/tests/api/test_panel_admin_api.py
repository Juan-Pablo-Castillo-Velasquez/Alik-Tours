"""Panel de administración: parámetros, solicitudes corporativas,
notificaciones y favoritos.

Autor (semana 7, responsable del backend al 75%): Juan Pablo Castillo.
"""

import pytest

from app.models.hotel_model import Hotel
from app.models.notificacion_model import Notificacion


@pytest.fixture
def admin(crear_usuario):
    return crear_usuario(roles=("admin",), con_cliente=False)[1]


@pytest.fixture
def empleado(crear_usuario):
    return crear_usuario(roles=("empleado",), con_cliente=False)[1]


class TestConfiguracion:
    def test_crea_lista_actualiza_y_borra_un_parametro(self, client, admin):
        creado = client.post("/api/configuracion", json={"clave": "anticipo_pct", "valor": "30"}, headers=admin)
        assert creado.status_code == 201
        id_config = creado.json()["id_config"]

        assert [c["clave"] for c in client.get("/api/configuracion", headers=admin).json()] == ["anticipo_pct"]
        actualizado = client.put(f"/api/configuracion/{id_config}", json={"valor": "40"}, headers=admin)
        assert actualizado.json()["valor"] == "40"
        assert client.delete(f"/api/configuracion/{id_config}", headers=admin).status_code == 200
        assert client.get("/api/configuracion", headers=admin).json() == []

    def test_una_clave_repetida_responde_409(self, client, admin):
        client.post("/api/configuracion", json={"clave": "anticipo_pct", "valor": "30"}, headers=admin)

        r = client.post("/api/configuracion", json={"clave": "anticipo_pct", "valor": "50"}, headers=admin)

        assert r.status_code == 409

    def test_un_parametro_inexistente_responde_404(self, client, admin):
        assert client.put("/api/configuracion/999", json={"valor": "1"}, headers=admin).status_code == 404
        assert client.delete("/api/configuracion/999", headers=admin).status_code == 404


class TestSolicitudesCorporativas:
    DATOS = {
        "nombre_empresa": "Viajes Andinos SAS",
        "nombre_contacto": "Laura Gómez",
        "email_corporativo": "laura@andinos.co",
        "telefono": "6015551234",
        "mensaje": "Viaje de incentivos para 40 personas.",
    }

    def test_cualquiera_la_envia_y_le_llega_una_notificacion_al_admin(self, client, db):
        r = client.post("/api/solicitudes-corporativas", json=self.DATOS)

        assert r.status_code == 201
        assert r.json()["estado"] == "nuevo"
        assert db.query(Notificacion).count() == 1

    def test_el_admin_cambia_el_estado_y_rechaza_uno_inventado(self, client, admin):
        id_sol = client.post("/api/solicitudes-corporativas", json=self.DATOS).json()["id_solicitud"]

        assert (
            client.put(f"/api/solicitudes-corporativas/{id_sol}", json={"estado": "contactado"}, headers=admin).json()[
                "estado"
            ]
            == "contactado"
        )
        assert (
            client.put(f"/api/solicitudes-corporativas/{id_sol}", json={"estado": "volando"}, headers=admin).status_code
            == 422
        )
        assert [s["estado"] for s in client.get("/api/solicitudes-corporativas", headers=admin).json()] == [
            "contactado"
        ]

    def test_borrar_una_solicitud_y_404_si_no_existe(self, client, admin):
        id_sol = client.post("/api/solicitudes-corporativas", json=self.DATOS).json()["id_solicitud"]

        assert client.delete(f"/api/solicitudes-corporativas/{id_sol}", headers=admin).status_code == 200
        assert client.delete(f"/api/solicitudes-corporativas/{id_sol}", headers=admin).status_code == 404
        assert (
            client.put("/api/solicitudes-corporativas/999", json={"estado": "cerrado"}, headers=admin).status_code
            == 404
        )

    def test_un_telefono_demasiado_corto_responde_422(self, client):
        assert client.post("/api/solicitudes-corporativas", json={**self.DATOS, "telefono": "123"}).status_code == 422


class TestNotificaciones:
    @pytest.fixture
    def tres(self, db):
        db.add_all([Notificacion(tipo="contacto", titulo=f"Mensaje {i}") for i in range(3)])
        db.commit()
        return [n.id_notificacion for n in db.query(Notificacion).order_by(Notificacion.id_notificacion)]

    def test_un_empleado_ve_cuantas_hay_sin_leer_y_las_marca(self, client, empleado, tres):
        conteo = lambda: client.get("/api/notificaciones/no-leidas/conteo", headers=empleado).json()  # noqa: E731
        assert conteo() == {"total": 3}

        assert client.put(f"/api/notificaciones/{tres[0]}/leer", headers=empleado).json()["leido"] is True
        assert conteo() == {"total": 2}

        client.put("/api/notificaciones/leer-todas", headers=empleado)
        assert conteo() == {"total": 0}
        assert len(client.get("/api/notificaciones", headers=empleado).json()) == 3

    def test_solo_el_admin_borra_y_404_si_no_existe(self, client, admin, empleado, tres):
        assert client.delete(f"/api/notificaciones/{tres[0]}", headers=empleado).status_code == 403
        assert client.delete(f"/api/notificaciones/{tres[0]}", headers=admin).status_code == 200
        assert client.delete(f"/api/notificaciones/{tres[0]}", headers=admin).status_code == 404
        assert client.put("/api/notificaciones/999/leer", headers=empleado).status_code == 404


class TestFavoritos:
    @pytest.fixture
    def hotel(self, db):
        h = Hotel(nombre_hotel="Hotel Caribe", ciudad="Cartagena")
        db.add(h)
        db.commit()
        return h

    def test_un_cliente_guarda_lista_y_quita_un_favorito(self, client, crear_usuario, hotel):
        _, h = crear_usuario()

        assert client.post("/api/favoritos", json={"id_hotel": hotel.id_hotel}, headers=h).status_code == 201
        assert client.get("/api/favoritos/ids", headers=h).json() == [hotel.id_hotel]
        assert [f["hotel"]["nombre_hotel"] for f in client.get("/api/favoritos", headers=h).json()] == ["Hotel Caribe"]
        assert client.delete(f"/api/favoritos/{hotel.id_hotel}", headers=h).status_code == 204
        assert client.get("/api/favoritos/ids", headers=h).json() == []

    def test_guardar_dos_veces_el_mismo_hotel_no_lo_duplica(self, client, crear_usuario, hotel):
        _, h = crear_usuario()

        client.post("/api/favoritos", json={"id_hotel": hotel.id_hotel}, headers=h)
        client.post("/api/favoritos", json={"id_hotel": hotel.id_hotel}, headers=h)

        assert client.get("/api/favoritos/ids", headers=h).json() == [hotel.id_hotel]

    def test_errores_hotel_inexistente_y_no_favorito_responden_404(self, client, crear_usuario):
        _, h = crear_usuario()

        assert client.post("/api/favoritos", json={"id_hotel": 999}, headers=h).status_code == 404
        assert client.delete("/api/favoritos/999", headers=h).status_code == 404

    def test_una_cuenta_sin_perfil_de_cliente_no_puede_tener_favoritos(self, client, crear_usuario):
        _, h = crear_usuario(roles=("admin",), con_cliente=False)

        assert client.get("/api/favoritos/ids", headers=h).status_code == 403
