import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

# Catálogo cerrado de íconos decorativos (lucide-react) -- espejo exacto
# del mapa del frontend (alecktourfrondend/src/app/utils/temaIconos.tsx).
# Cerrado a propósito: así nunca se guarda un nombre que el frontend no
# sepa resolver, y el admin elige de una lista en vez de escribir texto
# libre.
ICONOS_PERMITIDOS = {
    "sparkles",
    "snowflake",
    "tree-pine",
    "ghost",
    "heart",
    "flower2",
    "sun",
    "umbrella",
    "party-popper",
    "gift",
    "star",
    "moon",
    "cloud-snow",
    "flame",
    "leaf",
}


def _validar_hex(valor: str) -> str:
    if not _HEX_RE.match(valor):
        raise ValueError("Color inválido: debe ser un hex de 6 dígitos, ej. #6e1832")
    return valor.lower()


class TemaBase(BaseModel):
    nombre: str
    color_primario_claro: str
    color_primario_oscuro: str
    color_secundario_claro: str
    color_secundario_oscuro: str
    icono: str | None = None

    @field_validator(
        "color_primario_claro",
        "color_primario_oscuro",
        "color_secundario_claro",
        "color_secundario_oscuro",
    )
    @classmethod
    def _colores_hex(cls, v: str) -> str:
        return _validar_hex(v)

    @field_validator("icono")
    @classmethod
    def _icono_valido(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if v not in ICONOS_PERMITIDOS:
            raise ValueError(f"Ícono inválido: debe ser uno de {sorted(ICONOS_PERMITIDOS)}")
        return v


class TemaCreate(TemaBase):
    pass


class TemaUpdate(TemaBase):
    pass


class TemaResponse(TemaBase):
    id_tema: int
    clave: str
    activo: bool
    es_predeterminado: bool
    # Se sube por separado (POST /api/temas/{id}/imagen, multipart) igual
    # que Banner.imagen_url -- nunca viaja en el body JSON de create/update.
    imagen_url: str | None = None
    # Mismo criterio que imagen_url: se sube por separado
    # (POST /api/temas/{id}/video, multipart), nunca en el body JSON.
    video_url: str | None = None
    fecha_creacion: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
