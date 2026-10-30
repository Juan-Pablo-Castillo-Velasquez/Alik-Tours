# schemas/user_schema.py


from pydantic import BaseModel, EmailStr, Field


class UsuarioCreate(BaseModel):
    username: str
    correo_electronico: EmailStr
    password: str
    # Versión de los términos y condiciones que el usuario aceptó de forma
    # expresa (casilla sin marcar por defecto en el registro).
    terminos_version: str | None = Field(None, max_length=40)


class UsuarioLogin(BaseModel):
    # El login es siempre por correo electrónico (nunca por username) —
    # se llama `username` por compatibilidad con el frontend/OAuth2, pero
    # se valida y se usa como correo.
    username: EmailStr
    password: str


class UsuarioResponse(BaseModel):
    id_usuario: int
    username: str
    correo_electronico: str
    foto_perfil: str | None = None
    id_cliente: int | None = None
    id_empleado: int | None = None
    verificado: bool = False
    activo: bool = True

    class Config:
        from_attributes = True


class PasswordResetRequest(BaseModel):
    correo_electronico: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
