from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ServicioDependencyError
from app.core.security import require_admin
from app.models.reserva_model import PaqueteServicio, ReservaServicio
from app.models.servicio_model import CategoriaServicio, Servicio, ServicioProveedor
from app.schemas.servicio_schema import (
    CategoriaServicioResponse,
    ServicioCreate,
    ServicioResponse,
    ServicioUpdate,
)

router = APIRouter(prefix="/api/servicios", tags=["Servicios"])


@router.get("/categorias", response_model=list[CategoriaServicioResponse])
def get_categorias(db: Session = Depends(get_db)):
    return db.query(CategoriaServicio).order_by(CategoriaServicio.nombre_categoria.asc()).all()


@router.get("/", response_model=list[ServicioResponse])
def get_servicios(
    id_destino: int | None = Query(None),
    id_categoria: int | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Servicio)
    if id_destino is not None:
        query = query.filter(Servicio.id_destino == id_destino)
    if id_categoria is not None:
        query = query.filter(Servicio.id_categoria == id_categoria)
    return query.order_by(Servicio.nombre_servicio.asc()).offset(skip).limit(limit).all()


@router.get("/{servicio_id}", response_model=ServicioResponse)
def get_servicio(servicio_id: int, db: Session = Depends(get_db)):
    servicio = db.query(Servicio).filter(Servicio.id_servicio == servicio_id).first()
    if not servicio:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    return servicio


@router.post("/", response_model=ServicioResponse, status_code=201)
def create_servicio(data: ServicioCreate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    servicio = Servicio(**data.model_dump())
    db.add(servicio)
    db.commit()
    db.refresh(servicio)
    return servicio


@router.put("/{servicio_id}", response_model=ServicioResponse)
def update_servicio(
    servicio_id: int, data: ServicioUpdate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    servicio = db.query(Servicio).filter(Servicio.id_servicio == servicio_id).first()
    if not servicio:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(servicio, key, value)
    db.commit()
    db.refresh(servicio)
    return servicio


@router.delete("/{servicio_id}")
def delete_servicio(servicio_id: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    servicio = db.query(Servicio).filter(Servicio.id_servicio == servicio_id).first()
    if not servicio:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    # Antes esto no se validaba. PaqueteServicio.id_servicio y
    # ServicioProveedor.id_servicio son ondelete="CASCADE": borrar un
    # servicio usado en un paquete activo eliminaba ese vínculo en
    # silencio, dejando el paquete roto sin ningún aviso (mismo problema
    # ya corregido para hoteles). ReservaServicio.id_servicio no tiene
    # ondelete configurado, así que borrar un servicio con reservas
    # lanzaba un IntegrityError sin manejar (500 genérico) — Fase 1 del
    # plan de mejora ("manejo de errores consistente").
    paquetes_count = (
        db.query(func.count(PaqueteServicio.id_paquete)).filter(PaqueteServicio.id_servicio == servicio_id).scalar()
        or 0
    )

    reservas_count = (
        db.query(func.count(ReservaServicio.id_reserva)).filter(ReservaServicio.id_servicio == servicio_id).scalar()
        or 0
    )

    proveedores_count = (
        db.query(func.count(ServicioProveedor.id_proveedor))
        .filter(ServicioProveedor.id_servicio == servicio_id)
        .scalar()
        or 0
    )

    if paquetes_count > 0 or reservas_count > 0 or proveedores_count > 0:
        error = ServicioDependencyError(servicio_id, paquetes_count, reservas_count, proveedores_count)
        raise HTTPException(status_code=error.status_code, detail=error.detail)

    db.delete(servicio)
    db.commit()
    return {"message": "Servicio eliminado exitosamente"}
