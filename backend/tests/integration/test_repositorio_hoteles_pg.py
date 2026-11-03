"""Repositorios de hoteles y habitaciones contra PostgreSQL 16 real.

Autor (semana 6, capa BD): Cristian Sinisterra.

Cada método del repositorio se ejecuta al menos una vez, con sus consultas
propias (filtros, orden, JOIN de disponibilidad), y cada restricción de la
tabla queda documentada con un test. Varias de estas cosas NO se pueden
ver con SQLite en memoria: allí no se validan llaves foráneas (PRAGMA
apagado), ni la longitud de VARCHAR, y el orden "natural" de las filas es
el de inserción.
"""

from datetime import date

import pytest
from sqlalchemy.exc import DataError, IntegrityError

from app.models.cliente_model import Cliente
from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion
from app.models.reserva_model import Reserva, ReservaHabitacion
from app.repositories.hotel_repository import HabitacionRepository, HotelRepository

MARCA = "IntegracionPG"  # todos los datos del test llevan esta marca


@pytest.fixture
def tipo(db_real):
    t = TipoHabitacion(nombre_tipo=f"{MARCA} Doble", capacidad_personas=2)
    db_real.add(t)
    db_real.flush()
    return t


@pytest.fixture
def hotel(db_real):
    return HotelRepository.create(db_real, {"nombre_hotel": f"{MARCA} Hotel Caribe", "ciudad": "Cartagena"})


def _habitacion(db, hotel, tipo, numero, estado="disponible"):
    return HabitacionRepository.create(
        db,
        {
            "id_hotel": hotel.id_hotel,
            "id_tipo_habitacion": tipo.id_tipo_habitacion,
            "numero_habitacion": numero,
            "precio_noche": 250000,
            "estado": estado,
        },
    )


class TestHotelRepository:
    def test_crear_consultar_actualizar_y_borrar(self, db_real):
        # create
        hotel = HotelRepository.create(db_real, {"nombre_hotel": f"{MARCA} Hotel Sierra", "ciudad": "Santa Marta"})
        assert hotel.id_hotel is not None
        # get_by_id
        assert HotelRepository.get_by_id(db_real, hotel.id_hotel).nombre_hotel == f"{MARCA} Hotel Sierra"
        # update
        HotelRepository.update(db_real, hotel.id_hotel, {"calificacion": 5})
        assert db_real.get(Hotel, hotel.id_hotel).calificacion == 5
        # delete (sin dependencias)
        HotelRepository.delete(db_real, hotel.id_hotel)
        assert db_real.get(Hotel, hotel.id_hotel) is None

    def test_get_all_filtra_por_texto_y_ordena_por_id(self, db_real):
        a = HotelRepository.create(db_real, {"nombre_hotel": f"{MARCA} Zeta", "ciudad": "Cali"})
        b = HotelRepository.create(db_real, {"nombre_hotel": f"{MARCA} Alfa", "ciudad": "Cali"})
        # En PostgreSQL un UPDATE escribe una versión nueva de la fila al
        # final de la tabla: sin ORDER BY, "a" saldría después de "b". (En
        # MySQL/InnoDB las filas salen por llave primaria y no se notaría.)
        HotelRepository.update(db_real, a.id_hotel, {"calificacion": 4})
        db_real.expire_all()

        encontrados = HotelRepository.get_all(db_real, limit=300, q=MARCA.lower())

        assert [h.id_hotel for h in encontrados] == [a.id_hotel, b.id_hotel]  # por id, no por nombre

    def test_get_all_pagina_con_skip_y_limit(self, db_real):
        ids = [HotelRepository.create(db_real, {"nombre_hotel": f"{MARCA} {n}"}).id_hotel for n in range(3)]

        pagina = HotelRepository.get_all(db_real, skip=1, limit=1, q=MARCA)

        assert [h.id_hotel for h in pagina] == [ids[1]]

    def test_disponibilidad_excluye_el_hotel_con_su_habitacion_reservada(self, db_real, hotel, tipo):
        hab = _habitacion(db_real, hotel, tipo, "101")
        cliente = Cliente(nombre="Ana", apellido=MARCA, cedula=f"{MARCA}-1", correo=f"{MARCA.lower()}@t.co")
        db_real.add(cliente)
        db_real.flush()
        reserva = Reserva(
            id_cliente=cliente.id_cliente,
            fecha_inicio=date(2030, 1, 10),
            fecha_fin=date(2030, 1, 15),
            numero_personas=2,
            estado="confirmada",
        )
        db_real.add(reserva)
        db_real.flush()
        db_real.add(
            ReservaHabitacion(
                id_reserva=reserva.id_reserva,
                id_habitacion=hab.id_habitacion,
                fecha_checkin=date(2030, 1, 10),
                fecha_checkout=date(2030, 1, 15),
                precio_acordado=500000,
            )
        )
        db_real.flush()

        ocupado = HotelRepository.get_all(
            db_real, limit=300, fecha_checkin=date(2030, 1, 12), fecha_checkout=date(2030, 1, 14), q=MARCA
        )
        libre = HotelRepository.get_all(
            db_real, limit=300, fecha_checkin=date(2030, 1, 15), fecha_checkout=date(2030, 1, 18), q=MARCA
        )

        assert ocupado == []
        assert [h.id_hotel for h in libre] == [hotel.id_hotel]

    @pytest.mark.xfail(
        strict=True,
        reason="Incidencia: la búsqueda usa ILIKE, que en PostgreSQL distingue tildes. "
        "En MySQL (collation *_ai_ci) 'medellin' sí encontraría 'Medellín'.",
    )
    def test_buscar_sin_tilde_encuentra_la_ciudad_con_tilde(self, db_real):
        # Ciudad inventada para no chocar con los hoteles de demostración.
        HotelRepository.create(db_real, {"nombre_hotel": f"{MARCA} Hotel", "ciudad": "Villa Pruebasón"})

        assert HotelRepository.get_all(db_real, limit=300, q="pruebason") != []


class TestHabitacionRepository:
    def test_crear_buscar_por_numero_y_borrar(self, db_real, hotel, tipo):
        hab = _habitacion(db_real, hotel, tipo, "101")

        assert (
            HabitacionRepository.get_by_hotel_and_number(db_real, hotel.id_hotel, "101").id_habitacion
            == hab.id_habitacion
        )
        assert HabitacionRepository.get_by_hotel_and_number(db_real, hotel.id_hotel, "999") is None

        HabitacionRepository.delete(db_real, hab.id_habitacion)
        assert HabitacionRepository.get_by_id(db_real, hab.id_habitacion) is None

    def test_get_all_lista_solo_las_habitaciones_del_hotel_pedido(self, db_real, hotel, tipo):
        otro = HotelRepository.create(db_real, {"nombre_hotel": f"{MARCA} Otro"})
        _habitacion(db_real, hotel, tipo, "101")
        _habitacion(db_real, otro, tipo, "201")

        listado = HabitacionRepository.get_all(db_real, hotel_id=hotel.id_hotel)

        assert [h.numero_habitacion for h in listado] == ["101"]

    def test_disponibles_no_incluye_las_que_estan_en_mantenimiento(self, db_real, hotel, tipo):
        _habitacion(db_real, hotel, tipo, "101")
        _habitacion(db_real, hotel, tipo, "102", estado="mantenimiento")

        disponibles = HabitacionRepository.get_disponibles(db_real, hotel.id_hotel)

        assert [h.numero_habitacion for h in disponibles] == ["101"]


class TestRestriccionesDeLasTablas:
    """Cada restricción del esquema, comprobada en la BD real."""

    def test_nombre_del_hotel_es_obligatorio_not_null(self, db_real):
        db_real.add(Hotel(nombre_hotel=None))
        with pytest.raises(IntegrityError, match="not-null"):
            db_real.flush()

    def test_nombre_del_hotel_tiene_maximo_100_caracteres(self, db_real):
        # SQLite aceptaría los 101 caracteres sin quejarse.
        db_real.add(Hotel(nombre_hotel="x" * 101))
        with pytest.raises(DataError, match="too long"):
            db_real.flush()

    def test_numero_de_habitacion_unico_por_hotel_unique(self, db_real, hotel, tipo):
        _habitacion(db_real, hotel, tipo, "101")
        db_real.add(
            Habitacion(
                id_hotel=hotel.id_hotel,
                id_tipo_habitacion=tipo.id_tipo_habitacion,
                numero_habitacion="101",
                precio_noche=1,
                estado="disponible",
            )
        )
        with pytest.raises(IntegrityError, match="uq_hotel_numero"):
            db_real.flush()

    def test_la_habitacion_debe_apuntar_a_un_tipo_que_exista_fk(self, db_real, hotel):
        # Con SQLite (PRAGMA foreign_keys apagado) esto se guardaba igual.
        db_real.add(
            Habitacion(
                id_hotel=hotel.id_hotel,
                id_tipo_habitacion=999999,
                numero_habitacion="101",
                precio_noche=1,
                estado="disponible",
            )
        )
        with pytest.raises(IntegrityError, match="foreign key"):
            db_real.flush()

    # Hallazgo: estos CHECK estaban en el modelo pero no en la BD real (la
    # migración inicial no los creó). Se agregaron con la migración
    # f3c1d9a7b5e2_checks_de_reservas.py.
    def test_una_reserva_necesita_al_menos_una_persona_check(self, db_real):
        cliente = Cliente(nombre="Ana", apellido=MARCA, cedula=f"{MARCA}-2", correo=f"{MARCA.lower()}2@t.co")
        db_real.add(cliente)
        db_real.flush()
        db_real.add(Reserva(id_cliente=cliente.id_cliente, numero_personas=0, estado="pendiente"))
        with pytest.raises(IntegrityError, match="ck_reservas_numero_personas"):
            db_real.flush()

    def test_una_reserva_no_acepta_un_estado_inventado_check(self, db_real):
        cliente = Cliente(nombre="Ana", apellido=MARCA, cedula=f"{MARCA}-4", correo=f"{MARCA.lower()}4@t.co")
        db_real.add(cliente)
        db_real.flush()
        db_real.add(Reserva(id_cliente=cliente.id_cliente, numero_personas=2, estado="aprobadisima"))
        with pytest.raises(IntegrityError, match="ck_reservas_estado"):
            db_real.flush()

    def test_la_cedula_del_cliente_es_unica(self, db_real):
        db_real.add(Cliente(nombre="Ana", apellido=MARCA, cedula=f"{MARCA}-3", correo="a3@t.co"))
        db_real.flush()
        db_real.add(Cliente(nombre="Eva", apellido=MARCA, cedula=f"{MARCA}-3", correo="e3@t.co"))
        with pytest.raises(IntegrityError, match="duplicate key"):
            db_real.flush()
