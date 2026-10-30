from datetime import date

from pydantic import BaseModel, Field

from app.schemas.validadores import FechaValida


class DestinoCreate(BaseModel):
    nombre_destino: str = Field(..., min_length=1, max_length=100)
    descripcion: str | None = None
    ciudad: str | None = Field(None, max_length=100)
    pais: str | None = Field(None, max_length=100)
    temporada_alta_inicio: FechaValida | None = None
    temporada_alta_fin: FechaValida | None = None


class DestinoUpdate(BaseModel):
    nombre_destino: str | None = None
    descripcion: str | None = None
    ciudad: str | None = None
    pais: str | None = None
    temporada_alta_inicio: FechaValida | None = None
    temporada_alta_fin: FechaValida | None = None


class DestinoResponse(BaseModel):
    id_destino: int
    nombre_destino: str
    descripcion: str | None = None
    ciudad: str | None = None
    pais: str | None = None
    temporada_alta_inicio: date | None = None
    temporada_alta_fin: date | None = None

    class Config:
        from_attributes = True


class DestinoSugerenciaResponse(BaseModel):
    id_destino: int
    nombre_destino: str
    ciudad: str | None = None
    pais: str | None = None

    class Config:
        from_attributes = True
