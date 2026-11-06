from pydantic import BaseModel, ConfigDict, Field


class ServicioCreate(BaseModel):
    nombre_servicio: str = Field(..., min_length=1, max_length=100)
    descripcion: str | None = None
    id_categoria: int | None = None
    id_destino: int | None = None
    duracion_horas: float | None = None
    precio_base: float = Field(..., ge=0)
    capacidad_maxima: int = Field(..., gt=0)


class ServicioUpdate(BaseModel):
    nombre_servicio: str | None = None
    descripcion: str | None = None
    id_categoria: int | None = None
    id_destino: int | None = None
    duracion_horas: float | None = None
    precio_base: float | None = Field(None, ge=0)
    capacidad_maxima: int | None = Field(None, gt=0)


class ServicioResponse(BaseModel):
    id_servicio: int
    nombre_servicio: str
    descripcion: str | None = None
    id_categoria: int | None = None
    id_destino: int | None = None
    duracion_horas: float | None = None
    precio_base: float
    capacidad_maxima: int

    model_config = ConfigDict(from_attributes=True)


class CategoriaServicioResponse(BaseModel):
    id_categoria: int
    nombre_categoria: str

    model_config = ConfigDict(from_attributes=True)
