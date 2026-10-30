"""
Tests de la lógica de negocio real de reservas y pagos — Fase 1 del plan
de mejora ("Confiabilidad de datos").

Antes de esta suite, la única cobertura automatizada de todo el proyecto
eran las excepciones de borrado por FK (test_delete_exceptions.py). Esta
suite cubre en cambio los tres puntos donde un bug real ya causó (o podía
causar) un cobro incorrecto: el cálculo de precio por múltiples noches
(bug real, corregido esta sesión en reserva_repository.py), el chequeo de
disponibilidad/cruce de fechas de una habitación, y la idempotencia de
pagos asíncronos (PSE/Nequi) que evita un segundo Pago para la misma
reserva.

La fixture `db` (SQLite en memoria) vive en conftest.py, compartida por
toda la suite -- sin mockear nada de la lógica real, se ejecuta el código
de producción tal cual contra una base de datos real (aunque en memoria).
"""

from datetime import date

import pytest
from fastapi import HTTPException

from app.core.exceptions import (
    HabitacionNoDisponibleError,
    HabitacionNoEncontradaError,
    PaqueteNoEncontradoError,
)
from app.models.cliente_model import Cliente
from app.models.hotel_model import Habitacion, Hotel
from app.models.reserva_model import (
    MetodoPago,
    Pago,
    Reserva,
    ReservaHabitacion,
)
from app.models.user_model import Usuario
from app.repositories.reserva_repository import PagoRepository, ReservaRepository
from app.repositories.solicitud_cancelacion_repository import SolicitudCancelacionRepository
from app.routes import reserva_route, solicitud_cancelacion_route
from app.schemas.reserva_schema import PagarRequest
from app.schemas.solicitud_cancelacion_schema import SolicitudCancelacionResolve


def _crear_hotel_y_habitacion(db, precio_noche=100000, estado="disponible"):
    hotel = Hotel(
        nombre_hotel="Hotel Test",
        direccion="Calle 1",
        telefono="123456",
        correo_electronico="hotel@test.com",
        calificacion=4,
    )
    db.add(hotel)
    db.commit()

    habitacion = Habitacion(
        id_hotel=hotel.id_hotel,
        id_tipo_habitacion=1,
        numero_habitacion="101",
        precio_noche=precio_noche,
        estado=estado,
    )
    db.add(habitacion)
    db.commit()
    return hotel, habitacion


def _crear_cliente(db, cedula="1000000001"):
    cliente = Cliente(
        nombre="Cliente",
        apellido="Test",
        cedula=cedula,
        correo=f"cliente{cedula}@test.com",
    )
    db.add(cliente)
    db.commit()
    return cliente


class TestPrecioMultiplesNoches:
    """Regresión directa del bug real: antes se guardaba precio_acordado =
    precio de UNA noche sin importar cuántas noches durara la reserva."""

    def test_precio_se_multiplica_por_las_noches_reales(self, db):
        cliente = _crear_cliente(db)
        _, habitacion = _crear_hotel_y_habitacion(db, precio_noche=100000)

        reserva = ReservaRepository.create(
            db,
            {
                "id_cliente": cliente.id_cliente,
                "numero_personas": 2,
                "fecha_inicio": date(2026, 1, 10),
                "fecha_fin": date(2026, 1, 13),
                "habitaciones": [
                    {
                        "id_habitacion": habitacion.id_habitacion,
                        "fecha_checkin": date(2026, 1, 10),
                        "fecha_checkout": date(2026, 1, 13),  # 3 noches
                    }
                ],
            },
        )

        rh = db.query(ReservaHabitacion).filter(ReservaHabitacion.id_reserva == reserva.id_reserva).first()
        assert float(rh.precio_acordado) == 100000 * 3

    def test_precio_una_sola_noche(self, db):
        cliente = _crear_cliente(db)
        _, habitacion = _crear_hotel_y_habitacion(db, precio_noche=80000)

        reserva = ReservaRepository.create(
            db,
            {
                "id_cliente": cliente.id_cliente,
                "numero_personas": 1,
                "fecha_inicio": date(2026, 2, 1),
                "fecha_fin": date(2026, 2, 2),
                "habitaciones": [
                    {
                        "id_habitacion": habitacion.id_habitacion,
                        "fecha_checkin": date(2026, 2, 1),
                        "fecha_checkout": date(2026, 2, 2),
                    }
                ],
            },
        )

        rh = db.query(ReservaHabitacion).filter(ReservaHabitacion.id_reserva == reserva.id_reserva).first()
        assert float(rh.precio_acordado) == 80000


class TestDisponibilidadHabitacion:
    """Cruce de fechas / estado de la habitación — lo que evita el
    double-booking (dos clientes con la misma habitación las mismas
    noches)."""

    def test_habitacion_inexistente(self, db):
        with pytest.raises(HabitacionNoEncontradaError):
            ReservaRepository._verificar_disponibilidad(db, 9999, date(2026, 1, 1), date(2026, 1, 2))

    def test_habitacion_en_mantenimiento_rechazada(self, db):
        _, habitacion = _crear_hotel_y_habitacion(db, estado="mantenimiento")
        with pytest.raises(HabitacionNoDisponibleError):
            ReservaRepository._verificar_disponibilidad(
                db, habitacion.id_habitacion, date(2026, 1, 1), date(2026, 1, 2)
            )

    def test_fechas_cruzadas_con_reserva_activa_rechazadas(self, db):
        cliente = _crear_cliente(db)
        _, habitacion = _crear_hotel_y_habitacion(db)

        # Reserva existente: 10 al 15 de enero, confirmada (activa)
        ReservaRepository.create(
            db,
            {
                "id_cliente": cliente.id_cliente,
                "numero_personas": 1,
                "fecha_inicio": date(2026, 1, 10),
                "fecha_fin": date(2026, 1, 15),
                "habitaciones": [
                    {
                        "id_habitacion": habitacion.id_habitacion,
                        "fecha_checkin": date(2026, 1, 10),
                        "fecha_checkout": date(2026, 1, 15),
                    }
                ],
            },
        )

        # Nueva reserva que se cruza (12 al 18) debe rechazarse
        with pytest.raises(HabitacionNoDisponibleError):
            ReservaRepository._verificar_disponibilidad(
                db, habitacion.id_habitacion, date(2026, 1, 12), date(2026, 1, 18)
            )

    def test_fechas_consecutivas_sin_cruce_permitidas(self, db):
        """Salida el día 15, entrada de otro cliente el mismo día 15 (mismo
        día de turnover) NO debe considerarse un cruce — es el uso normal
        de un hotel."""
        cliente = _crear_cliente(db)
        _, habitacion = _crear_hotel_y_habitacion(db)

        ReservaRepository.create(
            db,
            {
                "id_cliente": cliente.id_cliente,
                "numero_personas": 1,
                "fecha_inicio": date(2026, 1, 10),
                "fecha_fin": date(2026, 1, 15),
                "habitaciones": [
                    {
                        "id_habitacion": habitacion.id_habitacion,
                        "fecha_checkin": date(2026, 1, 10),
                        "fecha_checkout": date(2026, 1, 15),
                    }
                ],
            },
        )

        # No debe lanzar excepción
        ReservaRepository._verificar_disponibilidad(db, habitacion.id_habitacion, date(2026, 1, 15), date(2026, 1, 20))

    def test_reserva_cancelada_no_bloquea_la_habitacion(self, db):
        cliente = _crear_cliente(db)
        _, habitacion = _crear_hotel_y_habitacion(db)

        reserva = ReservaRepository.create(
            db,
            {
                "id_cliente": cliente.id_cliente,
                "numero_personas": 1,
                "fecha_inicio": date(2026, 3, 1),
                "fecha_fin": date(2026, 3, 5),
                "habitaciones": [
                    {
                        "id_habitacion": habitacion.id_habitacion,
                        "fecha_checkin": date(2026, 3, 1),
                        "fecha_checkout": date(2026, 3, 5),
                    }
                ],
            },
        )
        reserva.estado = "cancelada"
        db.commit()

        # Las mismas fechas ahora deben estar libres
        ReservaRepository._verificar_disponibilidad(db, habitacion.id_habitacion, date(2026, 3, 1), date(2026, 3, 5))


class TestPaqueteInexistente:
    def test_id_paquete_inexistente_rechazado(self, db):
        cliente = _crear_cliente(db)
        with pytest.raises(PaqueteNoEncontradoError):
            ReservaRepository.create(
                db,
                {
                    "id_cliente": cliente.id_cliente,
                    "id_paquete": 9999,
                    "numero_personas": 1,
                    "fecha_inicio": date(2026, 1, 1),
                    "fecha_fin": date(2026, 1, 2),
                },
            )


class TestIdempotenciaPagos:
    """Fase 1 del plan de mejora: evita un segundo Pago para la misma
    reserva mientras un pago async (PSE/Nequi) sigue 'procesando'."""

    def _crear_reserva_pendiente(self, db):
        cliente = _crear_cliente(db)
        reserva = Reserva(
            id_cliente=cliente.id_cliente,
            numero_personas=1,
            estado="pendiente",
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 1, 2),
        )
        db.add(reserva)
        db.commit()
        return reserva

    def test_no_hay_pago_en_proceso_para_reserva_nueva(self, db):
        reserva = self._crear_reserva_pendiente(db)
        assert PagoRepository.existe_pago_en_proceso(db, reserva.id_reserva) is False

    def test_detecta_pago_procesando(self, db):
        reserva = self._crear_reserva_pendiente(db)
        metodo = MetodoPago(nombre_metodo="PSE", codigo="pse")
        db.add(metodo)
        db.commit()

        pago = Pago(
            id_reserva=reserva.id_reserva,
            id_metodo_pago=metodo.id_metodo,
            monto=100000,
            estado="procesando",
        )
        db.add(pago)
        db.commit()

        assert PagoRepository.existe_pago_en_proceso(db, reserva.id_reserva) is True

    def test_pago_ya_confirmado_no_cuenta_como_en_proceso(self, db):
        """Un pago que ya terminó (pagado/rechazado) no debe bloquear un
        reintento legítimo de una reserva que sigue pendiente por otra
        razón (ej. el primer intento fue rechazado)."""
        reserva = self._crear_reserva_pendiente(db)
        metodo = MetodoPago(nombre_metodo="Tarjeta", codigo="tarjeta_credito")
        db.add(metodo)
        db.commit()

        pago = Pago(
            id_reserva=reserva.id_reserva,
            id_metodo_pago=metodo.id_metodo,
            monto=100000,
            estado="rechazado",
        )
        db.add(pago)
        db.commit()

        assert PagoRepository.existe_pago_en_proceso(db, reserva.id_reserva) is False


class _HiloSincrono:
    """Reemplaza threading.Thread dentro de un módulo de ruta para las
    pruebas: el envío de correo (Fase 2 del plan de mejora) corre en un
    hilo aparte para no bloquear la respuesta ni depender de la sesión de
    BD tras cerrarse — pero eso hace la aserción en un test una carrera
    contra el hilo real. Este doble corre el "hilo" en el mismo hilo del
    test, de forma síncrona, así se puede afirmar sobre el envío sin
    sleeps ni condiciones de carrera.
    """

    def __init__(self, target=None, daemon=None, **kwargs):
        self._target = target

    def start(self):
        if self._target:
            self._target()


class TestCorreoConfirmacionReserva:
    """Fase 2 del plan de mejora: 'Confirmación por correo' prometida en
    Checkout.tsx (líneas 561-563) sin infraestructura de envío para
    reservas. send_reservation_confirmation ya existía en app/core/mail.py
    pero solo se usaba en app/core/examples.py (no es una ruta activa) —
    estas pruebas verifican que ahora sí se llama desde el flujo real de
    pago (pagar_reserva / confirmar_pago), solo cuando la reserva de
    verdad queda 'confirmada', nunca si el pago fue rechazado."""

    def _preparar_reserva_y_metodo(self, db, codigo_metodo, nombre_metodo):
        cliente = _crear_cliente(db)
        _, habitacion = _crear_hotel_y_habitacion(db, precio_noche=150000)
        reserva = ReservaRepository.create(
            db,
            {
                "id_cliente": cliente.id_cliente,
                "numero_personas": 1,
                "fecha_inicio": date(2026, 4, 1),
                "fecha_fin": date(2026, 4, 3),
                "habitaciones": [
                    {
                        "id_habitacion": habitacion.id_habitacion,
                        "fecha_checkin": date(2026, 4, 1),
                        "fecha_checkout": date(2026, 4, 3),
                    }
                ],
            },
        )
        metodo = MetodoPago(nombre_metodo=nombre_metodo, codigo=codigo_metodo)
        db.add(metodo)
        db.commit()
        usuario = Usuario(
            username=f"user{cliente.id_cliente}",
            correo_electronico=f"user{cliente.id_cliente}@test.com",
            password_hash="hash-de-prueba",
            id_cliente=cliente.id_cliente,
        )
        db.add(usuario)
        db.commit()
        return cliente, reserva, metodo, usuario

    def test_pago_aprobado_al_instante_envia_correo_de_confirmacion(self, db, monkeypatch):
        llamadas = []

        async def fake_send(**kwargs):
            llamadas.append(kwargs)
            return True

        monkeypatch.setattr(reserva_route.threading, "Thread", _HiloSincrono)
        monkeypatch.setattr(reserva_route, "send_reservation_confirmation", fake_send)

        cliente, reserva, metodo, usuario = self._preparar_reserva_y_metodo(db, "tarjeta_credito", "Tarjeta de crédito")
        data = PagarRequest(id_metodo_pago=metodo.id_metodo, tipo_pago="completo", ultimos4="4242")

        resultado = reserva_route.pagar_reserva(
            reserva.id_reserva, data, db=db, current_user=usuario, authorization=None
        )

        assert resultado.reserva.estado == "confirmada"
        assert len(llamadas) == 1
        assert llamadas[0]["email"] == cliente.correo
        assert llamadas[0]["reservation_id"] == reserva.id_reserva
        assert llamadas[0]["guest_name"] == f"{cliente.nombre} {cliente.apellido}"

    def test_pago_rechazado_no_envia_correo_de_confirmacion(self, db, monkeypatch):
        llamadas = []

        async def fake_send(**kwargs):
            llamadas.append(kwargs)
            return True

        monkeypatch.setattr(reserva_route.threading, "Thread", _HiloSincrono)
        monkeypatch.setattr(reserva_route, "send_reservation_confirmation", fake_send)

        cliente, reserva, metodo, usuario = self._preparar_reserva_y_metodo(db, "tarjeta_credito", "Tarjeta de crédito")
        # "0002" es el valor de prueba que payment_service siempre rechaza.
        data = PagarRequest(id_metodo_pago=metodo.id_metodo, tipo_pago="completo", ultimos4="0002")

        resultado = reserva_route.pagar_reserva(
            reserva.id_reserva, data, db=db, current_user=usuario, authorization=None
        )

        assert resultado.reserva.estado == "pendiente"
        assert resultado.pago.estado == "rechazado"
        assert llamadas == []

    def test_confirmar_pago_pse_aprobado_envia_correo_de_confirmacion(self, db, monkeypatch):
        llamadas = []

        async def fake_send(**kwargs):
            llamadas.append(kwargs)
            return True

        monkeypatch.setattr(reserva_route.threading, "Thread", _HiloSincrono)
        monkeypatch.setattr(reserva_route, "send_reservation_confirmation", fake_send)

        cliente, reserva, metodo, usuario = self._preparar_reserva_y_metodo(db, "pse", "PSE")
        # Documento normal (no "0000000000") -> se aprueba al confirmar.
        data = PagarRequest(
            id_metodo_pago=metodo.id_metodo,
            tipo_pago="completo",
            banco="Bancolombia",
            documento="123456789",
        )

        inicio = reserva_route.pagar_reserva(reserva.id_reserva, data, db=db, current_user=usuario, authorization=None)
        # PSE queda 'procesando' de inmediato — todavía no se manda nada.
        assert inicio.pago.estado == "procesando"
        assert llamadas == []

        pago_id = inicio.pago.id_pago
        resultado = reserva_route.confirmar_pago(pago_id, db=db, current_user=usuario, authorization=None)

        assert resultado.reserva.estado == "confirmada"
        assert len(llamadas) == 1
        assert llamadas[0]["email"] == cliente.correo
        assert llamadas[0]["reservation_id"] == reserva.id_reserva


class TestCorreoCancelacionReserva:
    """Misma fase del plan de mejora: aprobar una solicitud de cancelación
    ahora sí avisa por correo al cliente de que su reserva quedó cancelada
    de verdad (send_cancellation_email, antes también sin ningún punto de
    llamada real)."""

    def test_aprobar_solicitud_cancela_la_reserva_y_envia_correo(self, db, monkeypatch):
        llamadas = []

        async def fake_send(**kwargs):
            llamadas.append(kwargs)
            return True

        monkeypatch.setattr(solicitud_cancelacion_route.threading, "Thread", _HiloSincrono)
        monkeypatch.setattr(solicitud_cancelacion_route, "send_cancellation_email", fake_send)

        cliente = _crear_cliente(db)
        reserva = Reserva(
            id_cliente=cliente.id_cliente,
            numero_personas=1,
            estado="pendiente",
            fecha_inicio=date(2026, 5, 1),
            fecha_fin=date(2026, 5, 3),
        )
        db.add(reserva)
        db.commit()

        solicitud = SolicitudCancelacionRepository.create(
            db,
            id_reserva=reserva.id_reserva,
            id_cliente=cliente.id_cliente,
            motivo="Cambio de planes personales",
            motivo_detalle=None,
        )

        data = SolicitudCancelacionResolve(estado="aprobada", comentario_resolucion="Aprobado por soporte")
        resultado = solicitud_cancelacion_route.admin_resolver_solicitud(
            solicitud.id_solicitud, data, db=db, admin_id=1
        )

        assert resultado.estado == "aprobada"
        db.refresh(reserva)
        assert reserva.estado == "cancelada"
        assert len(llamadas) == 1
        assert llamadas[0]["email"] == cliente.correo
        assert llamadas[0]["reservation_id"] == reserva.id_reserva

    def test_rechazar_solicitud_no_cancela_ni_envia_correo(self, db, monkeypatch):
        llamadas = []

        async def fake_send(**kwargs):
            llamadas.append(kwargs)
            return True

        monkeypatch.setattr(solicitud_cancelacion_route.threading, "Thread", _HiloSincrono)
        monkeypatch.setattr(solicitud_cancelacion_route, "send_cancellation_email", fake_send)

        cliente = _crear_cliente(db)
        reserva = Reserva(
            id_cliente=cliente.id_cliente,
            numero_personas=1,
            estado="pendiente",
            fecha_inicio=date(2026, 6, 1),
            fecha_fin=date(2026, 6, 3),
        )
        db.add(reserva)
        db.commit()

        solicitud = SolicitudCancelacionRepository.create(
            db,
            id_reserva=reserva.id_reserva,
            id_cliente=cliente.id_cliente,
            motivo="Cambio de planes personales",
            motivo_detalle=None,
        )

        data = SolicitudCancelacionResolve(estado="rechazada", comentario_resolucion="No aplica reembolso")
        resultado = solicitud_cancelacion_route.admin_resolver_solicitud(
            solicitud.id_solicitud, data, db=db, admin_id=1
        )

        assert resultado.estado == "rechazada"
        db.refresh(reserva)
        assert reserva.estado == "pendiente"
        assert llamadas == []


class TestTransicionesDePago:
    """Auditoría oct-2026 (P0-2/P0-3): una sola puerta para cambiar el
    estado de un pago (pago_estado_service) y cobro del saldo tras el
    anticipo del 50%."""

    _preparar_reserva_y_metodo = TestCorreoConfirmacionReserva._preparar_reserva_y_metodo

    @pytest.fixture(autouse=True)
    def _sin_correo(self, monkeypatch):
        async def fake_send(**kwargs):
            return True

        monkeypatch.setattr(reserva_route.threading, "Thread", _HiloSincrono)
        monkeypatch.setattr(reserva_route, "send_reservation_confirmation", fake_send)

    def test_anticipo_confirma_y_luego_se_cobra_el_saldo(self, db):
        _, reserva, metodo, usuario = self._preparar_reserva_y_metodo(db, "tarjeta_credito", "Tarjeta")
        total = reserva.precio_total

        anticipo = reserva_route.pagar_reserva(
            reserva.id_reserva,
            PagarRequest(id_metodo_pago=metodo.id_metodo, tipo_pago="parcial", ultimos4="4242"),
            db=db,
            current_user=usuario,
            authorization=None,
        )
        assert anticipo.reserva.estado == "confirmada"
        assert float(anticipo.pago.monto) == round(total * 0.5, 2)
        assert anticipo.reserva.saldo_pendiente == pytest.approx(total - round(total * 0.5, 2))

        saldo = reserva_route.pagar_reserva(
            reserva.id_reserva,
            PagarRequest(id_metodo_pago=metodo.id_metodo, tipo_pago="saldo", ultimos4="4242"),
            db=db,
            current_user=usuario,
            authorization=None,
        )
        assert saldo.pago.estado == "pagado"
        assert saldo.reserva.saldo_pendiente == 0
        assert saldo.reserva.total_pagado == pytest.approx(total)
        # Cada pago aprobado tiene su propio comprobante.
        assert anticipo.pago.numero_factura != saldo.pago.numero_factura

        with pytest.raises(HTTPException) as exc:
            reserva_route.pagar_reserva(
                reserva.id_reserva,
                PagarRequest(id_metodo_pago=metodo.id_metodo, tipo_pago="saldo", ultimos4="4242"),
                db=db,
                current_user=usuario,
                authorization=None,
            )
        assert exc.value.status_code == 409

    def test_segundo_anticipo_no_se_permite(self, db):
        _, reserva, metodo, usuario = self._preparar_reserva_y_metodo(db, "tarjeta_credito", "Tarjeta")
        req = PagarRequest(id_metodo_pago=metodo.id_metodo, tipo_pago="parcial", ultimos4="4242")
        reserva_route.pagar_reserva(reserva.id_reserva, req, db=db, current_user=usuario, authorization=None)
        with pytest.raises(HTTPException) as exc:
            reserva_route.pagar_reserva(reserva.id_reserva, req, db=db, current_user=usuario, authorization=None)
        assert exc.value.status_code == 409

    def test_admin_marca_pagado_confirma_reserva_y_notifica_al_cliente(self, db):
        from app.models.notificacion_model import Notificacion
        from app.models.reserva_model import HistorialReserva
        from app.schemas.reserva_schema import PagoUpdate

        cliente, reserva, metodo, usuario = self._preparar_reserva_y_metodo(db, "transferencia", "Transferencia")
        pago = PagoRepository.create(
            db, {"id_reserva": reserva.id_reserva, "id_metodo_pago": metodo.id_metodo, "monto": 300000}
        )

        actualizado = reserva_route.update_pago(
            pago.id_pago, PagoUpdate(estado="pagado"), db=db, admin_id=1, current_user=usuario
        )
        db.refresh(reserva)

        assert actualizado.estado == "pagado"
        assert actualizado.numero_factura == f"FAC-{pago.id_pago:06d}"
        assert reserva.estado == "confirmada"
        assert db.query(HistorialReserva).filter_by(id_reserva=reserva.id_reserva).count() == 1
        para_cliente = db.query(Notificacion).filter_by(id_cliente=cliente.id_cliente).all()
        assert [n.titulo for n in para_cliente] == ["¡Pago aprobado!"]
        assert db.query(Notificacion).filter(Notificacion.id_cliente.is_(None)).count() == 1

    def test_admin_no_puede_reabrir_un_pago_aprobado(self, db):
        from app.schemas.reserva_schema import PagoUpdate

        _, reserva, metodo, usuario = self._preparar_reserva_y_metodo(db, "tarjeta_credito", "Tarjeta")
        resultado = reserva_route.pagar_reserva(
            reserva.id_reserva,
            PagarRequest(id_metodo_pago=metodo.id_metodo, tipo_pago="completo", ultimos4="4242"),
            db=db,
            current_user=usuario,
            authorization=None,
        )
        with pytest.raises(HTTPException) as exc:
            reserva_route.update_pago(
                resultado.pago.id_pago, PagoUpdate(estado="rechazado"), db=db, admin_id=1, current_user=usuario
            )
        assert exc.value.status_code == 409

        with pytest.raises(HTTPException) as exc:
            reserva_route.delete_pago(resultado.pago.id_pago, db=db, admin_id=1)
        assert exc.value.status_code == 409

    def test_pago_rechazado_no_notifica_al_cliente(self, db):
        from app.models.notificacion_model import Notificacion

        cliente, reserva, metodo, usuario = self._preparar_reserva_y_metodo(db, "tarjeta_credito", "Tarjeta")
        reserva_route.pagar_reserva(
            reserva.id_reserva,
            PagarRequest(id_metodo_pago=metodo.id_metodo, tipo_pago="completo", ultimos4="0002"),
            db=db,
            current_user=usuario,
            authorization=None,
        )
        assert db.query(Notificacion).filter_by(id_cliente=cliente.id_cliente).count() == 0


class TestValidacionesDeEntrada:
    """Auditoría oct-2026 (P1-3/P1-4): celular obligatorio al crear un
    cliente y años de 4 cifras razonables en las fechas de entrada."""

    def test_cliente_nuevo_exige_celular_valido(self):
        from pydantic import ValidationError

        from app.schemas.cliente_schema import ClienteCreate

        base = {"nombre": "Ana", "apellido": "Gómez", "cedula": "1020304050"}
        with pytest.raises(ValidationError):
            ClienteCreate(**base)
        with pytest.raises(ValidationError):
            ClienteCreate(**base, celular="12345")
        assert ClienteCreate(**base, celular="300 123 4567").celular == "3001234567"
        assert ClienteCreate(**base, celular="+57 300-123-4567").celular == "3001234567"
        assert ClienteCreate(**base, celular="+34612345678").celular == "+34612345678"

    def test_editar_cliente_antiguo_sin_celular_no_falla(self):
        from app.schemas.cliente_schema import ClienteUpdate

        assert ClienteUpdate(celular="").celular is None
        assert ClienteUpdate(nombre="Ana").celular is None

    def test_fechas_fuera_de_rango_se_rechazan(self):
        from pydantic import ValidationError

        from app.schemas.reserva_schema import ReservaCreate

        datos = {"id_cliente": 1, "numero_personas": 1, "fecha_inicio": "2026-04-01", "fecha_fin": "2026-04-03"}
        assert ReservaCreate(**datos).fecha_inicio == date(2026, 4, 1)
        with pytest.raises(ValidationError):
            ReservaCreate(**{**datos, "fecha_fin": "9999-12-31"})
        with pytest.raises(ValidationError):
            ReservaCreate(**{**datos, "fecha_inicio": "20255-01-01"})


class TestCrearHotelConHabitaciones:
    """Auditoría oct-2026 (P1-6): hotel y habitaciones en una transacción."""

    def test_crea_hotel_y_sus_habitaciones(self, db):
        from app.models.hotel_model import Habitacion, TipoHabitacion
        from app.routes import hotel_route
        from app.schemas.hotel_schema import HotelCreate

        tipo = TipoHabitacion(nombre_tipo="Doble", capacidad_personas=2)
        db.add(tipo)
        db.commit()
        datos = HotelCreate(
            nombre_hotel="Hotel Prueba",
            ciudad="Cartagena",
            descripcion="Frente al mar.",
            habitaciones=[
                {"id_tipo_habitacion": tipo.id_tipo_habitacion, "numero_habitacion": "101", "precio_noche": 200000},
                {"id_tipo_habitacion": tipo.id_tipo_habitacion, "numero_habitacion": "102", "precio_noche": 220000},
            ],
        )
        hotel = hotel_route.create_hotel(datos, db=db, admin_id=1)
        assert hotel.descripcion == "Frente al mar."
        assert db.query(Habitacion).filter_by(id_hotel=hotel.id_hotel).count() == 2

    def test_tipo_inexistente_no_crea_nada(self, db):
        from app.models.hotel_model import Hotel
        from app.routes import hotel_route
        from app.schemas.hotel_schema import HotelCreate

        datos = HotelCreate(
            nombre_hotel="Hotel Fantasma",
            habitaciones=[{"id_tipo_habitacion": 999, "numero_habitacion": "1", "precio_noche": 1}],
        )
        with pytest.raises(HTTPException) as exc:
            hotel_route.create_hotel(datos, db=db, admin_id=1)
        assert exc.value.status_code == 422
        assert db.query(Hotel).filter_by(nombre_hotel="Hotel Fantasma").count() == 0

    def test_numeros_repetidos_se_rechazan(self):
        from pydantic import ValidationError

        from app.schemas.hotel_schema import HotelCreate

        with pytest.raises(ValidationError):
            HotelCreate(
                nombre_hotel="X",
                habitaciones=[
                    {"id_tipo_habitacion": 1, "numero_habitacion": "1", "precio_noche": 1},
                    {"id_tipo_habitacion": 1, "numero_habitacion": "1", "precio_noche": 1},
                ],
            )
