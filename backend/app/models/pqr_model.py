"""PQRSF: peticiones, quejas, reclamos, sugerencias y felicitaciones.

Una PQR la radica un cliente (o un asesor en su nombre, si llamó). Desde
ese momento corre un plazo en días hábiles (ver app/services/pqr_service.py
y app/core/dias_habiles.py). Todo lo que pasa con ella queda como una
actuación: mensajes del cliente y del equipo, notas internas, cambios de
estado, asignaciones, prórrogas y la respuesta de fondo.
"""

from sqlalchemy import TIMESTAMP, Boolean, Column, Date, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Pqr(Base):
    __tablename__ = "pqrs"

    id_pqr = Column(Integer, primary_key=True, index=True)
    # Número de radicado que se le entrega al cliente (ej. PQR-2026-000045).
    radicado = Column(String(30), unique=True, nullable=True, index=True)
    tipo = Column(String(20), nullable=False)
    canal = Column(String(20), nullable=False, default="web")

    id_cliente = Column(Integer, ForeignKey("clientes.id_cliente", ondelete="CASCADE"), nullable=False, index=True)
    # Quién la registró: el propio cliente o el asesor que la tomó por teléfono.
    id_usuario_radica = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True)
    id_reserva = Column(Integer, ForeignKey("reservas.id_reserva", ondelete="SET NULL"), nullable=True)

    asunto = Column(String(150), nullable=False)
    descripcion = Column(Text, nullable=False)
    # Lo que el cliente pide concretamente (obligatorio en los reclamos).
    pretension = Column(Text, nullable=True)
    autoriza_datos = Column(Boolean, nullable=False, default=False)

    estado = Column(String(20), nullable=False, default="radicada", index=True)
    prioridad = Column(String(10), nullable=False, default="normal")
    id_responsable = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True, index=True)

    # Plazo. fecha_inicio_termino: día desde el que se cuenta (el de la
    # radicación, o el día en que el cliente completó la información que se
    # le pidió). fecha_vencimiento: último día hábil para responder.
    dias_termino = Column(Integer, nullable=False)
    fecha_radicacion = Column(TIMESTAMP, nullable=False, server_default=func.now())
    fecha_inicio_termino = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date, nullable=False, index=True)
    fecha_vencimiento_original = Column(Date, nullable=True)
    prorrogada = Column(Boolean, nullable=False, default=False)
    motivo_prorroga = Column(Text, nullable=True)
    fecha_solicitud_informacion = Column(TIMESTAMP, nullable=True)

    # Respuesta de fondo.
    decision = Column(String(20), nullable=True)
    respuesta = Column(Text, nullable=True)
    fecha_respuesta = Column(TIMESTAMP, nullable=True)
    id_usuario_responde = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True)
    respondida_a_tiempo = Column(Boolean, nullable=True)

    # Tipificación: la clasifica el asesor (categoría y motivo, ver
    # pqr_service.TIPIFICACION). Es obligatoria para dar la respuesta.
    categoria = Column(String(30), nullable=True, index=True)
    motivo = Column(String(80), nullable=True)
    id_usuario_tipifica = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True)
    fecha_tipificacion = Column(TIMESTAMP, nullable=True)
    # PQR de ejemplo para demostraciones: se marcan en pantalla, no cuentan en
    # los indicadores y se pueden borrar todas juntas.
    es_ejemplo = Column(Boolean, nullable=False, default=False, server_default="false")

    satisfaccion = Column(Integer, nullable=True)
    comentario_satisfaccion = Column(Text, nullable=True)
    fecha_cierre = Column(TIMESTAMP, nullable=True)
    fecha_actualizacion = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    cliente = relationship("Cliente", foreign_keys=[id_cliente])
    reserva = relationship("Reserva", foreign_keys=[id_reserva])
    responsable = relationship("Usuario", foreign_keys=[id_responsable])
    actuaciones = relationship(
        "PqrActuacion",
        back_populates="pqr",
        cascade="all, delete-orphan",
        order_by="PqrActuacion.id_actuacion",
    )


class PqrActuacion(Base):
    __tablename__ = "pqr_actuaciones"

    id_actuacion = Column(Integer, primary_key=True, index=True)
    id_pqr = Column(Integer, ForeignKey("pqrs.id_pqr", ondelete="CASCADE"), nullable=False, index=True)
    # radicacion, mensaje_cliente, mensaje_equipo, nota_interna, estado,
    # asignacion, prorroga, solicitud_informacion, respuesta, desistimiento,
    # calificacion, cierre
    tipo = Column(String(30), nullable=False)
    texto = Column(Text, nullable=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True)
    autor_nombre = Column(String(120), nullable=True)
    # Las notas internas del equipo nunca llegan al cliente.
    visible_cliente = Column(Boolean, nullable=False, default=True)
    fecha = Column(TIMESTAMP, nullable=False, server_default=func.now())

    pqr = relationship("Pqr", back_populates="actuaciones")
