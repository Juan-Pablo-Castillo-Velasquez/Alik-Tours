"""
Dependencias de autenticación/autorización reutilizables en las rutas del
backend.

Antes de esto, la función que decodifica el JWT y trae el Usuario completo
desde la base de datos ("get_current_usuario") estaba copiada de forma
idéntica en preferencias_route.py, solicitud_cancelacion_route.py y
resena_route.py. Ahora vive en un solo lugar y esos archivos importan de
aquí — ver Fase 0 del plan de mejora (docs/referencia-tecnica/).
"""

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token, get_user_from_token
from app.models.auth_model import Permiso, Rol, RolPermiso
from app.models.user_model import Usuario


def get_current_usuario(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> Usuario:
    """Exige un JWT válido en el header Authorization y devuelve el Usuario
    completo (con id_cliente, id_empleado) desde la base de datos."""
    if not authorization:
        raise HTTPException(status_code=401, detail="No autenticado")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Token inválido")

    user_id = get_user_from_token(parts[1])
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token expirado o inválido")

    usuario = db.query(Usuario).filter(Usuario.id_usuario == user_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Antes esto no se revisaba aquí: un admin podía desactivar una cuenta
    # (activo=False, PUT /api/usuarios/{id}) y el JWT ya emitido seguía
    # sirviendo para todos los endpoints protegidos hasta que expirara por
    # su cuenta (login_user sí bloquea activo=False, pero eso solo aplica
    # al INICIAR sesión, no a una sesión ya abierta). Con esto, la
    # desactivación corta el acceso de inmediato en la siguiente llamada
    # autenticada, sin esperar a que el token expire. El mensaje es
    # idéntico al de login_user (auth_service.py) para que el frontend lo
    # reconozca como el mismo caso.
    if not usuario.activo:
        raise HTTPException(
            status_code=403,
            detail="Esta cuenta está desactivada. Contacta al administrador.",
        )

    return usuario


def get_usuario_opcional(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> Usuario | None:
    """Como get_current_usuario pero para endpoints PÚBLICOS que muestran
    algo extra a quien tiene sesión (ej. "este comentario es tuyo"): sin
    token, o con uno inválido/vencido, devuelve None en vez de 401."""
    if not authorization:
        return None
    try:
        return get_current_usuario(authorization, db)
    except HTTPException:
        return None


def usuario_es_admin(authorization: str | None) -> bool:
    """Mismo chequeo que require_admin (security.py) pero sin lanzar
    excepción — para combinarlo con un chequeo de propiedad ('el dueño del
    recurso O un admin'), en vez de exigir solo una de las dos cosas."""
    if not authorization:
        return False
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return False
    payload = decode_token(parts[1])
    if not payload:
        return False
    return "admin" in (payload.get("roles") or [])


def usuario_es_staff(authorization: str | None) -> bool:
    """Igual que usuario_es_admin, pero también deja pasar a "empleado"
    (asesor) -- para los mismos endpoints de solo lectura que ya usa el
    admin y que ahora reutiliza el panel recortado del empleado (ver
    require_empleado en security.py). usuario_es_admin se deja intacto: lo
    siguen usando los pocos lugares que de verdad deben ser SOLO admin
    (ej. vincular una cuenta de usuario a un cliente)."""
    if not authorization:
        return False
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return False
    payload = decode_token(parts[1])
    if not payload:
        return False
    roles = payload.get("roles") or []
    return "admin" in roles or "empleado" in roles


def exigir_propietario_o_admin(
    current_user: Usuario,
    id_cliente_recurso: int | None,
    authorization: str | None,
) -> None:
    """Lanza 403 salvo que quien llama sea el dueño del recurso (mismo
    id_cliente), tenga rol admin, o tenga rol empleado (ver usuario_es_staff
    -- un asesor necesita poder ver los datos de CUALQUIER cliente para
    atenderlo por chat, igual que ya puede un admin) en su JWT. Centraliza
    el patrón repetido en las rutas de reservas/pagos/preferencias que
    exponen datos de UN cliente en particular."""
    if id_cliente_recurso is not None and current_user.id_cliente == id_cliente_recurso:
        return
    if usuario_es_staff(authorization):
        return
    raise HTTPException(status_code=403, detail="No tienes permiso para acceder a estos datos")


def require_permission(*claves: str):
    """
    Dependency factory para permisos granulares (ver Permiso/RolPermiso en
    auth_model.py, sección "Roles y permisos" del panel de admin). Deja
    pasar siempre a quien tenga el rol 'admin' en su JWT -- igual que
    require_admin (security.py), sin siquiera consultar la tabla
    roles_permisos -- y además a cualquiera cuyo rol tenga asignada AL
    MENOS UNA de las `claves` pedidas.

    Aceptar varias claves (no solo una) es para endpoints que sirven a más
    de una pantalla del panel con distintos permisos -- ej. GET /api/roles
    lo usan tanto el módulo de Usuarios (para el selector de roles) como el
    de Roles y permisos, así que pide
    require_permission("usuarios.gestionar", "roles.gestionar") en vez de
    forzar un único permiso que dejaría a uno de los dos módulos sin poder
    listar roles.

    Por ahora solo lo usan los endpoints de /api/usuarios y /api/roles
    (ver usuario_route.py) -- el resto de rutas de administración sigue
    con require_admin sin cambios, a propósito: retroaplicar permisos
    granulares a todos los módulos existentes es un alcance más grande,
    fuera de esta ronda.
    """

    def _dep(
        authorization: str | None = Header(None),
        db: Session = Depends(get_db),
    ) -> int:
        if not authorization:
            raise HTTPException(status_code=401, detail="No autenticado")
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Token inválido")

        payload = decode_token(parts[1])
        if payload is None:
            raise HTTPException(status_code=401, detail="Token expirado o inválido")

        roles = payload.get("roles") or []
        if "admin" in roles:
            return int(payload["sub"])

        if roles and claves:
            tiene_permiso = (
                db.query(RolPermiso)
                .join(Rol, Rol.id_rol == RolPermiso.id_rol)
                .join(Permiso, Permiso.id_permiso == RolPermiso.id_permiso)
                .filter(Rol.nombre_rol.in_(roles), Permiso.clave.in_(claves))
                .first()
            )
            if tiene_permiso:
                return int(payload["sub"])

        raise HTTPException(
            status_code=403,
            detail=f"Requiere alguno de estos permisos: {', '.join(claves)}",
        )

    return _dep
