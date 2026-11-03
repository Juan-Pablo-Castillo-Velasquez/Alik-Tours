# schemas/user_schema.py


import re

from pydantic import BaseModel, EmailStr, Field, field_validator

# Misma regla que el formulario de registro (RegisterModal.tsx,
# PASSWORD_REGEX). Hallazgo de la semana 6 del bootcamp: el backend no la
# validaba, así que llamando al API directo se podía crear una cuenta con
# contraseña vacía o de una letra.
_PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$")
MENSAJE_PASSWORD = "La contraseña debe tener mínimo 6 caracteres, una mayúscula, una minúscula y un número"


def _validar_password(v: str) -> str:
    if not _PASSWORD_REGEX.match(v):
        raise ValueError(MENSAJE_PASSWORD)
    return v


class UsuarioCreate(BaseModel):
    # max_length = tamaño de la columna (usuarios.username VARCHAR(50),
    # correo VARCHAR(100)). Hallazgo de la semana 6: un nombre de usuario de
    # 51 caracteres pasaba la validación y PostgreSQL lo rechazaba con 500.
    username: str = Field(..., min_length=1, max_length=50)
    correo_electronico: EmailStr = Field(..., max_length=100)
    password: str

    @field_validator("password")
    @classmethod
    def password_segura(cls, v: str) -> str:
        return _validar_password(v)

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

    @field_validator("new_password")
    @classmethod
    def password_segura(cls, v: str) -> str:
        return _validar_password(v)
