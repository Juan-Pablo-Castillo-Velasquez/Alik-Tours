"""
Chat privado admin<->cliente (con capturas via Cloudinary) -- un solo hilo
continuo por cliente (no uno por reserva) y bandeja compartida: cualquier
admin puede ver y responder el hilo de cualquier cliente, sin asignacion
1-a-1. Solo polling desde el frontend (sin websockets -- el backend esta
en el plan free de Render, que duerme tras 15 min de inactividad y
mataria cualquier socket abierto).

Nota sobre las rutas de escritura: RATE_LIMITED_PATHS (security_middleware.py)
filtra solo por PATH, no por metodo HTTP -- si el envio del cliente
compartiera el mismo path literal que su lectura (ambos "/api/mensajes/me"),
agregar ese path a RATE_LIMITED_PATHS limitaria tambien el GET de polling,
justo lo que el diseño de este modulo busca evitar. Por eso el envio del
cliente vive en su propio path "/me/enviar", distinto de la lectura "/me".
"""

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.cache import reservar_clave_unica
from app.core.database import get_db
from app.core.deps import get_current_usuario, usuario_es_staff
from app.core.file_validation import validar_y_leer_archivo
from app.core.image_storage import guardar_imagen
from app.core.security import require_empleado
from app.models.reserva_model import Reserva
from app.models.user_model import Usuario
from app.repositories.mensaje_chat_repository import MensajeChatRepository
from app.schemas.mensaje_chat_schema import (
    ConteoNoLeidosResponse,
    HilosPaginadosResponse,
    MensajeChatResponse,
)

router = APIRouter(prefix="/api/mensajes", tags=["Mensajes"])

PUBLIC_PATH_PREFIX = "/uploads/chat"
# Mismo criterio de formato/tamaño que banner_route.py -- una captura de
# pantalla de reserva/pago no necesita más que esto.
IMAGEN_TIPOS_PERMITIDOS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
# application/pdf ya estaba soportado por validar_y_leer_archivo (magic
# number "%PDF", ver file_validation.py) desde antes -- solo faltaba
# permitirlo acá. Cubre lo más común en un chat de soporte de viajes:
# voucher, itinerario o cédula escaneada en PDF, además de capturas.
ARCHIVO_TIPOS_PERMITIDOS = IMAGEN_TIPOS_PERMITIDOS | {"application/pdf"}
# Subido un poco de 5MB a 8MB al agregar PDF: un voucher/itinerario
# escaneado de varias páginas pesa más que una captura de pantalla.
TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024  # 8MB
# Mensajes de chat de soporte, no documentos -- 500 caracteres alcanza de
# sobra para explicar un problema puntual y evita mensajes desproporcionados
# en la bandeja compartida del admin. Mismo límite reflejado en el frontend
# (contador junto al textarea, ver ModuleMensajes.tsx / TabMensajes.tsx) --
# esta es la validación real, la del frontend es solo UX.
CONTENIDO_MAX_LENGTH = 500


class MarcarLeidoRequest(BaseModel):
    # Solo lo usa un admin (para indicar de qué cliente es el hilo) -- un
    # cliente marcando su propio hilo lo omite, ver marcar_leido() abajo.
    id_cliente: int | None = None


def _exigir_cliente(usuario: Usuario) -> int:
    if not usuario.cliente:
        raise HTTPException(status_code=403, detail="Esta cuenta no tiene un perfil de cliente asociado.")
    return usuario.cliente.id_cliente


def _validar_contenido_o_archivo(contenido: str | None, archivo: UploadFile | None) -> None:
    if not contenido and archivo is None:
        raise HTTPException(status_code=400, detail="El mensaje necesita texto, una imagen o un PDF.")
    if contenido and len(contenido) > CONTENIDO_MAX_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"El mensaje no puede superar los {CONTENIDO_MAX_LENGTH} caracteres.",
        )


def _validar_after_before(after_id: int | None, before_id: int | None) -> None:
    if after_id is not None and before_id is not None:
        raise HTTPException(status_code=400, detail="No se puede combinar after_id con before_id.")


def _validar_reserva_del_cliente(db: Session, id_reserva: int | None, id_cliente: int) -> None:
    """Si se etiqueta un mensaje con una reserva, esa reserva debe ser DEL
    MISMO cliente del hilo -- nunca se confía en el id_reserva del body sin
    verificar propiedad primero (evita que alguien etiquete un mensaje con
    la reserva de otro cliente adivinando su id)."""
    if id_reserva is None:
        return
    reserva = db.query(Reserva).filter(Reserva.id_reserva == id_reserva).first()
    if not reserva or reserva.id_cliente != id_cliente:
        raise HTTPException(status_code=404, detail="La reserva indicada no existe o no pertenece a este cliente.")


async def _guardar_archivo_chat(archivo: UploadFile) -> tuple[str | None, str | None, str | None]:
    """Devuelve (imagen_url, archivo_url, archivo_nombre) -- exactamente una
    de las dos primeras queda poblada, según el tipo REAL del archivo (bytes
    de cabecera, no el content_type que declaró el cliente): una imagen
    sigue el camino de siempre (imagen_url, se muestra inline con
    lightbox); un PDF va a archivo_url + su nombre original, para
    mostrarse como tarjeta de documento descargable (ver
    MensajeChat.archivo_url)."""
    contenido, extension = await validar_y_leer_archivo(
        archivo,
        tipos_permitidos=ARCHIVO_TIPOS_PERMITIDOS,
        mensaje_tipo="Formato no soportado. Usa JPG, PNG, WEBP o PDF.",
        tamano_maximo_bytes=TAMANO_MAXIMO_BYTES,
    )
    url = guardar_imagen(contenido, extension, carpeta="chat", public_path_prefix=PUBLIC_PATH_PREFIX)
    if archivo.content_type == "application/pdf":
        return None, url, archivo.filename or f"documento.{extension}"
    return url, None, None


# ===================== ADMIN (bandeja compartida) =====================


@router.get("/hilos", response_model=HilosPaginadosResponse)
def get_hilos(
    search: str | None = Query(None, description="Filtra por nombre, apellido o correo del cliente"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_empleado),
):
    """Clientes con hilo, ordenados por mensaje más reciente, paginados y
    con búsqueda opcional -- lo que alimenta la bandeja de
    ModuleMensajes.tsx (polling ~8-10s). Mismo contrato skip/limit que el
    resto del proyecto (ver reserva_route.py), nunca page/page_size. Sin
    caché: es una vista administrativa que debe reflejar mensajes nuevos
    de inmediato, no contenido público de alto tráfico."""
    items, total = MensajeChatRepository.get_hilos(db, search=search, skip=skip, limit=limit)
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/hilos/{id_cliente}", response_model=list[MensajeChatResponse])
def get_hilo_admin(
    id_cliente: int,
    after_id: int | None = Query(None, description="Solo mensajes con id mayor a este -- polling incremental"),
    before_id: int | None = Query(None, description="Los mensajes anteriores a este id -- cargar historial previo"),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_empleado),
):
    _validar_after_before(after_id, before_id)
    return MensajeChatRepository.get_mensajes(db, id_cliente, after_id=after_id, before_id=before_id)


@router.post("/enviar", response_model=MensajeChatResponse, status_code=201)
async def enviar_como_admin(
    id_cliente: int = Form(...),
    contenido: str | None = Form(None),
    archivo: UploadFile | None = File(None),
    id_reserva: int | None = Form(None, description="Reserva de la que se está hablando, opcional"),
    client_msg_id: str | None = Form(None, max_length=64, description="Id de idempotencia generado por el frontend"),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_empleado),
):
    _exigir_mensaje_no_repetido(admin_id, client_msg_id)
    _validar_contenido_o_archivo(contenido, archivo)
    _validar_reserva_del_cliente(db, id_reserva, id_cliente)
    imagen_url, archivo_url, archivo_nombre = (
        await _guardar_archivo_chat(archivo) if archivo is not None else (None, None, None)
    )
    return MensajeChatRepository.crear_mensaje(
        db,
        id_cliente=id_cliente,
        id_usuario_remitente=admin_id,
        remitente_tipo="admin",
        contenido=contenido,
        imagen_url=imagen_url,
        archivo_url=archivo_url,
        archivo_nombre=archivo_nombre,
        id_reserva=id_reserva,
    )


def _exigir_mensaje_no_repetido(id_usuario: int, client_msg_id: str | None) -> None:
    """Idempotencia del envío: el frontend genera un id por mensaje
    (client_msg_id) y lo reutiliza si reintenta. Un segundo POST con el
    mismo id en 5 minutos se rechaza con 409 en vez de guardar el mensaje
    dos veces (causa de mensajes duplicados en el chat del cliente)."""
    # isinstance: si se llama a la ruta como función (tests) sin el parámetro,
    # el valor por defecto es el objeto Form(None), no un str.
    if isinstance(client_msg_id, str) and client_msg_id and not reservar_clave_unica(f"chat:idem:{id_usuario}:{client_msg_id}"):
        raise HTTPException(status_code=409, detail="Este mensaje ya fue enviado")


# ===================== CLIENTE (su propio hilo) =====================


@router.get("/me", response_model=list[MensajeChatResponse])
def get_mi_hilo(
    after_id: int | None = Query(None, description="Solo mensajes con id mayor a este -- polling incremental"),
    before_id: int | None = Query(None, description="Los mensajes anteriores a este id -- cargar historial previo"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
):
    """El id_cliente SIEMPRE se resuelve del propio token, nunca de un
    parámetro -- así se garantiza que un cliente jamás pueda leer el hilo
    de otro cambiando un id en la petición."""
    id_cliente = _exigir_cliente(current_user)
    _validar_after_before(after_id, before_id)
    return MensajeChatRepository.get_mensajes(db, id_cliente, after_id=after_id, before_id=before_id)


@router.post("/me/enviar", response_model=MensajeChatResponse, status_code=201)
async def enviar_como_cliente(
    contenido: str | None = Form(None),
    archivo: UploadFile | None = File(None),
    id_reserva: int | None = Form(None, description="Reserva de la que se está hablando, opcional"),
    client_msg_id: str | None = Form(None, max_length=64, description="Id de idempotencia generado por el frontend"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
):
    id_cliente = _exigir_cliente(current_user)
    _exigir_mensaje_no_repetido(current_user.id_usuario, client_msg_id)
    _validar_contenido_o_archivo(contenido, archivo)
    _validar_reserva_del_cliente(db, id_reserva, id_cliente)
    imagen_url, archivo_url, archivo_nombre = (
        await _guardar_archivo_chat(archivo) if archivo is not None else (None, None, None)
    )
    return MensajeChatRepository.crear_mensaje(
        db,
        id_cliente=id_cliente,
        id_usuario_remitente=current_user.id_usuario,
        remitente_tipo="cliente",
        contenido=contenido,
        imagen_url=imagen_url,
        archivo_url=archivo_url,
        archivo_nombre=archivo_nombre,
        id_reserva=id_reserva,
    )


# ===================== COMPARTIDOS (ambos roles) =====================


@router.patch("/leido")
def marcar_leido(
    data: MarcarLeidoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """Un solo endpoint para ambos roles -- bandeja compartida: cualquier
    admin puede marcar leído cualquier hilo. Admin: body {id_cliente},
    marca los mensajes del CLIENTE de ese hilo. Cliente: body vacío/omitido,
    marca los mensajes del ADMIN de su propio hilo (mismo criterio de
    "nunca resolver id_cliente de un parámetro" que get_mi_hilo)."""
    if usuario_es_staff(authorization):
        if data.id_cliente is None:
            raise HTTPException(status_code=422, detail="id_cliente es requerido para administradores.")
        actualizados = MensajeChatRepository.marcar_leido(db, data.id_cliente, "cliente")
    else:
        id_cliente = _exigir_cliente(current_user)
        actualizados = MensajeChatRepository.marcar_leido(db, id_cliente, "admin")
    return {"actualizados": actualizados}


@router.get("/no-leidos", response_model=ConteoNoLeidosResponse)
def get_no_leidos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """Nunca se cachea -- mismo criterio ya establecido para conteos de
    no-leídos (ver Notificacion en notificacion_route.py). Admin: total
    global de todos los hilos. Cliente: no-leídos de su propio hilo."""
    if usuario_es_staff(authorization):
        return {"no_leidos": MensajeChatRepository.contar_no_leidos_admin(db)}
    id_cliente = _exigir_cliente(current_user)
    return {"no_leidos": MensajeChatRepository.contar_no_leidos_cliente(db, id_cliente)}
