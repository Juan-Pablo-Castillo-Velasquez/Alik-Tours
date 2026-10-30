import logging
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.cache import delete_pattern, get_cached, set_cached
from app.core.database import get_db
from app.core.exceptions import HotelDependencyError, NotFoundError
from app.core.file_validation import validar_y_leer_archivo
from app.core.image_storage import borrar_imagen, guardar_imagen
from app.core.security import require_admin
from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion
from app.repositories.hotel_repository import (
    CaracteristicaRepository,
    HabitacionRepository,
    HotelCaracteristicaRepository,
    HotelRepository,
    TipoHabitacionRepository,
)
from app.schemas.hotel_schema import (
    CaracteristicaCreate,
    CaracteristicaResponse,
    DestinoRealResponse,
    HabitacionCreate,
    HabitacionFechasOcupadas,
    HabitacionResponse,
    HabitacionUpdate,
    HotelCreate,
    HotelDetailResponse,
    HotelResponse,
    HotelUpdate,
    ImagenGaleriaResponse,
    TipoHabitacionCreate,
    TipoHabitacionResponse,
)

router = APIRouter(prefix="/api/hoteles", tags=["Hoteles"])

logger = logging.getLogger(__name__)

HOTELES_CACHE_PATTERN = "hoteles:list:*"

HOTEL_IMAGEN_TIPOS_PERMITIDOS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
HOTEL_IMAGEN_TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024  # 5MB
HOTEL_IMAGEN_PUBLIC_PREFIX = "/uploads/hoteles"
# Galería de fotos (distinta de la portada) -- misma validación, carpeta
# propia para no mezclar portadas con fotos de galería en Cloudinary/disco.
HOTEL_GALERIA_PUBLIC_PREFIX = "/uploads/hoteles-galeria"


# ===================== HOTELES CRUD =====================


@router.get("/", response_model=list[HotelDetailResponse])
def get_hotels(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=300),
    fecha_checkin: date | None = Query(
        None, description="Filtra a hoteles con disponibilidad real desde esta fecha (requiere fecha_checkout)"
    ),
    fecha_checkout: date | None = Query(
        None, description="Filtra a hoteles con disponibilidad real hasta esta fecha (requiere fecha_checkin)"
    ),
    q: str | None = Query(None, max_length=100, description="Busca por nombre del hotel, ciudad o país"),
    db: Session = Depends(get_db),
):
    """Obtiene lista de hoteles. Cacheada 2 min (30s si se filtra por fechas,
    ya que esa disponibilidad cambia con cada reserva nueva) — es el endpoint
    más pesado del sitio público (home, listados) y del panel de admin
    (?limit=100), invalidado en cualquier escritura que cambie lo que
    devuelve (hotel, habitaciones, características o una reseña nueva — ver
    resena_route.py).

    fecha_checkin/fecha_checkout son opcionales y deben ir juntas: antes el
    buscador público las capturaba pero nunca las mandaba al backend, así
    que un hotel sin ninguna habitación libre para esas fechas aparecía
    igual en los resultados (bug real corregido en FASE G)."""
    if (fecha_checkin is None) != (fecha_checkout is None):
        raise HTTPException(status_code=400, detail="fecha_checkin y fecha_checkout deben enviarse juntas")
    if fecha_checkin and fecha_checkout and fecha_checkout <= fecha_checkin:
        raise HTTPException(status_code=400, detail="fecha_checkout debe ser posterior a fecha_checkin")

    q = (q or "").strip() or None
    cache_key = f"hoteles:list:{skip}:{limit}:{fecha_checkin}:{fecha_checkout}:{(q or '').lower()}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    hoteles = HotelRepository.get_all(db, skip, limit, fecha_checkin, fecha_checkout, q=q)
    data = [HotelDetailResponse.model_validate(h).model_dump(mode="json") for h in hoteles]
    set_cached(cache_key, data, ttl_seconds=30 if fecha_checkin else 120)
    return data


# ===================== CATÁLOGO (estático) =====================
# OJO con el orden: estas rutas fijas ("/tipos-habitacion",
# "/caracteristicas") deben declararse ANTES de "/{hotel_id}" para que
# "/hoteles/tipos-habitacion" (con o sin barra final) no caiga en el
# path param dinámico y devuelva 422. FastAPI no re-intenta la siguiente
# ruta cuando falla la conversión a int del path param, así que un
# "hotel_id" literal falla siempre.


@router.get("/tipos-habitacion", response_model=list[TipoHabitacionResponse])
def get_tipos_habitacion(db: Session = Depends(get_db)):
    """Catálogo de tipos de habitación (Individual, Doble, Suite, etc.) —
    antes no existía ningún endpoint para listarlos, así que el admin no
    tenía forma de elegir uno al dar de alta una habitación nueva."""
    return TipoHabitacionRepository.get_all(db)


@router.post("/tipos-habitacion", response_model=TipoHabitacionResponse, status_code=201)
def create_tipo_habitacion(
    tipo: TipoHabitacionCreate,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Crea un nuevo tipo de habitación"""
    return TipoHabitacionRepository.create(db, tipo.dict())


@router.get("/caracteristicas", response_model=list[CaracteristicaResponse])
def get_caracteristicas(db: Session = Depends(get_db)):
    """Obtiene todas las características disponibles"""
    return CaracteristicaRepository.get_all(db)


@router.post("/caracteristicas", response_model=CaracteristicaResponse, status_code=201)
def create_caracteristica(
    caracteristica: CaracteristicaCreate,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Crea una nueva característica"""
    return CaracteristicaRepository.create(db, caracteristica.dict())


@router.get("/destinos-sugeridos", response_model=list[DestinoRealResponse])
def get_destinos_sugeridos(
    q: str = Query("", description="Texto escrito por el usuario en el buscador"),
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """Sugerencias de destino para el buscador (SearchBar.tsx), respaldadas
    por hoteles reales -- ver HotelRepository.get_destinos_reales. Antes el
    buscador usaba GET /destinos/sugerencias (catálogo de servicios/
    actividades, sin relación con los hoteles), pudiendo sugerir una ciudad
    sin ningún hotel ni paquete real. No se cachea: es una sola consulta
    agrupada, liviana, y así un hotel nuevo aparece de inmediato en las
    sugerencias sin esperar un TTL."""
    filas = HotelRepository.get_destinos_reales(db, q, limit)
    return [{"ciudad": ciudad, "pais": pais, "total_hoteles": total} for ciudad, pais, total in filas]


# ===================== HOTELES CRUD =====================


@router.get("/{hotel_id}", response_model=HotelDetailResponse)
def get_hotel(hotel_id: int, db: Session = Depends(get_db)):
    """Obtiene detalles completos de un hotel con sus habitaciones y características"""
    hotel = HotelRepository.get_by_id(db, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel no encontrado")
    return hotel


@router.get("/{hotel_id}/fechas-ocupadas", response_model=list[HabitacionFechasOcupadas])
def get_fechas_ocupadas(hotel_id: int, db: Session = Depends(get_db)):
    """Fechas ya reservadas (reservas activas) de cada habitación del hotel
    — para que el cliente vea disponibilidad real antes de elegir fechas.
    Nunca expone quién reservó, solo los rangos. No se cachea: la
    disponibilidad cambia con cada reserva nueva y esta consulta es liviana
    (una sola query, sin N+1)."""
    fechas_por_habitacion = HotelRepository.get_fechas_ocupadas(db, hotel_id)
    return [{"id_habitacion": id_hab, "rangos": rangos} for id_hab, rangos in fechas_por_habitacion.items()]


@router.post("/", response_model=HotelResponse, status_code=201)
def create_hotel(hotel: HotelCreate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Crea un hotel y, opcionalmente, sus habitaciones en UNA transacción:
    si cualquier habitación es inválida (tipo inexistente, número repetido)
    no se guarda nada -- nunca queda un hotel a medio crear. Antes las
    habitaciones solo se podían agregar una por una después de crear el
    hotel."""
    datos = hotel.dict(exclude={"habitaciones"})
    habitaciones = hotel.habitaciones or []

    tipos_validos = {t.id_tipo_habitacion for t in db.query(TipoHabitacion.id_tipo_habitacion).all()}
    invalidos = sorted({h.id_tipo_habitacion for h in habitaciones} - tipos_validos)
    if invalidos:
        raise HTTPException(status_code=422, detail=f"Tipo de habitación inexistente: {invalidos}")

    try:
        nuevo = Hotel(**datos)
        db.add(nuevo)
        db.flush()
        for h in habitaciones:
            db.add(Habitacion(id_hotel=nuevo.id_hotel, **h.dict()))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"No se pudo crear el hotel: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="No se pudo crear el hotel; no se guardó ningún dato") from e
    db.refresh(nuevo)
    delete_pattern(HOTELES_CACHE_PATTERN)
    return nuevo


@router.put("/{hotel_id}", response_model=HotelResponse)
def update_hotel(
    hotel_id: int, hotel: HotelUpdate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    """Actualiza un hotel existente"""
    db_hotel = HotelRepository.get_by_id(db, hotel_id)
    if not db_hotel:
        raise HTTPException(status_code=404, detail="Hotel no encontrado")
    actualizado = HotelRepository.update(db, hotel_id, hotel.dict(exclude_unset=True))
    delete_pattern(HOTELES_CACHE_PATTERN)
    return actualizado


@router.post("/{hotel_id}/imagen", response_model=HotelResponse)
async def subir_imagen_hotel(
    hotel_id: int,
    imagen: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Sube/reemplaza la foto principal del hotel. Antes Hotel no tenía
    ningún campo de imagen real: el frontend mostraba la misma foto de
    stock por ciudad para todos sus hoteles (ver CITY_IMAGES en
    HotelCard.tsx/HotelDetail.tsx, que se mantiene como respaldo para los
    que todavía no tienen foto propia). Usa el mismo almacenamiento que
    fotos de perfil/banners (Cloudinary si está configurado, disco local
    si no — ver app/core/image_storage.py)."""
    hotel = HotelRepository.get_by_id(db, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel no encontrado")

    contenido, extension = await validar_y_leer_archivo(
        imagen,
        tipos_permitidos=HOTEL_IMAGEN_TIPOS_PERMITIDOS,
        mensaje_tipo="Formato de imagen no soportado. Usa JPG, PNG o WEBP.",
        tamano_maximo_bytes=HOTEL_IMAGEN_TAMANO_MAXIMO_BYTES,
    )

    nueva_url = guardar_imagen(contenido, extension, carpeta="hoteles", public_path_prefix=HOTEL_IMAGEN_PUBLIC_PREFIX)
    # Igual que en usuario_route.py: primero se guarda la foto nueva, y
    # solo si eso funciona se borra la anterior.
    borrar_imagen(hotel.imagen_url, carpeta="hoteles", public_path_prefix=HOTEL_IMAGEN_PUBLIC_PREFIX)
    hotel.imagen_url = nueva_url
    db.commit()
    db.refresh(hotel)
    delete_pattern(HOTELES_CACHE_PATTERN)
    return hotel


@router.get("/{hotel_id}/similares", response_model=list[HotelDetailResponse])
def get_hoteles_similares(
    hotel_id: int,
    limit: int = Query(6, ge=1, le=12),
    db: Session = Depends(get_db),
):
    """Hoteles de la misma ciudad (excluyendo este) para la sección
    "también te puede interesar" de la ficha de hotel -- ver
    HotelRepository.get_similares. Vacío (nunca un 404) si el hotel no
    tiene ciudad o no hay otro hotel real en la misma ciudad."""
    return HotelRepository.get_similares(db, hotel_id, limit)


@router.post("/{hotel_id}/galeria", response_model=ImagenGaleriaResponse, status_code=201)
async def subir_foto_galeria_hotel(
    hotel_id: int,
    imagen: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Agrega una foto a la galería del hotel (distinta de la portada, ver
    subir_imagen_hotel arriba) -- antes Hotel no tenía forma de guardar más
    de una imagen real, ver ImagenHotel en hotel_model.py."""
    hotel = HotelRepository.get_by_id(db, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel no encontrado")

    contenido, extension = await validar_y_leer_archivo(
        imagen,
        tipos_permitidos=HOTEL_IMAGEN_TIPOS_PERMITIDOS,
        mensaje_tipo="Formato de imagen no soportado. Usa JPG, PNG o WEBP.",
        tamano_maximo_bytes=HOTEL_IMAGEN_TAMANO_MAXIMO_BYTES,
    )
    url = guardar_imagen(
        contenido, extension, carpeta="hoteles-galeria", public_path_prefix=HOTEL_GALERIA_PUBLIC_PREFIX
    )
    nueva = HotelRepository.add_imagen_galeria(db, hotel_id, url)
    delete_pattern(HOTELES_CACHE_PATTERN)
    return nueva


@router.delete("/{hotel_id}/galeria/{id_imagen}")
def borrar_foto_galeria_hotel(
    hotel_id: int,
    id_imagen: int,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Elimina una foto de la galería del hotel (y su archivo real, en
    Cloudinary o disco local según corresponda)."""
    imagen = HotelRepository.get_imagen_galeria(db, hotel_id, id_imagen)
    if not imagen:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    borrar_imagen(imagen.url, carpeta="hoteles-galeria", public_path_prefix=HOTEL_GALERIA_PUBLIC_PREFIX)
    HotelRepository.delete_imagen_galeria(db, imagen)
    delete_pattern(HOTELES_CACHE_PATTERN)
    return {"message": "Imagen eliminada de la galería"}


@router.delete("/{hotel_id}")
def delete_hotel(hotel_id: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Elimina un hotel"""
    try:
        resultado = HotelRepository.delete(db, hotel_id)
        delete_pattern(HOTELES_CACHE_PATTERN)
        return resultado
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from e
    except HotelDependencyError as e:
        raise HTTPException(status_code=409, detail=e.detail) from e
    except Exception as e:
        logger.error(f"Error inesperado: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor") from e


# ===================== HABITACIONES CRUD =====================


@router.get("/{hotel_id}/habitaciones", response_model=list[HabitacionResponse])
def get_habitaciones(
    hotel_id: int, skip: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=100), db: Session = Depends(get_db)
):
    """Obtiene habitaciones de un hotel"""
    hotel = HotelRepository.get_by_id(db, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel no encontrado")
    return HabitacionRepository.get_all(db, hotel_id, skip, limit)


@router.get("/{hotel_id}/habitaciones/disponibles", response_model=list[HabitacionResponse])
def get_habitaciones_disponibles(
    hotel_id: int, skip: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=100), db: Session = Depends(get_db)
):
    """Obtiene habitaciones disponibles de un hotel"""
    hotel = HotelRepository.get_by_id(db, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel no encontrado")
    return HabitacionRepository.get_disponibles(db, hotel_id, skip, limit)


@router.get("/habitaciones/{habitacion_id}", response_model=HabitacionResponse)
def get_habitacion(habitacion_id: int, db: Session = Depends(get_db)):
    """Obtiene detalles de una habitación"""
    habitacion = HabitacionRepository.get_by_id(db, habitacion_id)
    if not habitacion:
        raise HTTPException(status_code=404, detail="Habitación no encontrada")
    return habitacion


@router.post("/{hotel_id}/habitaciones", response_model=HabitacionResponse, status_code=201)
def create_habitacion(
    hotel_id: int,
    habitacion: HabitacionCreate,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Crea una nueva habitación en un hotel"""
    hotel = HotelRepository.get_by_id(db, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel no encontrado")

    existente = HabitacionRepository.get_by_hotel_and_number(db, hotel_id, habitacion.numero_habitacion)
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe habitación con ese número")

    habitacion_data = habitacion.dict()
    habitacion_data["id_hotel"] = hotel_id
    nueva = HabitacionRepository.create(db, habitacion_data)
    delete_pattern(HOTELES_CACHE_PATTERN)  # cambia Hotel.habitaciones en el listado
    return nueva


@router.put("/habitaciones/{habitacion_id}", response_model=HabitacionResponse)
def update_habitacion(
    habitacion_id: int,
    habitacion: HabitacionUpdate,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Actualiza una habitación existente"""
    db_habitacion = HabitacionRepository.get_by_id(db, habitacion_id)
    if not db_habitacion:
        raise HTTPException(status_code=404, detail="Habitación no encontrada")
    actualizada = HabitacionRepository.update(db, habitacion_id, habitacion.dict(exclude_unset=True))
    delete_pattern(HOTELES_CACHE_PATTERN)
    return actualizada


@router.delete("/habitaciones/{habitacion_id}")
def delete_habitacion(habitacion_id: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Elimina una habitación"""
    try:
        HabitacionRepository.delete(db, habitacion_id)
        delete_pattern(HOTELES_CACHE_PATTERN)
        return {"message": "Habitación eliminada exitosamente"}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from e
    except Exception as e:
        logger.error(f"Error inesperado: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor") from e


# ===================== CARACTERÍSTICAS DEL HOTEL =====================
# Los catálogos estáticos (GET/POST /tipos-habitacion y /caracteristicas)
# viven arriba, en la sección "CATÁLOGO", antes de /{hotel_id} — ver nota
# de orden de rutas al inicio del archivo.


@router.post("/{hotel_id}/caracteristicas/{caracteristica_id}")
def add_caracteristica_hotel(
    hotel_id: int,
    caracteristica_id: int,
    disponible: bool = True,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Añade una característica a un hotel"""
    hotel = HotelRepository.get_by_id(db, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel no encontrado")

    caracteristica = CaracteristicaRepository.get_by_id(db, caracteristica_id)
    if not caracteristica:
        raise HTTPException(status_code=404, detail="Característica no encontrada")

    resultado = HotelCaracteristicaRepository.add_caracteristica(db, hotel_id, caracteristica_id, disponible)
    delete_pattern(HOTELES_CACHE_PATTERN)
    return resultado


@router.delete("/{hotel_id}/caracteristicas/{caracteristica_id}")
def remove_caracteristica_hotel(
    hotel_id: int,
    caracteristica_id: int,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Elimina una característica de un hotel"""
    HotelCaracteristicaRepository.remove_caracteristica(db, hotel_id, caracteristica_id)
    delete_pattern(HOTELES_CACHE_PATTERN)
    return {"message": "Característica eliminada del hotel"}
