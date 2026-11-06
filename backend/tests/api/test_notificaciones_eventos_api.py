"""Avisos (notificaciones) por evento: uno por evento lógico, sin
duplicados. Reserva creada, pago rechazado, cambio de estado de la reserva
y resolución de una solicitud de cancelación."""

from datetime import date, timedelta

from app.models.notificacion_model import Notificacion
from app.models.reserva_model import MetodoPago, Pago, Reserva, SolicitudCancelacion
from app.services.pago_estado_service import cambiar_estado_pago

HOY = date.today()


def _avisos(db, id_cliente=None):
    q = db.query(Notificacion)
    q = q.filter(Notificacion.id_cliente == id_cliente) if id_cliente else q.filter(Notificacion.id_cliente.is_(None))
    return [n.titulo for n in q.order_by(Notificacion.id_notificacion)]


def _cuerpo(id_cliente, clave="intento-aviso-123"):
    return {
        "id_cliente": id_cliente,
        "fecha_inicio": (HOY + timedelta(days=30)).isoformat(),
        "fecha_fin": (HOY + timedelta(days=33)).isoformat(),
        "numero_personas": 2,
        "clave_idempotencia": clave,
    }


def test_reserva_nueva_avisa_una_vez_al_cliente_y_al_equipo(client, crear_usuario, db):
    usuario, h = crear_usuario()

    client.post("/api/reservas", json=_cuerpo(usuario.id_cliente), headers=h)
    client.post("/api/reservas", json=_cuerpo(usuario.id_cliente), headers=h)  # reenvío del mismo intento

    assert _avisos(db, usuario.id_cliente) == ["Recibimos tu reserva"]
    assert _avisos(db) == ["Nueva reserva por gestionar"]


def test_pago_rechazado_avisa_al_cliente(db, crear_usuario):
    usuario, _ = crear_usuario()
    reserva = Reserva(id_cliente=usuario.id_cliente, numero_personas=1, estado="pendiente")
    metodo = MetodoPago(nombre_metodo="Tarjeta", codigo="tarjeta_credito")
    db.add_all([reserva, metodo])
    db.commit()
    pago = Pago(id_reserva=reserva.id_reserva, id_metodo_pago=metodo.id_metodo, monto=100000, estado="procesando")
    db.add(pago)
    db.commit()

    cambiar_estado_pago(db, pago, reserva, "rechazado", "Rechazado por el banco")
    db.commit()

    assert _avisos(db, usuario.id_cliente) == ["Tu pago no fue aprobado"]


def test_cambio_de_estado_de_la_reserva_avisa_solo_si_cambia(client, crear_usuario, db):
    usuario, _ = crear_usuario()
    _, admin = crear_usuario(roles=("admin",), con_cliente=False)
    reserva = Reserva(id_cliente=usuario.id_cliente, numero_personas=1, estado="pendiente")
    db.add(reserva)
    db.commit()

    client.put(f"/api/reservas/{reserva.id_reserva}", json={"estado": "confirmada"}, headers=admin)
    client.put(f"/api/reservas/{reserva.id_reserva}", json={"estado": "confirmada"}, headers=admin)  # sin cambio
    client.put(f"/api/reservas/{reserva.id_reserva}", json={"numero_personas": 2}, headers=admin)  # otro dato

    assert _avisos(db, usuario.id_cliente) == ["Tu reserva está confirmada"]


def test_resolver_una_solicitud_de_cancelacion_avisa_al_cliente(client, crear_usuario, db):
    usuario, _ = crear_usuario()
    _, admin = crear_usuario(roles=("admin",), con_cliente=False)
    reserva = Reserva(id_cliente=usuario.id_cliente, numero_personas=1, estado="confirmada")
    db.add(reserva)
    db.commit()
    solicitud = SolicitudCancelacion(
        id_reserva=reserva.id_reserva, id_cliente=usuario.id_cliente, motivo="Cambio de planes personales"
    )
    db.add(solicitud)
    db.commit()

    r = client.put(
        f"/api/solicitudes-cancelacion/{solicitud.id_solicitud}/resolver",
        json={"estado": "rechazada", "comentario_resolucion": "Fuera de plazo"},
        headers=admin,
    )

    assert r.status_code == 200
    avisos = db.query(Notificacion).filter(Notificacion.id_cliente == usuario.id_cliente).all()
    assert [a.titulo for a in avisos] == ["Solicitud de cancelación no aprobada"]
    assert "Fuera de plazo" in avisos[0].mensaje
