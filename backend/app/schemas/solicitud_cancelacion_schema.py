# Guardar como: backend/app/schemas/solicitud_cancelacion_schema.py

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Debe coincidir con el array MOTIVOS del modal en TabReservas.tsx
MOTIVOS_VALIDOS = [
    "Cambio de planes personales",
    "Problema económico",
    "Emergencia médica o familiar",
    "Error al hacer la reserva",
    "Encontré una mejor opción",
    "Otro motivo",
]


class SolicitudCancelacionCreate(BaseModel):
    motivo: str = Field(..., min_length=1, max_length=100)
    # Solo obligatorio cuando motivo == "Otro motivo" (se valida en el service)
    motivo_detalle: str | None = Field(None, max_length=1000)

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, v):
        if v not in MOTIVOS_VALIDOS:
            raise ValueError(f"motivo debe ser uno de: {', '.join(MOTIVOS_VALIDOS)}")
        return v


class SolicitudCancelacionResponse(BaseModel):
    id_solicitud: int
    id_reserva: int
    id_cliente: int
    motivo: str
    motivo_detalle: str | None = None
    estado: str
    fecha_solicitud: datetime
    fecha_resolucion: datetime | None = None
    comentario_resolucion: str | None = None
    # Ya existía como columna en el modelo (SolicitudCancelacion.id_empleado_resolutor)
    # pero no se exponía en la respuesta — el panel de admin lo necesita para
    # mostrar qué asesor tomó la decisión (trazabilidad).
    id_empleado_resolutor: int | None = None

    model_config = ConfigDict(from_attributes=True)


class SolicitudCancelacionResolve(BaseModel):
    estado: str = Field(..., description="'aprobada' o 'rechazada'")
    # Obligatorio: el panel de admin exige un motivo interno para cada
    # decisión de aprobar/rechazar (queda como registro de auditoría).
    comentario_resolucion: str = Field(..., min_length=1, max_length=1000)

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, v):
        if v not in ("aprobada", "rechazada"):
            raise ValueError("estado debe ser 'aprobada' o 'rechazada'")
        return v

    @field_validator("comentario_resolucion")
    @classmethod
    def validar_comentario(cls, v):
        if not v or not v.strip():
            raise ValueError("Debes indicar un motivo interno para la decisión")
        return v.strip()
