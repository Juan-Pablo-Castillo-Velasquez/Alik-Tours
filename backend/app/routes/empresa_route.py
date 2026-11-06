from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin
from app.models.empresa_model import SolicitudCorporativa
from app.schemas.empresa_schema import (
    SolicitudCorporativaCreate,
    SolicitudCorporativaResponse,
    SolicitudCorporativaUpdate,
)
from app.services.notificacion_service import crear_notificacion

router = APIRouter(prefix="/api/solicitudes-corporativas", tags=["Empresas y Contactos"])


@router.post("", response_model=SolicitudCorporativaResponse, status_code=201)
def crear_solicitud_corporativa(data: SolicitudCorporativaCreate, db: Session = Depends(get_db)):
    """Recibe el formulario 'Solicita una cotización' de /corporate — sin
    autenticación, es un formulario público de captación de leads B2B."""
    nueva = SolicitudCorporativa(**data.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    crear_notificacion(
        db,
        tipo="corporativo",
        titulo=f"Nueva solicitud corporativa — {nueva.nombre_empresa}",
        mensaje=f"{nueva.nombre_contacto} · {nueva.email_corporativo} · {nueva.telefono}",
        id_referencia=nueva.id_solicitud,
    )
    return nueva


@router.get("", response_model=list[SolicitudCorporativaResponse])
def listar_solicitudes_corporativas(
    estado: str | None = Query(None),
    limit: int = Query(100, ge=1, le=300),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    query = db.query(SolicitudCorporativa)
    if estado:
        query = query.filter(SolicitudCorporativa.estado == estado)
    return query.order_by(SolicitudCorporativa.fecha_creacion.desc()).limit(limit).all()


@router.put("/{id_solicitud}", response_model=SolicitudCorporativaResponse)
def actualizar_estado_solicitud(
    id_solicitud: int,
    data: SolicitudCorporativaUpdate,
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_admin),
):
    item = db.query(SolicitudCorporativa).filter(SolicitudCorporativa.id_solicitud == id_solicitud).first()
    if not item:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    item.estado = data.estado
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{id_solicitud}")
def eliminar_solicitud_corporativa(
    id_solicitud: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    item = db.query(SolicitudCorporativa).filter(SolicitudCorporativa.id_solicitud == id_solicitud).first()
    if not item:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    db.delete(item)
    db.commit()
    return {"message": "Solicitud eliminada"}
