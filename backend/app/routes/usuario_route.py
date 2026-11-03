from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.cache import delete_pattern
from app.core.database import get_db
from app.core.deps import get_current_usuario, require_permission
from app.core.file_validation import validar_y_leer_archivo
from app.core.image_storage import borrar_imagen, guardar_imagen
from app.core.security import hash_password, verify_password
from app.models.auth_model import Permiso, Rol, RolPermiso, UsuarioRol
from app.models.user_model import Usuario
from app.schemas.user_schema import UsuarioResponse
from app.schemas.usuario_admin_schema import (
    AsignarPermisosRequest,
    PermisoResponse,
    RolConPermisosResponse,
    RolCreate,
    RolResponse,
    UsuarioAdminCreate,
    UsuarioAdminResponse,
    UsuarioAdminUpdate,
)

router = APIRouter(prefix="/api/usuarios", tags=["Usuarios"])
roles_router = APIRouter(prefix="/api/roles", tags=["Roles"])
# Catálogo de permisos -- ruta propia (no bajo /api/roles) porque no es
# información de UN rol en particular, es la lista fija de permisos que el
# backend conoce (ver Permiso en auth_model.py). La usa el módulo "Roles y
# permisos" del panel para pintar los checkboxes agrupados por categoría.
permisos_router = APIRouter(prefix="/api/permisos", tags=["Permisos"])

PUBLIC_PATH_PREFIX = "/uploads/perfiles"
PERFILES_TIPOS_PERMITIDOS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024  # 5MB


def _shape_usuario_admin(db: Session, usuario: Usuario) -> UsuarioAdminResponse:
    roles = [
        r.nombre_rol
        for r in db.query(Rol)
        .join(UsuarioRol, UsuarioRol.id_rol == Rol.id_rol)
        .filter(UsuarioRol.id_usuario == usuario.id_usuario)
        .all()
    ]
    nombre_completo = None
    if usuario.cliente:
        nombre_completo = f"{usuario.cliente.nombre} {usuario.cliente.apellido}"
    elif usuario.empleado:
        nombre_completo = f"{usuario.empleado.nombre} {usuario.empleado.apellido}"

    return UsuarioAdminResponse(
        id_usuario=usuario.id_usuario,
        username=usuario.username,
        correo_electronico=usuario.correo_electronico,
        # `activo`/`verificado` son NULLABLE en la BD (columnas creadas sin
        # default a nivel de motor) — cuentas antiguas pueden tener NULL,
        # que tratamos como su valor por defecto real (activa / no verificada).
        activo=usuario.activo if usuario.activo is not None else True,
        verificado=bool(usuario.verificado),
        nombre_completo=nombre_completo,
        roles=roles,
        foto_perfil=usuario.foto_perfil,
        fecha_creacion=usuario.fecha_creacion,
        ultimo_login=usuario.ultimo_login,
    )


@router.get("", response_model=list[UsuarioAdminResponse])
def admin_get_usuarios(db: Session = Depends(get_db), _u: int = Depends(require_permission("usuarios.gestionar"))):
    usuarios = db.query(Usuario).order_by(Usuario.id_usuario.asc()).all()
    return [_shape_usuario_admin(db, u) for u in usuarios]


@router.post("", response_model=UsuarioAdminResponse, status_code=201)
def admin_create_usuario(
    data: UsuarioAdminCreate, db: Session = Depends(get_db), _u: int = Depends(require_permission("usuarios.gestionar"))
):
    # 409 (antes 400): mismo contrato que /auth/register para un dato repetido.
    if db.query(Usuario).filter(Usuario.username == data.username).first():
        raise HTTPException(status_code=409, detail="El nombre de usuario ya existe")
    if db.query(Usuario).filter(Usuario.correo_electronico == data.correo_electronico).first():
        raise HTTPException(status_code=409, detail="El correo electrónico ya está registrado")

    roles_validos = (
        {r.nombre_rol: r.id_rol for r in db.query(Rol).filter(Rol.nombre_rol.in_(data.roles)).all()}
        if data.roles
        else {}
    )
    faltantes = set(data.roles) - set(roles_validos.keys())
    if faltantes:
        raise HTTPException(status_code=400, detail=f"Rol(es) inexistente(s): {', '.join(faltantes)}")

    usuario = Usuario(
        username=data.username,
        correo_electronico=data.correo_electronico,
        password_hash=hash_password(data.password),
        activo=True,
        verificado=True,
    )
    db.add(usuario)
    db.flush()

    for id_rol in roles_validos.values():
        db.add(UsuarioRol(id_usuario=usuario.id_usuario, id_rol=id_rol))

    db.commit()
    db.refresh(usuario)
    return _shape_usuario_admin(db, usuario)


@router.put("/{usuario_id}", response_model=UsuarioAdminResponse)
def admin_update_usuario(
    usuario_id: int,
    data: UsuarioAdminUpdate,
    db: Session = Depends(get_db),
    _u: int = Depends(require_permission("usuarios.gestionar")),
):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if data.activo is not None:
        usuario.activo = data.activo
    if data.verificado is not None:
        usuario.verificado = data.verificado

    if data.roles is not None:
        # Limite de seguridad del lado del servidor: un admin no puede
        # quitarse a si mismo el rol de admin por esta via. El selector de
        # ModuleUsuarios.tsx ya deshabilita el boton en el frontend, pero
        # eso depende de que localStorage.usuario (ver AuthContext.tsx)
        # tenga cacheado el user_id de la sesion actual -- si esa cache
        # esta vieja el boton del frontend no bloquea nada. Este chequeo no
        # depende de ningun estado del navegador: usa _u (el id del que
        # llama, sacado del propio JWT en require_permission, deps.py), asi
        # que es la unica fuente de verdad real.
        if usuario_id == _u and "admin" not in data.roles:
            raise HTTPException(
                status_code=400,
                detail="No puedes quitarte el rol de admin a ti mismo.",
            )

        roles_validos = (
            {r.nombre_rol: r.id_rol for r in db.query(Rol).filter(Rol.nombre_rol.in_(data.roles)).all()}
            if data.roles
            else {}
        )
        faltantes = set(data.roles) - set(roles_validos.keys())
        if faltantes:
            raise HTTPException(status_code=400, detail=f"Rol(es) inexistente(s): {', '.join(faltantes)}")

        db.query(UsuarioRol).filter(UsuarioRol.id_usuario == usuario_id).delete()
        for id_rol in roles_validos.values():
            db.add(UsuarioRol(id_usuario=usuario_id, id_rol=id_rol))

    db.commit()
    db.refresh(usuario)
    return _shape_usuario_admin(db, usuario)


@router.delete("/{usuario_id}")
def admin_delete_usuario(
    usuario_id: int, db: Session = Depends(get_db), _u: int = Depends(require_permission("usuarios.gestionar"))
):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # Hallazgo (bootcamp, semana 7): quitarse el rol de admin ya estaba
    # bloqueado, pero borrarse no -- el único admin podía dejar el panel sin
    # nadie que lo administre.
    if usuario_id == _u:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta.")
    db.delete(usuario)
    db.commit()
    return {"message": "Usuario eliminado exitosamente"}


@roles_router.get("", response_model=list[RolResponse])
def get_roles(
    db: Session = Depends(get_db),
    # Lo usan tanto el selector de roles del módulo Usuarios como el
    # listado del módulo Roles y permisos -- cualquiera de los dos permisos
    # basta (ver require_permission en deps.py).
    _u: int = Depends(require_permission("usuarios.gestionar", "roles.gestionar")),
):
    return db.query(Rol).order_by(Rol.nombre_rol.asc()).all()


@roles_router.post("", response_model=RolResponse, status_code=201)
def crear_rol(data: RolCreate, db: Session = Depends(get_db), _u: int = Depends(require_permission("roles.gestionar"))):
    nombre = data.nombre_rol.strip().lower()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre del rol no puede estar vacío")
    if db.query(Rol).filter(Rol.nombre_rol == nombre).first():
        raise HTTPException(status_code=409, detail="Ya existe un rol con ese nombre")
    rol = Rol(nombre_rol=nombre)
    db.add(rol)
    db.commit()
    db.refresh(rol)
    return rol


@roles_router.delete("/{rol_id}")
def eliminar_rol(rol_id: int, db: Session = Depends(get_db), _u: int = Depends(require_permission("roles.gestionar"))):
    rol = db.query(Rol).filter(Rol.id_rol == rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    # 'admin' es el único rol que el backend reconoce por su nombre
    # literal (ver require_admin en security.py y el bypass de
    # require_permission en deps.py) -- borrarlo dejaría sin forma de
    # volver a asignarlo desde el panel, aunque las sesiones ya abiertas
    # sigan funcionando hasta que su token expire.
    if rol.nombre_rol == "admin":
        raise HTTPException(status_code=400, detail="El rol 'admin' no se puede eliminar")

    tiene_usuarios = db.query(UsuarioRol).filter(UsuarioRol.id_rol == rol_id).first()
    if tiene_usuarios:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar un rol que todavía tiene usuarios asignados. Quítaselo primero desde Usuarios.",
        )

    db.delete(rol)
    db.commit()
    return {"message": "Rol eliminado correctamente"}


@roles_router.get("/{rol_id}/permisos", response_model=RolConPermisosResponse)
def obtener_permisos_rol(
    rol_id: int, db: Session = Depends(get_db), _u: int = Depends(require_permission("roles.gestionar"))
):
    rol = db.query(Rol).filter(Rol.id_rol == rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    claves = [
        p.clave
        for p in db.query(Permiso)
        .join(RolPermiso, RolPermiso.id_permiso == Permiso.id_permiso)
        .filter(RolPermiso.id_rol == rol_id)
        .all()
    ]
    total_usuarios = db.query(UsuarioRol).filter(UsuarioRol.id_rol == rol_id).count()
    return RolConPermisosResponse(
        id_rol=rol.id_rol, nombre_rol=rol.nombre_rol, permisos=claves, total_usuarios=total_usuarios
    )


@roles_router.put("/{rol_id}/permisos", response_model=RolConPermisosResponse)
def asignar_permisos_rol(
    rol_id: int,
    data: AsignarPermisosRequest,
    db: Session = Depends(get_db),
    _u: int = Depends(require_permission("roles.gestionar")),
):
    """Reemplaza por completo el conjunto de permisos de un rol (mismo
    patrón 'borrar todo y reinsertar' que admin_update_usuario ya usa para
    los roles de un usuario, ver arriba). Para 'admin' esto es meramente
    informativo -- require_permission igual lo deja pasar siempre, sin
    consultar esta tabla -- pero se permite editarlo para que el panel no
    tenga un caso especial oculto."""
    rol = db.query(Rol).filter(Rol.id_rol == rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    permisos_validos = (
        {p.clave: p.id_permiso for p in db.query(Permiso).filter(Permiso.clave.in_(data.permisos)).all()}
        if data.permisos
        else {}
    )
    faltantes = set(data.permisos) - set(permisos_validos.keys())
    if faltantes:
        raise HTTPException(status_code=400, detail=f"Permiso(s) inexistente(s): {', '.join(faltantes)}")

    db.query(RolPermiso).filter(RolPermiso.id_rol == rol_id).delete()
    for id_permiso in permisos_validos.values():
        db.add(RolPermiso(id_rol=rol_id, id_permiso=id_permiso))
    db.commit()

    total_usuarios = db.query(UsuarioRol).filter(UsuarioRol.id_rol == rol_id).count()
    return RolConPermisosResponse(
        id_rol=rol.id_rol,
        nombre_rol=rol.nombre_rol,
        permisos=list(permisos_validos.keys()),
        total_usuarios=total_usuarios,
    )


@permisos_router.get("", response_model=list[PermisoResponse])
def listar_permisos(db: Session = Depends(get_db), _u: int = Depends(require_permission("roles.gestionar"))):
    """Catálogo completo de permisos que el backend conoce, agrupable por
    `categoria` en el frontend -- para pintar los checkboxes del módulo
    Roles y permisos. No hay endpoint para crear permisos nuevos: la lista
    solo cambia agregando una fila a PERMISOS en la migración
    5d2370d4474f_crear_tablas_permisos.py junto con el chequeo real en el
    código (ver require_permission)."""
    return db.query(Permiso).order_by(Permiso.categoria.asc(), Permiso.nombre.asc()).all()


def _borrar_archivo_si_existe(foto_perfil: str | None) -> None:
    borrar_imagen(foto_perfil, carpeta="perfiles", public_path_prefix=PUBLIC_PATH_PREFIX)


@router.get("/me", response_model=UsuarioResponse)
def get_me(usuario: Usuario = Depends(get_current_usuario)):
    return usuario


class CambiarPasswordRequest(BaseModel):
    contrasena_actual: str
    nueva_contrasena: str


@router.put("/me/password")
def cambiar_password_propio(
    data: CambiarPasswordRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_usuario),
):
    """Cambio de contraseña de la cuenta ya autenticada (por token), no de
    un cliente específico como /clientes/{id}/cambiar-contrasena (que exige
    un id_cliente y por tanto no sirve para una cuenta de administrador sin
    cliente vinculado) ni del flujo de 'olvidé mi contraseña' (token de un
    solo uso por correo, ver password_reset). Sirve para cualquier Usuario:
    admin, empleado o cliente."""
    if not verify_password(data.contrasena_actual, usuario.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    if len(data.nueva_contrasena) < 8:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 8 caracteres")

    usuario.password_hash = hash_password(data.nueva_contrasena)
    db.commit()
    return {"message": "Contraseña actualizada correctamente"}


@router.post("/me/foto", response_model=UsuarioResponse)
async def subir_foto_perfil(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_usuario),
):
    # La foto de perfil personalizada queda condicionada a que la cuenta ya
    # esté verificada (ver ProfileSidebar.tsx/TabCuenta.tsx, que ya ocultan
    # y deshabilitan esto en la UI) -- se repite la validación aquí porque
    # un cliente HTTP directo (no el frontend) podría saltarse el chequeo
    # visual y llamar a este endpoint igual.
    if not usuario.verificado:
        raise HTTPException(
            status_code=403,
            detail="Verifica tu cuenta antes de personalizar tu foto de perfil.",
        )

    if file.content_type not in PERFILES_TIPOS_PERMITIDOS:
        raise HTTPException(
            status_code=422,
            detail="Formato de imagen no soportado. Usa JPG, PNG o WEBP.",
        )

    contenido, extension = await validar_y_leer_archivo(
        file,
        tipos_permitidos=PERFILES_TIPOS_PERMITIDOS,
        mensaje_tipo="Formato de imagen no soportado. Usa JPG, PNG o WEBP.",
        tamano_maximo_bytes=TAMANO_MAXIMO_BYTES,
    )

    nueva_url = guardar_imagen(contenido, extension, carpeta="perfiles", public_path_prefix=PUBLIC_PATH_PREFIX)
    # Igual que antes de esta integración: primero se guarda la foto nueva,
    # y solo si eso funciona se borra la anterior — así una subida fallida
    # nunca deja al usuario sin ninguna foto.
    _borrar_archivo_si_existe(usuario.foto_perfil)
    usuario.foto_perfil = nueva_url
    db.commit()
    db.refresh(usuario)
    _invalidar_cache_foto(usuario)
    return usuario


@router.delete("/me/foto", response_model=UsuarioResponse)
def eliminar_foto_perfil(db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    _borrar_archivo_si_existe(usuario.foto_perfil)
    usuario.foto_perfil = None
    db.commit()
    db.refresh(usuario)
    _invalidar_cache_foto(usuario)
    return usuario


def _invalidar_cache_foto(usuario: Usuario) -> None:
    """Usuario.foto_perfil se expone también en ClienteResponse/EmpleadoResponse
    (ver Cliente.foto_perfil / Empleado.foto_perfil) — al subir o borrar la
    foto hay que invalidar el listado del que sea dueño de la cuenta, si no
    el panel de admin seguiría mostrando la foto vieja hasta que expire el TTL."""
    if usuario.id_cliente:
        delete_pattern("clientes:list:*")
    if usuario.id_empleado:
        delete_pattern("empleados:list:*")
