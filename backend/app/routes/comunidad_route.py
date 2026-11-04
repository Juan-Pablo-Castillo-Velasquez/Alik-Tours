"""
Comunidad viajera (/api/comunidad).

- Clientes registrados publican su experiencia: texto + calificación y un
  video corto o hasta 4 fotos. Toda publicación nace "pendiente" y solo
  aparece en el sitio cuando un admin/asesor la aprueba.
- Los clientes comentan publicaciones aprobadas de otros. Los comentarios
  salen al instante; el equipo puede ocultarlos.
- Videos propios de la agencia, administrados desde el panel. Se pueden
  comentar, asociar a un paquete (salen como video promocional en la ficha
  de ese viaje) y destacar en la página de inicio.
- El equipo (admin/asesor) también comenta y responde: sus comentarios salen
  con el nombre de la agencia. Las respuestas son de un solo nivel.
"""

import logging
import time
from datetime import UTC, datetime

import cloudinary
import cloudinary.utils
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, selectinload

# FastAPI entrega los archivos como starlette.datastructures.UploadFile;
# fastapi.UploadFile es una SUBCLASE, así que isinstance contra ella da
# False con un archivo real y el archivo se descartaba sin error.
from starlette.datastructures import UploadFile as StarletteUploadFile

from app.core.database import get_db
from app.core.deps import get_current_usuario, get_usuario_opcional, usuario_es_admin, usuario_es_staff
from app.core.file_validation import validar_y_leer_archivo
from app.core.image_storage import CLOUDINARY_CONFIGURADO, borrar_imagen, guardar_imagen
from app.core.security import require_admin, require_empleado
from app.models.comunidad_model import ComentarioComunidad, ImagenPublicacion, PublicacionComunidad, VideoAgencia
from app.models.reserva_model import Paquete
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


NOMBRE_EQUIPO = "Alik Tours · Equipo"


def _usuario(valor) -> Usuario | None:
    """Las funciones de ruta también se llaman directo desde las pruebas: ahí
    el parámetro opcional llega como el objeto Depends(...) y no como Usuario."""
    return valor if isinstance(valor, Usuario) else None


def _texto(valor) -> str | None:
    return valor if isinstance(valor, str) else None


def _autor_de(usuario: Usuario | None, authorization: str | None) -> tuple[int | None, int | None]:
    """(id_cliente, id_usuario_equipo) de quien comenta. El equipo comenta
    como la agencia aunque su usuario también tenga ficha de cliente."""
    if usuario and usuario_es_staff(authorization):
        return None, usuario.id_usuario
    if usuario and usuario.id_cliente:
        return usuario.id_cliente, None
    raise HTTPException(status_code=403, detail="Inicia sesión con tu cuenta de cliente para comentar en la comunidad.")


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


def _es_mio(c: ComentarioComunidad, viewer: Usuario | None) -> bool:
    if not viewer:
        return False
    if c.id_cliente is not None:
        return c.id_cliente == viewer.id_cliente
    return c.id_usuario_equipo is not None and c.id_usuario_equipo == viewer.id_usuario


def _comentario(db: Session, c: ComentarioComunidad, viewer: Usuario | None = None) -> ComentarioResponse:
    autor = AutorComunidad(nombre=NOMBRE_EQUIPO, es_equipo=True) if c.id_cliente is None else _autor(db, c.cliente)
    return ComentarioResponse(
        id_comentario=c.id_comentario,
        id_publicacion=c.id_publicacion,
        id_video=c.id_video,
        id_padre=c.id_padre,
        contenido=c.contenido,
        oculto=c.oculto,
        fecha_creacion=c.fecha_creacion,
        autor=autor,
        es_mio=_es_mio(c, viewer),
    )


def _visibles(comentarios: list[ComentarioComunidad], incluir_ocultos: bool) -> list[ComentarioComunidad]:
    """Sin ocultos (salvo moderación) y sin respuestas cuyo comentario
    principal está oculto o ya no existe."""
    if incluir_ocultos:
        return list(comentarios)
    visibles = [c for c in comentarios if not c.oculto]
    ids = {c.id_comentario for c in visibles}
    return [c for c in visibles if c.id_padre is None or c.id_padre in ids]


def _publicacion(
    db: Session, p: PublicacionComunidad, viewer: Usuario | None = None, incluir_ocultos: bool = False
) -> PublicacionResponse:
    comentarios = _visibles(p.comentarios, incluir_ocultos)
    id_cliente_actual = viewer.id_cliente if viewer else None
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
        comentarios=[_comentario(db, c, viewer) for c in comentarios],
        total_comentarios=len(comentarios),
        es_mia=id_cliente_actual is not None and p.id_cliente == id_cliente_actual,
    )


def _video(
    db: Session, v: VideoAgencia, viewer: Usuario | None = None, incluir_ocultos: bool = False
) -> VideoAgenciaResponse:
    comentarios = _visibles(v.comentarios, incluir_ocultos)
    return VideoAgenciaResponse(
        id_video=v.id_video,
        titulo=v.titulo,
        descripcion=v.descripcion,
        video_url=v.video_url,
        portada_url=v.portada_url,
        orden=v.orden or 0,
        activo=bool(v.activo),
        id_paquete=v.id_paquete,
        nombre_paquete=v.paquete.nombre_paquete if v.paquete else None,
        mostrar_inicio=bool(v.mostrar_inicio),
        fecha_creacion=v.fecha_creacion,
        total_comentarios=len(comentarios),
        comentarios=[_comentario(db, c, viewer) for c in comentarios],
    )


def _query_videos(db: Session):
    return db.query(VideoAgencia).options(
        selectinload(VideoAgencia.paquete),
        selectinload(VideoAgencia.comentarios).selectinload(ComentarioComunidad.cliente),
    )


def _paquete_valido(db: Session, id_paquete) -> int | None:
    """None/0 = sin paquete. Si viene un id, el paquete debe existir."""
    if not isinstance(id_paquete, int) or id_paquete == 0:
        return None
    if not db.query(Paquete).filter(Paquete.id_paquete == id_paquete).first():
        raise HTTPException(status_code=422, detail="El paquete elegido no existe")
    return id_paquete


def _guardar_comentario(
    db: Session,
    data: ComentarioCreate,
    usuario: Usuario,
    authorization: str | None,
    publicacion: PublicacionComunidad | None = None,
    video: VideoAgencia | None = None,
) -> ComentarioComunidad:
    id_cliente, id_equipo = _autor_de(usuario, authorization)
    padre = None
    if data.id_padre is not None:
        padre = db.query(ComentarioComunidad).filter(ComentarioComunidad.id_comentario == data.id_padre).first()
        mismo_hilo = padre is not None and (
            (publicacion is not None and padre.id_publicacion == publicacion.id_publicacion)
            or (video is not None and padre.id_video == video.id_video)
        )
        if not mismo_hilo or padre.oculto:
            raise HTTPException(status_code=404, detail="El comentario que quieres responder ya no está disponible")
        # Un solo nivel: responder a una respuesta cuelga del mismo comentario principal.
        if padre.id_padre is not None:
            padre = db.query(ComentarioComunidad).filter(ComentarioComunidad.id_comentario == padre.id_padre).first()

    comentario = ComentarioComunidad(
        id_publicacion=publicacion.id_publicacion if publicacion else None,
        id_video=video.id_video if video else None,
        id_cliente=id_cliente,
        id_usuario_equipo=id_equipo,
        id_padre=padre.id_comentario if padre else None,
        contenido=data.contenido,
    )
    db.add(comentario)

    titulo_hilo = publicacion.titulo if publicacion else video.titulo
    referencia = publicacion.id_publicacion if publicacion else video.id_video
    avisados: set[int] = set()
    if publicacion and publicacion.id_cliente != id_cliente:
        crear_notificacion(
            db,
            tipo="comunidad",
            titulo="Comentaron tu publicación",
            mensaje=f"«{titulo_hilo}»: {data.contenido[:120]}",
            id_referencia=referencia,
            id_cliente=publicacion.id_cliente,
            commit=False,
        )
        avisados.add(publicacion.id_cliente)
    if padre and padre.id_cliente and padre.id_cliente != id_cliente and padre.id_cliente not in avisados:
        crear_notificacion(
            db,
            tipo="comunidad",
            titulo="Respondieron tu comentario",
            mensaje=f"«{titulo_hilo}»: {data.contenido[:120]}",
            id_referencia=referencia,
            id_cliente=padre.id_cliente,
            commit=False,
        )
    if video and id_cliente is not None:
        # Aviso interno para que el equipo conteste a tiempo.
        crear_notificacion(
            db,
            tipo="comunidad",
            titulo="Nuevo comentario en un video de la agencia",
            mensaje=f"«{titulo_hilo}»: {data.contenido[:120]}",
            id_referencia=referencia,
            commit=False,
        )
    db.commit()
    db.refresh(comentario)
    return comentario


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


# ===================== SUBIDA DIRECTA A CLOUDINARY =====================
# Los videos NO pasan por este servidor: el navegador los sube directo a
# Cloudinary con una firma de un solo uso generada aquí, y luego solo envía
# la URL resultante. Antes el archivo completo (hasta 80 MB) se recibía en
# memoria en el backend (Render free, 512 MB) antes de reenviarlo a
# Cloudinary: la conexión se caía y el panel mostraba "Failed to fetch".
# Sin Cloudinary configurado (desarrollo local) se responde modo "servidor"
# y el frontend sube el archivo al backend como siempre.

DESTINOS_SUBIDA = {
    # destino: (carpeta, resource_type, quién puede)
    "agencia-video": (CARPETA_AGENCIA, "video", "admin"),
    "agencia-portada": (CARPETA_PORTADAS, "image", "admin"),
    "comunidad-video": (CARPETA_VIDEOS, "video", "cliente"),
    "comunidad-foto": (CARPETA_FOTOS, "image", "cliente"),
}


def _url_cloudinary_valida(url: str | None, resource_type: str) -> str | None:
    """Solo se aceptan URLs de NUESTRA cuenta de Cloudinary (nunca una URL
    arbitraria enviada por el navegador)."""
    if not url:
        return None
    cloud = cloudinary.config().cloud_name if CLOUDINARY_CONFIGURADO else None
    prefijo = f"https://res.cloudinary.com/{cloud}/{resource_type}/upload/"
    if not cloud or not url.startswith(prefijo) or len(url) > 500:
        raise HTTPException(status_code=422, detail="Archivo no válido: súbelo de nuevo.")
    return url


@router.get("/firma-subida")
def firma_subida(
    destino: str = Query(..., description="agencia-video | agencia-portada | comunidad-video | comunidad-foto"),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    if destino not in DESTINOS_SUBIDA:
        raise HTTPException(status_code=422, detail="Destino de subida no válido")
    carpeta, resource_type, quien = DESTINOS_SUBIDA[destino]
    if quien == "admin" and not usuario_es_admin(authorization):
        raise HTTPException(status_code=403, detail="Solo un administrador puede subir videos de la agencia")
    if quien == "cliente":
        _exigir_cliente(current_user)
    if not CLOUDINARY_CONFIGURADO:
        return {"modo": "servidor"}
    cfg = cloudinary.config()
    folder = f"alectours/{carpeta}"
    timestamp = int(time.time())
    firma = cloudinary.utils.api_sign_request({"folder": folder, "timestamp": timestamp}, cfg.api_secret)
    return {
        "modo": "directo",
        "cloud_name": cfg.cloud_name,
        "api_key": cfg.api_key,
        "timestamp": timestamp,
        "folder": folder,
        "signature": firma,
        "resource_type": resource_type,
    }


# ===================== PÚBLICO =====================


@router.get("/publicaciones", response_model=PublicacionesPaginadas)
def listar_publicaciones(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    usuario: Usuario | None = Depends(get_usuario_opcional),
):
    """Publicaciones aprobadas, la más reciente primero. Con sesión marca
    lo propio (es_mia / es_mio) para que se pueda borrar."""
    viewer = _usuario(usuario)
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
    return PublicacionesPaginadas(
        items=[_publicacion(db, p, viewer) for p in items], total=total, skip=skip, limit=limit
    )


@router.get("/videos", response_model=list[VideoAgenciaResponse])
def listar_videos_agencia(
    id_paquete: int | None = Query(None, description="Solo los videos promocionales de este paquete"),
    inicio: bool = Query(False, description="Solo los destacados para la página de inicio"),
    db: Session = Depends(get_db),
    usuario: Usuario | None = Depends(get_usuario_opcional),
):
    q = _query_videos(db).filter(VideoAgencia.activo.is_(True))
    if isinstance(id_paquete, int):
        q = q.filter(VideoAgencia.id_paquete == id_paquete)
    if inicio is True:
        q = q.filter(VideoAgencia.mostrar_inicio.is_(True))
    videos = q.order_by(VideoAgencia.orden.asc(), VideoAgencia.fecha_creacion.desc()).all()
    viewer = _usuario(usuario)
    return [_video(db, v, viewer) for v in videos]


@router.post("/videos/{id_video}/comentarios", response_model=ComentarioResponse, status_code=201)
def comentar_video(
    id_video: int,
    data: ComentarioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    v = db.query(VideoAgencia).filter(VideoAgencia.id_video == id_video).first()
    if not v or not v.activo:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    comentario = _guardar_comentario(db, data, current_user, _texto(authorization), video=v)
    return _comentario(db, comentario, current_user)


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
    return [_publicacion(db, p, current_user) for p in items]


@router.post("/publicaciones", response_model=PublicacionResponse, status_code=201)
async def crear_publicacion(
    titulo: str = Form(..., min_length=3, max_length=150),
    contenido: str = Form(..., min_length=10, max_length=3000),
    calificacion: int | None = Form(None, ge=1, le=5),
    destino: str | None = Form(None, max_length=120),
    video: UploadFile | None = File(None),
    imagenes: list[UploadFile] | None = File(None),
    video_url: str | None = Form(None, description="URL ya subida a Cloudinary (subida directa)"),
    imagenes_urls: list[str] | None = Form(None, description="URLs ya subidas a Cloudinary (subida directa)"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
):
    """Crea una publicación en estado 'pendiente' (la revisa el equipo antes
    de mostrarse). Lleva un video corto O hasta 4 fotos (o solo texto)."""
    id_cliente = _exigir_cliente(current_user)
    video = video if isinstance(video, StarletteUploadFile) and video.filename else None
    imagenes = [i for i in (imagenes or []) if isinstance(i, StarletteUploadFile) and i.filename]
    video_url_directo = _url_cloudinary_valida(video_url, "video") if isinstance(video_url, str) else None
    fotos_directas = [
        _url_cloudinary_valida(u, "image") for u in (imagenes_urls if isinstance(imagenes_urls, list) else []) if u
    ]
    if video_url_directo:
        video = None
    if fotos_directas:
        imagenes = []

    if (video or video_url_directo) and (imagenes or fotos_directas):
        raise HTTPException(status_code=422, detail="Sube un video o fotos, no ambos en la misma publicación.")
    if len(imagenes) + len(fotos_directas) > MAX_IMAGENES:
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

    video_final = video_url_directo
    if video_validado:
        video_final = guardar_imagen(
            *video_validado, carpeta=CARPETA_VIDEOS, public_path_prefix=PREFIJO_VIDEOS, resource_type="video"
        )
    urls_fotos = fotos_directas + [
        guardar_imagen(*f, carpeta=CARPETA_FOTOS, public_path_prefix=PREFIJO_FOTOS) for f in fotos_validadas
    ]

    publicacion = PublicacionComunidad(
        id_cliente=id_cliente,
        titulo=titulo.strip(),
        contenido=contenido.strip(),
        calificacion=calificacion if isinstance(calificacion, int) else None,
        destino=(destino.strip() or None) if isinstance(destino, str) else None,
        video_url=video_final,
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
    return _publicacion(db, publicacion, current_user)


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
    authorization: str | None = Header(None),
):
    p = db.query(PublicacionComunidad).filter(PublicacionComunidad.id_publicacion == id_publicacion).first()
    if not p or p.estado != "aprobada":
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    comentario = _guardar_comentario(db, data, current_user, _texto(authorization), publicacion=p)
    return _comentario(db, comentario, current_user)


@router.delete("/comentarios/{id_comentario}")
def borrar_comentario(
    id_comentario: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_usuario)
):
    """El autor borra su comentario (cliente o miembro del equipo). Sus
    respuestas se borran con él."""
    c = db.query(ComentarioComunidad).filter(ComentarioComunidad.id_comentario == id_comentario).first()
    if not c or not _es_mio(c, current_user):
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    # Explícito (no solo el ON DELETE CASCADE de la BD) para que funcione igual
    # en cualquier motor.
    db.query(ComentarioComunidad).filter(ComentarioComunidad.id_padre == c.id_comentario).delete(
        synchronize_session=False
    )
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
    videos = _query_videos(db).order_by(VideoAgencia.orden.asc(), VideoAgencia.fecha_creacion.desc()).all()
    return [_video(db, v, incluir_ocultos=True) for v in videos]


@router.post("/admin/videos", response_model=VideoAgenciaResponse, status_code=201)
async def admin_subir_video(
    titulo: str = Form(..., min_length=1, max_length=150),
    descripcion: str | None = Form(None, max_length=500),
    video: UploadFile | None = File(None),
    portada: UploadFile | None = File(None),
    video_url: str | None = Form(None, description="URL ya subida a Cloudinary (subida directa)"),
    portada_url: str | None = Form(None, description="URL ya subida a Cloudinary (subida directa)"),
    id_paquete: int | None = Form(None, description="Paquete del que es video promocional"),
    mostrar_inicio: bool = Form(False, description="Mostrarlo también en la página de inicio"),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    video_directo = _url_cloudinary_valida(video_url, "video") if isinstance(video_url, str) else None
    portada_directa = _url_cloudinary_valida(portada_url, "image") if isinstance(portada_url, str) else None
    tiene_archivo = isinstance(video, StarletteUploadFile) and video.filename
    if not video_directo and not tiene_archivo:
        raise HTTPException(status_code=422, detail="Falta el video")
    contenido_video = None
    if not video_directo:
        contenido_video = await validar_y_leer_archivo(
            video,
            tipos_permitidos=VIDEO_TIPOS,
            mensaje_tipo=MENSAJE_VIDEO,
            tamano_maximo_bytes=VIDEO_AGENCIA_MAX_BYTES,
        )
    portada_validada = None
    if not portada_directa and isinstance(portada, StarletteUploadFile) and portada.filename:
        portada_validada = await validar_y_leer_archivo(
            portada, tipos_permitidos=IMAGEN_TIPOS, mensaje_tipo=MENSAJE_IMAGEN, tamano_maximo_bytes=IMAGEN_MAX_BYTES
        )
    video_final = video_directo or guardar_imagen(
        *contenido_video, carpeta=CARPETA_AGENCIA, public_path_prefix=PREFIJO_AGENCIA, resource_type="video"
    )
    portada_final = portada_directa or (
        guardar_imagen(*portada_validada, carpeta=CARPETA_PORTADAS, public_path_prefix=PREFIJO_PORTADAS)
        if portada_validada
        else None
    )
    siguiente = db.query(VideoAgencia).count() or 0
    nuevo = VideoAgencia(
        titulo=titulo.strip(),
        descripcion=(descripcion.strip() or None) if isinstance(descripcion, str) else None,
        video_url=video_final,
        portada_url=portada_final,
        orden=siguiente,
        activo=True,
        id_paquete=_paquete_valido(db, id_paquete),
        mostrar_inicio=mostrar_inicio is True,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return _video(db, nuevo, incluir_ocultos=True)


@router.put("/admin/videos/{id_video}", response_model=VideoAgenciaResponse)
def admin_editar_video(
    id_video: int, data: VideoAgenciaUpdate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    v = db.query(VideoAgencia).filter(VideoAgencia.id_video == id_video).first()
    if not v:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    cambios = data.model_dump(exclude_unset=True)
    if "id_paquete" in cambios and cambios["id_paquete"] is not None:
        v.id_paquete = _paquete_valido(db, cambios.pop("id_paquete"))
    cambios.pop("id_paquete", None)
    for campo, valor in cambios.items():
        if valor is not None:
            setattr(v, campo, valor.strip() if isinstance(valor, str) else valor)
    db.commit()
    db.refresh(v)
    return _video(db, v, incluir_ocultos=True)


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
