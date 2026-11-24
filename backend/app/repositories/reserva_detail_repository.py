from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.reserva_model import HistorialReserva, Reserva


class ReservaDetailRepository:
    @staticmethod
    def get_habitaciones(db: Session, reserva_id: int):
        result = db.execute(
            text("""
            SELECT rh.id_habitacion, rh.fecha_checkin, rh.fecha_checkout,
                   rh.precio_acordado, h.numero_habitacion, h.precio_noche,
                   h.estado, th.nombre_tipo, hot.nombre_hotel,
                   hot.id_hotel, hot.direccion, hot.ciudad, hot.pais, hot.telefono,
                   hot.hora_checkin, hot.hora_checkout, hot.imagen_url AS imagen_hotel,
                   hot.politica_cancelacion
            FROM reserva_habitaciones rh
            JOIN habitaciones h ON h.id_habitacion = rh.id_habitacion
            JOIN tipo_habitacion th ON th.id_tipo_habitacion = h.id_tipo_habitacion
            JOIN hoteles hot ON hot.id_hotel = h.id_hotel
            WHERE rh.id_reserva = :id
        """),
            {"id": reserva_id},
        ).fetchall()
        return [dict(r._mapping) for r in result]

    @staticmethod
    def get_servicios(db: Session, reserva_id: int):
        result = db.execute(
            text("""
            SELECT rs.id_servicio, rs.fecha_servicio, rs.numero_personas,
                   rs.precio_acordado, s.nombre_servicio, s.descripcion,
                   s.duracion_horas, cs.nombre_categoria
            FROM reserva_servicios rs
            JOIN servicios s ON s.id_servicio = rs.id_servicio
            LEFT JOIN categoria_servicio cs ON cs.id_categoria = s.id_categoria
            WHERE rs.id_reserva = :id
        """),
            {"id": reserva_id},
        ).fetchall()
        return [dict(r._mapping) for r in result]

    @staticmethod
    def get_historial_reciente(db: Session, limit: int = 15):
        """
        Feed de actividad reciente para el Dashboard de admin: últimos
        cambios de estado de TODAS las reservas (no de una sola), más
        recientes primero. Misma tabla historial_reservas que ya usa
        get_historial — no crea ninguna tabla/columna nueva, solo agrega
        una consulta agregada sobre datos que ya existían.
        """
        result = db.execute(
            text("""
            SELECT hr.id_historial, hr.id_reserva, hr.estado_anterior, hr.estado_nuevo,
                   hr.fecha_cambio, hr.comentarios,
                   COALESCE(e.nombre || ' ' || e.apellido, 'Sistema') AS nombre_empleado
            FROM historial_reservas hr
            LEFT JOIN empleados e ON e.id_empleado = hr.id_empleado_responsable
            ORDER BY hr.fecha_cambio DESC
            LIMIT :limit
        """),
            {"limit": limit},
        ).fetchall()
        return [dict(r._mapping) for r in result]

    @staticmethod
    def get_historial_cliente(db: Session, id_cliente: int, limit: int = 30):
        """
        Cambios de estado reales de las reservas de UN cliente (para su feed
        de notificaciones en el sitio público) — excluye notas internas del
        asesor (estado_anterior = estado_nuevo, ver add_nota más abajo) porque
        esas no son un evento que el cliente deba ver. Misma tabla
        historial_reservas que ya alimenta el timeline y la actividad
        reciente del admin — ninguna tabla ni columna nueva.
        """
        result = db.execute(
            text("""
            SELECT hr.id_historial, hr.id_reserva, hr.estado_anterior, hr.estado_nuevo,
                   hr.fecha_cambio, hr.comentarios
            FROM historial_reservas hr
            JOIN reservas r ON r.id_reserva = hr.id_reserva
            WHERE r.id_cliente = :id_cliente
              AND hr.estado_anterior IS DISTINCT FROM hr.estado_nuevo
            ORDER BY hr.fecha_cambio DESC
            LIMIT :limit
        """),
            {"id_cliente": id_cliente, "limit": limit},
        ).fetchall()
        return [dict(r._mapping) for r in result]

    @staticmethod
    def get_historial(db: Session, reserva_id: int):
        result = db.execute(
            text("""
            SELECT hr.id_historial, hr.estado_anterior, hr.estado_nuevo,
                   hr.fecha_cambio, hr.comentarios,
                   COALESCE(e.nombre || ' ' || e.apellido, 'Sistema') AS nombre_empleado
            FROM historial_reservas hr
            LEFT JOIN empleados e ON e.id_empleado = hr.id_empleado_responsable
            WHERE hr.id_reserva = :id
            ORDER BY hr.fecha_cambio ASC
        """),
            {"id": reserva_id},
        ).fetchall()
        return [dict(r._mapping) for r in result]

    @staticmethod
    def add_nota(db: Session, reserva_id: int, id_empleado, comentario: str):
        """
        Nota interna de un asesor sobre una reserva — no cambia el estado
        (estado_anterior == estado_nuevo == estado actual), solo deja
        trazabilidad real en la misma tabla historial_reservas que ya
        alimenta el timeline y `fecha_ultima_actualizacion` (ver
        Reserva.fecha_ultima_actualizacion en reserva_model.py, que toma el
        max(fecha_cambio) del historial). No agrega ninguna tabla/columna.
        Retorna None si la reserva no existe.
        """
        reserva = db.query(Reserva).filter(Reserva.id_reserva == reserva_id).first()
        if not reserva:
            return None
        historial = HistorialReserva(
            id_reserva=reserva_id,
            estado_anterior=reserva.estado,
            estado_nuevo=reserva.estado,
            id_empleado_responsable=id_empleado,
            comentarios=comentario,
        )
        db.add(historial)
        db.commit()
        db.refresh(historial)
        nombre_empleado = "Sistema"
        if historial.empleado_responsable:
            nombre_empleado = f"{historial.empleado_responsable.nombre} {historial.empleado_responsable.apellido}"
        return {
            "id_historial": historial.id_historial,
            "estado_anterior": historial.estado_anterior,
            "estado_nuevo": historial.estado_nuevo,
            "fecha_cambio": historial.fecha_cambio,
            "comentarios": historial.comentarios,
            "nombre_empleado": nombre_empleado,
        }
