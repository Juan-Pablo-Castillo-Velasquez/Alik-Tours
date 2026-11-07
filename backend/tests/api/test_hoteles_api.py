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


class TestFotosYDetallesDeHabitacion:
    """Fotos propias de la habitación y su información (descripción,
    tamaño, cama, vista, comodidades)."""

    @pytest.fixture
    def sin_archivos_reales(self, monkeypatch):
        from app.routes import hotel_route

        async def leer(*_a, **_k):
            return b"img", "png"

        guardadas = []
        monkeypatch.setattr(hotel_route, "validar_y_leer_archivo", leer)
        monkeypatch.setattr(
            hotel_route,
            "guardar_imagen",
            lambda *_a, **_k: guardadas.append(1) or f"/uploads/habitaciones-galeria/f{len(guardadas)}.png",
        )
        monkeypatch.setattr(hotel_route, "borrar_imagen", lambda *_a, **_k: None)

    def _habitacion(self, client, admin, tipo_doble, **extra):
        id_hotel = client.post("/api/hoteles/", json=_hotel(), headers=admin).json()["id_hotel"]
        return client.post(
            f"/api/hoteles/{id_hotel}/habitaciones",
            json={
                "id_tipo_habitacion": tipo_doble.id_tipo_habitacion,
                "numero_habitacion": "301",
                "precio_noche": 350000,
                **extra,
            },
            headers=admin,
        ).json()

    def test_la_habitacion_guarda_y_devuelve_sus_detalles(self, client, admin, tipo_doble):
        h = self._habitacion(
            client,
            admin,
            tipo_doble,
            descripcion="Con balcón al mar",
            tamano_m2=28,
            tipo_cama="1 King",
            vista="Mar",
            comodidades="Aire acondicionado\nMinibar",
        )

        listado = client.get(f"/api/hoteles/{h['id_hotel']}/habitaciones").json()[0]

        assert (listado["tamano_m2"], listado["tipo_cama"], listado["vista"]) == (28, "1 King", "Mar")
        assert listado["comodidades"] == "Aire acondicionado\nMinibar"
        assert listado["imagenes"] == []

    def test_tamano_cero_o_negativo_responde_422(self, client, admin, tipo_doble):
        id_hotel = client.post("/api/hoteles/", json=_hotel(), headers=admin).json()["id_hotel"]
        r = client.post(
            f"/api/hoteles/{id_hotel}/habitaciones",
            json={
                "id_tipo_habitacion": tipo_doble.id_tipo_habitacion,
                "numero_habitacion": "1",
                "precio_noche": 1,
                "tamano_m2": 0,
            },
            headers=admin,
        )
        assert r.status_code == 422

    def test_subir_fotos_y_borrar_una(self, client, admin, tipo_doble, sin_archivos_reales):
        h = self._habitacion(client, admin, tipo_doble)
        ruta = f"/api/hoteles/habitaciones/{h['id_habitacion']}/imagenes"

        f1 = client.post(ruta, files={"imagen": ("a.png", b"img", "image/png")}, headers=admin)
        f2 = client.post(ruta, files={"imagen": ("b.png", b"img", "image/png")}, headers=admin)
        assert (f1.status_code, f2.status_code) == (201, 201)
        assert (f1.json()["orden"], f2.json()["orden"]) == (1, 2)

        assert client.delete(f"{ruta}/{f1.json()['id_imagen']}", headers=admin).status_code == 200

        hotel = client.get(f"/api/hoteles/{h['id_hotel']}").json()
        fotos = hotel["habitaciones"][0]["imagenes"]
        assert [f["id_imagen"] for f in fotos] == [f2.json()["id_imagen"]]

    def test_no_se_borra_la_foto_de_otra_habitacion(self, client, admin, tipo_doble, sin_archivos_reales):
        h = self._habitacion(client, admin, tipo_doble)
        foto = client.post(
            f"/api/hoteles/habitaciones/{h['id_habitacion']}/imagenes",
            files={"imagen": ("a.png", b"img", "image/png")},
            headers=admin,
        ).json()

        r = client.delete(f"/api/hoteles/habitaciones/99999/imagenes/{foto['id_imagen']}", headers=admin)

        assert r.status_code == 404

    def test_un_cliente_no_puede_subir_fotos(self, client, admin, tipo_doble, crear_usuario):
        h = self._habitacion(client, admin, tipo_doble)
        _, cliente = crear_usuario()

        r = client.post(
            f"/api/hoteles/habitaciones/{h['id_habitacion']}/imagenes",
            files={"imagen": ("a.png", b"img", "image/png")},
            headers=cliente,
        )

        assert r.status_code == 403

    def test_ficha_completa_servicios_y_condiciones(self, client, admin, tipo_doble):
        h = self._habitacion(
            client,
            admin,
            tipo_doble,
            piso=4,
            tipo_bano="Privado con ducha",
            servicios=["wifi", "minibar", "wifi"],
            desayuno_incluido=True,
            permite_fumar=False,
        )

        assert h["servicios"] == ["wifi", "minibar"]  # sin duplicados
        assert (h["piso"], h["tipo_bano"]) == (4, "Privado con ducha")
        assert (h["desayuno_incluido"], h["permite_fumar"], h["admite_mascotas"]) == (True, False, None)

    def test_servicio_desconocido_responde_422(self, client, admin, tipo_doble):
        id_hotel = client.post("/api/hoteles/", json=_hotel(), headers=admin).json()["id_hotel"]
        r = client.post(
            f"/api/hoteles/{id_hotel}/habitaciones",
            json={
                "id_tipo_habitacion": tipo_doble.id_tipo_habitacion,
                "numero_habitacion": "1",
                "precio_noche": 1,
                "servicios": ["helipuerto"],
            },
            headers=admin,
        )
        assert r.status_code == 422

    def test_el_admin_puede_borrar_datos_de_la_ficha_con_null(self, client, admin, tipo_doble):
        h = self._habitacion(client, admin, tipo_doble, vista="Mar", servicios=["tv"], accesible=True)

        r = client.put(
            f"/api/hoteles/habitaciones/{h['id_habitacion']}",
            json={"vista": None, "servicios": None, "accesible": None, "precio_noche": None},
            headers=admin,
        )

        assert r.status_code == 200
        body = r.json()
        assert (body["vista"], body["servicios"], body["accesible"]) == (None, [], None)
        assert body["precio_noche"] == 350000  # obligatorio: el null se ignora

    def test_pie_de_foto_y_portada(self, client, admin, tipo_doble, sin_archivos_reales):
        h = self._habitacion(client, admin, tipo_doble)
        ruta = f"/api/hoteles/habitaciones/{h['id_habitacion']}/imagenes"
        f1 = client.post(ruta, files={"imagen": ("a.png", b"img", "image/png")}, headers=admin).json()
        f2 = client.post(ruta, files={"imagen": ("b.png", b"img", "image/png")}, headers=admin).json()

        r = client.patch(f"{ruta}/{f2['id_imagen']}", json={"descripcion": " Baño ", "portada": True}, headers=admin)

        assert r.status_code == 200
        fotos = client.get(f"/api/hoteles/{h['id_hotel']}").json()["habitaciones"][0]["imagenes"]
        assert [f["id_imagen"] for f in fotos] == [f2["id_imagen"], f1["id_imagen"]]
        assert fotos[0]["descripcion"] == "Baño"

    def test_cambiar_tipo_de_habitacion_y_tipo_inexistente(self, client, admin, tipo_doble):
        h = self._habitacion(client, admin, tipo_doble)
        ruta = f"/api/hoteles/habitaciones/{h['id_habitacion']}"

        assert client.put(ruta, json={"id_tipo_habitacion": 999999}, headers=admin).status_code == 404
        ok = client.put(ruta, json={"id_tipo_habitacion": tipo_doble.id_tipo_habitacion}, headers=admin)
        assert ok.status_code == 200
