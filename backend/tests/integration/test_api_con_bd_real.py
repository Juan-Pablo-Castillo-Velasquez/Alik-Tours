"""Endpoints completos contra PostgreSQL 16 real.

Autor (semana 6, capa API): Juan Pablo Castillo.

El caso feliz se verifica EN LA BD (no solo en la respuesta) y se prueba
qué responde el API cuando un dato choca con una restricción de la tabla.
Todo lo que respondía 500 fue un hallazgo y se corrigió en el esquema
(ver tests/unit/test_limites_de_esquemas.py).
"""

from datetime import date

import pytest
from sqlalchemy import text

from app.core.security import create_access_token
from app.models.cliente_model import Cliente
from app.models.hotel_model import Habitacion, Hotel
from app.models.reserva_model import Reserva, ReservaHabitacion
from app.models.user_model import Usuario

MARCA = "ApiPG"


@pytest.fixture
def admin():
    token = create_access_token(data={"sub": "1", "roles": ["admin"]})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def id_tipo(db_real):
    # Los tipos de habitación los siembran las migraciones (datos reales).
    return db_real.execute(text("SELECT MIN(id_tipo_habitacion) FROM tipo_habitacion")).scalar_one()


def _crear_hotel(client_real, admin, id_tipo, numeros=("101",)):
    habitaciones = [{"id_tipo_habitacion": id_tipo, "numero_habitacion": n, "precio_noche": 300000} for n in numeros]
    r = client_real.post(
        "/api/hoteles/",
        json={"nombre_hotel": f"{MARCA} Hotel Caribe", "ciudad": "Cartagena", "habitaciones": habitaciones},
        headers=admin,
    )
    assert r.status_code == 201, r.text
    return r.json()["id_hotel"]


class TestCrearHotel:
    def test_el_hotel_y_sus_habitaciones_quedan_guardados_en_la_bd(self, client_real, db_real, admin, id_tipo):
        # Act
        id_hotel = _crear_hotel(client_real, admin, id_tipo, numeros=("101", "102"))
        # Assert: en PostgreSQL, no en la respuesta
        hotel = db_real.get(Hotel, id_hotel)
        assert hotel.nombre_hotel == f"{MARCA} Hotel Caribe"
        filas = db_real.query(Habitacion).filter_by(id_hotel=id_hotel).order_by(Habitacion.numero_habitacion).all()
        assert [(h.numero_habitacion, float(h.precio_noche), h.estado) for h in filas] == [
            ("101", 300000.0, "disponible"),
            ("102", 300000.0, "disponible"),
        ]

    def test_con_un_tipo_de_habitacion_inexistente_no_queda_nada_en_la_bd(self, client_real, db_real, admin):
        antes = db_real.query(Hotel).count()

        r = client_real.post(
            "/api/hoteles/",
            json={
                "nombre_hotel": f"{MARCA} Fantasma",
                "habitaciones": [{"id_tipo_habitacion": 999999, "numero_habitacion": "1", "precio_noche": 1}],
            },
            headers=admin,
        )

        assert r.status_code == 422
        assert db_real.query(Hotel).count() == antes


class TestRestriccionesVistasDesdeElApi:
    def test_editar_el_hotel_con_un_nombre_mas_largo_que_la_columna_responde_422(self, client_real, admin, id_tipo):
        # Hallazgo: VARCHAR(100) en la BD, sin límite en HotelUpdate -> 500.
        id_hotel = _crear_hotel(client_real, admin, id_tipo)

        r = client_real.put(f"/api/hoteles/{id_hotel}", json={"nombre_hotel": "x" * 101}, headers=admin)

        assert r.status_code == 422
        assert r.json()["detail"][0]["loc"] == ["body", "nombre_hotel"]

    def test_renombrar_una_habitacion_con_un_numero_demasiado_largo_responde_422(
        self, client_real, db_real, admin, id_tipo
    ):
        id_hotel = _crear_hotel(client_real, admin, id_tipo)
        hab = db_real.query(Habitacion).filter_by(id_hotel=id_hotel).one()

        r = client_real.put(
            f"/api/hoteles/habitaciones/{hab.id_habitacion}", json={"numero_habitacion": "9" * 21}, headers=admin
        )

        assert r.status_code == 422

    def test_renombrar_con_el_numero_de_otra_habitacion_responde_409_tambien_en_postgres(
        self, client_real, db_real, admin, id_tipo
    ):
        id_hotel = _crear_hotel(client_real, admin, id_tipo, numeros=("101", "102"))
        hab_102 = db_real.query(Habitacion).filter_by(id_hotel=id_hotel, numero_habitacion="102").one()

        r = client_real.put(
            f"/api/hoteles/habitaciones/{hab_102.id_habitacion}", json={"numero_habitacion": "101"}, headers=admin
        )

        assert r.status_code == 409

    def test_borrar_una_habitacion_con_reservas_responde_409_y_no_rompe_la_llave_foranea(
        self, client_real, db_real, admin, id_tipo
    ):
        id_hotel = _crear_hotel(client_real, admin, id_tipo)
        hab = db_real.query(Habitacion).filter_by(id_hotel=id_hotel).one()
        cliente = Cliente(nombre="Ana", apellido=MARCA, cedula=f"{MARCA}-1", correo=f"{MARCA.lower()}@t.co")
        db_real.add(cliente)
        db_real.flush()
        reserva = Reserva(id_cliente=cliente.id_cliente, numero_personas=2, estado="confirmada")
        db_real.add(reserva)
        db_real.flush()
        db_real.add(
            ReservaHabitacion(
                id_reserva=reserva.id_reserva,
                id_habitacion=hab.id_habitacion,
                fecha_checkin=date(2030, 2, 1),
                fecha_checkout=date(2030, 2, 3),
                precio_acordado=600000,
            )
        )
        db_real.flush()

        r = client_real.delete(f"/api/hoteles/habitaciones/{hab.id_habitacion}", headers=admin)

        assert r.status_code == 409
        assert db_real.get(Habitacion, hab.id_habitacion) is not None


class TestRegistro:
    def test_registrarse_guarda_la_cuenta_sin_verificar_con_rol_cliente(self, client_real, db_real):
        correo = f"{MARCA.lower()}.registro@correo.com"

        r = client_real.post(
            "/auth/register", json={"username": f"{MARCA}user", "correo_electronico": correo, "password": "Clave123"}
        )

        assert r.status_code == 201
        usuario = db_real.query(Usuario).filter_by(correo_electronico=correo).one()
        assert usuario.verificado is False
        assert usuario.password_hash != "Clave123"
        roles = (
            db_real.execute(
                text(
                    "SELECT r.nombre_rol FROM usuarios_roles ur JOIN roles r ON r.id_rol = ur.id_rol WHERE ur.id_usuario = :u"
                ),
                {"u": usuario.id_usuario},
            )
            .scalars()
            .all()
        )
        assert roles == ["cliente"]

    def test_un_nombre_de_usuario_mas_largo_que_la_columna_responde_422_y_no_500(self, client_real):
        # Hallazgo: usuarios.username es VARCHAR(50); con 51 caracteres el
        # registro (público, sin sesión) respondía 500.
        r = client_real.post(
            "/auth/register",
            json={"username": "u" * 51, "correo_electronico": "largo@correo.com", "password": "Clave123"},
        )

        assert r.status_code == 422

    def test_una_contrasena_debil_se_rechaza_aunque_se_llame_al_api_directo(self, client_real):
        # Hallazgo de seguridad: la regla solo existía en el formulario.
        r = client_real.post(
            "/auth/register", json={"username": "debil", "correo_electronico": "debil@correo.com", "password": "1"}
        )

        assert r.status_code == 422


def test_paquetes_populares_funciona_con_la_vista_real(client_real):
    # En SQLite este endpoint da 500 porque la vista vista_paquetes_populares
    # solo existe en PostgreSQL (la crea una migración): no era un defecto.
    r = client_real.get("/api/paquetes/populares")

    assert r.status_code == 200
    assert isinstance(r.json(), list)
