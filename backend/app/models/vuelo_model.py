from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base

ESTADOS_OFERTA_VUELO = ("borrador", "publicada", "pausada", "agotada", "finalizada")
TIPOS_TRAYECTO = ("solo_ida", "ida_regreso", "multiples")
CLASES_VUELO = ("economica", "premium_economy", "ejecutiva", "primera")


class OfertaVuelo(Base):
    """Oferta aérea GESTIONADA POR LA AGENCIA (no hay integración con
    aerolíneas ni GDS: no es disponibilidad en tiempo real). La registra el
    admin con los datos que le confirmó el proveedor; lo que no se sabe se
    deja vacío y la vista pública no lo muestra como confirmado."""

    __tablename__ = "ofertas_vuelo"
    __table_args__ = (
        CheckConstraint(f"estado IN {ESTADOS_OFERTA_VUELO}", name="ck_oferta_vuelo_estado"),
        CheckConstraint(f"tipo_trayecto IN {TIPOS_TRAYECTO}", name="ck_oferta_vuelo_trayecto"),
        CheckConstraint(f"clase IS NULL OR clase IN {CLASES_VUELO}", name="ck_oferta_vuelo_clase"),
        CheckConstraint("precio_adulto >= 0", name="ck_oferta_vuelo_precio_adulto"),
        CheckConstraint("precio_nino IS NULL OR precio_nino >= 0", name="ck_oferta_vuelo_precio_nino"),
        CheckConstraint("precio_infante IS NULL OR precio_infante >= 0", name="ck_oferta_vuelo_precio_infante"),
        CheckConstraint("cargos_adicionales >= 0", name="ck_oferta_vuelo_cargos"),
        CheckConstraint("cupos IS NULL OR cupos >= 0", name="ck_oferta_vuelo_cupos"),
        CheckConstraint("escalas IS NULL OR escalas >= 0", name="ck_oferta_vuelo_escalas"),
    )

    id_oferta = Column(Integer, primary_key=True, index=True)
    # Información general
    titulo = Column(String(150), nullable=False)
    descripcion = Column(Text)
    estado = Column(String(20), nullable=False, default="borrador", index=True)
    aerolinea = Column(String(100))
    numero_vuelo = Column(String(20))
    codigo_referencia = Column(String(40))
    imagen_url = Column(String(255))
    # Se puede vender sola (no solo dentro de un paquete).
    venta_independiente = Column(Boolean, nullable=False, default=False)
    # Origen y destino
    origen_pais = Column(String(100))
    origen_ciudad = Column(String(100), nullable=False)
    origen_aeropuerto = Column(String(150))
    origen_iata = Column(String(3))
    origen_zona_horaria = Column(String(60))
    destino_pais = Column(String(100))
    destino_ciudad = Column(String(100), nullable=False)
    destino_aeropuerto = Column(String(150))
    destino_iata = Column(String(3))
    destino_zona_horaria = Column(String(60))
    tipo_trayecto = Column(String(20), nullable=False, default="ida_regreso")
    # Fechas (las horas son opcionales: solo cuando están confirmadas)
    fecha_salida = Column(Date, nullable=False, index=True)
    hora_salida = Column(Time)
    fecha_llegada = Column(Date)
    hora_llegada = Column(Time)
    fecha_regreso = Column(Date)
    hora_regreso = Column(Time)
    fecha_llegada_regreso = Column(Date)
    hora_llegada_regreso = Column(Time)
    duracion_estimada = Column(String(40))
    # Características
    clase = Column(String(20))
    escalas = Column(Integer)
    aeropuertos_conexion = Column(String(255))
    horarios_conexion = Column(Text)
    equipaje_mano = Column(String(150))
    equipaje_bodega = Column(String(150))
    condiciones_cambio = Column(Text)
    condiciones_cancelacion = Column(Text)
    restricciones = Column(Text)
    informacion_adicional = Column(Text)
    # Comercial (pesos colombianos)
    precio_adulto = Column(Numeric(12, 2), nullable=False)
    precio_nino = Column(Numeric(12, 2))
    precio_infante = Column(Numeric(12, 2))
    impuestos_incluidos = Column(Boolean)
    # Cargos adicionales POR PASAJERO (tasas, combustible...).
    cargos_adicionales = Column(Numeric(12, 2), nullable=False, default=0)
    descripcion_cargos = Column(String(255))
    # Sillas que maneja la agencia (None = no se controlan cupos).
    cupos = Column(Integer)
    vigencia_hasta = Column(Date)
    condiciones_comerciales = Column(Text)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    fecha_actualizacion = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    paquete_vuelos = relationship("PaqueteVuelo", back_populates="oferta", cascade="all, delete-orphan")


class PaqueteVuelo(Base):
    """Ofertas aéreas que se pueden usar con un paquete (incluidas u
    opcionales según Paquete.modalidad_vuelo)."""

    __tablename__ = "paquete_vuelos"

    id_paquete = Column(Integer, ForeignKey("paquetes.id_paquete", ondelete="CASCADE"), primary_key=True)
    id_oferta = Column(Integer, ForeignKey("ofertas_vuelo.id_oferta", ondelete="CASCADE"), primary_key=True)

    paquete = relationship("Paquete", back_populates="paquete_vuelos")
    oferta = relationship("OfertaVuelo", back_populates="paquete_vuelos")
