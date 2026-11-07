from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.validadores import FechaValida

EstadoOferta = Literal["borrador", "publicada", "pausada", "agotada", "finalizada"]
TipoTrayecto = Literal["solo_ida", "ida_regreso", "multiples"]
ClaseVuelo = Literal["economica", "premium_economy", "ejecutiva", "primera"]
TipoServicio = Literal["regular", "charter", "bajo_costo", "otro"]


def _iata(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    v = v.strip().upper()
    if len(v) != 3 or not v.isalpha():
        raise ValueError("El código IATA son 3 letras (ej. BOG)")
    return v


class _CamposOferta(BaseModel):
    titulo: str | None = Field(None, min_length=3, max_length=150)
    descripcion: str | None = Field(None, max_length=5000)
    estado: EstadoOferta | None = None
    aerolinea: str | None = Field(None, max_length=100)
    numero_vuelo: str | None = Field(None, max_length=20)
    codigo_referencia: str | None = Field(None, max_length=40)
    tipo_servicio: TipoServicio | None = None
    documentos_requeridos: str | None = Field(None, max_length=255)
    venta_independiente: bool | None = None
    origen_pais: str | None = Field(None, max_length=100)
    origen_ciudad: str | None = Field(None, min_length=2, max_length=100)
    origen_aeropuerto: str | None = Field(None, max_length=150)
    origen_iata: str | None = None
    origen_zona_horaria: str | None = Field(None, max_length=60)
    destino_pais: str | None = Field(None, max_length=100)
    destino_ciudad: str | None = Field(None, min_length=2, max_length=100)
    destino_aeropuerto: str | None = Field(None, max_length=150)
    destino_iata: str | None = None
    destino_zona_horaria: str | None = Field(None, max_length=60)
    tipo_trayecto: TipoTrayecto | None = None
    fecha_salida: FechaValida | None = None
    hora_salida: time | None = None
    fecha_llegada: FechaValida | None = None
    hora_llegada: time | None = None
    fecha_regreso: FechaValida | None = None
    hora_regreso: time | None = None
    fecha_llegada_regreso: FechaValida | None = None
    hora_llegada_regreso: time | None = None
    duracion_estimada: str | None = Field(None, max_length=40)
    clase: ClaseVuelo | None = None
    escalas: int | None = Field(None, ge=0, le=10)
    aeropuertos_conexion: str | None = Field(None, max_length=255)
    horarios_conexion: str | None = Field(None, max_length=2000)
    equipaje_mano: str | None = Field(None, max_length=150)
    equipaje_bodega: str | None = Field(None, max_length=150)
    condiciones_cambio: str | None = Field(None, max_length=3000)
    condiciones_cancelacion: str | None = Field(None, max_length=3000)
    restricciones: str | None = Field(None, max_length=3000)
    informacion_adicional: str | None = Field(None, max_length=3000)
    precio_adulto: float | None = Field(None, ge=0, le=100_000_000)
    precio_nino: float | None = Field(None, ge=0, le=100_000_000)
    precio_infante: float | None = Field(None, ge=0, le=100_000_000)
    impuestos_incluidos: bool | None = None
    cargos_adicionales: float | None = Field(None, ge=0, le=100_000_000)
    descripcion_cargos: str | None = Field(None, max_length=255)
    cupos: int | None = Field(None, ge=0, le=10000)
    vigencia_hasta: FechaValida | None = None
    condiciones_comerciales: str | None = Field(None, max_length=3000)

    @field_validator("origen_iata", "destino_iata")
    @classmethod
    def validar_iata(cls, v):
        return _iata(v)

    @model_validator(mode="after")
    def _coherencia(self):
        if self.fecha_salida and self.fecha_llegada and self.fecha_llegada < self.fecha_salida:
            raise ValueError("La fecha de llegada no puede ser antes de la salida")
        if self.fecha_salida and self.fecha_regreso and self.fecha_regreso < self.fecha_salida:
            raise ValueError("La fecha de regreso no puede ser antes de la salida")
        if self.fecha_regreso and self.fecha_llegada_regreso and self.fecha_llegada_regreso < self.fecha_regreso:
            raise ValueError("La llegada del regreso no puede ser antes de su salida")
        if self.tipo_trayecto == "solo_ida" and self.fecha_regreso:
            raise ValueError("Un vuelo solo de ida no tiene fecha de regreso")
        if (
            self.origen_ciudad
            and self.destino_ciudad
            and self.origen_ciudad.strip().lower() == self.destino_ciudad.strip().lower()
            and (self.origen_iata or "") == (self.destino_iata or "")
        ):
            raise ValueError("El origen y el destino no pueden ser el mismo")
        return self


class OfertaVueloCreate(_CamposOferta):
    titulo: str = Field(..., min_length=3, max_length=150)
    origen_ciudad: str = Field(..., min_length=2, max_length=100)
    destino_ciudad: str = Field(..., min_length=2, max_length=100)
    fecha_salida: FechaValida
    precio_adulto: float = Field(..., ge=0, le=100_000_000)
    estado: EstadoOferta = "borrador"
    tipo_trayecto: TipoTrayecto = "ida_regreso"
    venta_independiente: bool = False
    cargos_adicionales: float = Field(0, ge=0, le=100_000_000)

    @model_validator(mode="after")
    def _regreso_si_ida_y_regreso(self):
        if self.tipo_trayecto == "ida_regreso" and not self.fecha_regreso:
            raise ValueError("Un vuelo de ida y regreso necesita fecha de regreso")
        return self


class OfertaVueloUpdate(_CamposOferta):
    pass


class OfertaVueloResponse(BaseModel):
    id_oferta: int
    titulo: str
    descripcion: str | None = None
    estado: str
    aerolinea: str | None = None
    numero_vuelo: str | None = None
    codigo_referencia: str | None = None
    imagen_url: str | None = None
    tipo_servicio: str | None = None
    documentos_requeridos: str | None = None
    venta_independiente: bool = False
    origen_pais: str | None = None
    origen_ciudad: str
    origen_aeropuerto: str | None = None
    origen_iata: str | None = None
    origen_zona_horaria: str | None = None
    destino_pais: str | None = None
    destino_ciudad: str
    destino_aeropuerto: str | None = None
    destino_iata: str | None = None
    destino_zona_horaria: str | None = None
    tipo_trayecto: str
    fecha_salida: date
    hora_salida: time | None = None
    fecha_llegada: date | None = None
    hora_llegada: time | None = None
    fecha_regreso: date | None = None
    hora_regreso: time | None = None
    fecha_llegada_regreso: date | None = None
    hora_llegada_regreso: time | None = None
    duracion_estimada: str | None = None
    clase: str | None = None
    escalas: int | None = None
    aeropuertos_conexion: str | None = None
    horarios_conexion: str | None = None
    equipaje_mano: str | None = None
    equipaje_bodega: str | None = None
    condiciones_cambio: str | None = None
    condiciones_cancelacion: str | None = None
    restricciones: str | None = None
    informacion_adicional: str | None = None
    precio_adulto: float
    precio_nino: float | None = None
    precio_infante: float | None = None
    impuestos_incluidos: bool | None = None
    cargos_adicionales: float = 0
    descripcion_cargos: str | None = None
    cupos: int | None = None
    # Calculados: sillas ocupadas por reservas activas y las que quedan.
    cupos_usados: int = 0
    cupos_disponibles: int | None = None
    vigencia_hasta: date | None = None
    condiciones_comerciales: str | None = None
    fecha_creacion: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class OfertaVueloAdmin(OfertaVueloResponse):
    reservas_activas: int = 0
    paquetes: list[dict] = []


class OfertasVueloPagina(BaseModel):
    items: list[OfertaVueloAdmin]
    total: int
    pagina: int
    por_pagina: int


class EstadoOfertaUpdate(BaseModel):
    estado: EstadoOferta


class PasajeroOferta(BaseModel):
    id_reserva: int
    estado_reserva: str
    cliente: str
    tipo: str
    nombres: str
    apellidos: str
    fecha_nacimiento: date | None = None
    nacionalidad: str | None = None
    tipo_documento: str | None = None
    numero_documento: str | None = None


class ReservaDeOferta(BaseModel):
    id_reserva: int
    estado: str
    cliente: str
    tipo_producto: str | None = None
    adultos: int | None = None
    ninos: int | None = None
    infantes: int | None = None
    estado_vuelo: str | None = None
    fecha_reserva: datetime | None = None
