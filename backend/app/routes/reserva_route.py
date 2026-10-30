import asyncio
import contextlib
import logging
import os
import threading
import uuid
from types import SimpleNamespace

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.core.cache import delete_pattern, get_cached, set_cached
from app.core.database import get_db
from app.core.deps import exigir_propietario_o_admin, get_current_usuario, usuario_es_staff
from app.core.exceptions import (
    HabitacionNoDisponibleError,
    HabitacionNoEncontradaError,
    NotFoundError,
    PaqueteDependencyError,
    PaqueteNoEncontradoError,
    ReservaDependencyError,
)
from app.core.file_validation import validar_y_leer_archivo
from app.core.image_storage import borrar_imagen, guardar_imagen
from app.core.mail import send_reservation_confirmation
from app.core.security import require_admin, require_empleado
from app.models.hotel_model import Hotel, HotelCaracteristica
from app.models.metodo_pago_guardado_model import MetodoPagoGuardado
from app.models.reserva_model import MetodoPago, Pago, Paquete, PaqueteHotel, PaqueteServicio
from app.models.servicio_model import Servicio
from app.models.user_model import Usuario
from app.repositories.reserva_repository import (
    MetodoPagoRepository,
    PagoRepository,
    PaqueteRepository,
    ReservaRepository,
)
from app.schemas.hotel_schema import ImagenGaleriaResponse
from app.schemas.reserva_detail import (
    ActividadRecienteItem,
    NotaInternaCreate,
    ReservaHabitacionDetail,
    ReservaHistorialDetail,
    ReservaServicioDetail,
)
from app.schemas.reserva_schema import (
    MetodoPagoCreate,
    MetodoPagoResponse,
    PagarRequest,
    PagarResponse,
    PagoCreate,
    PagoResponse,
    PagoUpdate,
    PaqueteCreate,
    PaqueteDetalleResponse,
    PaqueteHotelDetalle,
    PaqueteResponse,
    PaqueteServicioDetalle,
    PaqueteUpdate,
    ReservaCreate,
    ReservaDetailResponse,
    ReservaResponse,
    ReservaUpdate,
)
from app.services import payment_service
from app.services.pago_estado_service import TransicionPagoInvalida, cambiar_estado_pago, total_pagado
from app.services.reserva_detail_service import ReservaDetailService

router = APIRouter(prefix="/api", tags=["Reservas, Paquetes y Pagos"])

logger = logging.getLogger(__name__)

PAQUETES_CACHE_PATTERN = "paquetes:list:*"

# Imágenes de paquete (portada + galería) -- mismo patrón que hotel_route.py,
# con carpetas propias para no mezclarlas con las de hoteles en Cloudinary/disco.
PAQUETE_IMAGEN_TIPOS_PERMITIDOS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
PAQUETE_IMAGEN_TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024  # 5MB
PAQUETE_IMAGEN_PUBLIC_PREFIX = "/uploads/paquetes"
PAQUETE_GALERIA_PUBLIC_PREFIX = "/uploads/paquetes-galeria"
RESERVAS_CACHE_PATTERN = "reservas:list:*"
PAGOS_CACHE_PATTERN = "pagos:list:*"
# Los métodos de pago casi nunca cambian (se crean una vez al configurar el
# sistema), así que van con TTL largo y una sola clave fija en vez de
# parametrizada — no hay skip/limit en este endpoint.
METODOS_PAGO_CACHE_KEY = "metodos_pago:list"

# Comprobantes externos de pago (voucher de transferencia/efectivo que el
# cliente envía por fuera de la plataforma) — mismo patrón que la foto de
# perfil en usuario_route.py, pero admitiendo también PDF.
COMPROBANTES_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "comprobantes")
COMPROBANTES_PUBLIC_PREFIX = "/uploads/comprobantes"
COMPROBANTES_TIPOS_PERMITIDOS = {"image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"}
COMPROBANTES_TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024  # 5MB


def _borrar_comprobante_si_existe(comprobante_url: str | None) -> None:
    if not comprobante_url:
        return
    filename = os.path.basename(comprobante_url)
    ruta = os.path.join(COMPROBANTES_UPLOAD_DIR, filename)
    if os.path.isfile(ruta):
        with contextlib.suppress(OSError):
            os.remove(ruta)


def _enviar_confirmacion_reserva_en_hilo(
    email: str | None,
    reserva_id: int,
    hotel_name: str | None,
    check_in: str,
    check_out: str,
    total_price: float,
    guest_name: str,
) -> None:
    """
    Envia el correo de confirmacion de reserva (Fase 2 del plan de mejora:
    la "confirmacion por correo" que Checkout.tsx ya promete al cliente
    -linea 561-563- no tenia ninguna infraestructura de envio real detras;
    send_reservation_confirmation ya existia en app/core/mail.py pero solo
    se usaba en app/core/examples.py, que no es una ruta activa.

    Se extraen los valores planos ANTES de llamar a esta funcion (nunca se
    pasa el objeto Reserva ni la sesion de BD a otro hilo: la sesion puede
    cerrarse en cuanto este endpoint responda, y un lazy-load de
    reserva.cliente desde otro hilo en ese momento fallaria). Corre en un
    hilo aparte, best-effort: si el envio falla, solo queda en el log —
    nunca debe romper la respuesta de un pago que ya se aplico y confirmo
    en la base de datos.
    """
    if not email:
        return

    def _run() -> None:
        try:
            asyncio.run(
                send_reservation_confirmation(
                    email=email,
                    reservation_id=reserva_id,
                    hotel_name=hotel_name or "Alik Tours",
                    check_in=check_in,
                    check_out=check_out,
                    total_price=total_price,
                    guest_name=guest_name,
                )
            )
        except Exception as e:
            logger.error(f"No se pudo enviar el correo de confirmacion de la reserva #{reserva_id}: {e}")

    threading.Thread(target=_run, daemon=True).start()


def _notificar_confirmacion(reserva) -> None:
    """Correo de confirmación de la reserva (en hilo aparte, best-effort)."""
    cliente = reserva.cliente
    _enviar_confirmacion_reserva_en_hilo(
        email=cliente.correo if cliente else None,
        reserva_id=reserva.id_reserva,
        hotel_name=reserva.hotel_nombre,
        check_in=str(reserva.fecha_inicio) if reserva.fecha_inicio else "",
        check_out=str(reserva.fecha_fin) if reserva.fecha_fin else "",
        total_price=reserva.precio_total,
        guest_name=f"{cliente.nombre} {cliente.apellido}".strip() if cliente else "Cliente",
    )


# ===================== PAQUETES CRUD =====================


@router.get("/paquetes", response_model=list[PaqueteResponse])
def get_paquetes(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=300),
    incluir_inactivos: bool = Query(False, description="Solo para el panel de admin: incluye paquetes desactivados"),
    db: Session = Depends(get_db),
):
    """Obtiene lista de paquetes activos (o todos, si incluir_inactivos=true).
    Cacheada 2 min — invalidada en cualquier alta/edición/baja de paquete."""
    cache_key = f"paquetes:list:{skip}:{limit}:{incluir_inactivos}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    paquetes = PaqueteRepository.get_all(db, skip, limit, incluir_inactivos)
    data = [PaqueteResponse.model_validate(p).model_dump(mode="json") for p in paquetes]
    set_cached(cache_key, data, ttl_seconds=120)
    return data


@router.get("/paquetes/populares")
def get_paquetes_populares(limit: int = 6, db: Session = Depends(get_db)):
    result = db.execute(text("SELECT * FROM vista_paquetes_populares LIMIT :limit"), {"limit": limit}).fetchall()
    return [dict(r._mapping) for r in result]


@router.get("/paquetes/{paquete_id}", response_model=PaqueteResponse)
def get_paquete(paquete_id: int, db: Session = Depends(get_db)):
    """Obtiene detalles de un paquete"""
    paquete = PaqueteRepository.get_by_id(db, paquete_id)
    if not paquete:
        raise HTTPException(status_code=404, detail="Paquete no encontrado")
    return paquete


@router.get("/paquetes/{paquete_id}/detalle", response_model=PaqueteDetalleResponse)
def get_paquete_detalle(paquete_id: int, db: Session = Depends(get_db)):
    """
    Igual que GET /paquetes/{id} pero enriquecido con los destinos, hoteles
    (con sus características reales) y servicios incluidos del paquete —
    usado por la página de detalle del frontend, que antes mostraba datos
    de ejemplo hardcodeados (vuelos, horarios y hoteles inventados) desde
    data/packages.ts en vez de la información real de la base de datos.
    """
    paquete = (
        db.query(Paquete)
        .options(
            joinedload(Paquete.paquete_servicios).joinedload(PaqueteServicio.servicio).joinedload(Servicio.categoria),
            joinedload(Paquete.paquete_servicios).joinedload(PaqueteServicio.servicio).joinedload(Servicio.destino),
            joinedload(Paquete.paquete_hotel)
            .joinedload(PaqueteHotel.hotel)
            .joinedload(Hotel.hotel_caracteristicas)
            .joinedload(HotelCaracteristica.caracteristica),
        )
        .filter(Paquete.id_paquete == paquete_id)
        .first()
    )
    if not paquete:
        raise HTTPException(status_code=404, detail="Paquete no encontrado")

    destinos = sorted(
        {ps.servicio.destino.nombre_destino for ps in paquete.paquete_servicios if ps.servicio and ps.servicio.destino}
    )

    hoteles = [
        PaqueteHotelDetalle(
            id_hotel=ph.hotel.id_hotel,
            nombre_hotel=ph.hotel.nombre_hotel,
            ciudad=ph.hotel.ciudad,
            pais=ph.hotel.pais,
            calificacion=ph.hotel.calificacion,
            noches_incluidas=ph.noches_incluidas,
            imagen_url=ph.hotel.imagen_url,
            caracteristicas=sorted(
                {
                    hc.caracteristica.nombre_caracteristica
                    for hc in ph.hotel.hotel_caracteristicas
                    if hc.disponible and hc.caracteristica
                }
            ),
        )
        for ph in paquete.paquete_hotel
        if ph.hotel
    ]

    servicios = [
        PaqueteServicioDetalle(
            id_servicio=ps.id_servicio,
            nombre_servicio=ps.servicio.nombre_servicio,
            categoria=ps.servicio.categoria.nombre_categoria if ps.servicio.categoria else None,
            descripcion=ps.servicio.descripcion,
            dia_actividad=ps.dia_actividad,
            incluido=ps.incluido if ps.incluido is not None else True,
            capacidad_maxima=ps.servicio.capacidad_maxima,
        )
        for ps in paquete.paquete_servicios
        if ps.servicio
    ]

    imagenes = [
        ImagenGaleriaResponse(id_imagen=img.id_imagen, url=img.url, orden=img.orden) for img in paquete.imagenes
    ]

    return PaqueteDetalleResponse(
        id_paquete=paquete.id_paquete,
        nombre_paquete=paquete.nombre_paquete,
        descripcion=paquete.descripcion,
        duracion_dias=paquete.duracion_dias,
        precio_base=float(paquete.precio_base),
        activo=paquete.activo,
        ciudad_salida=paquete.ciudad_salida,
        condiciones=paquete.condiciones,
        imagen_url=paquete.imagen_url,
        destinos=destinos,
        hoteles=hoteles,
        servicios=servicios,
        imagenes=imagenes,
    )


@router.post("/paquetes", response_model=PaqueteResponse, status_code=201)
def create_paquete(paquete: PaqueteCreate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Crea un nuevo paquete turístico, opcionalmente vinculado a hotel(es)
    reales (paquete_hotel — ver PaqueteRepository._sync_hoteles)."""
    try:
        nuevo = PaqueteRepository.create(db, paquete.dict())
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from e
    delete_pattern(PAQUETES_CACHE_PATTERN)
    return nuevo


@router.put("/paquetes/{paquete_id}", response_model=PaqueteResponse)
def update_paquete(
    paquete_id: int, paquete: PaqueteUpdate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    """Actualiza un paquete existente"""
    db_paquete = PaqueteRepository.get_by_id(db, paquete_id)
    if not db_paquete:
        raise HTTPException(status_code=404, detail="Paquete no encontrado")
    try:
        actualizado = PaqueteRepository.update(db, paquete_id, paquete.dict(exclude_unset=True))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from e
    delete_pattern(PAQUETES_CACHE_PATTERN)
    return actualizado


@router.delete("/paquetes/{paquete_id}")
def delete_paquete(paquete_id: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Desactiva un paquete"""
    try:
        PaqueteRepository.delete(db, paquete_id)
        delete_pattern(PAQUETES_CACHE_PATTERN)
        return {"message": "Paquete desactivado exitosamente"}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from e
    except PaqueteDependencyError as e:
        raise HTTPException(status_code=409, detail=e.detail) from e
    except Exception as e:
        logger.error(f"Error inesperado: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor") from e


@router.get("/paquetes/{paquete_id}/similares", response_model=list[PaqueteResponse])
def get_paquetes_similares(
    paquete_id: int,
    limit: int = Query(6, ge=1, le=12),
    db: Session = Depends(get_db),
):
    """Paquetes con destino real parecido (mismo ciudad de algún hotel
    vinculado) para la sección "también te puede interesar" -- ver
    PaqueteRepository.get_similares. Vacío (nunca 404) si el paquete no
    tiene ningún hotel vinculado todavía."""
    return PaqueteRepository.get_similares(db, paquete_id, limit)


@router.post("/paquetes/{paquete_id}/imagen", response_model=PaqueteResponse)
async def subir_imagen_paquete(
    paquete_id: int,
    imagen: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Sube/reemplaza la portada del paquete (Paquete.imagen_url) -- antes
    Paquete no tenía ningún campo de imagen propio, ver reserva_model.py.
    Mismo almacenamiento (Cloudinary si está configurado, disco local si
    no) y misma validación que subir_imagen_hotel en hotel_route.py."""
    paquete = PaqueteRepository.get_by_id(db, paquete_id)
    if not paquete:
        raise HTTPException(status_code=404, detail="Paquete no encontrado")

    contenido, extension = await validar_y_leer_archivo(
        imagen,
        tipos_permitidos=PAQUETE_IMAGEN_TIPOS_PERMITIDOS,
        mensaje_tipo="Formato de imagen no soportado. Usa JPG, PNG o WEBP.",
        tamano_maximo_bytes=PAQUETE_IMAGEN_TAMANO_MAXIMO_BYTES,
    )
    nueva_url = guardar_imagen(
        contenido, extension, carpeta="paquetes", public_path_prefix=PAQUETE_IMAGEN_PUBLIC_PREFIX
    )
    # Primero se guarda la foto nueva, y solo si eso funciona se borra la
    # anterior -- mismo orden que subir_imagen_hotel.
    borrar_imagen(paquete.imagen_url, carpeta="paquetes", public_path_prefix=PAQUETE_IMAGEN_PUBLIC_PREFIX)
    actualizado = PaqueteRepository.set_imagen_portada(db, paquete_id, nueva_url)
    delete_pattern(PAQUETES_CACHE_PATTERN)
    return actualizado


@router.post("/paquetes/{paquete_id}/galeria", response_model=ImagenGaleriaResponse, status_code=201)
async def subir_foto_galeria_paquete(
    paquete_id: int,
    imagen: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Agrega una foto a la galería del paquete (distinta de la portada, ver
    subir_imagen_paquete arriba) -- ver ImagenPaquete en reserva_model.py."""
    paquete = PaqueteRepository.get_by_id(db, paquete_id)
    if not paquete:
        raise HTTPException(status_code=404, detail="Paquete no encontrado")

    contenido, extension = await validar_y_leer_archivo(
        imagen,
        tipos_permitidos=PAQUETE_IMAGEN_TIPOS_PERMITIDOS,
        mensaje_tipo="Formato de imagen no soportado. Usa JPG, PNG o WEBP.",
        tamano_maximo_bytes=PAQUETE_IMAGEN_TAMANO_MAXIMO_BYTES,
    )
    url = guardar_imagen(
        contenido, extension, carpeta="paquetes-galeria", public_path_prefix=PAQUETE_GALERIA_PUBLIC_PREFIX
    )
    nueva = PaqueteRepository.add_imagen_galeria(db, paquete_id, url)
    delete_pattern(PAQUETES_CACHE_PATTERN)
    return nueva


@router.delete("/paquetes/{paquete_id}/galeria/{id_imagen}")
def borrar_foto_galeria_paquete(
    paquete_id: int,
    id_imagen: int,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Elimina una foto de la galería del paquete (y su archivo real)."""
    imagen = PaqueteRepository.get_imagen_galeria(db, paquete_id, id_imagen)
    if not imagen:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    borrar_imagen(imagen.url, carpeta="paquetes-galeria", public_path_prefix=PAQUETE_GALERIA_PUBLIC_PREFIX)
    PaqueteRepository.delete_imagen_galeria(db, imagen)
    delete_pattern(PAQUETES_CACHE_PATTERN)
    return {"message": "Imagen eliminada de la galería"}


# ===================== RESERVAS CRUD =====================


@router.get("/reservas", response_model=list[ReservaResponse])
def get_reservas(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_empleado),
):
    """Obtiene lista de reservas. Cacheada solo 60s (más corto que
    hoteles/paquetes/clientes) porque una reserva cambia por muchos caminos
    distintos — crear/editar/eliminar, pagar, confirmar un pago, y aprobar
    una solicitud de cancelación (ver los `delete_pattern` en cada uno más
    abajo y en solicitud_cancelacion_route.py) — un TTL corto acota el
    impacto de cualquier camino de escritura que se nos escape."""
    cache_key = f"reservas:list:{skip}:{limit}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    reservas = ReservaRepository.get_all(db, skip, limit)
    data = [ReservaResponse.model_validate(r).model_dump(mode="json") for r in reservas]
    set_cached(cache_key, data, ttl_seconds=60)
    return data


@router.get("/reservas/cliente/{cliente_id}", response_model=list[ReservaResponse])
def get_reservas_cliente(
    cliente_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """Obtiene reservas de un cliente"""
    exigir_propietario_o_admin(current_user, cliente_id, authorization)
    return ReservaRepository.get_by_cliente(db, cliente_id, skip, limit)


@router.get("/reservas/estado/{estado}", response_model=list[ReservaResponse])
def get_reservas_estado(
    estado: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Obtiene reservas por estado"""
    if estado not in ["pendiente", "confirmada", "cancelada", "finalizada"]:
        raise HTTPException(status_code=400, detail="Estado inválido")
    return ReservaRepository.get_by_estado(db, estado, skip, limit)


# ⚠️ IMPORTANTE: estos tres endpoints específicos van ANTES de /reservas/{reserva_id}
# para que FastAPI no los confunda con el parámetro dinámico


@router.get("/reservas/{reserva_id}/habitaciones", response_model=list[ReservaHabitacionDetail])
def get_habitaciones_reserva(
    reserva_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """Obtiene habitaciones asociadas a una reserva"""
    reserva = ReservaRepository.get_by_id(db, reserva_id)
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    exigir_propietario_o_admin(current_user, reserva.id_cliente, authorization)
    return ReservaDetailService.get_habitaciones(db, reserva_id)


@router.get("/reservas/{reserva_id}/servicios", response_model=list[ReservaServicioDetail])
def get_servicios_reserva(
    reserva_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """Obtiene servicios asociados a una reserva"""
    reserva = ReservaRepository.get_by_id(db, reserva_id)
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    exigir_propietario_o_admin(current_user, reserva.id_cliente, authorization)
    return ReservaDetailService.get_servicios(db, reserva_id)


@router.get("/reservas/{reserva_id}/historial", response_model=list[ReservaHistorialDetail])
def get_historial_reserva(
    reserva_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """Obtiene historial de cambios de una reserva"""
    reserva = ReservaRepository.get_by_id(db, reserva_id)
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    exigir_propietario_o_admin(current_user, reserva.id_cliente, authorization)
    return ReservaDetailService.get_historial(db, reserva_id)


@router.post("/reservas/{reserva_id}/notas", response_model=ReservaHistorialDetail)
def agregar_nota_reserva(
    reserva_id: int,
    data: NotaInternaCreate,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """
    Nota interna del asesor sobre una reserva (ej. 'llamé al cliente,
    confirmó que llega el día 10') — no cambia el estado, solo deja
    trazabilidad real en el mismo historial que ya alimenta el timeline,
    para que cualquier empleado que retome el caso (ej. verificar una
    reserva pendiente) vea qué gestiones ya se hicieron.
    """
    admin = db.query(Usuario).filter(Usuario.id_usuario == admin_id).first()
    id_empleado = admin.empleado.id_empleado if admin and admin.empleado else None
    nota = ReservaDetailService.add_nota(db, reserva_id, id_empleado, data.comentario)
    if nota is None:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    return nota


@router.get("/historial-reservas/recientes", response_model=list[ActividadRecienteItem])
def get_actividad_reciente(
    # 50 alcanza para el widget chico del Dashboard, pero el módulo completo
    # de "Actividad del sistema" del admin necesita poder pedir más — mismo
    # endpoint, límite más alto en vez de duplicar la consulta.
    limit: int = Query(15, ge=1, le=300),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """
    Feed de 'Actividad reciente' para el Dashboard y el módulo de Actividad
    del admin: últimos cambios de estado registrados en TODAS las reservas
    (confirmaciones, cancelaciones, pagos aprobados/rechazados...), más
    recientes primero. Reutiliza la misma tabla historial_reservas que ya
    alimenta GET /reservas/{id}/historial — no agrega ninguna tabla ni
    columna nueva a la base de datos, solo una consulta agregada de solo
    lectura.
    """
    return ReservaDetailService.get_historial_reciente(db, limit)


@router.get("/reservas/{reserva_id}", response_model=ReservaDetailResponse)
def get_reserva(
    reserva_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """Obtiene detalles completos de una reserva con paquete, pagos y habitaciones"""
    reserva = ReservaRepository.get_by_id(db, reserva_id)
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    exigir_propietario_o_admin(current_user, reserva.id_cliente, authorization)
    return reserva


@router.post("/reservas", response_model=ReservaResponse, status_code=201)
def create_reserva(
    reserva: ReservaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """
    Crea una nueva reserva.

    Si `habitaciones` viene incluido, el backend:
    - Verifica que cada habitación exista y no esté en mantenimiento
    - Verifica que no haya otra reserva activa cruzando esas fechas (409 si la hay)
    - Calcula el precio con el valor REAL de la habitación en la BD (ignora cualquier
      precio que mande el frontend, para evitar manipulación)
    """
    # Antes se aceptaba el id_cliente que mandara el frontend tal cual, sin
    # verificar que fuera el mismo cliente autenticado — cualquiera con
    # sesión podía crear reservas a nombre de otro cliente. El frontend
    # (Checkout.tsx) ya siempre manda el id_cliente del usuario logueado,
    # así que esto no cambia el comportamiento normal.
    if current_user.id_cliente != reserva.id_cliente and not usuario_es_staff(authorization):
        raise HTTPException(status_code=403, detail="No puedes crear una reserva a nombre de otro cliente")
    try:
        nueva = ReservaRepository.create(db, reserva.dict())
        delete_pattern(RESERVAS_CACHE_PATTERN)
        # KPIs del dashboard dependen de reservas/pagos — invalida también su
        # caché corto (60s) para no mostrar cifras desactualizadas tras escribir.
        delete_pattern("kpi:dashboard:resumen")
        return nueva
    except HabitacionNoDisponibleError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
    except HabitacionNoEncontradaError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
    except PaqueteNoEncontradoError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
    except Exception as e:
        db.rollback()
        logger.error(f"Error inesperado: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor") from e


@router.post("/reservas/{reserva_id}/pagar", response_model=PagarResponse)
def pagar_reserva(
    reserva_id: int,
    data: PagarRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """
    Inicia el pago de una reserva (100% simulado, sin pasarela real). El
    monto SIEMPRE se calcula en el backend a partir del precio real de
    habitaciones/servicios ya guardados en la reserva — nunca se acepta un
    monto propuesto por el cliente.

    Segun el metodo:
    - Tarjeta / PayPal / otros: resuelve al instante (aprobado o rechazado
      con los valores de prueba de payment_service).
    - PSE / Nequi: el pago queda en estado 'procesando' y la reserva sigue
      'pendiente' hasta que el frontend llama a
      POST /api/pagos/{id}/confirmar (simula la confirmacion del banco o
      la app, que en la vida real llega despues, de forma asincrona).
    """
    # get_by_id_for_update (SELECT ... FOR UPDATE) en vez de get_by_id: sin
    # el lock, dos requests concurrentes para la misma reserva (doble clic,
    # reintento del frontend tras un timeout) podían leer estado='pendiente'
    # y pasar los dos chequeos de abajo antes de que cualquiera hiciera
    # commit, creando dos Pago para una sola reserva (cobro duplicado). Con
    # el lock, la segunda request espera a que la primera confirme (commit)
    # y entonces sí ve el nuevo estado/pago y es rechazada correctamente.
    reserva = ReservaRepository.get_by_id_for_update(db, reserva_id)
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    exigir_propietario_o_admin(current_user, reserva.id_cliente, authorization)

    # Se puede pagar una reserva 'pendiente' (primer pago) o una
    # 'confirmada' que todavía tiene saldo (anticipo del 50% ya pagado).
    # Antes, tras el anticipo la reserva quedaba 'confirmada' y este
    # chequeo rechazaba cualquier pago nuevo: el saldo nunca se podía cobrar.
    if reserva.estado not in ("pendiente", "confirmada"):
        raise HTTPException(
            status_code=409,
            detail=f"Esta reserva está en estado '{reserva.estado}', no admite pagos",
        )

    # Idempotencia (Fase 1 del plan de mejora): un pago async (PSE/Nequi) deja
    # la reserva en 'pendiente' mientras el Pago queda 'procesando' — sin este
    # chequeo, un segundo clic o un reintento del frontend pasaba el chequeo
    # de arriba igual y creaba un segundo Pago para la misma reserva.
    if PagoRepository.existe_pago_en_proceso(db, reserva_id):
        raise HTTPException(
            status_code=409,
            detail="Ya hay un pago en proceso para esta reserva. Espera a que se confirme antes de intentar de nuevo.",
        )

    metodo = db.query(MetodoPago).filter(MetodoPago.id_metodo == data.id_metodo_pago).first()
    if not metodo:
        raise HTTPException(status_code=404, detail="Método de pago no encontrado")

    # Pago con método guardado (billetera del cliente): el frontend envía
    # id_metodo_guardado y NO se confía en los datos de pago que mande el
    # navegador (ultimos4/celular/banco/documento). Se carga el método
    # guardado real del cliente, se valida que es suyo y que su tipo
    # coincide con el método de pago seleccionado, y la simulación usa los
    # datos REALES guardados. Esto corrige el bug de que se pudiera pagar
    # con un último-4 arbitrario sin corresponder al método guardado.
    datos_simulacion = data
    if data.id_metodo_guardado is not None:
        metodo_guardado = (
            db.query(MetodoPagoGuardado)
            .filter(
                MetodoPagoGuardado.id_metodo_guardado == data.id_metodo_guardado,
                MetodoPagoGuardado.id_cliente == reserva.id_cliente,
            )
            .first()
        )
        if not metodo_guardado:
            raise HTTPException(status_code=404, detail="Método de pago guardado no encontrado o no es de este cliente")
        if metodo_guardado.tipo != metodo.codigo:
            raise HTTPException(
                status_code=400,
                detail=f"El método guardado es de tipo '{metodo_guardado.tipo}' pero elegiste '{metodo.codigo}'",
            )
        # Se construye un objeto de simulación con la info REAL del método
        # guardado (últimos 4 de tarjeta, celular de Nequi, documento de
        # PSE), ignorando lo que haya enviado el navegador.
        datos_simulacion = SimpleNamespace(
            ultimos4=metodo_guardado.ultimos4,
            celular=None,
            banco=None,
            documento=None,
        )

    total = reserva.precio_total
    if total <= 0:
        raise HTTPException(
            status_code=422,
            detail="Esta reserva no tiene habitaciones ni servicios asociados, no hay nada que cobrar",
        )
    pagado = total_pagado(reserva)
    saldo = round(total - pagado, 2)
    if saldo <= 0:
        raise HTTPException(status_code=409, detail="Esta reserva ya está pagada en su totalidad")

    if data.tipo_pago == "parcial":
        # El anticipo del 50% (mismo cálculo de siempre) solo aplica como
        # primer pago.
        if pagado > 0:
            raise HTTPException(status_code=409, detail="El anticipo ya fue pagado; ahora corresponde pagar el saldo")
        monto = round(total * 0.5, 2)
    else:
        # 'completo' o 'saldo': lo que falta por pagar (el total si es el
        # primer pago). Nunca un monto propuesto por el navegador.
        monto = saldo
    concepto = {"parcial": "anticipo (50%)", "saldo": "saldo", "completo": "completo"}[data.tipo_pago]

    rechazo_simulado = payment_service.debe_simular_rechazo(metodo.codigo, datos_simulacion)
    es_async = payment_service.es_pago_asincrono(metodo.codigo)

    pago = Pago(
        id_reserva=reserva_id,
        id_metodo_pago=data.id_metodo_pago,
        monto=monto,
        referencia=f"PAY-{uuid.uuid4().hex[:10].upper()}",
        estado="pendiente",
        simular_rechazo=rechazo_simulado,
        celular_nequi=getattr(datos_simulacion, "celular", None) if metodo.codigo == "nequi" else None,
    )
    db.add(pago)
    db.flush()

    estado_reserva_antes = reserva.estado
    if es_async:
        cambiar_estado_pago(db, pago, reserva, "procesando", "")
    elif rechazo_simulado:
        cambiar_estado_pago(db, pago, reserva, "rechazado", f"Pago {concepto} rechazado (simulado) por ${monto:,.0f}")
    else:
        cambiar_estado_pago(db, pago, reserva, "pagado", f"Pago {concepto} aprobado (simulado) por ${monto:,.0f}")

    db.commit()
    db.refresh(pago)
    db.refresh(reserva)
    delete_pattern(RESERVAS_CACHE_PATTERN)
    delete_pattern(PAGOS_CACHE_PATTERN)
    # KPIs del dashboard dependen de reservas/pagos — invalida también su
    # caché corto (60s) para no mostrar cifras desactualizadas tras escribir.
    delete_pattern("kpi:dashboard:resumen")

    # El correo de confirmación sale solo cuando la reserva PASA a confirmada
    # (no al pagar el saldo de una que ya lo estaba).
    if estado_reserva_antes != "confirmada" and reserva.estado == "confirmada":
        _notificar_confirmacion(reserva)

    return PagarResponse(pago=pago, reserva=reserva)


@router.post("/pagos/{pago_id}/confirmar", response_model=PagarResponse)
def confirmar_pago(
    pago_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """
    Confirma un pago que quedo 'procesando' (PSE/Nequi) — simula que el
    banco o la app ya respondieron. El resultado (aprobado/rechazado) ya
    fue decidido al iniciar el pago (ver `pagar_reserva`), aqui solo se
    aplica y se actualiza la reserva + el historial.
    """
    # with_for_update(): sin el lock, dos confirmaciones concurrentes del
    # mismo pago_id (doble clic, reintento tras timeout) podían leer
    # estado='procesando' las dos antes de que cualquiera hiciera commit,
    # duplicando el HistorialReserva y el correo de confirmación. Mismo
    # criterio que pagar_reserva (ver ReservaRepository.get_by_id_for_update).
    pago = db.query(Pago).filter(Pago.id_pago == pago_id).with_for_update().first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if pago.estado != "procesando":
        raise HTTPException(
            status_code=409,
            detail=f"Este pago ya está en estado '{pago.estado}', no hay nada que confirmar",
        )

    reserva = ReservaRepository.get_by_id(db, pago.id_reserva)
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    # Nequi ya no se autoconfirma solo: el cliente transfiere y queda
    # "procesando" hasta que un asesor/admin revisa el comprobante (y el
    # celular_nequi que quedó guardado) y confirma de verdad -- ver
    # NequiConfirmar.tsx. PSE y el resto siguen autoconfirmándose desde la
    # propia sesión del cliente, sin cambios.
    if pago.metodo_pago and pago.metodo_pago.codigo == "nequi":
        if not usuario_es_staff(authorization):
            raise HTTPException(
                status_code=403,
                detail="Un asesor debe revisar el comprobante antes de confirmar un pago por Nequi.",
            )
    else:
        exigir_propietario_o_admin(current_user, reserva.id_cliente, authorization)

    estado_reserva_antes = reserva.estado
    if pago.simular_rechazo:
        cambiar_estado_pago(
            db, pago, reserva, "rechazado", f"Pago confirmado como rechazado (simulado) por ${pago.monto:,.0f}"
        )
    else:
        cambiar_estado_pago(
            db,
            pago,
            reserva,
            "pagado",
            f"Pago confirmado y aprobado (simulado) por ${pago.monto:,.0f}",
            id_empleado=current_user.id_empleado,
        )

    db.commit()
    db.refresh(pago)
    db.refresh(reserva)
    delete_pattern(RESERVAS_CACHE_PATTERN)
    delete_pattern(PAGOS_CACHE_PATTERN)
    delete_pattern("kpi:dashboard:resumen")

    if estado_reserva_antes != "confirmada" and reserva.estado == "confirmada":
        _notificar_confirmacion(reserva)

    return PagarResponse(pago=pago, reserva=reserva)


@router.put("/reservas/{reserva_id}", response_model=ReservaResponse)
def update_reserva(
    reserva_id: int, reserva: ReservaUpdate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    """Actualiza una reserva existente"""
    db_reserva = ReservaRepository.get_by_id(db, reserva_id)
    if not db_reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    actualizada = ReservaRepository.update(db, reserva_id, reserva.dict(exclude_unset=True))
    delete_pattern(RESERVAS_CACHE_PATTERN)
    # KPIs del dashboard dependen de reservas/pagos — invalida también su
    # caché corto (60s) para no mostrar cifras desactualizadas tras escribir.
    delete_pattern("kpi:dashboard:resumen")
    return actualizada


@router.delete("/reservas/{reserva_id}")
def delete_reserva(reserva_id: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Elimina una reserva"""
    try:
        ReservaRepository.delete(db, reserva_id)
        delete_pattern(RESERVAS_CACHE_PATTERN)
        # KPIs del dashboard dependen de reservas/pagos — invalida también su
        # caché corto (60s) para no mostrar cifras desactualizadas tras escribir.
        delete_pattern("kpi:dashboard:resumen")
        return {"message": "Reserva eliminada exitosamente"}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from e
    except ReservaDependencyError as e:
        raise HTTPException(status_code=409, detail=e.detail) from e
    except Exception as e:
        logger.error(f"Error inesperado: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor") from e


# ===================== MÉTODOS DE PAGO CRUD =====================


@router.get("/metodos-pago", response_model=list[MetodoPagoResponse])
def get_metodos_pago(db: Session = Depends(get_db)):
    """Obtiene todos los métodos de pago disponibles. Cacheada 300s — lista
    casi estática, se invalida solo si se crea un método nuevo."""
    cached = get_cached(METODOS_PAGO_CACHE_KEY)
    if cached is not None:
        return cached

    metodos = MetodoPagoRepository.get_all(db)
    data = [MetodoPagoResponse.model_validate(m).model_dump(mode="json") for m in metodos]
    set_cached(METODOS_PAGO_CACHE_KEY, data, ttl_seconds=300)
    return data


@router.post("/metodos-pago", response_model=MetodoPagoResponse, status_code=201)
def create_metodo_pago(metodo: MetodoPagoCreate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Crea un nuevo método de pago"""
    nuevo = MetodoPagoRepository.create(db, metodo.dict())
    delete_pattern(METODOS_PAGO_CACHE_KEY)
    return nuevo


# ===================== PAGOS CRUD =====================


@router.get("/pagos", response_model=list[PagoResponse])
def get_pagos(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=300),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_empleado),
):
    """Obtiene lista de pagos. Cacheada 60s — mismo criterio de TTL corto que
    reservas, ya que un pago cambia de estado por varios caminos."""
    cache_key = f"pagos:list:{skip}:{limit}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    pagos = PagoRepository.get_all(db, skip, limit)
    data = [PagoResponse.model_validate(p).model_dump(mode="json") for p in pagos]
    set_cached(cache_key, data, ttl_seconds=60)
    return data


@router.get("/pagos/reserva/{reserva_id}", response_model=list[PagoResponse])
def get_pagos_reserva(
    reserva_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """Obtiene pagos de una reserva"""
    reserva = ReservaRepository.get_by_id(db, reserva_id)
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    exigir_propietario_o_admin(current_user, reserva.id_cliente, authorization)
    return PagoRepository.get_by_reserva(db, reserva_id)


@router.get("/pagos/estado/{estado}", response_model=list[PagoResponse])
def get_pagos_estado(
    estado: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    """Obtiene pagos por estado"""
    if estado not in ["pendiente", "pagado", "rechazado"]:
        raise HTTPException(status_code=400, detail="Estado inválido")
    return PagoRepository.get_by_estado(db, estado, skip, limit)


@router.get("/pagos/{pago_id}", response_model=PagoResponse)
def get_pago(
    pago_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """Obtiene detalles de un pago"""
    pago = PagoRepository.get_by_id(db, pago_id)
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    reserva = ReservaRepository.get_by_id(db, pago.id_reserva)
    if reserva:
        exigir_propietario_o_admin(current_user, reserva.id_cliente, authorization)
    elif not usuario_es_staff(authorization):
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a estos datos")
    return pago


@router.post("/pagos", response_model=PagoResponse, status_code=201)
def create_pago(pago: PagoCreate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Crea un nuevo pago"""
    nuevo = PagoRepository.create(db, pago.dict())
    delete_pattern(PAGOS_CACHE_PATTERN)
    # KPIs del dashboard dependen de reservas/pagos — invalida también su
    # caché corto (60s) para no mostrar cifras desactualizadas tras escribir.
    delete_pattern("kpi:dashboard:resumen")
    return nuevo


@router.put("/pagos/{pago_id}", response_model=PagoResponse)
def update_pago(
    pago_id: int,
    pago: PagoUpdate,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
    current_user: Usuario = Depends(get_current_usuario),
):
    """Actualiza un pago desde el panel. Un cambio de estado pasa por las
    mismas reglas que el flujo del cliente (pago_estado_service): marcar
    'pagado' confirma la reserva, deja historial, asigna comprobante y
    notifica; los estados finales no se reabren. El monto solo se puede
    corregir mientras el pago no esté resuelto."""
    db_pago = db.query(Pago).filter(Pago.id_pago == pago_id).with_for_update().first()
    if not db_pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    cambios = pago.dict(exclude_unset=True)

    if cambios.get("monto") is not None and float(cambios["monto"]) != float(db_pago.monto):
        if db_pago.estado not in ("pendiente", "procesando"):
            raise HTTPException(
                status_code=409, detail=f"No se puede cambiar el monto de un pago en estado '{db_pago.estado}'"
            )
        db_pago.monto = cambios["monto"]
    if cambios.get("referencia") is not None:
        db_pago.referencia = cambios["referencia"]

    nuevo_estado = cambios.get("estado")
    estado_reserva_antes = None
    reserva = None
    if nuevo_estado and nuevo_estado != db_pago.estado:
        reserva = ReservaRepository.get_by_id_for_update(db, db_pago.id_reserva)
        estado_reserva_antes = reserva.estado
        try:
            cambiar_estado_pago(
                db,
                db_pago,
                reserva,
                nuevo_estado,
                f"Pago #{db_pago.id_pago} marcado como '{nuevo_estado}' desde el panel por ${db_pago.monto:,.0f}",
                id_empleado=current_user.id_empleado,
            )
        except TransicionPagoInvalida as e:
            db.rollback()
            raise HTTPException(status_code=409, detail=str(e)) from e

    db.commit()
    db.refresh(db_pago)
    delete_pattern(PAGOS_CACHE_PATTERN)
    delete_pattern(RESERVAS_CACHE_PATTERN)  # el estado de pago se ve en la tabla de Reservas
    delete_pattern("kpi:dashboard:resumen")
    if reserva is not None and estado_reserva_antes != "confirmada" and reserva.estado == "confirmada":
        _notificar_confirmacion(reserva)
    return db_pago


@router.delete("/pagos/{pago_id}")
def delete_pago(pago_id: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Elimina un pago. Un pago aprobado (o con comprobante emitido) no se
    borra: es el registro de un dinero recibido y su trazabilidad debe
    quedar. Para revertir una venta se usa la cancelación de la reserva."""
    existente = PagoRepository.get_by_id(db, pago_id)
    if existente and (existente.estado == "pagado" or existente.numero_factura):
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar un pago aprobado o con comprobante emitido",
        )
    try:
        PagoRepository.delete(db, pago_id)
        delete_pattern(PAGOS_CACHE_PATTERN)
        delete_pattern(RESERVAS_CACHE_PATTERN)
        # KPIs del dashboard dependen de reservas/pagos — invalida también su
        # caché corto (60s) para no mostrar cifras desactualizadas tras escribir.
        delete_pattern("kpi:dashboard:resumen")
        return {"message": "Pago eliminado exitosamente"}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from e
    except Exception as e:
        logger.error(f"Error inesperado: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno del servidor") from e


@router.post("/pagos/{pago_id}/comprobante", response_model=PagoResponse)
async def subir_comprobante_pago(
    pago_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    """Adjunta un comprobante externo (imagen o PDF) a un pago — por ejemplo
    el voucher de una transferencia Nequi que el cliente envía por fuera de
    la plataforma. Reemplaza el anterior si ya existía uno.

    Antes era exclusivo de admin; ahora el propio cliente dueño de la
    reserva también puede adjuntar su comprobante desde el checkout (ver
    NequiConfirmar.tsx) -- un asesor/admin lo revisa después para verificar
    el pago (ver confirmar_pago)."""
    pago = db.query(Pago).filter(Pago.id_pago == pago_id).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    reserva_del_pago = ReservaRepository.get_by_id(db, pago.id_reserva)
    if not reserva_del_pago:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    exigir_propietario_o_admin(current_user, reserva_del_pago.id_cliente, authorization)

    if file.content_type not in COMPROBANTES_TIPOS_PERMITIDOS:
        raise HTTPException(
            status_code=422,
            detail="Formato no soportado. Usa JPG, PNG, WEBP o PDF.",
        )

    contenido, extension = await validar_y_leer_archivo(
        file,
        tipos_permitidos=COMPROBANTES_TIPOS_PERMITIDOS,
        mensaje_tipo="Formato no soportado. Usa JPG, PNG, WEBP o PDF.",
        tamano_maximo_bytes=COMPROBANTES_TAMANO_MAXIMO_BYTES,
    )

    os.makedirs(COMPROBANTES_UPLOAD_DIR, exist_ok=True)

    nombre_archivo = f"{uuid.uuid4().hex}.{extension}"
    ruta_destino = os.path.join(COMPROBANTES_UPLOAD_DIR, nombre_archivo)
    with open(ruta_destino, "wb") as f:
        f.write(contenido)

    _borrar_comprobante_si_existe(pago.comprobante_url)

    pago.comprobante_url = f"{COMPROBANTES_PUBLIC_PREFIX}/{nombre_archivo}"
    db.commit()
    db.refresh(pago)
    delete_pattern(PAGOS_CACHE_PATTERN)
    # KPIs del dashboard dependen de reservas/pagos — invalida también su
    # caché corto (60s) para no mostrar cifras desactualizadas tras escribir.
    delete_pattern("kpi:dashboard:resumen")
    return pago


@router.delete("/pagos/{pago_id}/comprobante", response_model=PagoResponse)
def eliminar_comprobante_pago(pago_id: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Quita el comprobante adjunto de un pago (por ejemplo si se subió por
    error o hay que reemplazarlo)."""
    pago = db.query(Pago).filter(Pago.id_pago == pago_id).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    _borrar_comprobante_si_existe(pago.comprobante_url)
    pago.comprobante_url = None
    db.commit()
    db.refresh(pago)
    delete_pattern(PAGOS_CACHE_PATTERN)
    # KPIs del dashboard dependen de reservas/pagos — invalida también su
    # caché corto (60s) para no mostrar cifras desactualizadas tras escribir.
    delete_pattern("kpi:dashboard:resumen")
    return pago
