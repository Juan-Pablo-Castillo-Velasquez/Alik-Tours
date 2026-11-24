from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TipoPqr = Literal["peticion", "informacion", "consulta", "queja", "reclamo", "sugerencia", "felicitacion"]
EstadoPqr = Literal["radicada", "en_tramite", "esperando_cliente", "respondida", "cerrada", "desistida"]
DecisionPqr = Literal["favorable", "parcial", "desfavorable", "informativa"]


def _limpiar(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


class PqrCreate(BaseModel):
    tipo: TipoPqr
    asunto: str = Field(..., min_length=5, max_length=150)
    descripcion: str = Field(..., min_length=20, max_length=4000)
    pretension: str | None = Field(None, max_length=2000)
    id_reserva: int | None = None
    autoriza_datos: bool
    # Solo para el equipo: registrar la PQR de un cliente que llamó o vino.
    id_cliente: int | None = None
    canal: Literal["web", "telefono", "presencial", "correo", "whatsapp"] = "web"

    _limpiar = field_validator("asunto", "descripcion", "pretension", mode="before")(_limpiar)


class PqrMensajeCreate(BaseModel):
    texto: str = Field(..., min_length=2, max_length=3000)
    # Solo el equipo puede dejar notas internas.
    interna: bool = False

    _limpiar = field_validator("texto", mode="before")(_limpiar)


class PqrGestionUpdate(BaseModel):
    estado: Literal["en_tramite"] | None = None
    prioridad: Literal["normal", "alta"] | None = None
    # 0 = quitar el responsable.
    id_responsable: int | None = None


class PqrSolicitarInformacion(BaseModel):
    texto: str = Field(..., min_length=20, max_length=2000)


class PqrProrroga(BaseModel):
    dias_adicionales: int = Field(..., ge=1, le=30)
    motivo: str = Field(..., min_length=20, max_length=2000)


class PqrRespuesta(BaseModel):
    decision: DecisionPqr
    respuesta: str = Field(..., min_length=30, max_length=8000)


class PqrCalificacion(BaseModel):
    satisfaccion: int = Field(..., ge=1, le=5)
    comentario: str | None = Field(None, max_length=1000)


class PqrDesistimiento(BaseModel):
    motivo: str | None = Field(None, max_length=1000)


class PqrCierre(BaseModel):
    motivo: str = Field(..., min_length=10, max_length=1000)


class PqrActuacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_actuacion: int
    tipo: str
    texto: str | None
    autor_nombre: str | None
    autor_equipo: bool
    visible_cliente: bool
    fecha: datetime


class PqrResumenOut(BaseModel):
    id_pqr: int
    radicado: str
    tipo: TipoPqr
    tipo_nombre: str
    canal: str
    asunto: str
    estado: EstadoPqr
    prioridad: str
    id_cliente: int
    cliente_nombre: str | None
    id_reserva: int | None
    id_responsable: int | None
    responsable_nombre: str | None
    dias_termino: int
    fecha_radicacion: datetime
    fecha_vencimiento: date
    prorrogada: bool
    dias_habiles_restantes: int
    estado_plazo: Literal["a_tiempo", "por_vencer", "vencida", "pausada", "respondida_a_tiempo", "respondida_tarde"]
    decision: DecisionPqr | None
    fecha_respuesta: datetime | None
    satisfaccion: int | None
    ultima_actividad: datetime | None


class PqrDetalleOut(PqrResumenOut):
    descripcion: str
    pretension: str | None
    reserva_titulo: str | None
    fecha_vencimiento_original: date | None
    motivo_prorroga: str | None
    respuesta: str | None
    comentario_satisfaccion: str | None
    fecha_cierre: datetime | None
    puede_prorrogar: bool
    puede_solicitar_informacion: bool
    actuaciones: list[PqrActuacionOut]


class PqrResumenGestion(BaseModel):
    abiertas: int
    sin_asignar: int
    por_vencer: int
    vencidas: int
    respondidas: int
    a_tiempo_pct: int | None
    satisfaccion_promedio: float | None


class PqrPagina(BaseModel):
    items: list[PqrResumenOut]
    total: int
    page: int
    page_size: int
    resumen: PqrResumenGestion


class PqrTipoOut(BaseModel):
    tipo: TipoPqr
    nombre: str
    descripcion: str
    dias: int
    norma: str


class PqrResponsableOut(BaseModel):
    id_usuario: int
    nombre: str
