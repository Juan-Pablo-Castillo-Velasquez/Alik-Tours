from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class BannerResponse(BaseModel):
    id_banner: int
    titulo: str
    descripcion_corta: str | None = None
    imagen_url: str
    texto_boton: str | None = None
    link_destino: str | None = None
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    temporada: str | None = None
    tipo: str = "banner"
    orden: int
    activo: bool
    fecha_creacion: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class BannerReorderItem(BaseModel):
    id_banner: int
    orden: int
