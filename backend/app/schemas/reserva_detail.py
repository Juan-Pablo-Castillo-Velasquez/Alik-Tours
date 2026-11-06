from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ReservaHabitacionDetail(BaseModel):
    id_habitacion: int
    numero_habitacion: str
    nombre_tipo: str
    nombre_hotel: str
    fecha_checkin: date | None = None
    fecha_checkout: date | None = None
    precio_acordado: float | None = None
    precio_noche: float
    estado: str

    model_config = ConfigDict(from_attributes=True)


class ReservaServicioDetail(BaseModel):
    id_servicio: int
    nombre_servicio: str
    descripcion: str | None = None
    duracion_horas: float | None = None
    nombre_categoria: str | None = None
    fecha_servicio: date | None = None
    numero_personas: int | None = None
    precio_acordado: float | None = None

    model_config = ConfigDict(from_attributes=True)


class ReservaHistorialDetail(BaseModel):
    id_historial: int
    estado_anterior: str | None = None
    estado_nuevo: str | None = None
    fecha_cambio: datetime
    comentarios: str | None = None
    nombre_empleado: str | None = None

    model_config = ConfigDict(from_attributes=True)


class NotaInternaCreate(BaseModel):
    """Nota interna que un asesor deja sobre una reserva (ej. 'llamé al
    cliente, confirmó que llega el día 10') — no cambia el estado, solo
    queda trazada en historial_reservas para que cualquier empleado que
    retome el caso vea qué gestiones ya se hicieron."""

    comentario: str


class ActividadRecienteItem(BaseModel):
    """Un ítem del feed de 'Actividad reciente' del Dashboard de admin —
    igual que ReservaHistorialDetail pero con id_reserva incluido, porque
    acá se listan cambios de MUCHAS reservas mezcladas (no una sola, donde
    el id ya se sabe por la URL)."""

    id_historial: int
    id_reserva: int
    estado_anterior: str | None = None
    estado_nuevo: str | None = None
    fecha_cambio: datetime
    comentarios: str | None = None
    nombre_empleado: str | None = None

    model_config = ConfigDict(from_attributes=True)
