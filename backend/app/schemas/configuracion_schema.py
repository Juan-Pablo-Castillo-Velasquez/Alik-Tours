from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ConfiguracionCreate(BaseModel):
    # Quita espacios al inicio y al final: "   " ya no pasa como dato válido.
    model_config = ConfigDict(str_strip_whitespace=True)

    clave: str
    valor: str | None = None
    descripcion: str | None = None


class ConfiguracionUpdate(BaseModel):
    # Quita espacios al inicio y al final: "   " ya no pasa como dato válido.
    model_config = ConfigDict(str_strip_whitespace=True)

    valor: str | None = None
    descripcion: str | None = None


class ConfiguracionResponse(BaseModel):
    id_config: int
    clave: str
    valor: str | None = None
    descripcion: str | None = None
    actualizado_en: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
