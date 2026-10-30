from sqlalchemy import TIMESTAMP, Boolean, Column, ForeignKey, Integer, String, Text, func

from app.core.database import Base


class Notificacion(Base):
    """Notificación real para el admin — creada en el punto exacto donde
    ocurre el evento (nueva solicitud de cancelación, mensaje de contacto,
    solicitud corporativa, pago aprobado...) vía
    app.services.notificacion_service.crear_notificacion. Nunca se inserta
    una fila con datos inventados."""

    __tablename__ = "notificaciones"

    id_notificacion = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(30), nullable=False)
    titulo = Column(String(200), nullable=False)
    mensaje = Column(Text, nullable=True)
    # id de la reserva/solicitud/pago relacionado, cuando aplica — para un
    # futuro deep-link directo desde la notificación a su origen.
    id_referencia = Column(Integer, nullable=True)
    # Destinatario: NULL = notificación interna del panel de admin (como
    # siempre); un id_cliente = notificación para ese cliente (ej. "¡Pago
    # aprobado!"), que ve en la campana de su cuenta.
    id_cliente = Column(Integer, ForeignKey("clientes.id_cliente", ondelete="CASCADE"), nullable=True, index=True)
    leido = Column(Boolean, nullable=False, default=False, index=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
