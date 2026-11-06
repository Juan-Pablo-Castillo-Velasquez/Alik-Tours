from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_usuario
from app.core.security import hash_password, verify_password
from app.models.user_model import Usuario
from app.repositories.metodo_pago_guardado_repository import MetodoPagoGuardadoRepository
from app.schemas.metodo_pago_guardado_schema import (
    MetodoPagoGuardadoCreate,
    MetodoPagoGuardadoResponse,
    MetodoPagoGuardadoUpdate,
    VerificarClaveRequest,
    VerificarClaveResponse,
)

router = APIRouter(prefix="/api/metodos-pago-guardados", tags=["Métodos de pago guardados"])


def _require_cliente(usuario: Usuario) -> int:
    if not usuario.cliente:
        raise HTTPException(status_code=403, detail="Solo los clientes pueden gestionar métodos de pago guardados")
    return usuario.cliente.id_cliente


@router.get("", response_model=list[MetodoPagoGuardadoResponse])
def listar_metodos_guardados(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_usuario),
):
    id_cliente = _require_cliente(usuario)
    return MetodoPagoGuardadoRepository.get_by_cliente(db, id_cliente)


@router.post("", response_model=MetodoPagoGuardadoResponse, status_code=201)
def guardar_metodo_pago(
    data: MetodoPagoGuardadoCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_usuario),
):
    id_cliente = _require_cliente(usuario)
    clave_hash = hash_password(data.clave)
    return MetodoPagoGuardadoRepository.create(
        db,
        id_cliente=id_cliente,
        alias=data.alias,
        tipo=data.tipo,
        ultimos4=data.ultimos4,
        clave_hash=clave_hash,
        predeterminado=data.predeterminado,
    )


@router.put("/{id_metodo_guardado}", response_model=MetodoPagoGuardadoResponse)
def actualizar_metodo_guardado(
    id_metodo_guardado: int,
    data: MetodoPagoGuardadoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_usuario),
):
    """
    Edita un método guardado (lápiz en el perfil): alias, tipo, últimos 4,
    y/o marcarlo como predeterminado. `clave` es opcional: si el cliente la
    cambia, se re-hashea (nunca en texto plano); si no la envía, se conserva
    la actual.
    """
    id_cliente = _require_cliente(usuario)
    cambios = data.model_dump(exclude_unset=True)
    if "clave" in cambios and cambios["clave"]:
        cambios["clave_hash"] = hash_password(cambios.pop("clave"))
    else:
        cambios.pop("clave", None)

    actualizado = MetodoPagoGuardadoRepository.update(db, id_cliente, id_metodo_guardado, **cambios)
    if not actualizado:
        raise HTTPException(status_code=404, detail="Método de pago guardado no encontrado")
    return actualizado


@router.post("/{id_metodo_guardado}/verificar", response_model=VerificarClaveResponse)
def verificar_clave_metodo(
    id_metodo_guardado: int,
    data: VerificarClaveRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_usuario),
):
    """
    Verifica la clave de confirmación de un método guardado antes de usarlo
    para autorizar un pago. Nunca expone el hash guardado, solo indica si
    la clave ingresada coincide.
    """
    id_cliente = _require_cliente(usuario)
    metodo = MetodoPagoGuardadoRepository.get_by_id(db, id_cliente, id_metodo_guardado)
    if not metodo:
        raise HTTPException(status_code=404, detail="Método de pago guardado no encontrado")
    return VerificarClaveResponse(valido=verify_password(data.clave, metodo.clave_hash))


@router.delete("/{id_metodo_guardado}", status_code=204)
def eliminar_metodo_guardado(
    id_metodo_guardado: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_usuario),
):
    id_cliente = _require_cliente(usuario)
    eliminado = MetodoPagoGuardadoRepository.delete(db, id_cliente, id_metodo_guardado)
    if not eliminado:
        raise HTTPException(status_code=404, detail="Método de pago guardado no encontrado")
    return None
