from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Hotel(Base):
    __tablename__ = "hoteles"

    id_hotel = Column(Integer, primary_key=True, index=True)
    nombre_hotel = Column(String(100), nullable=False)
    calificacion = Column(Integer, CheckConstraint("calificacion BETWEEN 1 AND 5"))
    direccion = Column(String(255))
    ciudad = Column(String(100))
    pais = Column(String(100))
    codigo_postal = Column(String(20))
    correo_electronico = Column(String(100))
    telefono = Column(String(20))
    # Antes no existía ningún campo de imagen real — el frontend mostraba
    # la misma foto de stock por ciudad para todos los hoteles (ver
    # CITY_IMAGES en HotelCard.tsx/HotelDetail.tsx, que sigue de respaldo
    # para hoteles sin foto todavía). Nullable: hoteles existentes no
    # tienen ninguna hasta que un admin suba una (ver
    # POST /api/hoteles/{id}/imagen).
    imagen_url = Column(String(255), nullable=True)
    # Descripción y políticas propias de cada hotel (texto libre del panel).
    # Nullable: la vista pública omite la sección si está vacía.
    descripcion = Column(Text, nullable=True)
    politicas = Column(Text, nullable=True)

    habitaciones = relationship("Habitacion", back_populates="hotel", cascade="all, delete-orphan")
    hotel_caracteristicas = relationship("HotelCaracteristica", back_populates="hotel", cascade="all, delete-orphan")
    resenas = relationship("Resena", back_populates="hotel")
    # Galería de fotos reales del hotel (distinta de imagen_url, que es solo
    # la portada) -- antes no existía ninguna forma de subir más de una
    # foto por hotel, ver ImagenHotel más abajo y POST /hoteles/{id}/galeria
    # en hotel_route.py. order_by asegura que siempre viajen en el orden en
    # que el admin las subió (no el orden de inserción en la BD, que en
    # Postgres no está garantizado sin un ORDER BY explícito).
    imagenes = relationship(
        "ImagenHotel", back_populates="hotel", cascade="all, delete-orphan", order_by="ImagenHotel.orden"
    )

    @property
    def total_resenas(self) -> int:
        """Cantidad real de reseñas de clientes que dejaron este hotel —
        usado para mostrar información comercial real (ej. "4.6 (23 reseñas)")
        en vez de conteos inventados en las tarjetas de hotel."""
        return len(self.resenas)

    @property
    def calificacion_promedio(self):
        """Promedio real de calificación de clientes (1-5, de la tabla
        `resenas`), distinto de `calificacion` (categoría/estrellas fijada
        por el hotel). None si todavía no hay ninguna reseña real — el
        frontend debe usar `calificacion` como respaldo en ese caso, nunca
        inventar un promedio."""
        if not self.resenas:
            return None
        return round(sum(r.calificacion for r in self.resenas) / len(self.resenas), 1)


class ImagenHotel(Base):
    """Una foto de la galería de un hotel (distinta de Hotel.imagen_url, que
    es solo la portada) -- antes Hotel no tenía forma de guardar más de una
    imagen: la ficha pública rellenaba la galería con fotos de stock
    genéricas (ver AMENITY_POOL en HotelDetail.tsx). `orden` es la posición
    en que el admin las subió/organizó (ver POST/DELETE
    /hoteles/{id}/galeria en hotel_route.py)."""

    __tablename__ = "imagenes_hotel"

    id_imagen = Column(Integer, primary_key=True, index=True)
    id_hotel = Column(Integer, ForeignKey("hoteles.id_hotel", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    orden = Column(Integer, nullable=False, default=0)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())

    hotel = relationship("Hotel", back_populates="imagenes")


class Caracteristica(Base):
    __tablename__ = "caracteristicas_hotel"

    id_caracteristica = Column(Integer, primary_key=True, index=True)
    nombre_caracteristica = Column(String(100), unique=True, nullable=False)

    hotel_caracteristicas = relationship(
        "HotelCaracteristica", back_populates="caracteristica", cascade="all, delete-orphan"
    )


class HotelCaracteristica(Base):
    __tablename__ = "hotel_caracteristicas"

    id_hotel = Column(Integer, ForeignKey("hoteles.id_hotel", ondelete="CASCADE"), primary_key=True)
    id_caracteristica = Column(
        Integer, ForeignKey("caracteristicas_hotel.id_caracteristica", ondelete="CASCADE"), primary_key=True
    )
    disponible = Column(Boolean, default=True)

    hotel = relationship("Hotel", back_populates="hotel_caracteristicas")
    caracteristica = relationship("Caracteristica", back_populates="hotel_caracteristicas")


class TipoHabitacion(Base):
    __tablename__ = "tipo_habitacion"

    id_tipo_habitacion = Column(Integer, primary_key=True, index=True)
    nombre_tipo = Column(String(50), nullable=False)
    descripcion = Column(String(200))
    capacidad_personas = Column(Integer, nullable=False)

    habitaciones = relationship("Habitacion", back_populates="tipo_habitacion")


class Habitacion(Base):
    __tablename__ = "habitaciones"

    id_habitacion = Column(Integer, primary_key=True, index=True)
    id_hotel = Column(Integer, ForeignKey("hoteles.id_hotel", ondelete="CASCADE"), nullable=False)
    id_tipo_habitacion = Column(Integer, ForeignKey("tipo_habitacion.id_tipo_habitacion"), nullable=False)
    numero_habitacion = Column(String(20), nullable=False)
    precio_noche = Column(Numeric(10, 2), CheckConstraint("precio_noche >= 0"), nullable=False)
    estado = Column(String(20), CheckConstraint("estado IN ('disponible', 'ocupada', 'mantenimiento')"), nullable=False)

    hotel = relationship("Hotel", back_populates="habitaciones")
    tipo_habitacion = relationship("TipoHabitacion", back_populates="habitaciones")
    reserva_habitaciones = relationship("ReservaHabitacion", back_populates="habitacion")

    __table_args__ = (UniqueConstraint("id_hotel", "numero_habitacion", name="uq_hotel_numero"),)
