from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class AutorComunidad(BaseModel):
    nombre: str
    foto: str | None = None
    # True cuando escribe alguien del equipo de la agencia (admin/asesor).
    es_equipo: bool = False


class ComentarioResponse(BaseModel):
    id_comentario: int
    id_publicacion: int | None = None
    id_video: int | None = None
    id_padre: int | None = None
    contenido: str
    oculto: bool = False
    fecha_creacion: datetime | None = None
    autor: AutorComunidad
    es_mio: bool = False


class PublicacionResponse(BaseModel):
    id_publicacion: int
    titulo: str
    contenido: str
    calificacion: int | None = None
    destino: str | None = None
    video_url: str | None = None
    imagenes: list[str] = []
    estado: str
    motivo_moderacion: str | None = None
    fecha_creacion: datetime | None = None
    autor: AutorComunidad
    comentarios: list[ComentarioResponse] = []
    total_comentarios: int = 0
    es_mia: bool = False


class PublicacionesPaginadas(BaseModel):
    items: list[PublicacionResponse]
    total: int
    skip: int
    limit: int


class ComentarioCreate(BaseModel):
    contenido: str = Field(..., min_length=1, max_length=500)
    # Para responder a otro comentario del mismo hilo.
    id_padre: int | None = None

    @field_validator("contenido")
    @classmethod
    def no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El comentario no puede estar vacío")
        return v


class ModerarPublicacion(BaseModel):
    estado: str
    motivo: str | None = Field(None, max_length=300)

    @field_validator("estado")
    @classmethod
    def estado_valido(cls, v: str) -> str:
        if v not in ("aprobada", "rechazada", "oculta", "pendiente"):
            raise ValueError("estado debe ser: aprobada, rechazada, oculta o pendiente")
        return v


class OcultarComentario(BaseModel):
    oculto: bool


class VideoAgenciaResponse(BaseModel):
    id_video: int
    titulo: str
    descripcion: str | None = None
    video_url: str
    portada_url: str | None = None
    orden: int = 0
    activo: bool = True
    id_paquete: int | None = None
    nombre_paquete: str | None = None
    mostrar_inicio: bool = False
    fecha_creacion: datetime | None = None
    total_comentarios: int = 0
    comentarios: list[ComentarioResponse] = []


class VideoAgenciaUpdate(BaseModel):
    titulo: str | None = Field(None, min_length=1, max_length=150)
    descripcion: str | None = Field(None, max_length=500)
    activo: bool | None = None
    orden: int | None = Field(None, ge=0)
    mostrar_inicio: bool | None = None
    # 0 = quitar el paquete asociado (null en JSON ya significa "no cambiar").
    id_paquete: int | None = Field(None, ge=0)
