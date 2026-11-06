from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UsuarioAdminResponse(BaseModel):
    id_usuario: int
    username: str
    correo_electronico: str
    activo: bool
    verificado: bool
    nombre_completo: str | None = None
    roles: list[str] = []
    foto_perfil: str | None = None
    # Reales (Usuario.fecha_creacion / Usuario.ultimo_login, ver user_model.py)
    # -- para que el panel de admin muestre cuándo se creó la cuenta y cuándo
    # fue su último acceso, en vez de solo el estado actual. ultimo_login
    # queda en None hasta el primer login posterior a este cambio (antes esa
    # columna nunca se actualizaba, ver login_user en auth_service.py).
    fecha_creacion: datetime | None = None
    ultimo_login: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UsuarioAdminCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    correo_electronico: EmailStr
    password: str = Field(..., min_length=8)
    roles: list[str] = []


class UsuarioAdminUpdate(BaseModel):
    activo: bool | None = None
    verificado: bool | None = None
    roles: list[str] | None = None


class RolResponse(BaseModel):
    id_rol: int
    nombre_rol: str

    model_config = ConfigDict(from_attributes=True)


class RolCreate(BaseModel):
    nombre_rol: str = Field(..., min_length=2, max_length=50)


class PermisoResponse(BaseModel):
    id_permiso: int
    clave: str
    nombre: str
    categoria: str

    model_config = ConfigDict(from_attributes=True)


class RolConPermisosResponse(BaseModel):
    id_rol: int
    nombre_rol: str
    permisos: list[str] = []
    # Cuántos usuarios tienen este rol asignado hoy -- para que el admin
    # sepa, antes de intentar borrarlo, si primero tiene que quitárselo a
    # alguien desde Usuarios (ver eliminar_rol en usuario_route.py, que
    # bloquea el borrado mientras este número sea mayor que 0).
    total_usuarios: int = 0


class AsignarPermisosRequest(BaseModel):
    permisos: list[str] = []
