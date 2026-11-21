"""Prototipo IoT: telemetría de los vehículos de traslado de la agencia.

Cada vehículo lleva un dispositivo (ESP32 con GPS y sensor de temperatura,
o el simulador de `iot/`) que cada pocos segundos envía una lectura por
HTTP a POST /api/iot/lecturas, autenticado con su propia clave. El panel
muestra el último dato de cada vehículo y su historial.
"""

from sqlalchemy import TIMESTAMP, Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DispositivoIoT(Base):
    __tablename__ = "dispositivos_iot"

    id_dispositivo = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    # Qué lleva el dispositivo, para mostrarlo en el panel (ej. "Van de traslados").
    descripcion = Column(String(255), nullable=True)
    # Solo se guarda el SHA-256 de la clave: la clave en claro se muestra
    # una única vez al crear el dispositivo (igual que un token de API).
    clave_hash = Column(String(64), nullable=False, unique=True, index=True)
    activo = Column(Boolean, nullable=False, default=True)
    ultima_conexion = Column(TIMESTAMP(timezone=True), nullable=True)
    creado_en = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    lecturas = relationship(
        "LecturaIoT", back_populates="dispositivo", cascade="all, delete-orphan", passive_deletes=True
    )


class LecturaIoT(Base):
    __tablename__ = "lecturas_iot"

    id_lectura = Column(Integer, primary_key=True, index=True)
    id_dispositivo = Column(
        Integer, ForeignKey("dispositivos_iot.id_dispositivo", ondelete="CASCADE"), nullable=False, index=True
    )
    # Hora que reporta el dispositivo (si la trae) y hora en que llegó al servidor.
    medido_en = Column(TIMESTAMP(timezone=True), nullable=True)
    recibido_en = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False, index=True)
    latitud = Column(Float, nullable=True)
    longitud = Column(Float, nullable=True)
    velocidad_kmh = Column(Float, nullable=True)
    temperatura_c = Column(Float, nullable=True)
    humedad_pct = Column(Float, nullable=True)
    pasajeros = Column(Integer, nullable=True)
    bateria_pct = Column(Float, nullable=True)

    dispositivo = relationship("DispositivoIoT", back_populates="lecturas")
