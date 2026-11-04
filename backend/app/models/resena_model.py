from sqlalchemy import TIMESTAMP, Boolean, CheckConstraint, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Resena(Base):
    __tablename__ = "resenas"

    id_resena = Column(Integer, primary_key=True, index=True)
    id_reserva = Column(Integer, ForeignKey("reservas.id_reserva", ondelete="CASCADE"), nullable=False, unique=True)
    id_cliente = Column(Integer, ForeignKey("clientes.id_cliente", ondelete="CASCADE"), nullable=False)
    id_hotel = Column(Integer, ForeignKey("hoteles.id_hotel", ondelete="CASCADE"), nullable=False)
    calificacion = Column(Integer, CheckConstraint("calificacion BETWEEN 1 AND 5"), nullable=False)
    comentario = Column(Text, nullable=False)
    foto_url = Column(String(500))
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    fecha_edicion = Column(TIMESTAMP, nullable=True)
    # Respuesta pública de la agencia (admin/asesor) a la reseña.
    respuesta_agencia = Column(Text, nullable=True)
    fecha_respuesta = Column(TIMESTAMP, nullable=True)
    # El equipo puede ocultar una reseña (spam, datos personales...).
    visible = Column(Boolean, nullable=False, default=True, server_default="true")

    reserva = relationship("Reserva")
    cliente = relationship("Cliente")
    hotel = relationship("Hotel", back_populates="resenas")
