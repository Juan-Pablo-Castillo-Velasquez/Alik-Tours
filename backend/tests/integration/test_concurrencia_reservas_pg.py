"""Concurrencia real en PostgreSQL (solo con TEST_DATABASE_URL).

Dos personas reservan la MISMA habitación para las MISMAS fechas al mismo
tiempo, cada una en su propia conexión: el SELECT ... FOR UPDATE de
ReservaRepository._verificar_disponibilidad debe dejar pasar a una sola.
Y un doble clic (misma clave de idempotencia) debe dejar una sola reserva.

A diferencia de los demás tests de integración, aquí los datos se
confirman de verdad (commit) para que las dos conexiones los vean, y se
borran al final.
"""

import threading
from datetime import date, timedelta

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import HabitacionNoDisponibleError
from app.models.cliente_model import Cliente
from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion
from app.models.reserva_model import Reserva, ReservaHabitacion
from app.repositories.reserva_repository import ReservaRepository


@pytest.fixture
def escenario(motor_real):
    s = Session(bind=motor_real)
    hotel = Hotel(nombre_hotel="Hotel Concurrencia PG", ciudad="Cartagena", pais="Colombia", calificacion=3)
    tipo = TipoHabitacion(nombre_tipo="Doble concurrencia", capacidad_personas=2)
    s.add_all([hotel, tipo])
    s.commit()
    hab = Habitacion(
        id_hotel=hotel.id_hotel,
        id_tipo_habitacion=tipo.id_tipo_habitacion,
        numero_habitacion="C-1",
        precio_noche=100000,
        estado="disponible",
    )
    clientes = [Cliente(nombre="Ana", apellido=f"Concurrencia{i}", cedula=f"990000{i:04d}") for i in range(2)]
    s.add(hab)
    s.add_all(clientes)
    s.commit()
    datos = {
        "hab": hab.id_habitacion,
        "clientes": [c.id_cliente for c in clientes],
        "hotel": hotel.id_hotel,
        "tipo": tipo.id_tipo_habitacion,
    }
    yield datos
    reservas = [r.id_reserva for r in s.query(Reserva).filter(Reserva.id_cliente.in_(datos["clientes"])).all()]
    if reservas:
        s.query(ReservaHabitacion).filter(ReservaHabitacion.id_reserva.in_(reservas)).delete(synchronize_session=False)
        s.query(Reserva).filter(Reserva.id_reserva.in_(reservas)).delete(synchronize_session=False)
    s.query(Cliente).filter(Cliente.id_cliente.in_(datos["clientes"])).delete(synchronize_session=False)
    s.query(Hotel).filter(Hotel.id_hotel == datos["hotel"]).delete(synchronize_session=False)
    s.query(TipoHabitacion).filter(TipoHabitacion.id_tipo_habitacion == datos["tipo"]).delete(synchronize_session=False)
    s.commit()
    s.close()


def _reservar_en_paralelo(motor, payloads):
    barrera = threading.Barrier(len(payloads))
    resultados: list[str] = [""] * len(payloads)

    def trabajo(i, payload):
        s = Session(bind=motor)
        try:
            barrera.wait(timeout=5)
            ReservaRepository.create(s, dict(payload, habitaciones=[dict(h) for h in payload["habitaciones"]]))
            resultados[i] = "ok"
        except HabitacionNoDisponibleError:
            s.rollback()
            resultados[i] = "ocupada"
        finally:
            s.close()

    hilos = [threading.Thread(target=trabajo, args=(i, p)) for i, p in enumerate(payloads)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join(timeout=20)
    return resultados


def _payload(id_cliente, id_hab, clave=None):
    entrada = date.today() + timedelta(days=40)
    datos = {
        "id_cliente": id_cliente,
        "fecha_inicio": entrada,
        "fecha_fin": entrada + timedelta(days=2),
        "numero_personas": 2,
        "habitaciones": [
            {"id_habitacion": id_hab, "fecha_checkin": entrada, "fecha_checkout": entrada + timedelta(days=2)}
        ],
    }
    if clave:
        datos["clave_idempotencia"] = clave
    return datos


def test_dos_clientes_la_misma_habitacion_al_tiempo_solo_uno_reserva(motor_real, escenario):
    resultados = _reservar_en_paralelo(
        motor_real,
        [_payload(escenario["clientes"][0], escenario["hab"]), _payload(escenario["clientes"][1], escenario["hab"])],
    )
    assert sorted(resultados) == ["ocupada", "ok"]


def test_doble_clic_con_la_misma_clave_crea_una_sola_reserva(motor_real, escenario):
    cliente = escenario["clientes"][0]
    resultados = _reservar_en_paralelo(
        motor_real,
        [
            _payload(cliente, escenario["hab"], clave="doble-clic-1"),
            _payload(cliente, escenario["hab"], clave="doble-clic-1"),
        ],
    )
    # El segundo intento recibe la misma reserva (idempotencia) o choca con la
    # habitación ya tomada por el primero; nunca quedan dos reservas.
    assert "ok" in resultados
    s = Session(bind=motor_real)
    try:
        assert s.query(Reserva).filter(Reserva.id_cliente == cliente).count() == 1
    finally:
        s.close()
