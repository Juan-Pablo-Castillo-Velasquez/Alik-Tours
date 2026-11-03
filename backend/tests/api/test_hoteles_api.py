"""API del recurso principal: hoteles y sus habitaciones (CRUD del panel).

Autor (semana 4, capa API): Cristian Sinisterra.

Cada endpoint se prueba en sus tres escenarios: caso feliz, datos
inválidos (422) e inexistente (404). La BD es SQLite en memoria (fixture
`client` de conftest.py): ningún test depende de datos previos.
"""

import pytest

from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion


@pytest.fixture
def admin(crear_usuario):
    _, headers = crear_usuario(roles=("admin",), con_cliente=False)
    return headers


@pytest.fixture
def tipo_doble(db):
    tipo = TipoHabitacion(nombre_tipo="Doble", descripcion="Dos personas", capacidad_personas=2)
    db.add(tipo)
    db.commit()
    return tipo


def _hotel(**cambios):
    datos = {
        "nombre_hotel": "Hotel Caribe",
        "calificacion": 4,
        "ciudad": "Cartagena",
        "pais": "Colombia",
        "direccion": "Cra 1 #2-3",
        "telefono": "6056650155",
        "correo_electronico": "reservas@hotelcaribe.co",
    }
    datos.update(cambios)
    return datos


class TestCrearHotel:
    def test_crea_el_hotel_y_responde_201_con_json(self, client, admin):
        # Act
        r = client.post("/api/hoteles/", json=_hotel(), headers=admin)
        # Assert: código, tipo de contenido y cuerpo
        assert r.status_code == 201
        assert r.headers["content-type"] == "application/json"
        cuerpo = r.json()
        assert cuerpo["id_hotel"] > 0
        assert cuerpo["nombre_hotel"] == "Hotel Caribe"
        assert cuerpo["ciudad"] == "Cartagena"

    def test_el_hotel_creado_se_puede_consultar(self, client, admin):
        id_hotel = client.post("/api/hoteles/", json=_hotel(), headers=admin).json()["id_hotel"]

        r = client.get(f"/api/hoteles/{id_hotel}")

        assert r.status_code == 200
        assert r.json()["nombre_hotel"] == "Hotel Caribe"

    def test_crea_hotel_y_habitaciones_en_la_misma_operacion(self, client, admin, tipo_doble, db):
        habitaciones = [
            {"id_tipo_habitacion": tipo_doble.id_tipo_habitacion, "numero_habitacion": "101", "precio_noche": 250000},
            {"id_tipo_habitacion": tipo_doble.id_tipo_habitacion, "numero_habitacion": "102", "precio_noche": 260000},
        ]

        r = client.post("/api/hoteles/", json=_hotel(habitaciones=habitaciones), headers=admin)

        assert r.status_code == 201
        assert db.query(Habitacion).filter(Habitacion.id_hotel == r.json()["id_hotel"]).count() == 2

    @pytest.mark.parametrize(
        ("cambio", "campo"),
        [
            ({"nombre_hotel": ""}, "nombre_hotel"),
            ({"calificacion": 6}, "calificacion"),  # máximo 5 estrellas
            ({"calificacion": 0}, "calificacion"),  # mínimo 1
            ({"nombre_hotel": "x" * 101}, "nombre_hotel"),  # máximo 100 caracteres
        ],
    )
    def test_datos_invalidos_responden_422_indicando_el_campo(self, client, admin, cambio, campo):
        r = client.post("/api/hoteles/", json=_hotel(**cambio), headers=admin)

        assert r.status_code == 422
        campos = [e["loc"][-1] for e in r.json()["detail"]]
        assert campo in campos

    def test_habitacion_con_tipo_inexistente_no_guarda_nada(self, client, admin, db):
        habitaciones = [{"id_tipo_habitacion": 999, "numero_habitacion": "101", "precio_noche": 100000}]

        r = client.post("/api/hoteles/", json=_hotel(habitaciones=habitaciones), headers=admin)

        assert r.status_code == 422
        assert r.json() == {"detail": "Tipo de habitación inexistente: [999]"}
        assert db.query(Hotel).count() == 0  # ni el hotel quedó a medio crear

    def test_numeros_de_habitacion_repetidos_en_el_mismo_hotel_se_rechazan(self, client, admin, tipo_doble):
        habitaciones = [
            {"id_tipo_habitacion": tipo_doble.id_tipo_habitacion, "numero_habitacion": "101", "precio_noche": 1},
            {"id_tipo_habitacion": tipo_doble.id_tipo_habitacion, "numero_habitacion": " 101 ", "precio_noche": 1},
        ]

        r = client.post("/api/hoteles/", json=_hotel(habitaciones=habitaciones), headers=admin)

        assert r.status_code == 422
        assert "repetidos" in r.text


class TestConsultarActualizarEliminarHotel:
    def test_un_hotel_inexistente_responde_404(self, client):
        r = client.get("/api/hoteles/999")

        assert r.status_code == 404
        assert r.json() == {"detail": "Hotel no encontrado"}

    def test_actualiza_solo_los_campos_enviados(self, client, admin):
        id_hotel = client.post("/api/hoteles/", json=_hotel(), headers=admin).json()["id_hotel"]

        r = client.put(f"/api/hoteles/{id_hotel}", json={"calificacion": 5}, headers=admin)

        assert r.status_code == 200
        assert r.json()["calificacion"] == 5
        assert r.json()["nombre_hotel"] == "Hotel Caribe"

    def test_actualizar_un_hotel_inexistente_responde_404(self, client, admin):
        r = client.put("/api/hoteles/999", json={"calificacion": 5}, headers=admin)

        assert r.status_code == 404

    def test_elimina_un_hotel_sin_dependencias(self, client, admin):
        id_hotel = client.post("/api/hoteles/", json=_hotel(), headers=admin).json()["id_hotel"]

        r = client.delete(f"/api/hoteles/{id_hotel}", headers=admin)

        assert r.status_code == 200
        assert client.get(f"/api/hoteles/{id_hotel}").status_code == 404

    def test_eliminar_un_hotel_inexistente_responde_404(self, client, admin):
        assert client.delete("/api/hoteles/999", headers=admin).status_code == 404

    def test_el_listado_publico_muestra_el_hotel_nuevo(self, client, admin):
        client.post("/api/hoteles/", json=_hotel(nombre_hotel="Hotel Sierra"), headers=admin)

        r = client.get("/api/hoteles/")

        assert r.status_code == 200
        assert [h["nombre_hotel"] for h in r.json()] == ["Hotel Sierra"]


class TestHabitaciones:
    def test_agrega_una_habitacion_a_un_hotel(self, client, admin, tipo_doble):
        id_hotel = client.post("/api/hoteles/", json=_hotel(), headers=admin).json()["id_hotel"]

        r = client.post(
            f"/api/hoteles/{id_hotel}/habitaciones",
            json={
                "id_tipo_habitacion": tipo_doble.id_tipo_habitacion,
                "numero_habitacion": "201",
                "precio_noche": 300000,
            },
            headers=admin,
        )

        assert r.status_code == 201
        assert r.json()["id_hotel"] == id_hotel
        listado = client.get(f"/api/hoteles/{id_hotel}/habitaciones").json()
        assert [h["numero_habitacion"] for h in listado] == ["201"]

    def test_habitacion_con_precio_negativo_responde_422(self, client, admin, tipo_doble):
        id_hotel = client.post("/api/hoteles/", json=_hotel(), headers=admin).json()["id_hotel"]

        r = client.post(
            f"/api/hoteles/{id_hotel}/habitaciones",
            json={"id_tipo_habitacion": tipo_doble.id_tipo_habitacion, "numero_habitacion": "201", "precio_noche": -1},
            headers=admin,
        )

        assert r.status_code == 422

    def test_habitacion_en_un_hotel_inexistente_responde_404(self, client, admin, tipo_doble):
        r = client.post(
            "/api/hoteles/999/habitaciones",
            json={"id_tipo_habitacion": tipo_doble.id_tipo_habitacion, "numero_habitacion": "201", "precio_noche": 1},
            headers=admin,
        )

        assert r.status_code == 404

    def test_una_habitacion_inexistente_responde_404(self, client):
        assert client.get("/api/hoteles/habitaciones/999").status_code == 404

    def test_eliminar_una_habitacion_inexistente_responde_404(self, client, admin):
        # Hallazgo de la semana 4: respondía 200 "Habitación eliminada
        # exitosamente" aunque no existiera ninguna habitación con ese id.
        r = client.delete("/api/hoteles/habitaciones/999", headers=admin)

        assert r.status_code == 404
        assert r.json() == {"detail": "Habitación no encontrada"}
