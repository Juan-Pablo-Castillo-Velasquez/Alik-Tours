from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin, require_empleado
from app.models.notificacion_model import Notificacion
from app.schemas.notificacion_schema import NotificacionResponse

router = APIRouter(prefix="/api/notificaciones", tags=["Notificaciones"])


@router.get("", response_model=list[NotificacionResponse])
def listar_notificaciones(
    solo_no_leidas: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin_id: int = Depends(require_empleado),
):
    # Solo las internas del panel: las de clientes (id_cliente) se ven en su cuenta.
    query = db.query(Notificacion).filter(Notificacion.id_cliente.is_(None))
    if solo_no_leidas:
        query = query.filter(Notificacion.leido.is_(False))
    return query.order_by(Notificacion.fecha_creacion.desc()).limit(limit).all()


@router.get("/no-leidas/conteo")
def contar_no_leidas(db: Session = Depends(get_db), admin_id: int = Depends(require_empleado)):
    total = db.query(Notificacion).filter(Notificacion.id_cliente.is_(None), Notificacion.leido.is_(False)).count()
    return {"total": total}


@router.put("/leer-todas")
def marcar_todas_leidas(db: Session = Depends(get_db), admin_id: int = Depends(require_empleado)):
    db.query(Notificacion).filter(Notificacion.id_cliente.is_(None), Notificacion.leido.is_(False)).update(
        {"leido": True}, synchronize_session=False
    )
    db.commit()
    return {"message": "Todas las notificaciones marcadas como leídas"}


@router.put("/{id_notificacion}/leer", response_model=NotificacionResponse)
def marcar_leida(id_notificacion: int, db: Session = Depends(get_db), admin_id: int = Depends(require_empleado)):
    item = db.query(Notificacion).filter(Notificacion.id_notificacion == id_notificacion).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    item.leido = True
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{id_notificacion}")
def eliminar_notificacion(id_notificacion: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    item = db.query(Notificacion).filter(Notificacion.id_notificacion == id_notificacion).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    db.delete(item)
    db.commit()
    return {"message": "Notificación eliminada"}
