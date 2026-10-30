from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.validadores import Celular, FechaValida


class ClienteCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: str = Field(..., min_length=1, max_length=100)
    cedula: str = Field(..., min_length=1, max_length=20)
    correo: EmailStr | None = None
    # Obligatorio para clientes NUEVOS (sin él no se puede contactar al
    # viajero por su reserva). Los clientes existentes sin celular no se
    # tocan: ClienteResponse sigue aceptando None.
    celular: Celular
    direccion: str | None = Field(None, max_length=255)
    # El formato correcto ("Calle 45 #12-34") se valida en el frontend
    # (RegisterModal.tsx) -- acá solo se acota longitud, mismo criterio ya
    # usado para el resto de estos campos (cedula/celular tampoco llevan
    # regex en el backend).
    barrio: str | None = Field(None, max_length=100)
    departamento: str | None = Field(None, max_length=100)
    codigo_postal: str | None = Field(None, max_length=10)
    ciudad: str | None = Field(None, max_length=100)
    pais: str | None = Field(None, max_length=100)
    fecha_nacimiento: FechaValida | None = None


class ClienteUpdate(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    correo: EmailStr | None = None
    # Opcional al editar (None = no cambia), pero si se envía debe ser válido.
    celular: Celular | None = None
    direccion: str | None = None
    barrio: str | None = None
    departamento: str | None = None
    codigo_postal: str | None = None
    ciudad: str | None = None
    pais: str | None = None
    fecha_nacimiento: FechaValida | None = None

    @field_validator("celular", mode="before")
    @classmethod
    def celular_vacio_es_sin_cambio(cls, v):
        # Formularios de edición de clientes antiguos mandan "" cuando el
        # cliente nunca tuvo celular: eso no debe bloquear la edición.
        return None if isinstance(v, str) and not v.strip() else v


class ClienteResponse(BaseModel):
    id_cliente: int
    nombre: str
    apellido: str
    cedula: str
    correo: str | None
    celular: str | None
    direccion: str | None
    barrio: str | None = None
    departamento: str | None = None
    codigo_postal: str | None = None
    ciudad: str | None
    pais: str | None
    fecha_nacimiento: date | None
    # Ruta relativa real (ej. "/uploads/perfiles/xxx.jpg") tomada de la
    # cuenta de Usuario vinculada — ver Cliente.foto_perfil. None si el
    # cliente no tiene cuenta o no ha subido foto; nunca se inventa.
    foto_perfil: str | None = None
    # Ya existía en la tabla (Cliente.fecha_registro), solo faltaba
    # exponerse en la respuesta — para "cliente desde" en el perfil de
    # admin. No requiere ninguna migración.
    fecha_registro: datetime | None = None

    class Config:
        from_attributes = True


class EmpleadoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: str = Field(..., min_length=1, max_length=100)
    cedula: str = Field(..., min_length=1, max_length=20)
    correo_electronico: EmailStr | None = None
    celular: str | None = Field(None, max_length=20)
    direccion: str | None = Field(None, max_length=255)
    ciudad: str | None = Field(None, max_length=100)
    pais: str | None = Field(None, max_length=100)
    fecha_nacimiento: FechaValida | None = None
    fecha_contratacion: FechaValida


class EmpleadoUpdate(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    correo_electronico: EmailStr | None = None
    celular: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    pais: str | None = None
    fecha_nacimiento: FechaValida | None = None
    activo: bool | None = None


class EmpleadoResponse(BaseModel):
    id_empleado: int
    nombre: str
    apellido: str
    cedula: str
    correo_electronico: str | None
    celular: str | None
    direccion: str | None
    ciudad: str | None
    pais: str | None
    fecha_nacimiento: date | None
    fecha_contratacion: date
    activo: bool
    # Ver Empleado.foto_perfil / ClienteResponse.foto_perfil — mismo criterio.
    foto_perfil: str | None = None

    class Config:
        from_attributes = True
