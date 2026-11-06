from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

ESTADOS_VALIDOS = ["nuevo", "contactado", "cerrado", "descartado"]


class SolicitudCorporativaCreate(BaseModel):
    nombre_empresa: str = Field(..., min_length=2, max_length=150)
    numero_empleados: str | None = None
    nombre_contacto: str = Field(..., min_length=2, max_length=100)
    email_corporativo: EmailStr
    telefono: str = Field(..., min_length=6, max_length=30)
    mensaje: str | None = Field(None, max_length=2000)


class SolicitudCorporativaUpdate(BaseModel):
    estado: str

    @field_validator("estado")
    @classmethod
    def validate_estado(cls, v):
        if v not in ESTADOS_VALIDOS:
            raise ValueError(f"estado debe ser uno de: {', '.join(ESTADOS_VALIDOS)}")
        return v


class SolicitudCorporativaResponse(BaseModel):
    id_solicitud: int
    nombre_empresa: str
    numero_empleados: str | None = None
    nombre_contacto: str
    email_corporativo: str
    telefono: str
    mensaje: str | None = None
    estado: str
    fecha_creacion: datetime

    model_config = ConfigDict(from_attributes=True)
