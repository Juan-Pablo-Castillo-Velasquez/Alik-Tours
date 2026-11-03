"""Endpoints cuya respuesta depende de lo que ya hay guardado.

Autor (semana 4, capa BD): Fernando Gutiérrez.

Duplicados (409), registros con dependientes que no se pueden borrar (409)
y el filtro de disponibilidad por fechas del buscador. La BD es SQLite en
memoria: cada test siembra exactamente los datos que necesita.
"""

from datetime import date

import pytest

from app.models.cliente_model import Cliente
from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion
from app.models.reserva_model import Reserva, ReservaHabitacion


@pytest.fixture
def admin(crear_usuario):
    _, headers = crear_usuario(roles=("admin",), con_cliente=False)
    return headers


@pytest.fixture
def hotel(db):
    tipo = TipoHabitacion(nombre_tipo="Doble", capacidad_personas=2)
    hotel = Hotel(nombre_hotel="Hotel Caribe", ciudad="Cartagena", pais="Colombia")
    db.add_all([tipo, hotel])
    db.commit()
    hotel.tipo_id = tipo.id_tipo_habitacion
    return hotel


def _habitacion(db, hotel, numero="101", estado="disponible"):
    hab = Habitacion(
        id_hotel=hotel.id_hotel,
        id_tipo_habitacion=hotel.tipo_id,
        numero_habitacion=numero,
        precio_noche=200000,
        estado=estado,
    )
    db.add(hab)
    db.commit()
    return hab


def _reservar(db, habitacion, desde, hasta, estado="confirmada"):
    cliente = Cliente(nombre="Ana", apellido="Pérez", cedula=f"cc-{desde}-{estado}", correo=f"{desde}{estado}@t.co")
    db.add(cliente)
    db.commit()
    reserva = Reserva(
        id_cliente=cliente.id_cliente, fecha_inicio=desde, fecha_fin=hasta, numero_personas=2, estado=estado
    )
    db.add(reserva)
    db.commit()
    db.add(
        ReservaHabitacion(
            id_reserva=reserva.id_reserva,
            id_habitacion=habitacion.id_habitacion,
            fecha_checkin=desde,
            fecha_checkout=hasta,
            precio_acordado=400000,
        )
    )
    db.commit()
    return reserva


class TestDuplicados:
    def test_numero_de_habitacion_repetido_en_el_mismo_hotel_responde_409(self, client, admin, db, hotel):
        # Arrange
        _habitacion(db, hotel, "101")
        # Act
        r = client.post(
            f"/api/hoteles/{hotel.id_hotel}/habitaciones",
            json={"id_tipo_habitacion": hotel.tipo_id, "numero_habitacion": "101", "precio_noche": 1},
            headers=admin,
        )
        # Assert: 409 Conflict (antes 400), con el formato de error del API
        assert r.status_code == 409
        assert r.json() == {"detail": "Ya existe habitación con ese número"}

    def test_el_mismo_numero_si_se_permite_en_otro_hotel(self, client, admin, db, hotel):
        _habitacion(db, hotel, "101")
        otro = Hotel(nombre_hotel="Hotel Sierra")
        db.add(otro)
        db.commit()

        r = client.post(
            f"/api/hoteles/{otro.id_hotel}/habitaciones",
            json={"id_tipo_habitacion": hotel.tipo_id, "numero_habitacion": "101", "precio_noche": 1},
            headers=admin,
        )

        assert r.status_code == 201

    def test_renombrar_una_habitacion_con_el_numero_de_otra_responde_409(self, client, admin, db, hotel):
        # Hallazgo: la restricción UNIQUE (hotel, número) reventaba como 500.
        _habitacion(db, hotel, "101")
        segunda = _habitacion(db, hotel, "102")

        r = client.put(
            f"/api/hoteles/habitaciones/{segunda.id_habitacion}", json={"numero_habitacion": "101"}, headers=admin
        )

        assert r.status_code == 409
        assert r.json() == {"detail": "Ya existe habitación con ese número"}

    def test_conservar_su_propio_numero_al_editar_no_es_un_duplicado(self, client, admin, db, hotel):
        hab = _habitacion(db, hotel, "101")

        r = client.put(
            f"/api/hoteles/habitaciones/{hab.id_habitacion}",
            json={"numero_habitacion": "101", "precio_noche": 300000},
            headers=admin,
        )

        assert r.status_code == 200
        assert r.json()["precio_noche"] == 300000

    def test_registrarse_con_un_correo_ya_usado_responde_409(self, client, db):
        datos = {"username": "ana", "correo_electronico": "ana@correo.com", "password": "Clave123!"}
        assert client.post("/auth/register", json=datos).status_code == 201

        r = client.post("/auth/register", json={**datos, "username": "ana2"})

        assert r.status_code == 409
        assert r.json() == {"detail": "El correo electrónico ya está registrado"}

    def test_registrarse_con_un_usuario_ya_usado_responde_409(self, client, db):
        datos = {"username": "ana", "correo_electronico": "ana@correo.com", "password": "Clave123!"}
        client.post("/auth/register", json=datos)

        r = client.post("/auth/register", json={**datos, "correo_electronico": "otra@correo.com"})

        assert r.status_code == 409
        assert r.json() == {"detail": "El nombre de usuario ya existe"}


class TestDependientes:
    def test_no_se_borra_un_hotel_que_tiene_habitaciones(self, client, admin, db, hotel):
        _habitacion(db, hotel, "101")

        r = client.delete(f"/api/hoteles/{hotel.id_hotel}", headers=admin)

        assert r.status_code == 409
        assert "1 habitación(es)" in r.json()["detail"]
        assert db.get(Hotel, hotel.id_hotel) is not None

    def test_no_se_borra_una_habitacion_con_reservas(self, client, admin, db, hotel):
        # Hallazgo: se borraba (y en PostgreSQL la llave foránea de
        # reserva_habitaciones la hacía reventar como 500).
        hab = _habitacion(db, hotel, "101")
        _reservar(db, hab, date(2026, 12, 1), date(2026, 12, 5))

        r = client.delete(f"/api/hoteles/habitaciones/{hab.id_habitacion}", headers=admin)

        assert r.status_code == 409
        assert "1 reserva(s)" in r.json()["detail"]
        assert db.get(Habitacion, hab.id_habitacion) is not None

    def test_una_habitacion_sin_reservas_si_se_borra(self, client, admin, db, hotel):
        hab = _habitacion(db, hotel, "101")

        r = client.delete(f"/api/hoteles/habitaciones/{hab.id_habitacion}", headers=admin)

        assert r.status_code == 200


class TestFiltroDeDisponibilidad:
    CHECKIN = "2026-12-10"
    CHECKOUT = "2026-12-15"

    def _buscar(self, client):
        r = client.get("/api/hoteles/", params={"fecha_checkin": self.CHECKIN, "fecha_checkout": self.CHECKOUT})
        assert r.status_code == 200
        return [h["nombre_hotel"] for h in r.json()]

    def test_un_hotel_con_su_unica_habitacion_ocupada_no_aparece(self, client, db, hotel):
        hab = _habitacion(db, hotel)
        _reservar(db, hab, date(2026, 12, 12), date(2026, 12, 14))

        assert self._buscar(client) == []

    def test_una_reserva_cancelada_no_ocupa_la_habitacion(self, client, db, hotel):
        hab = _habitacion(db, hotel)
        _reservar(db, hab, date(2026, 12, 12), date(2026, 12, 14), estado="cancelada")

        assert self._buscar(client) == ["Hotel Caribe"]

    def test_salir_el_dia_que_otro_llega_no_es_un_cruce(self, client, db, hotel):
        # Valor límite: la reserva existente termina justo el día del checkin.
        hab = _habitacion(db, hotel)
        _reservar(db, hab, date(2026, 12, 5), date(2026, 12, 10))

        assert self._buscar(client) == ["Hotel Caribe"]

    def test_una_habitacion_en_mantenimiento_no_cuenta_como_disponible(self, client, db, hotel):
        _habitacion(db, hotel, estado="mantenimiento")

        assert self._buscar(client) == []

    def test_la_busqueda_por_texto_encuentra_por_ciudad_sin_importar_mayusculas(self, client, db, hotel):
        db.add(Hotel(nombre_hotel="Hotel Sierra", ciudad="Santa Marta"))
        db.commit()

        r = client.get("/api/hoteles/", params={"q": "CARTAGENA"})

        assert [h["nombre_hotel"] for h in r.json()] == ["Hotel Caribe"]

    @pytest.mark.parametrize(
        "params",
        [
            {"fecha_checkin": "2026-12-10"},  # falta checkout
            {"fecha_checkout": "2026-12-15"},  # falta checkin
            {"fecha_checkin": "2026-12-15", "fecha_checkout": "2026-12-15"},  # mismo día
            {"fecha_checkin": "2026-12-15", "fecha_checkout": "2026-12-10"},  # al revés
        ],
    )
    def test_fechas_incompletas_o_invertidas_responden_400(self, client, params):
        r = client.get("/api/hoteles/", params=params)

        assert r.status_code == 400
        assert "fecha_checkout" in r.json()["detail"]
