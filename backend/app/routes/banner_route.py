"""Banners publicitarios administrables (sección 7 del plan de mejora).

Distinto de /api/promociones/* (promociones_route.py), que deriva datos de
la tabla `hoteles` y no es una tabla de banners real — ver el comentario en
app/models/banner_model.py. Prefijo /api/banners a propósito, para no
chocar con esa ruta existente.
"""

from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.cache import delete_pattern, get_cached, set_cached
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.file_validation import validar_y_leer_archivo
from app.core.image_storage import borrar_imagen, guardar_imagen
from app.core.security import require_admin
from app.repositories.banner_repository import BannerRepository
from app.schemas.banner_schema import BannerReorderItem, BannerResponse

router = APIRouter(prefix="/api/banners", tags=["Banners"])

PUBLIC_PATH_PREFIX = "/uploads/banners"
BANNER_TIPOS_PERMITIDOS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024  # 5MB

# Ver sección 8 del plan de mejora (esquema de claves Redis): prefijo
# "promo:" para contenido público cacheado con TTL largo (cambia con poca
# frecuencia — un admin editando banners, no una escritura de cliente).
BANNERS_CACHE_KEY = "promo:banners:activos"
TIPOS_BANNER_VALIDOS = {"banner", "folleto"}
BANNERS_CACHE_PATTERN = "promo:banners:*"
BANNERS_CACHE_TTL = 1800  # 30 min


class BannerActivoUpdate(BaseModel):
    activo: bool


def _borrar_archivo_si_existe(imagen_url: str | None) -> None:
    borrar_imagen(imagen_url, carpeta="banners", public_path_prefix=PUBLIC_PATH_PREFIX)


async def _guardar_imagen(file: UploadFile) -> str:
    # Mismas validaciones que usuario_route.py::subir_foto_perfil (formato
    # por magic bytes y tamaño máximo en chunks) — mismo criterio en todo el
    # proyecto para cualquier imagen subida por un usuario/admin.
    contenido, extension = await validar_y_leer_archivo(
        file,
        tipos_permitidos=BANNER_TIPOS_PERMITIDOS,
        mensaje_tipo="Formato de imagen no soportado. Usa JPG, PNG o WEBP.",
        tamano_maximo_bytes=TAMANO_MAXIMO_BYTES,
    )
    return guardar_imagen(contenido, extension, carpeta="banners", public_path_prefix=PUBLIC_PATH_PREFIX)


# ===================== PÚBLICO =====================
@router.get("/activos", response_model=list[BannerResponse])
def get_banners_activos(
    tipo: str | None = Query(None, description='Filtra por "banner" o "folleto"; sin filtro devuelve ambos.'),
    db: Session = Depends(get_db),
):
    """Solo banners activos y dentro de su rango de vigencia, en orden —
    lo que debe ver un visitante del sitio ahora mismo (carrusel del home,
    acordeón de ofertas, o el anuncio de bienvenida a pantalla completa,
    según `tipo`)."""
    cache_key = f"{BANNERS_CACHE_KEY}:{tipo or 'todos'}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    activos = BannerRepository.get_activos(db, tipo=tipo)
    data = [BannerResponse.model_validate(b).model_dump(mode="json") for b in activos]
    set_cached(cache_key, data, ttl_seconds=BANNERS_CACHE_TTL)
    return data


# ===================== ADMIN =====================
@router.get("/", response_model=list[BannerResponse])
def get_banners_admin(db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Listado completo (incluye inactivos/fuera de vigencia) para
    ModuleBanners.tsx — a diferencia de /activos, sin caché: es una vista
    de administración, no contenido público de alto tráfico."""
    return BannerRepository.get_all(db)


@router.post("/", response_model=BannerResponse, status_code=201)
async def create_banner(
    titulo: str = Form(...),
    descripcion_corta: str | None = Form(None),
    texto_boton: str | None = Form(None),
    link_destino: str | None = Form(None),
    fecha_inicio: date | None = Form(None),
    fecha_fin: date | None = Form(None),
    temporada: str | None = Form(None),
    tipo: str = Form("banner"),
    activo: bool = Form(True),
    imagen: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    if tipo not in TIPOS_BANNER_VALIDOS:
        raise HTTPException(status_code=400, detail=f"tipo debe ser uno de {sorted(TIPOS_BANNER_VALIDOS)}")

    imagen_url = await _guardar_imagen(imagen)
    orden = BannerRepository.get_siguiente_orden(db)

    nuevo = BannerRepository.create(
        db,
        {
            "titulo": titulo,
            "descripcion_corta": descripcion_corta,
            "imagen_url": imagen_url,
            "texto_boton": texto_boton,
            "link_destino": link_destino,
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "temporada": temporada or None,
            "tipo": tipo,
            "orden": orden,
            "activo": activo,
        },
    )
    delete_pattern(BANNERS_CACHE_PATTERN)
    return nuevo


@router.put("/{banner_id}", response_model=BannerResponse)
async def update_banner(
    banner_id: int,
    titulo: str = Form(...),
    descripcion_corta: str | None = Form(None),
    texto_boton: str | None = Form(None),
    link_destino: str | None = Form(None),
    fecha_inicio: date | None = Form(None),
    fecha_fin: date | None = Form(None),
    temporada: str | None = Form(None),
    tipo: str = Form("banner"),
    activo: bool = Form(True),
    imagen: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    if tipo not in TIPOS_BANNER_VALIDOS:
        raise HTTPException(status_code=400, detail=f"tipo debe ser uno de {sorted(TIPOS_BANNER_VALIDOS)}")

    existente = BannerRepository.get_by_id(db, banner_id)
    if not existente:
        raise HTTPException(status_code=404, detail="Banner no encontrado")

    datos = {
        "titulo": titulo,
        "descripcion_corta": descripcion_corta,
        "texto_boton": texto_boton,
        "link_destino": link_destino,
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "temporada": temporada or None,
        "tipo": tipo,
        "activo": activo,
    }

    # La imagen es opcional al editar: si no se manda una nueva, se
    # conserva la que ya tenía (no se puede "borrar solo la imagen", un
    # banner siempre necesita una).
    if imagen is not None:
        nueva_imagen_url = await _guardar_imagen(imagen)
        _borrar_archivo_si_existe(existente.imagen_url)
        datos["imagen_url"] = nueva_imagen_url

    actualizado = BannerRepository.update(db, banner_id, datos)
    delete_pattern(BANNERS_CACHE_PATTERN)
    return actualizado


@router.put("/reordenar", response_model=list[BannerResponse])
def reordenar_banners(
    items: list[BannerReorderItem],
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    resultado = BannerRepository.reorder(db, [item.model_dump() for item in items])
    delete_pattern(BANNERS_CACHE_PATTERN)
    return resultado


@router.patch("/{banner_id}/activo", response_model=BannerResponse)
def toggle_activo_banner(
    banner_id: int,
    data: BannerActivoUpdate,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    try:
        actualizado = BannerRepository.set_activo(db, banner_id, data.activo)
        delete_pattern(BANNERS_CACHE_PATTERN)
        return actualizado
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from e


@router.delete("/{banner_id}")
def delete_banner(banner_id: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    existente = BannerRepository.get_by_id(db, banner_id)
    try:
        resultado = BannerRepository.delete(db, banner_id)
        if existente:
            _borrar_archivo_si_existe(existente.imagen_url)
        delete_pattern(BANNERS_CACHE_PATTERN)
        return resultado
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from e
