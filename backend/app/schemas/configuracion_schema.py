from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ConfiguracionCreate(BaseModel):
    clave: str
    valor: str | None = None
    descripcion: str | None = None


class ConfiguracionUpdate(BaseModel):
    valor: str | None = None
    descripcion: str | None = None


class ConfiguracionResponse(BaseModel):
    id_config: int
    clave: str
    valor: str | None = None
    descripcion: str | None = None
    actualizado_en: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
