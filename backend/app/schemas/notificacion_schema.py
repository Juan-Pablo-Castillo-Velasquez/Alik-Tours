from datetime import datetime

from pydantic import BaseModel


class NotificacionResponse(BaseModel):
    id_notificacion: int
    tipo: str
    titulo: str
    mensaje: str | None = None
    id_referencia: int | None = None
    leido: bool
    fecha_creacion: datetime

    class Config:
        from_attributes = True


class ActividadClienteItem(BaseModel):
    """Item del feed de notificaciones del cliente autenticado (campana del
    sitio público): se arma al vuelo agregando historial_reservas,
    solicitudes_cancelacion y las Notificacion con id_cliente de ESE cliente.
    Ver notificacion_service.get_actividad_cliente."""

    tipo: str
    titulo: str
    mensaje: str | None = None
    fecha: datetime
    id_referencia: int
