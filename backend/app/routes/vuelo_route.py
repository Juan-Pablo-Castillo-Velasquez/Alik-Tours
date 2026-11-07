"""Ofertas aéreas gestionadas por la agencia.

No hay integración con aerolíneas ni GDS: todo lo que aparece aquí lo
registró el admin con lo que le confirmó el proveedor. La vista pública lo
presenta como "oferta gestionada por la agencia", nunca como
disponibilidad aérea en tiempo real.
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import usuario_es_staff
from app.core.file_validation import validar_y_leer_archivo
from app.core.image_storage import borrar_imagen, guardar_imagen
from app.core.security import require_admin, require_empleado
from app.models.reserva_model import Reserva
from app.models.vuelo_model import OfertaVuelo, PaqueteVuelo
from app.schemas.vuelo_schema import (
    EstadoOfertaUpdate,
    OfertasVueloPagina,
    OfertaVueloAdmin,
    OfertaVueloCreate,
    OfertaVueloResponse,
    OfertaVueloUpdate,
    PasajeroOferta,
    ReservaDeOferta,
)
from app.services.cotizacion_service import ESTADOS_ACTIVOS, sillas_usadas

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vuelos", tags=["Vuelos"])

IMAGEN_TIPOS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
IMAGEN_MAX_BYTES = 5 * 1024 * 1024
IMAGEN_PREFIX = "/uploads/vuelos"


def _enriquecer(db: Session, oferta: OfertaVuelo, *, admin: bool = False) -> dict:
    datos = OfertaVueloResponse.model_validate(oferta).model_dump()
    usadas = sillas_usadas(db, oferta.id_oferta)
    datos["cupos_usados"] = usadas
    datos["cupos_disponibles"] = None if oferta.cupos is None else max(oferta.cupos - usadas, 0)
    if admin:
        datos["reservas_activas"] = (
            db.query(func.count(Reserva.id_reserva))
            .filter(Reserva.id_oferta_vuelo == oferta.id_oferta, Reserva.estado.in_(ESTADOS_ACTIVOS))
            .scalar()
            or 0
        )
        datos["paquetes"] = [
            {"id_paquete": pv.id_paquete, "nombre_paquete": pv.paquete.nombre_paquete}
            for pv in oferta.paquete_vuelos
            if pv.paquete
        ]
    return datos


def _filtrar(q, *, origen, destino, fecha_desde, fecha_hasta, aerolinea, texto=None):
    if origen:
        like = f"%{origen.strip()}%"
        q = q.filter(or_(OfertaVuelo.origen_ciudad.ilike(like), OfertaVuelo.origen_iata.ilike(like)))
    if destino:
        like = f"%{destino.strip()}%"
        q = q.filter(or_(OfertaVuelo.destino_ciudad.ilike(like), OfertaVuelo.destino_iata.ilike(like)))
    if fecha_desde:
        q = q.filter(OfertaVuelo.fecha_salida >= fecha_desde)
    if fecha_hasta:
        q = q.filter(OfertaVuelo.fecha_salida <= fecha_hasta)
    if aerolinea:
        q = q.filter(OfertaVuelo.aerolinea.ilike(f"%{aerolinea.strip()}%"))
    if texto:
        like = f"%{texto.strip()}%"
        q = q.filter(
            or_(
                OfertaVuelo.titulo.ilike(like),
                OfertaVuelo.codigo_referencia.ilike(like),
                OfertaVuelo.numero_vuelo.ilike(like),
            )
        )
    return q


# ----------------------------- Público -----------------------------


@router.get("", response_model=list[OfertaVueloResponse])
def listar_ofertas_publicas(
    origen: str | None = Query(None, max_length=100),
    destino: str | None = Query(None, max_length=100),
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    aerolinea: str | None = Query(None, max_length=100),
    solo_independientes: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Ofertas publicadas y vigentes (salida desde hoy)."""
    hoy = date.today()
    q = db.query(OfertaVuelo).filter(
        OfertaVuelo.estado == "publicada",
        OfertaVuelo.fecha_salida >= hoy,
        or_(OfertaVuelo.vigencia_hasta.is_(None), OfertaVuelo.vigencia_hasta >= hoy),
    )
    if solo_independientes:
        q = q.filter(OfertaVuelo.venta_independiente.is_(True))
    q = _filtrar(
        q, origen=origen, destino=destino, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta, aerolinea=aerolinea
    )
    ofertas = q.order_by(OfertaVuelo.fecha_salida, OfertaVuelo.id_oferta).offset(skip).limit(limit).all()
    return [_enriquecer(db, o) for o in ofertas]


# ----------------------------- Admin -----------------------------


@router.get("/admin", response_model=OfertasVueloPagina)
def listar_ofertas_admin(
    estado: str | None = Query(None, pattern="^(borrador|publicada|pausada|agotada|finalizada)$"),
    q: str | None = Query(None, max_length=100),
    origen: str | None = Query(None, max_length=100),
    destino: str | None = Query(None, max_length=100),
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    aerolinea: str | None = Query(None, max_length=100),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    staff_id: int = Depends(require_empleado),
):
    consulta = db.query(OfertaVuelo)
    if estado:
        consulta = consulta.filter(OfertaVuelo.estado == estado)
    consulta = _filtrar(
        consulta,
        origen=origen,
        destino=destino,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        aerolinea=aerolinea,
        texto=q,
    )
    total = consulta.count()
    ofertas = (
        consulta.order_by(OfertaVuelo.fecha_salida.desc(), OfertaVuelo.id_oferta.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )
    return {
        "items": [_enriquecer(db, o, admin=True) for o in ofertas],
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
    }


@router.get("/{id_oferta}", response_model=OfertaVueloAdmin)
def obtener_oferta(id_oferta: int, db: Session = Depends(get_db), authorization: str | None = Header(None)):
    oferta = db.query(OfertaVuelo).filter(OfertaVuelo.id_oferta == id_oferta).first()
    staff = usuario_es_staff(authorization)
    if not oferta or (oferta.estado != "publicada" and not staff):
        raise HTTPException(status_code=404, detail="Oferta aérea no encontrada")
    return _enriquecer(db, oferta, admin=staff)


def _validar_completa(oferta: OfertaVuelo) -> None:
    """Revalida la oferta ya combinada (al editar llegan solo algunos campos)."""
    datos = {c.name: getattr(oferta, c.name) for c in OfertaVuelo.__table__.columns}
    for campo in ("precio_adulto", "precio_nino", "precio_infante", "cargos_adicionales"):
        if datos.get(campo) is not None:
            datos[campo] = float(datos[campo])
    try:
        OfertaVueloCreate.model_validate({k: v for k, v in datos.items() if k in OfertaVueloCreate.model_fields})
    except PydanticValidationError as e:
        mensaje = "; ".join(err["msg"].removeprefix("Value error, ") for err in e.errors())
        raise HTTPException(status_code=422, detail=mensaje) from e


@router.post("", response_model=OfertaVueloAdmin, status_code=201)
def crear_oferta(datos: OfertaVueloCreate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    oferta = OfertaVuelo(**datos.model_dump())
    db.add(oferta)
    db.commit()
    db.refresh(oferta)
    return _enriquecer(db, oferta, admin=True)


@router.put("/{id_oferta}", response_model=OfertaVueloAdmin)
def editar_oferta(
    id_oferta: int, datos: OfertaVueloUpdate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    oferta = db.query(OfertaVuelo).filter(OfertaVuelo.id_oferta == id_oferta).with_for_update().first()
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta aérea no encontrada")
    cambios = datos.model_dump(exclude_unset=True)
    obligatorios = {"titulo", "origen_ciudad", "destino_ciudad", "fecha_salida", "precio_adulto", "estado"}
    for campo, valor in cambios.items():
        if valor is None and campo in obligatorios:
            continue
        setattr(oferta, campo, valor)
    if oferta.cupos is not None and "cupos" in cambios:
        usadas = sillas_usadas(db, oferta.id_oferta)
        if oferta.cupos < usadas:
            db.rollback()
            raise HTTPException(
                status_code=409, detail=f"Ya hay {usadas} silla(s) vendidas: los cupos no pueden ser menos que eso"
            )
    _validar_completa(oferta)
    db.commit()
    db.refresh(oferta)
    return _enriquecer(db, oferta, admin=True)


@router.patch("/{id_oferta}/estado", response_model=OfertaVueloAdmin)
def cambiar_estado_oferta(
    id_oferta: int, datos: EstadoOfertaUpdate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    oferta = db.query(OfertaVuelo).filter(OfertaVuelo.id_oferta == id_oferta).first()
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta aérea no encontrada")
    if oferta.estado == "finalizada" and datos.estado != "finalizada":
        raise HTTPException(status_code=409, detail="Una oferta finalizada no se puede reabrir: crea una nueva")
    oferta.estado = datos.estado
    db.commit()
    db.refresh(oferta)
    return _enriquecer(db, oferta, admin=True)


@router.delete("/{id_oferta}")
def eliminar_oferta(id_oferta: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    oferta = db.query(OfertaVuelo).filter(OfertaVuelo.id_oferta == id_oferta).first()
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta aérea no encontrada")
    reservas = db.query(func.count(Reserva.id_reserva)).filter(Reserva.id_oferta_vuelo == id_oferta).scalar() or 0
    if reservas:
        raise HTTPException(
            status_code=409,
            detail=f"Esta oferta tiene {reservas} reserva(s): no se puede borrar. Márcala como finalizada.",
        )
    paquetes = db.query(func.count(PaqueteVuelo.id_paquete)).filter(PaqueteVuelo.id_oferta == id_oferta).scalar() or 0
    if paquetes:
        raise HTTPException(
            status_code=409,
            detail=f"Esta oferta está asociada a {paquetes} paquete(s): quítala de ellos antes de borrarla.",
        )
    borrar_imagen(oferta.imagen_url, carpeta="vuelos", public_path_prefix=IMAGEN_PREFIX)
    db.delete(oferta)
    db.commit()
    return {"message": "Oferta aérea eliminada"}


@router.post("/{id_oferta}/imagen", response_model=OfertaVueloAdmin)
async def subir_imagen_oferta(
    id_oferta: int,
    imagen: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    oferta = db.query(OfertaVuelo).filter(OfertaVuelo.id_oferta == id_oferta).first()
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta aérea no encontrada")
    contenido, extension = await validar_y_leer_archivo(
        imagen,
        tipos_permitidos=IMAGEN_TIPOS,
        mensaje_tipo="Formato de imagen no soportado. Usa JPG, PNG o WEBP.",
        tamano_maximo_bytes=IMAGEN_MAX_BYTES,
    )
    nueva = guardar_imagen(contenido, extension, carpeta="vuelos", public_path_prefix=IMAGEN_PREFIX)
    borrar_imagen(oferta.imagen_url, carpeta="vuelos", public_path_prefix=IMAGEN_PREFIX)
    oferta.imagen_url = nueva
    db.commit()
    db.refresh(oferta)
    return _enriquecer(db, oferta, admin=True)


def _nombre_cliente(reserva: Reserva) -> str:
    c = reserva.cliente
    return f"{c.nombre} {c.apellido}" if c else f"Cliente #{reserva.id_cliente}"


@router.get("/{id_oferta}/reservas", response_model=list[ReservaDeOferta])
def reservas_de_oferta(id_oferta: int, db: Session = Depends(get_db), staff_id: int = Depends(require_empleado)):
    reservas = (
        db.query(Reserva).filter(Reserva.id_oferta_vuelo == id_oferta).order_by(Reserva.fecha_reserva.desc()).all()
    )
    return [
        ReservaDeOferta(
            id_reserva=r.id_reserva,
            estado=r.estado,
            cliente=_nombre_cliente(r),
            tipo_producto=r.tipo_producto,
            adultos=r.adultos,
            ninos=r.ninos,
            infantes=r.infantes,
            estado_vuelo=r.estado_vuelo,
            fecha_reserva=r.fecha_reserva,
        )
        for r in reservas
    ]


@router.get("/{id_oferta}/pasajeros", response_model=list[PasajeroOferta])
def pasajeros_de_oferta(id_oferta: int, db: Session = Depends(get_db), staff_id: int = Depends(require_empleado)):
    """Manifiesto de pasajeros de las reservas activas de esta oferta (solo
    staff: contiene documentos de identidad)."""
    reservas = (
        db.query(Reserva)
        .filter(Reserva.id_oferta_vuelo == id_oferta, Reserva.estado.in_(ESTADOS_ACTIVOS))
        .order_by(Reserva.id_reserva)
        .all()
    )
    return [
        PasajeroOferta(
            id_reserva=r.id_reserva,
            estado_reserva=r.estado,
            cliente=_nombre_cliente(r),
            tipo=v.tipo,
            nombres=v.nombres,
            apellidos=v.apellidos,
            fecha_nacimiento=v.fecha_nacimiento,
            nacionalidad=v.nacionalidad,
            tipo_documento=v.tipo_documento,
            numero_documento=v.numero_documento,
        )
        for r in reservas
        for v in r.viajeros
    ]
