"""
services/pago_estado_service.py

Única puerta para cambiar el estado de un Pago. Antes había tres caminos
distintos (pagar_reserva, confirmar_pago y PUT /api/pagos/{id} del panel
de admin) y el del admin escribía cualquier estado sin tocar la reserva:
marcar un pago como 'pagado' le asignaba número de comprobante pero la
reserva seguía 'pendiente', sin historial ni correo; y pasar un pago
'pagado' a 'rechazado' dejaba la reserva confirmada.

Reglas (todas verificadas en el backend, nunca en el navegador):
- Transiciones permitidas: pendiente -> procesando|pagado|rechazado|cancelado,
  procesando -> pagado|rechazado|cancelado. 'pagado', 'rechazado' y
  'cancelado' son finales: un pago aprobado no se "desaprueba" editando su
  estado (la reversa de una venta va por la solicitud de cancelación).
- Al pasar a 'pagado': la reserva 'pendiente' pasa a 'confirmada', queda
  un HistorialReserva, se asigna el número de comprobante (derivado del
  id_pago) y se notifica al admin y al cliente -- una sola vez, porque la
  transición a 'pagado' solo puede ocurrir una vez por pago.
- Nada de esto hace commit: el llamador confirma todo en UNA transacción.
"""

from sqlalchemy.orm import Session

from app.models.reserva_model import HistorialReserva, Pago, Reserva
from app.services.notificacion_service import crear_notificacion

ESTADOS_FINALES = {"pagado", "rechazado", "cancelado"}
TRANSICIONES = {
    "pendiente": {"procesando", "pagado", "rechazado", "cancelado"},
    "procesando": {"pagado", "rechazado", "cancelado"},
    "pagado": set(),
    "rechazado": set(),
    "cancelado": set(),
}


class TransicionPagoInvalida(Exception):
    def __init__(self, actual: str, nuevo: str):
        self.actual = actual
        self.nuevo = nuevo
        super().__init__(f"Un pago en estado '{actual}' no puede pasar a '{nuevo}'")


def total_pagado(reserva: Reserva, excluir_id_pago: int | None = None) -> float:
    return float(sum((p.monto or 0) for p in reserva.pagos if p.estado == "pagado" and p.id_pago != excluir_id_pago))


def numero_comprobante(id_pago: int) -> str:
    # Misma serie que ya existía en producción (FAC-000123) para no romper
    # los números ya emitidos. Es una referencia INTERNA del comprobante de
    # pago, no una factura electrónica de venta DIAN.
    return f"FAC-{id_pago:06d}"


def cambiar_estado_pago(
    db: Session,
    pago: Pago,
    reserva: Reserva,
    nuevo_estado: str,
    comentario: str,
    id_empleado: int | None = None,
) -> None:
    """Valida y aplica la transición. Lanza TransicionPagoInvalida si no
    está permitida. No hace commit."""
    actual = pago.estado
    if nuevo_estado == actual:
        return
    if nuevo_estado not in TRANSICIONES.get(actual, set()):
        raise TransicionPagoInvalida(actual, nuevo_estado)

    pago.estado = nuevo_estado
    estado_reserva_anterior = reserva.estado

    if nuevo_estado == "pagado":
        if reserva.estado == "pendiente":
            reserva.estado = "confirmada"
        db.flush()  # garantiza pago.id_pago antes de numerarlo
        if not pago.numero_factura:
            pago.numero_factura = numero_comprobante(pago.id_pago)

    # Solo los resultados (aprobado/rechazado/cancelado) dejan huella en el
    # historial de la reserva; 'procesando' es un paso intermedio.
    if nuevo_estado in ESTADOS_FINALES:
        db.add(
            HistorialReserva(
                id_reserva=reserva.id_reserva,
                estado_anterior=estado_reserva_anterior,
                estado_nuevo=reserva.estado,
                comentarios=comentario,
                id_empleado_responsable=id_empleado,
            )
        )

    if nuevo_estado == "pagado":
        monto = f"${float(pago.monto):,.0f}".replace(",", ".")
        crear_notificacion(
            db,
            tipo="pago",
            titulo=f"Pago aprobado — Reserva #{reserva.id_reserva}",
            mensaje=f"Pago #{pago.id_pago} ({pago.numero_factura}) por {monto} confirmado.",
            id_referencia=reserva.id_reserva,
            commit=False,
        )
        crear_notificacion(
            db,
            tipo="pago",
            titulo="¡Pago aprobado!",
            mensaje=(
                f"Tu pago de {monto} para la reserva #{reserva.id_reserva} ha sido aprobado correctamente. "
                "Ya puedes consultar los detalles de tu reserva desde tu cuenta."
            ),
            id_referencia=reserva.id_reserva,
            id_cliente=reserva.id_cliente,
            commit=False,
        )
