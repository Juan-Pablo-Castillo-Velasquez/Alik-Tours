"""Prototipo IoT: telemetría de los vehículos de traslado.

Protocolo (detalle en docs/entrega-final/06-iot.md):

- Transporte: HTTP/1.1 sobre TLS en producción (HTTPS de Render), JSON.
- El dispositivo se autentica con la cabecera ``X-Device-Key`` (clave que
  entrega el panel al registrarlo; el servidor guarda solo su SHA-256).
- ``POST /api/iot/lecturas`` con el cuerpo de :class:`LecturaIoTEntrada`.
  Respuestas: 201 (guardada, con alertas si las hay), 401 (clave inválida o
  dispositivo desactivado) y 422 (lectura fuera de rango o vacía).

El panel (admin) registra dispositivos y consulta su estado y lecturas.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin
from app.models.iot_model import DispositivoIoT, LecturaIoT
from app.schemas.iot_schema import (
    DispositivoIoTCreado,
    DispositivoIoTCrear,
    DispositivoIoTResponse,
    LecturaIoTEntrada,
    LecturaIoTResponse,
    LecturaRecibida,
)

router = APIRouter(prefix="/api/iot", tags=["IoT"])

# Umbrales de alerta del prototipo (vehículo con pasajeros).
TEMPERATURA_MAXIMA_C = 28.0
VELOCIDAD_MAXIMA_KMH = 100.0
BATERIA_MINIMA_PCT = 15.0
# Si el dispositivo no reporta en este tiempo, el panel lo marca inactivo.
VENTANA_EN_LINEA = timedelta(minutes=2)


def _hash_clave(clave: str) -> str:
    return hashlib.sha256(clave.encode()).hexdigest()


def _alertas(lectura: LecturaIoT | LecturaIoTEntrada | None) -> list[str]:
    if lectura is None:
        return []
    alertas = []
    if lectura.temperatura_c is not None and lectura.temperatura_c > TEMPERATURA_MAXIMA_C:
        alertas.append(f"Temperatura de cabina alta ({lectura.temperatura_c:.1f} °C)")
    if lectura.velocidad_kmh is not None and lectura.velocidad_kmh > VELOCIDAD_MAXIMA_KMH:
        alertas.append(f"Exceso de velocidad ({lectura.velocidad_kmh:.0f} km/h)")
    if lectura.bateria_pct is not None and lectura.bateria_pct < BATERIA_MINIMA_PCT:
        alertas.append(f"Batería baja ({lectura.bateria_pct:.0f} %)")
    return alertas


def _como_utc(momento: datetime | None) -> datetime | None:
    if momento is None:
        return None
    return momento if momento.tzinfo else momento.replace(tzinfo=UTC)


def _respuesta(d: DispositivoIoT, ultima: LecturaIoT | None) -> dict:
    ultima_conexion = _como_utc(d.ultima_conexion)
    if ultima_conexion is None:
        estado = "sin_datos"
    elif datetime.now(UTC) - ultima_conexion <= VENTANA_EN_LINEA:
        estado = "en_linea"
    else:
        estado = "inactivo"
    return {
        "id_dispositivo": d.id_dispositivo,
        "nombre": d.nombre,
        "descripcion": d.descripcion,
        "activo": d.activo,
        "ultima_conexion": ultima_conexion,
        "estado": estado,
        "ultima_lectura": LecturaIoTResponse.model_validate(ultima) if ultima else None,
        "alertas": _alertas(ultima),
    }


def dispositivo_autenticado(
    x_device_key: str | None = Header(None, alias="X-Device-Key"), db: Session = Depends(get_db)
) -> DispositivoIoT:
    if not x_device_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Falta la cabecera X-Device-Key")
    dispositivo = db.query(DispositivoIoT).filter(DispositivoIoT.clave_hash == _hash_clave(x_device_key)).first()
    if dispositivo is None or not dispositivo.activo:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Dispositivo no autorizado")
    return dispositivo


# ===================== DISPOSITIVO =====================


@router.post("/lecturas", response_model=LecturaRecibida, status_code=status.HTTP_201_CREATED)
def recibir_lectura(
    datos: LecturaIoTEntrada,
    dispositivo: DispositivoIoT = Depends(dispositivo_autenticado),
    db: Session = Depends(get_db),
):
    lectura = LecturaIoT(id_dispositivo=dispositivo.id_dispositivo, **datos.model_dump())
    dispositivo.ultima_conexion = datetime.now(UTC)
    db.add(lectura)
    db.commit()
    db.refresh(lectura)
    return {"id_lectura": lectura.id_lectura, "recibido_en": lectura.recibido_en, "alertas": _alertas(datos)}


# ===================== PANEL (ADMIN) =====================


@router.get("/dispositivos", response_model=list[DispositivoIoTResponse])
def listar_dispositivos(db: Session = Depends(get_db), _admin: int = Depends(require_admin)):
    dispositivos = db.query(DispositivoIoT).order_by(DispositivoIoT.nombre).all()
    # Última lectura de cada dispositivo en una sola consulta.
    ultimas_ids = db.query(func.max(LecturaIoT.id_lectura)).group_by(LecturaIoT.id_dispositivo).scalar_subquery()
    ultimas = {lec.id_dispositivo: lec for lec in db.query(LecturaIoT).filter(LecturaIoT.id_lectura.in_(ultimas_ids))}
    return [_respuesta(d, ultimas.get(d.id_dispositivo)) for d in dispositivos]


@router.post("/dispositivos", response_model=DispositivoIoTCreado, status_code=status.HTTP_201_CREATED)
def crear_dispositivo(datos: DispositivoIoTCrear, db: Session = Depends(get_db), _admin: int = Depends(require_admin)):
    clave = secrets.token_urlsafe(32)
    dispositivo = DispositivoIoT(
        nombre=datos.nombre.strip(), descripcion=datos.descripcion, clave_hash=_hash_clave(clave)
    )
    db.add(dispositivo)
    db.commit()
    db.refresh(dispositivo)
    return {**_respuesta(dispositivo, None), "clave": clave}


@router.patch("/dispositivos/{id_dispositivo}/activo", response_model=DispositivoIoTResponse)
def cambiar_activo(
    id_dispositivo: int,
    activo: bool = Query(...),
    db: Session = Depends(get_db),
    _admin: int = Depends(require_admin),
):
    dispositivo = db.get(DispositivoIoT, id_dispositivo)
    if dispositivo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dispositivo no encontrado")
    dispositivo.activo = activo
    db.commit()
    ultima = (
        db.query(LecturaIoT).filter_by(id_dispositivo=id_dispositivo).order_by(LecturaIoT.id_lectura.desc()).first()
    )
    return _respuesta(dispositivo, ultima)


@router.get("/dispositivos/{id_dispositivo}/lecturas", response_model=list[LecturaIoTResponse])
def lecturas_de_dispositivo(
    id_dispositivo: int,
    limite: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _admin: int = Depends(require_admin),
):
    if db.get(DispositivoIoT, id_dispositivo) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dispositivo no encontrado")
    return (
        db.query(LecturaIoT)
        .filter_by(id_dispositivo=id_dispositivo)
        .order_by(LecturaIoT.id_lectura.desc())
        .limit(limite)
        .all()
    )
