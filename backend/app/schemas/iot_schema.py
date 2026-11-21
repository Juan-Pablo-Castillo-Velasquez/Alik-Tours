from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class LecturaIoTEntrada(BaseModel):
    """Lo que envía el dispositivo. Todos los sensores son opcionales (un
    dispositivo sin GPS manda solo temperatura), pero al menos uno debe venir
    y cada valor debe estar en un rango físico posible."""

    model_config = ConfigDict(extra="forbid")

    medido_en: datetime | None = None
    latitud: float | None = Field(None, ge=-90, le=90)
    longitud: float | None = Field(None, ge=-180, le=180)
    velocidad_kmh: float | None = Field(None, ge=0, le=250)
    temperatura_c: float | None = Field(None, ge=-40, le=85)
    humedad_pct: float | None = Field(None, ge=0, le=100)
    pasajeros: int | None = Field(None, ge=0, le=80)
    bateria_pct: float | None = Field(None, ge=0, le=100)

    @model_validator(mode="after")
    def al_menos_un_sensor(self):
        sensores = (
            self.latitud,
            self.longitud,
            self.velocidad_kmh,
            self.temperatura_c,
            self.humedad_pct,
            self.pasajeros,
            self.bateria_pct,
        )
        if all(v is None for v in sensores):
            raise ValueError("La lectura no trae ningún dato de sensor")
        if (self.latitud is None) != (self.longitud is None):
            raise ValueError("La posición necesita latitud y longitud juntas")
        return self


class LecturaIoTResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_lectura: int
    medido_en: datetime | None
    recibido_en: datetime
    latitud: float | None
    longitud: float | None
    velocidad_kmh: float | None
    temperatura_c: float | None
    humedad_pct: float | None
    pasajeros: int | None
    bateria_pct: float | None


class LecturaRecibida(BaseModel):
    id_lectura: int
    recibido_en: datetime
    alertas: list[str] = []


class DispositivoIoTCrear(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: str | None = Field(None, max_length=255)


class DispositivoIoTResponse(BaseModel):
    id_dispositivo: int
    nombre: str
    descripcion: str | None
    activo: bool
    ultima_conexion: datetime | None
    # en_linea (reportó hace menos de 2 min), inactivo (más tiempo) o sin_datos.
    estado: str
    ultima_lectura: LecturaIoTResponse | None
    alertas: list[str] = []


class DispositivoIoTCreado(DispositivoIoTResponse):
    # Solo en la respuesta de creación: se debe copiar al dispositivo.
    clave: str
