"""
Comunidad viajera: publicaciones de clientes (video corto o fotos + texto +
calificación), comentarios entre clientes y videos propios de la agencia.

Moderación: toda publicación nace "pendiente" y solo se ve en el sitio
cuando un admin/asesor la aprueba. Los comentarios se publican al instante
y el equipo puede ocultarlos.
"""

from sqlalchemy import TIMESTAMP, Boolean, CheckConstraint, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base

ESTADOS_PUBLICACION = ("pendiente", "aprobada", "rechazada", "oculta")


class PublicacionComunidad(Base):
    __tablename__ = "publicaciones_comunidad"

    id_publicacion = Column(Integer, primary_key=True, index=True)
    id_cliente = Column(Integer, ForeignKey("clientes.id_cliente", ondelete="CASCADE"), nullable=False, index=True)
    titulo = Column(String(150), nullable=False)
    contenido = Column(Text, nullable=False)
    calificacion = Column(Integer, CheckConstraint("calificacion BETWEEN 1 AND 5"), nullable=True)
    destino = Column(String(120), nullable=True)
    video_url = Column(String(500), nullable=True)
    estado = Column(
        String(20),
        CheckConstraint("estado IN ('pendiente', 'aprobada', 'rechazada', 'oculta')"),
        nullable=False,
        default="pendiente",
        index=True,
    )
    motivo_moderacion = Column(String(300), nullable=True)
    id_moderador = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    fecha_moderacion = Column(TIMESTAMP, nullable=True)

    cliente = relationship("Cliente")
    imagenes = relationship(
        "ImagenPublicacion",
        back_populates="publicacion",
        cascade="all, delete-orphan",
        order_by="ImagenPublicacion.orden",
    )
    comentarios = relationship(
        "ComentarioComunidad",
        back_populates="publicacion",
        cascade="all, delete-orphan",
        order_by="ComentarioComunidad.fecha_creacion",
    )


class ImagenPublicacion(Base):
    __tablename__ = "imagenes_publicacion"

    id_imagen = Column(Integer, primary_key=True, index=True)
    id_publicacion = Column(
        Integer, ForeignKey("publicaciones_comunidad.id_publicacion", ondelete="CASCADE"), nullable=False, index=True
    )
    url = Column(String(500), nullable=False)
    orden = Column(Integer, nullable=False, default=0)

    publicacion = relationship("PublicacionComunidad", back_populates="imagenes")


class ComentarioComunidad(Base):
    """Comentario en una publicación de un cliente O en un video de la
    agencia (exactamente uno de los dos). Lo escribe un cliente o alguien
    del equipo (admin/asesor): el equipo responde con el nombre de la
    agencia. id_padre = respuesta a otro comentario (un solo nivel)."""

    __tablename__ = "comentarios_comunidad"
    __table_args__ = (
        CheckConstraint(
            "(id_publicacion IS NOT NULL AND id_video IS NULL) OR (id_publicacion IS NULL AND id_video IS NOT NULL)",
            name="ck_comentario_publicacion_o_video",
        ),
        CheckConstraint("id_cliente IS NOT NULL OR id_usuario_equipo IS NOT NULL", name="ck_comentario_tiene_autor"),
    )

    id_comentario = Column(Integer, primary_key=True, index=True)
    id_publicacion = Column(
        Integer, ForeignKey("publicaciones_comunidad.id_publicacion", ondelete="CASCADE"), nullable=True, index=True
    )
    id_video = Column(Integer, ForeignKey("videos_agencia.id_video", ondelete="CASCADE"), nullable=True, index=True)
    id_cliente = Column(Integer, ForeignKey("clientes.id_cliente", ondelete="CASCADE"), nullable=True)
    id_usuario_equipo = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True)
    id_padre = Column(
        Integer, ForeignKey("comentarios_comunidad.id_comentario", ondelete="CASCADE"), nullable=True, index=True
    )
    contenido = Column(String(500), nullable=False)
    oculto = Column(Boolean, nullable=False, default=False)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())

    publicacion = relationship("PublicacionComunidad", back_populates="comentarios")
    video = relationship("VideoAgencia", back_populates="comentarios")
    cliente = relationship("Cliente")


class VideoAgencia(Base):
    """Videos propios de Alik Tours (sección "Lo que hacemos")."""

    __tablename__ = "videos_agencia"

    id_video = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(150), nullable=False)
    descripcion = Column(String(500), nullable=True)
    video_url = Column(String(500), nullable=False)
    portada_url = Column(String(500), nullable=True)
    orden = Column(Integer, nullable=False, default=0)
    activo = Column(Boolean, nullable=False, default=True)
    # Video promocional de un viaje: aparece en la ficha de ese paquete.
    id_paquete = Column(Integer, ForeignKey("paquetes.id_paquete", ondelete="SET NULL"), nullable=True, index=True)
    # Se muestra también en la página de inicio.
    mostrar_inicio = Column(Boolean, nullable=False, default=False, server_default="false")
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())

    paquete = relationship("Paquete")
    comentarios = relationship(
        "ComentarioComunidad",
        back_populates="video",
        cascade="all, delete-orphan",
        order_by="ComentarioComunidad.fecha_creacion",
    )
