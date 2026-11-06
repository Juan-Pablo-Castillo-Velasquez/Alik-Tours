from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import DestinoDependencyError
from app.core.security import require_admin
from app.models.servicio_model import Destino, Servicio
from app.schemas.destino_schema import (
    DestinoCreate,
    DestinoResponse,
    DestinoSugerenciaResponse,
    DestinoUpdate,
)

router = APIRouter(prefix="/api/destinos", tags=["Destinos"])


def _filtro_busqueda(query, q: str):
    patron = f"%{q}%"
    return query.filter(
        or_(
            Destino.nombre_destino.ilike(patron),
            Destino.ciudad.ilike(patron),
            Destino.pais.ilike(patron),
        )
    )


@router.get("/sugerencias", response_model=list[DestinoSugerenciaResponse])
def get_sugerencias_destinos(
    q: str | None = Query(None, min_length=0),
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """Autocompletado liviano usado por el buscador de destinos del Hero."""
    query = db.query(Destino)
    if q:
        query = _filtro_busqueda(query, q)
    return query.order_by(Destino.nombre_destino.asc()).limit(limit).all()


@router.get("/", response_model=list[DestinoResponse])
def get_destinos(
    q: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Destino)
    if q:
        query = _filtro_busqueda(query, q)
    return query.order_by(Destino.nombre_destino.asc()).offset(skip).limit(limit).all()


@router.get("/{destino_id}", response_model=DestinoResponse)
def get_destino(destino_id: int, db: Session = Depends(get_db)):
    destino = db.query(Destino).filter(Destino.id_destino == destino_id).first()
    if not destino:
        raise HTTPException(status_code=404, detail="Destino no encontrado")
    return destino


@router.post("/", response_model=DestinoResponse, status_code=201)
def create_destino(data: DestinoCreate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    destino = Destino(**data.model_dump())
    db.add(destino)
    db.commit()
    db.refresh(destino)
    return destino


@router.put("/{destino_id}", response_model=DestinoResponse)
def update_destino(
    destino_id: int, data: DestinoUpdate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    destino = db.query(Destino).filter(Destino.id_destino == destino_id).first()
    if not destino:
        raise HTTPException(status_code=404, detail="Destino no encontrado")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(destino, key, value)
    db.commit()
    db.refresh(destino)
    return destino


@router.delete("/{destino_id}")
def delete_destino(destino_id: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    destino = db.query(Destino).filter(Destino.id_destino == destino_id).first()
    if not destino:
        raise HTTPException(status_code=404, detail="Destino no encontrado")

    # Antes esto no se validaba: Servicio.id_destino no tiene ondelete
    # configurado, así que borrar un destino con servicios asociados
    # lanzaba un IntegrityError sin manejar (500 genérico, sin explicar
    # la causa real) en vez de un error claro — Fase 1 del plan de mejora
    # ("manejo de errores consistente").
    servicios_count = db.query(func.count(Servicio.id_servicio)).filter(Servicio.id_destino == destino_id).scalar() or 0
    if servicios_count > 0:
        error = DestinoDependencyError(destino_id, servicios_count)
        raise HTTPException(status_code=error.status_code, detail=error.detail)

    db.delete(destino)
    db.commit()
    return {"message": "Destino eliminado exitosamente"}
