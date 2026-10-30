"""
Comunidad viajera (/api/comunidad).

- Clientes registrados publican su experiencia: texto + calificación y un
  video corto o hasta 4 fotos. Toda publicación nace "pendiente" y solo
  aparece en el sitio cuando un admin/asesor la aprueba.
- Los clientes comentan publicaciones aprobadas de otros. Los comentarios
  salen al instante; el equipo puede ocultarlos.
- Videos propios de la agencia, administrados desde el panel.
"""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.deps import get_current_usuario
from app.core.file_validation import validar_y_leer_archivo
from app.core.image_storage import borrar_imagen, guardar_imagen
from app.core.security import require_admin, require_empleado
from app.models.comunidad_model import ComentarioComunidad, ImagenPublicacion, PublicacionComunidad, VideoAgencia
from app.models.user_model import Usuario
from app.schemas.comunidad_schema import (
    AutorComunidad,
    ComentarioCreate,
    ComentarioResponse,
    ModerarPublicacion,
    OcultarComentario,
    PublicacionesPaginadas,
    PublicacionResponse,
    VideoAgenciaResponse,
    VideoAgenciaUpdate,
)
from app.services.notificacion_service import crear_notificacion

router = APIRouter(prefix="/api/comunidad", tags=["Comunidad"])
logger = logging.getLogger(__name__)

IMAGEN_TIPOS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
IMAGEN_MAX_BYTES = 5 * 1024 * 1024  # 5 MB por foto
MAX_IMAGENES = 4
VIDEO_TIPOS = {"video/mp4", "video/webm", "video/quicktime"}
VIDEO_CLIENTE_MAX_BYTES = 50 * 1024 * 1024  # 50 MB (video corto, ~60 s)
VIDEO_AGENCIA_MAX_BYTES = 80 * 1024 * 1024  # 80 MB
MENSAJE_VIDEO = "Formato de video no soportado. Usa MP4, MOV o WEBM."
MENSAJE_IMAGEN = "Formato de imagen no soportado. Usa JPG, PNG o WEBP."

CARPETA_FOTOS, PREFIJO_FOTOS = "comunidad-fotos", "/uploads/comunidad-fotos"
CARPETA_VIDEOS, PREFIJO_VIDEOS = "comunidad-videos", "/uploads/comunidad-videos"
CARPETA_AGENCIA, PREFIJO_AGENCIA = "videos-agencia", "/uploads/videos-agencia"
CARPETA_PORTADAS, PREFIJO_PORTADAS = "videos-agencia-portadas", "/uploads/videos-agencia-portadas"


# ===================== utilidades =====================


def _ahora() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _exigir_cliente(usuario: Usuario) -> int:
    if not usuario.id_cliente:
        raise HTTPException(status_code=403, detail="Solo los clientes registrados pueden participar en la comunidad.")
    return usuario.id_cliente


def _autor(db: Session, cliente) -> AutorComunidad:
    """'Nombre A.' + foto de perfil. Nunca expone apellido completo, cédula
    ni correo del cliente en una página pública."""
    if not cliente:
        return AutorComunidad(nombre="Viajero Alik Tours")
    inicial = f" {cliente.apellido[0]}." if cliente.apellido else ""
    usuario = db.query(Usuario).filter(Usuario.id_cliente == cliente.id_cliente).first()
    return AutorComunidad(nombre=f"{cliente.nombre}{inicial}", foto=usuario.foto_perfil if usuario else None)


def _comentario(db: Session, c: ComentarioComunidad, id_cliente_actual: int | None) -> ComentarioResponse:
    return ComentarioResponse(
        id_comentario=c.id_comentario,
        id_publicacion=c.id_publicacion,
        contenido=c.contenido,
        oculto=c.oculto,
        fecha_creacion=c.fecha_creacion,
        autor=_autor(db, c.cliente),
        es_mio=id_cliente_actual is not None and c.id_cliente == id_cliente_actual,
    )


def _publicacion(
    db: Session, p: PublicacionComunidad, id_cliente_actual: int | None = None, incluir_ocultos: bool = False
) -> PublicacionResponse:
    comentarios = [c for c in p.comentarios if incluir_ocultos or not c.oculto]
    return PublicacionResponse(
        id_publicacion=p.id_publicacion,
        titulo=p.titulo,
        contenido=p.contenido,
        calificacion=p.calificacion,
        destino=p.destino,
        video_url=p.video_url,
        imagenes=[i.url for i in p.imagenes],
        estado=p.estado,
        motivo_moderacion=p.motivo_moderacion,
        fecha_creacion=p.fecha_creacion,
        autor=_autor(db, p.cliente),
        comentarios=[_comentario(db, c, id_cliente_actual) for c in comentarios],
        total_comentarios=len(comentarios),
        es_mia=id_cliente_actual is not None and p.id_cliente == id_cliente_actual,
    )


def _query_publicaciones(db: Session):
    return db.query(PublicacionComunidad).options(
        selectinload(PublicacionComunidad.imagenes),
        selectinload(PublicacionComunidad.comentarios).selectinload(ComentarioComunidad.cliente),
        selectinload(PublicacionComunidad.cliente),
    )


def _borrar_medios(p: PublicacionComunidad) -> None:
    if p.video_url:
        borrar_imagen(p.video_url, carpeta=CARPETA_VIDEOS, public_path_prefix=PREFIJO_VIDEOS, resource_type="video")
    for img in p.imagenes:
        borrar_imagen(img.url, carpeta=CARPETA_FOTOS, public_path_prefix=PREFIJO_FOTOS)


# ===================== PÚBLICO =====================


@router.get("/publicaciones", response_model=PublicacionesPaginadas)
def listar_publicaciones(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Publicaciones aprobadas, la más reciente primero."""
    base = db.query(PublicacionComunidad).filter(PublicacionComunidad.estado == "aprobada")
    total = base.count()
    items = (
        _query_publicaciones(db)
        .filter(PublicacionComunidad.estado == "aprobada")
        .order_by(PublicacionComunidad.fecha_creacion.desc(), PublicacionComunidad.id_publicacion.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return PublicacionesPaginadas(items=[_publicacion(db, p) for p in items], total=total, skip=skip, limit=limit)


@router.get("/videos", response_model=list[VideoAgenciaResponse])
def listar_videos_agencia(db: Session = Depends(get_db)):
    return (
        db.query(VideoAgencia)
        .filter(VideoAgencia.activo.is_(True))
        .order_by(VideoAgencia.orden.asc(), VideoAgencia.fecha_creacion.desc())
        .all()
    )


# ===================== CLIENTE =====================


@router.get("/mis-publicaciones", response_model=list[PublicacionResponse])
def mis_publicaciones(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_usuario)):
    """Todas las publicaciones del cliente, en cualquier estado (para que vea
    las pendientes y el motivo si alguna no fue aprobada)."""
    id_cliente = _exigir_cliente(current_user)
    items = (
        _query_publicaciones(db)
        .filter(PublicacionComunidad.id_cliente == id_cliente)
        .order_by(PublicacionComunidad.fecha_creacion.desc())
        .all()
    )
    return [_publicacion(db, p, id_cliente) for p in items]


@router.post("/publicaciones", response_model=PublicacionResponse, status_code=201)
async def crear_publicacion(
    titulo: str = Form(..., min_length=3, max_length=150),
    contenido: str = Form(..., min_length=10, max_length=3000),
    calificacion: int | None = Form(None, ge=1, le=5),
    destino: str | None = Form(None, max_length=120),
    video: UploadFile | None = File(None),
    imagenes: list[UploadFile] | None = File(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
):
    """Crea una publicación en estado 'pendiente' (la revisa el equipo antes
    de mostrarse). Lleva un video corto O hasta 4 fotos (o solo texto)."""
    id_cliente = _exigir_cliente(current_user)
    video = video if isinstance(video, UploadFile) and video.filename else None
    imagenes = [i for i in (imagenes or []) if isinstance(i, UploadFile) and i.filename]

    if video and imagenes:
        raise HTTPException(status_code=422, detail="Sube un video o fotos, no ambos en la misma publicación.")
    if len(imagenes) > MAX_IMAGENES:
        raise HTTPException(status_code=422, detail=f"Máximo {MAX_IMAGENES} fotos por publicación.")

    # Validar TODO antes de subir nada.
    video_validado = None
    if video:
        video_validado = await validar_y_leer_archivo(
            video,
            tipos_permitidos=VIDEO_TIPOS,
            mensaje_tipo=MENSAJE_VIDEO,
            tamano_maximo_bytes=VIDEO_CLIENTE_MAX_BYTES,
        )
    fotos_validadas = [
        await validar_y_leer_archivo(
            img, tipos_permitidos=IMAGEN_TIPOS, mensaje_tipo=MENSAJE_IMAGEN, tamano_maximo_bytes=IMAGEN_MAX_BYTES
        )
        for img in imagenes
    ]

    video_url = None
    if video_validado:
        video_url = guardar_imagen(
            *video_validado, carpeta=CARPETA_VIDEOS, public_path_prefix=PREFIJO_VIDEOS, resource_type="video"
        )
    urls_fotos = [guardar_imagen(*f, carpeta=CARPETA_FOTOS, public_path_prefix=PREFIJO_FOTOS) for f in fotos_validadas]

    publicacion = PublicacionComunidad(
        id_cliente=id_cliente,
        titulo=titulo.strip(),
        contenido=contenido.strip(),
        calificacion=calificacion if isinstance(calificacion, int) else None,
        destino=(destino.strip() or None) if isinstance(destino, str) else None,
        video_url=video_url,
        estado="pendiente",
    )
    publicacion.imagenes = [ImagenPublicacion(url=u, orden=i) for i, u in enumerate(urls_fotos)]
    db.add(publicacion)
    db.flush()
    crear_notificacion(
        db,
        tipo="comunidad",
        titulo="Nueva publicación de la comunidad por revisar",
        mensaje=publicacion.titulo,
        id_referencia=publicacion.id_publicacion,
        commit=False,
    )
    db.commit()
    db.refresh(publicacion)
    return _publicacion(db, publicacion, id_cliente)


@router.delete("/publicaciones/{id_publicacion}")
def borrar_publicacion(
    id_publicacion: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_usuario)
):
    """El autor puede borrar su publicación en cualquier momento."""
    id_cliente = _exigir_cliente(current_user)
    p = _query_publicaciones(db).filter(PublicacionComunidad.id_publicacion == id_publicacion).first()
    if not p or p.id_cliente != id_cliente:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    _borrar_medios(p)
    db.delete(p)
    db.commit()
    return {"message": "Publicación eliminada"}


@router.post("/publicaciones/{id_publicacion}/comentarios", response_model=ComentarioResponse, status_code=201)
def comentar(
    id_publicacion: int,
    data: ComentarioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
):
    id_cliente = _exigir_cliente(current_user)
    p = db.query(PublicacionComunidad).filter(PublicacionComunidad.id_publicacion == id_publicacion).first()
    if not p or p.estado != "aprobada":
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    comentario = ComentarioComunidad(id_publicacion=id_publicacion, id_cliente=id_cliente, contenido=data.contenido)
    db.add(comentario)
    if p.id_cliente != id_cliente:
        crear_notificacion(
            db,
            tipo="comunidad",
            titulo="Comentaron tu publicación",
            mensaje=f"«{p.titulo}»: {data.contenido[:120]}",
            id_referencia=p.id_publicacion,
            id_cliente=p.id_cliente,
            commit=False,
        )
    db.commit()
    db.refresh(comentario)
    return _comentario(db, comentario, id_cliente)


@router.delete("/comentarios/{id_comentario}")
def borrar_comentario(
    id_comentario: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_usuario)
):
    id_cliente = _exigir_cliente(current_user)
    c = db.query(ComentarioComunidad).filter(ComentarioComunidad.id_comentario == id_comentario).first()
    if not c or c.id_cliente != id_cliente:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    db.delete(c)
    db.commit()
    return {"message": "Comentario eliminado"}


# ===================== MODERACIÓN (admin / asesor) =====================


@router.get("/admin/publicaciones", response_model=list[PublicacionResponse])
def admin_listar_publicaciones(
    estado: str | None = Query(None, description="pendiente | aprobada | rechazada | oculta"),
    db: Session = Depends(get_db),
    moderador_id: int = Depends(require_empleado),
):
    q = _query_publicaciones(db)
    if estado:
        q = q.filter(PublicacionComunidad.estado == estado)
    items = q.order_by(PublicacionComunidad.fecha_creacion.desc()).limit(200).all()
    return [_publicacion(db, p, incluir_ocultos=True) for p in items]


@router.put("/admin/publicaciones/{id_publicacion}/moderar", response_model=PublicacionResponse)
def admin_moderar(
    id_publicacion: int,
    data: ModerarPublicacion,
    db: Session = Depends(get_db),
    moderador_id: int = Depends(require_empleado),
):
    p = _query_publicaciones(db).filter(PublicacionComunidad.id_publicacion == id_publicacion).first()
    if not p:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    anterior = p.estado
    p.estado = data.estado
    p.motivo_moderacion = (data.motivo or "").strip() or None
    p.id_moderador = moderador_id
    p.fecha_moderacion = _ahora()

    if anterior != data.estado and data.estado in ("aprobada", "rechazada"):
        aprobada = data.estado == "aprobada"
        crear_notificacion(
            db,
            tipo="comunidad",
            titulo="Tu publicación ya está en la comunidad" if aprobada else "Tu publicación no fue aprobada",
            mensaje=p.titulo if aprobada else (p.motivo_moderacion or p.titulo),
            id_referencia=p.id_publicacion,
            id_cliente=p.id_cliente,
            commit=False,
        )
    db.commit()
    db.refresh(p)
    return _publicacion(db, p, incluir_ocultos=True)


@router.delete("/admin/publicaciones/{id_publicacion}")
def admin_borrar_publicacion(
    id_publicacion: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    p = _query_publicaciones(db).filter(PublicacionComunidad.id_publicacion == id_publicacion).first()
    if not p:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    _borrar_medios(p)
    db.delete(p)
    db.commit()
    return {"message": "Publicación eliminada"}


@router.put("/admin/comentarios/{id_comentario}", response_model=ComentarioResponse)
def admin_ocultar_comentario(
    id_comentario: int,
    data: OcultarComentario,
    db: Session = Depends(get_db),
    moderador_id: int = Depends(require_empleado),
):
    c = db.query(ComentarioComunidad).filter(ComentarioComunidad.id_comentario == id_comentario).first()
    if not c:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    c.oculto = data.oculto
    db.commit()
    db.refresh(c)
    return _comentario(db, c, None)


# ===================== VIDEOS DE LA AGENCIA (admin) =====================


@router.get("/admin/videos", response_model=list[VideoAgenciaResponse])
def admin_listar_videos(db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    return db.query(VideoAgencia).order_by(VideoAgencia.orden.asc(), VideoAgencia.fecha_creacion.desc()).all()


@router.post("/admin/videos", response_model=VideoAgenciaResponse, status_code=201)
async def admin_subir_video(
    titulo: str = Form(..., min_length=1, max_length=150),
    descripcion: str | None = Form(None, max_length=500),
    video: UploadFile = File(...),
    portada: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    contenido_video = await validar_y_leer_archivo(
        video, tipos_permitidos=VIDEO_TIPOS, mensaje_tipo=MENSAJE_VIDEO, tamano_maximo_bytes=VIDEO_AGENCIA_MAX_BYTES
    )
    portada_validada = None
    if isinstance(portada, UploadFile) and portada.filename:
        portada_validada = await validar_y_leer_archivo(
            portada, tipos_permitidos=IMAGEN_TIPOS, mensaje_tipo=MENSAJE_IMAGEN, tamano_maximo_bytes=IMAGEN_MAX_BYTES
        )
    video_url = guardar_imagen(
        *contenido_video, carpeta=CARPETA_AGENCIA, public_path_prefix=PREFIJO_AGENCIA, resource_type="video"
    )
    portada_url = (
        guardar_imagen(*portada_validada, carpeta=CARPETA_PORTADAS, public_path_prefix=PREFIJO_PORTADAS)
        if portada_validada
        else None
    )
    siguiente = db.query(VideoAgencia).count() or 0
    nuevo = VideoAgencia(
        titulo=titulo.strip(),
        descripcion=(descripcion.strip() or None) if isinstance(descripcion, str) else None,
        video_url=video_url,
        portada_url=portada_url,
        orden=siguiente,
        activo=True,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/admin/videos/{id_video}", response_model=VideoAgenciaResponse)
def admin_editar_video(
    id_video: int, data: VideoAgenciaUpdate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    v = db.query(VideoAgencia).filter(VideoAgencia.id_video == id_video).first()
    if not v:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    for campo, valor in data.dict(exclude_unset=True).items():
        if valor is not None:
            setattr(v, campo, valor.strip() if isinstance(valor, str) else valor)
    db.commit()
    db.refresh(v)
    return v


@router.delete("/admin/videos/{id_video}")
def admin_borrar_video(id_video: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    v = db.query(VideoAgencia).filter(VideoAgencia.id_video == id_video).first()
    if not v:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    borrar_imagen(v.video_url, carpeta=CARPETA_AGENCIA, public_path_prefix=PREFIJO_AGENCIA, resource_type="video")
    if v.portada_url:
        borrar_imagen(v.portada_url, carpeta=CARPETA_PORTADAS, public_path_prefix=PREFIJO_PORTADAS)
    db.delete(v)
    db.commit()
    return {"message": "Video eliminado"}
