from sqlalchemy.orm import Session

from app.models.notificacion_model import Notificacion


def crear_notificacion(
    db: Session,
    tipo: str,
    titulo: str,
    mensaje: str | None = None,
    id_referencia: int | None = None,
    id_cliente: int | None = None,
    commit: bool = True,
) -> None:
    """Crea una notificación real para el admin, llamada desde el punto
    exacto donde ocurre el evento (nueva solicitud de cancelación, mensaje
    de contacto, solicitud corporativa, pago aprobado...) — nunca con datos
    inventados. Sin caché: el conteo de no leídas debe reflejar el estado
    real al instante, no un valor con TTL."""
    # id_cliente=None -> notificación interna del panel (admin/asesores).
    # id_cliente=N -> notificación para ese cliente (campana de su cuenta).
    # commit=False cuando el evento forma parte de una transacción mayor
    # (ver pago_estado_service.py): se guarda junto con el resto o nada.
    db.add(Notificacion(tipo=tipo, titulo=titulo, mensaje=mensaje, id_referencia=id_referencia, id_cliente=id_cliente))
    if commit:
        db.commit()


def get_actividad_cliente(db: Session, id_cliente: int, limit: int = 30) -> list[dict]:
    """
    Feed de notificaciones del cliente autenticado (campana del sitio
    público): une dos fuentes reales que ya existían — cambios de estado de
    SUS reservas (historial_reservas) y resoluciones de SUS solicitudes de
    cancelación (solicitudes_cancelacion) — ordenadas por fecha, más
    reciente primero. No crea ninguna tabla/columna nueva.

    Deliberadamente NO incluye:
      - Cambios de contraseña: Usuario no tiene columna de fecha/evento para
        esto — hoy solo se confirma al instante con un toast (ver
        TabCuenta.tsx handleActualizarPassword), no queda historial.
    Además incluye las notificaciones persistidas dirigidas a este cliente
    (Notificacion.id_cliente), como "¡Pago aprobado!".
    """
    from app.repositories.reserva_detail_repository import ReservaDetailRepository
    from app.repositories.solicitud_cancelacion_repository import SolicitudCancelacionRepository

    ESTADO_LABEL = {
        "pendiente": "quedó pendiente",
        "confirmada": "fue confirmada",
        "cancelada": "fue cancelada",
        "finalizada": "finalizó",
    }

    items: list[dict] = []

    for h in ReservaDetailRepository.get_historial_cliente(db, id_cliente, limit):
        estado_nuevo = h["estado_nuevo"]
        veredicto = ESTADO_LABEL.get(estado_nuevo, f"cambió a '{estado_nuevo}'")
        items.append(
            {
                "tipo": "reserva",
                "titulo": f"Tu reserva #{h['id_reserva']} {veredicto}",
                "mensaje": h["comentarios"],
                "fecha": h["fecha_cambio"],
                "id_referencia": h["id_reserva"],
            }
        )

    solicitudes = SolicitudCancelacionRepository.get_by_cliente(db, id_cliente, skip=0, limit=limit)
    for sol in solicitudes:
        if sol.estado == "pendiente" or not sol.fecha_resolucion:
            continue
        veredicto = "fue aprobada" if sol.estado == "aprobada" else "fue rechazada"
        items.append(
            {
                "tipo": "cancelacion",
                "titulo": f"Tu solicitud de cancelación de la reserva #{sol.id_reserva} {veredicto}",
                "mensaje": sol.comentario_resolucion,
                "fecha": sol.fecha_resolucion,
                "id_referencia": sol.id_reserva,
            }
        )

    # Notificaciones dirigidas a este cliente (ej. "¡Pago aprobado!", ver
    # pago_estado_service.py).
    propias = (
        db.query(Notificacion)
        .filter(Notificacion.id_cliente == id_cliente)
        .order_by(Notificacion.fecha_creacion.desc())
        .limit(limit)
        .all()
    )
    for n in propias:
        items.append(
            {
                "tipo": n.tipo,
                "titulo": n.titulo,
                "mensaje": n.mensaje,
                "fecha": n.fecha_creacion,
                "id_referencia": n.id_referencia,
            }
        )

    items.sort(key=lambda x: x["fecha"], reverse=True)
    return items[:limit]
