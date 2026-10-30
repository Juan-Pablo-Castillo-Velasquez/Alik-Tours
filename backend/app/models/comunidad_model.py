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
    __tablename__ = "comentarios_comunidad"

    id_comentario = Column(Integer, primary_key=True, index=True)
    id_publicacion = Column(
        Integer, ForeignKey("publicaciones_comunidad.id_publicacion", ondelete="CASCADE"), nullable=False, index=True
    )
    id_cliente = Column(Integer, ForeignKey("clientes.id_cliente", ondelete="CASCADE"), nullable=False)
    contenido = Column(String(500), nullable=False)
    oculto = Column(Boolean, nullable=False, default=False)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())

    publicacion = relationship("PublicacionComunidad", back_populates="comentarios")
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
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
