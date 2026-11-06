from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.cache import delete_pattern, get_cached, set_cached
from app.core.database import get_db
from app.core.security import require_admin
from app.models.configuracion_model import ConfiguracionSistema
from app.schemas.configuracion_schema import ConfiguracionCreate, ConfiguracionResponse, ConfiguracionUpdate

router = APIRouter(prefix="/api/configuracion", tags=["Configuración"])

CONFIG_CACHE_KEY = "configuracion:list"


@router.get("", response_model=list[ConfiguracionResponse])
def listar_configuracion(db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    """Lista todos los parámetros del sistema guardados. Cacheada 300s —
    cambia muy poco, la lee cada request del admin que abre el módulo."""
    cached = get_cached(CONFIG_CACHE_KEY)
    if cached is not None:
        return cached
    items = db.query(ConfiguracionSistema).order_by(ConfiguracionSistema.clave.asc()).all()
    data = [ConfiguracionResponse.model_validate(i).model_dump(mode="json") for i in items]
    set_cached(CONFIG_CACHE_KEY, data, ttl_seconds=300)
    return data


@router.post("", response_model=ConfiguracionResponse, status_code=201)
def crear_configuracion(
    data: ConfiguracionCreate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    if db.query(ConfiguracionSistema).filter(ConfiguracionSistema.clave == data.clave).first():
        raise HTTPException(status_code=409, detail=f"Ya existe un parámetro con la clave '{data.clave}'")
    nuevo = ConfiguracionSistema(**data.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    delete_pattern(CONFIG_CACHE_KEY)
    return nuevo


@router.put("/{id_config}", response_model=ConfiguracionResponse)
def actualizar_configuracion(
    id_config: int, data: ConfiguracionUpdate, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)
):
    item = db.query(ConfiguracionSistema).filter(ConfiguracionSistema.id_config == id_config).first()
    if not item:
        raise HTTPException(status_code=404, detail="Parámetro no encontrado")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    delete_pattern(CONFIG_CACHE_KEY)
    return item


@router.delete("/{id_config}")
def eliminar_configuracion(id_config: int, db: Session = Depends(get_db), admin_id: int = Depends(require_admin)):
    item = db.query(ConfiguracionSistema).filter(ConfiguracionSistema.id_config == id_config).first()
    if not item:
        raise HTTPException(status_code=404, detail="Parámetro no encontrado")
    db.delete(item)
    db.commit()
    delete_pattern(CONFIG_CACHE_KEY)
    return {"message": "Parámetro eliminado"}
