from datetime import date

from pydantic import BaseModel, Field, field_validator


class CaracteristicaCreate(BaseModel):
    nombre_caracteristica: str = Field(..., min_length=1, max_length=100)


class CaracteristicaResponse(BaseModel):
    id_caracteristica: int
    nombre_caracteristica: str

    class Config:
        from_attributes = True


class TipoHabitacionCreate(BaseModel):
    nombre_tipo: str = Field(..., min_length=1, max_length=50)
    descripcion: str | None = Field(None, max_length=200)
    capacidad_personas: int = Field(..., gt=0)


class TipoHabitacionResponse(BaseModel):
    id_tipo_habitacion: int
    nombre_tipo: str
    descripcion: str | None
    capacidad_personas: int

    class Config:
        from_attributes = True


class HabitacionCreate(BaseModel):
    id_hotel: int
    id_tipo_habitacion: int
    numero_habitacion: str = Field(..., min_length=1, max_length=20)
    precio_noche: float = Field(..., ge=0)
    estado: str = Field(default="disponible")

    @field_validator("estado")
    @classmethod
    def validate_estado(cls, v):
        if v not in ["disponible", "ocupada", "mantenimiento"]:
            raise ValueError("estado debe ser: disponible, ocupada o mantenimiento")
        return v


class HabitacionUpdate(BaseModel):
    numero_habitacion: str | None = None
    precio_noche: float | None = Field(None, ge=0)
    estado: str | None = None

    @field_validator("estado")
    @classmethod
    def validate_estado(cls, v):
        if v and v not in ["disponible", "ocupada", "mantenimiento"]:
            raise ValueError("estado debe ser: disponible, ocupada o mantenimiento")
        return v


class HabitacionResponse(BaseModel):
    id_habitacion: int
    id_hotel: int
    id_tipo_habitacion: int
    numero_habitacion: str
    precio_noche: float
    estado: str
    tipo_habitacion: TipoHabitacionResponse | None = None

    class Config:
        from_attributes = True


class RangoOcupado(BaseModel):
    """Un rango de fechas ya reservado — solo fechas, nunca quién reservó
    (no expone datos de otros clientes)."""

    fecha_checkin: date
    fecha_checkout: date


class HabitacionFechasOcupadas(BaseModel):
    """Fechas ya reservadas de una habitación, para GET
    /hoteles/{hotel_id}/fechas-ocupadas — reutiliza reserva_habitaciones,
    que ya tiene estos datos (mismo criterio de reserva "activa" que
    _verificar_disponibilidad en reserva_repository.py), sin necesitar
    ninguna tabla ni columna nueva."""

    id_habitacion: int
    rangos: list[RangoOcupado]


class HotelCaracteristicaCreate(BaseModel):
    id_caracteristica: int
    disponible: bool = True


class HotelCaracteristicaResponse(BaseModel):
    id_hotel: int
    id_caracteristica: int
    disponible: bool
    caracteristica: CaracteristicaResponse | None = None

    class Config:
        from_attributes = True


class HabitacionNuevaEnHotel(BaseModel):
    """Habitación que se crea junto con el hotel (POST /api/hoteles/) --
    mismos campos y reglas que HabitacionCreate, sin id_hotel (todavía no
    existe)."""

    id_tipo_habitacion: int
    numero_habitacion: str = Field(..., min_length=1, max_length=20)
    precio_noche: float = Field(..., ge=0)
    estado: str = Field(default="disponible")

    @field_validator("estado")
    @classmethod
    def validate_estado(cls, v):
        if v not in ["disponible", "ocupada", "mantenimiento"]:
            raise ValueError("estado debe ser: disponible, ocupada o mantenimiento")
        return v


class HotelCreate(BaseModel):
    nombre_hotel: str = Field(..., min_length=1, max_length=100)
    calificacion: int | None = Field(None, ge=1, le=5)
    direccion: str | None = Field(None, max_length=255)
    ciudad: str | None = Field(None, max_length=100)
    pais: str | None = Field(None, max_length=100)
    codigo_postal: str | None = Field(None, max_length=20)
    correo_electronico: str | None = Field(None, max_length=100)
    telefono: str | None = Field(None, max_length=20)
    descripcion: str | None = Field(None, max_length=5000)
    politicas: str | None = Field(None, max_length=5000)
    # Opcional: habitaciones creadas en la MISMA transacción que el hotel
    # (o se crea todo, o nada).
    habitaciones: list[HabitacionNuevaEnHotel] | None = None

    @field_validator("habitaciones")
    @classmethod
    def numeros_unicos(cls, v):
        if v:
            numeros = [h.numero_habitacion.strip().lower() for h in v]
            if len(numeros) != len(set(numeros)):
                raise ValueError("Hay números de habitación repetidos")
        return v


class HotelUpdate(BaseModel):
    nombre_hotel: str | None = None
    calificacion: int | None = Field(None, ge=1, le=5)
    direccion: str | None = None
    ciudad: str | None = None
    pais: str | None = None
    codigo_postal: str | None = None
    correo_electronico: str | None = None
    telefono: str | None = None
    descripcion: str | None = Field(None, max_length=5000)
    politicas: str | None = Field(None, max_length=5000)


class HotelResponse(BaseModel):
    id_hotel: int
    nombre_hotel: str
    calificacion: int | None
    direccion: str | None
    ciudad: str | None
    pais: str | None
    codigo_postal: str | None
    correo_electronico: str | None
    telefono: str | None
    imagen_url: str | None = None
    descripcion: str | None = None
    politicas: str | None = None
    # Reseñas reales de clientes (propiedades calculadas en el modelo Hotel a
    # partir de la tabla `resenas`) — nunca cifras inventadas en el frontend.
    total_resenas: int = 0
    calificacion_promedio: float | None = None

    class Config:
        from_attributes = True


class ImagenGaleriaResponse(BaseModel):
    """Una foto de la galería (de un hotel o de un paquete -- se reutiliza
    el mismo shape para ambos, ver ImagenHotel/ImagenPaquete en los
    modelos). Distinta de `imagen_url` (la portada, un solo campo plano)."""

    id_imagen: int
    url: str
    orden: int

    class Config:
        from_attributes = True


class HotelDetailResponse(HotelResponse):
    habitaciones: list[HabitacionResponse] = []
    hotel_caracteristicas: list[HotelCaracteristicaResponse] = []
    # Galería de fotos reales (distinta de imagen_url, la portada) -- antes
    # no existía ninguna forma de subir más de una foto por hotel.
    imagenes: list[ImagenGaleriaResponse] = []


class DestinoRealResponse(BaseModel):
    """Sugerencia de destino para el buscador (SearchBar.tsx), respaldada
    por hoteles reales -- ver HotelRepository.get_destinos_reales. A
    diferencia del catálogo de /destinos (pensado para servicios/
    actividades, sin relación con los hoteles), esto nunca sugiere una
    ciudad sin al menos un hotel real detrás."""

    ciudad: str
    pais: str | None
    total_hoteles: int
