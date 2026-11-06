from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ReservaResumenChatResponse(BaseModel):
    """Resumen mínimo de la reserva etiquetada en un mensaje -- reutiliza
    las properties ya calculadas en el modelo Reserva (nombre_paquete,
    destino, hotel_nombre) en vez de reimplementar esa lógica aquí (ver
    MensajeChatRepository._reserva_resumen)."""

    id_reserva: int
    nombre_paquete: str | None = None
    destino: str | None = None
    hotel_nombre: str | None = None
    estado: str
    fecha_inicio: date | None = None
    fecha_fin: date | None = None

    model_config = ConfigDict(from_attributes=True)


class MensajeChatResponse(BaseModel):
    id_mensaje: int
    id_cliente: int
    id_usuario_remitente: int
    remitente_tipo: str
    contenido: str | None = None
    imagen_url: str | None = None
    # Adjunto que no es una imagen (por ahora, PDF) -- ver comentario en
    # MensajeChat.archivo_url (mensaje_chat_model.py). Nunca coexiste con
    # imagen_url en el mismo mensaje.
    archivo_url: str | None = None
    archivo_nombre: str | None = None
    id_reserva: int | None = None
    # None si el mensaje no tiene reserva asociada, o si la tenía y esa
    # reserva ya se borró (id_reserva queda en NULL por el ondelete="SET
    # NULL" de la FK) -- nunca se rompe la respuesta por una reserva
    # eliminada.
    reserva: ReservaResumenChatResponse | None = None
    leido: bool
    fecha_envio: datetime | None = None
    # Denormalizados para la UI (resueltos en el repositorio, no acá --
    # nunca se calculan en el schema, mismo criterio que el resto del
    # proyecto: el schema solo declara la forma de salida).
    remitente_nombre: str | None = None
    remitente_foto: str | None = None

    model_config = ConfigDict(from_attributes=True)


class HiloResumenResponse(BaseModel):
    """Una fila por cliente en la bandeja compartida del admin (ver
    MensajeChatRepository.get_hilos) -- no existe una tabla de "hilo", esto
    se deriva agregando mensajes_chat por id_cliente."""

    id_cliente: int
    cliente_nombre: str
    cliente_foto: str | None = None
    ultimo_mensaje: str | None = None
    ultimo_mensaje_fecha: datetime | None = None
    # Quién escribió el último mensaje del hilo -- "cliente" | "admin". Lo
    # usa ModuleMensajes.tsx para aproximar "en línea" (el cliente escribió
    # hace poco y todavía no se le ha respondido) y para la alerta de "sin
    # responder en 5 minutos", sin necesitar una tabla de presencia real
    # (el chat es solo polling, ver mensaje_chat_route.py).
    ultimo_mensaje_remitente_tipo: str | None = None
    no_leidos: int


class ConteoNoLeidosResponse(BaseModel):
    no_leidos: int


class HilosPaginadosResponse(BaseModel):
    """Página de la bandeja compartida del admin (GET /hilos) -- mismo
    contrato skip/limit que ya usa el resto del proyecto (ver
    reserva_route.py), nunca page/page_size."""

    items: list[HiloResumenResponse]
    total: int
    skip: int
    limit: int
