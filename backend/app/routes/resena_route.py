from datetime import UTC, datetime
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, joinedload

from app.core.cache import delete_pattern, get_cached, redis_client, set_cached
from app.core.database import get_db
from app.core.deps import get_current_usuario
from app.core.security import require_empleado
from app.models.resena_model import Resena
from app.models.reserva_model import Reserva
from app.models.user_model import Usuario
from app.repositories.resena_repository import ResenaRepository
from app.services.notificacion_service import crear_notificacion

router = APIRouter(prefix="/api/resenas", tags=["Reseñas"])

HOME_CACHE_KEY = "home:resenas_destacadas"

# La tabla `resenas` no guarda avatar del cliente, así que generamos uno
# consistente con la paleta de marca (granate/dorado) cuando no hay foto_url.
AVATAR_BG = "7B1E3A"


class ResenaCreate(BaseModel):
    id_reserva: int
    calificacion: int = Field(..., ge=1, le=5)
    comentario: str = Field(..., min_length=10, max_length=1000)
    foto_url: str | None = None


class ResenaUpdate(BaseModel):
    calificacion: int | None = Field(None, ge=1, le=5)
    comentario: str | None = Field(None, min_length=10, max_length=1000)


class RespuestaAgencia(BaseModel):
    # Vacío o null = quitar la respuesta.
    respuesta: str | None = Field(None, max_length=1000)

    @field_validator("respuesta")
    @classmethod
    def limpiar(cls, v: str | None) -> str | None:
        return (v or "").strip() or None


class VisibilidadResena(BaseModel):
    visible: bool


class ResenaResponse(BaseModel):
    id_resena: int
    id_reserva: int
    id_hotel: int
    calificacion: int
    comentario: str
    foto_url: str | None = None
    fecha_creacion: datetime
    nombre_cliente: str | None = None
    fecha_edicion: datetime | None = None
    respuesta_agencia: str | None = None
    fecha_respuesta: datetime | None = None
    visible: bool = True
    nombre_hotel: str | None = None

    class Config:
        from_attributes = True


def _avatar_url(nombre_completo: str) -> str:
    return (
        f"https://ui-avatars.com/api/?name={quote(nombre_completo)}"
        f"&background={AVATAR_BG}&color=fff&size=128&font-size=0.4&bold=true"
    )


def _inicial_apellido(cliente) -> str:
    """Primera letra del apellido para el formato 'Nombre A.'. Un cliente
    puede tener apellido None o vacío en la BD; antes `apellido[0]` reventaba
    con 500 en endpoints públicos (GET /api/resenas, /destacadas y
    /hotel/{id}) — TypeError/IndexError. Ahora se cae a un string vacío."""
    if not cliente or not cliente.apellido:
        return ""
    return f"{cliente.apellido[0]}."


def _shape_resena(r: Resena) -> dict:
    """Formato compartido por /destacadas y el listado paginado: lo que
    consume directamente el frontend (tarjetas de testimonios)."""
    nombre = f"{r.cliente.nombre} {_inicial_apellido(r.cliente)}".strip() if r.cliente else "Viajero Alik Tours"
    return {
        "id": r.id_resena,
        "name": nombre,
        "location": (
            f"{r.cliente.ciudad}, {r.cliente.pais}"
            if r.cliente and r.cliente.ciudad
            else (f"{r.hotel.ciudad}, {r.hotel.pais}" if r.hotel else "")
        ),
        "quote": r.comentario,
        "rating": r.calificacion,
        "trip": r.hotel.nombre_hotel if r.hotel else "Alik Tours",
        "avatar": r.foto_url
        or _avatar_url(
            f"{r.cliente.nombre} {r.cliente.apellido}".strip()
            if r.cliente and r.cliente.apellido
            else "Viajero Alik Tours"
        ),
        "fecha": r.fecha_creacion.isoformat() if r.fecha_creacion else None,
        "editada": r.fecha_edicion is not None,
        "respuesta": r.respuesta_agencia,
        "fecha_respuesta": r.fecha_respuesta.isoformat() if r.fecha_respuesta else None,
    }


def _ahora() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _response(r: Resena, nombre_cliente: str | None = None) -> ResenaResponse:
    if nombre_cliente is None:
        nombre_cliente = (
            f"{r.cliente.nombre} {_inicial_apellido(r.cliente)}".strip() if r.cliente else "Viajero Alik Tours"
        )
    return ResenaResponse(
        id_resena=r.id_resena,
        id_reserva=r.id_reserva,
        id_hotel=r.id_hotel,
        calificacion=r.calificacion,
        comentario=r.comentario,
        foto_url=r.foto_url,
        fecha_creacion=r.fecha_creacion,
        nombre_cliente=nombre_cliente,
        fecha_edicion=r.fecha_edicion,
        respuesta_agencia=r.respuesta_agencia,
        fecha_respuesta=r.fecha_respuesta,
        visible=r.visible is not False,
        nombre_hotel=r.hotel.nombre_hotel if r.hotel else None,
    )


def _invalidar_caches(id_hotel: int) -> None:
    """Lo que cambia cuando se crea, edita, oculta o responde una reseña: el
    listado del hotel, los testimonios del home y los hoteles (promedio)."""
    redis_client.delete(f"hotel:{id_hotel}:resenas")
    redis_client.delete(HOME_CACHE_KEY)
    delete_pattern("hoteles:list:*")


def _resena_propia(db: Session, id_resena: int, usuario: Usuario) -> Resena:
    if not usuario.cliente:
        raise HTTPException(status_code=403, detail="Solo los clientes pueden gestionar reseñas")
    r = db.query(Resena).filter(Resena.id_resena == id_resena).first()
    if not r or r.id_cliente != usuario.cliente.id_cliente:
        raise HTTPException(status_code=404, detail="Reseña no encontrada")
    return r


@router.post("", response_model=ResenaResponse, status_code=201)
def crear_resena(
    data: ResenaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_usuario),
):
    if not usuario.cliente:
        raise HTTPException(status_code=403, detail="Solo los clientes pueden dejar reseñas")

    reserva = db.query(Reserva).filter(Reserva.id_reserva == data.id_reserva).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.id_cliente != usuario.cliente.id_cliente:
        raise HTTPException(status_code=403, detail="No puedes reseñar una reserva que no es tuya")

    if ResenaRepository.get_by_reserva(db, data.id_reserva):
        raise HTTPException(status_code=409, detail="Ya dejaste una reseña para esta reserva")

    id_hotel = ResenaRepository.get_hotel_id_from_reserva(db, data.id_reserva)
    if not id_hotel:
        raise HTTPException(status_code=422, detail="No se pudo asociar esta reserva a un hotel")

    resena = ResenaRepository.create(
        db,
        id_reserva=data.id_reserva,
        id_cliente=usuario.cliente.id_cliente,
        id_hotel=id_hotel,
        calificacion=data.calificacion,
        comentario=data.comentario,
        foto_url=data.foto_url,
    )

    # Invalidar caches afectados: el listado del hotel, el bloque de
    # testimonios del home (que puede incluir esta reseña si califica bien),
    # y el listado de hoteles del panel de admin/home — una reseña nueva
    # cambia Hotel.total_resenas/calificacion_promedio, que viaja en cada
    # hotel de GET /hoteles/ (ver hotel_route.py).
    _invalidar_caches(id_hotel)

    return _response(resena, nombre_cliente=usuario.cliente.nombre)


@router.get("/mias", response_model=list[ResenaResponse])
def mis_resenas(db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    """Las reseñas del cliente (también las ocultas por el equipo), con la
    respuesta de la agencia si la hay."""
    if not usuario.cliente:
        return []
    resenas = (
        db.query(Resena)
        .options(joinedload(Resena.hotel), joinedload(Resena.cliente))
        .filter(Resena.id_cliente == usuario.cliente.id_cliente)
        .order_by(Resena.fecha_creacion.desc())
        .all()
    )
    return [_response(r) for r in resenas]


@router.put("/{id_resena}", response_model=ResenaResponse)
def editar_resena(
    id_resena: int,
    data: ResenaUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_usuario),
):
    """El autor corrige su reseña (estrellas y/o texto). Queda marcada como editada."""
    r = _resena_propia(db, id_resena, usuario)
    cambios = data.model_dump(exclude_unset=True, exclude_none=True)
    if not cambios:
        raise HTTPException(status_code=422, detail="No hay cambios para guardar")
    for campo, valor in cambios.items():
        setattr(r, campo, valor.strip() if isinstance(valor, str) else valor)
    r.fecha_edicion = _ahora()
    db.commit()
    db.refresh(r)
    _invalidar_caches(r.id_hotel)
    return _response(r)


@router.delete("/{id_resena}")
def borrar_resena(id_resena: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    r = _resena_propia(db, id_resena, usuario)
    id_hotel = r.id_hotel
    db.delete(r)
    db.commit()
    _invalidar_caches(id_hotel)
    return {"message": "Reseña eliminada"}


# ===================== EQUIPO (admin / asesor) =====================


@router.get("/admin/todas", response_model=list[ResenaResponse])
def admin_listar_resenas(
    filtro: str | None = Query(None, description="sin_responder | ocultas | bajas (1-3 estrellas)"),
    db: Session = Depends(get_db),
    moderador_id: int = Depends(require_empleado),
):
    q = db.query(Resena).options(joinedload(Resena.hotel), joinedload(Resena.cliente))
    if filtro == "sin_responder":
        q = q.filter(Resena.respuesta_agencia.is_(None), Resena.visible.is_(True))
    elif filtro == "ocultas":
        q = q.filter(Resena.visible.is_(False))
    elif filtro == "bajas":
        q = q.filter(Resena.calificacion <= 3)
    resenas = q.order_by(Resena.fecha_creacion.desc()).limit(200).all()
    return [_response(r) for r in resenas]


@router.put("/admin/{id_resena}/responder", response_model=ResenaResponse)
def admin_responder_resena(
    id_resena: int,
    data: RespuestaAgencia,
    db: Session = Depends(get_db),
    moderador_id: int = Depends(require_empleado),
):
    """Respuesta pública de la agencia. Se le avisa al cliente."""
    r = db.query(Resena).filter(Resena.id_resena == id_resena).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reseña no encontrada")
    era_nueva = r.respuesta_agencia is None and data.respuesta is not None
    r.respuesta_agencia = data.respuesta
    r.fecha_respuesta = _ahora() if data.respuesta else None
    if era_nueva:
        crear_notificacion(
            db,
            tipo="resena",
            titulo="Alik Tours respondió tu reseña",
            mensaje=data.respuesta[:160],
            id_referencia=r.id_resena,
            id_cliente=r.id_cliente,
            commit=False,
        )
    db.commit()
    db.refresh(r)
    _invalidar_caches(r.id_hotel)
    return _response(r)


@router.put("/admin/{id_resena}/visibilidad", response_model=ResenaResponse)
def admin_visibilidad_resena(
    id_resena: int,
    data: VisibilidadResena,
    db: Session = Depends(get_db),
    moderador_id: int = Depends(require_empleado),
):
    """Ocultar una reseña del sitio (spam, datos personales, lenguaje
    ofensivo) sin borrarla. Deja de contar en los promedios públicos."""
    r = db.query(Resena).filter(Resena.id_resena == id_resena).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reseña no encontrada")
    r.visible = data.visible
    db.commit()
    db.refresh(r)
    _invalidar_caches(r.id_hotel)
    return _response(r)


@router.get("")
def get_resenas_todas(
    skip: int = Query(0, ge=0),
    limit: int = Query(12, ge=1, le=50),
    calificacion: int | None = Query(None, ge=1, le=5, description="Solo reseñas con estas estrellas"),
    db: Session = Depends(get_db),
):
    """
    Listado público y paginado de las reseñas visibles (cualquier
    calificación o solo una), usado en la página /testimonios. Incluye
    cuántas hay de cada calificación para el resumen.
    """
    calificacion = calificacion if isinstance(calificacion, int) else None
    resenas = ResenaRepository.get_all(db, skip=skip, limit=limit, calificacion=calificacion)
    total = ResenaRepository.count_all(db, calificacion=calificacion)
    promedio_row = ResenaRepository.get_promedio_global(db)

    return {
        "total": total,
        "promedio": round(float(promedio_row.promedio), 1) if promedio_row and promedio_row.promedio else 5.0,
        "total_global": promedio_row.total if promedio_row else 0,
        "distribucion": ResenaRepository.get_distribucion(db),
        "resenas": [_shape_resena(r) for r in resenas],
    }


@router.get("/hotel/{id_hotel}", response_model=list[ResenaResponse])
def get_resenas_hotel(id_hotel: int, db: Session = Depends(get_db)):
    resenas = ResenaRepository.get_by_hotel(db, id_hotel)
    return [_response(r) for r in resenas]


@router.get("/destacadas")
def get_resenas_destacadas(db: Session = Depends(get_db)):
    """
    Endpoint público (sin auth) para la sección de Testimonios del home.
    Trae las mejores reseñas (4-5 estrellas) de toda la plataforma, junto
    con el promedio y total global, cacheado 10 min en Redis.
    """
    cached = get_cached(HOME_CACHE_KEY)
    if cached:
        return cached

    resenas = ResenaRepository.get_destacadas(db, limit=6)
    promedio_row = ResenaRepository.get_promedio_global(db)

    data = {
        "promedio": round(float(promedio_row.promedio), 1) if promedio_row and promedio_row.promedio else 5.0,
        "total": promedio_row.total if promedio_row else 0,
        "resenas": [_shape_resena(r) for r in resenas],
    }

    set_cached(HOME_CACHE_KEY, data, ttl_seconds=600)  # 10 min
    return data
