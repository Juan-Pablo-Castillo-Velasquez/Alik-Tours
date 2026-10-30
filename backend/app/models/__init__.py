# Importar todos los modelos aquí para asegurar que SQLAlchemy los registre
from app.models.auth_model import RecuperacionPassword, Rol, SesionUsuario, UsuarioRol
from app.models.cliente_model import Cliente, Empleado, PreferenciaCliente
from app.models.comunidad_model import ComentarioComunidad, ImagenPublicacion, PublicacionComunidad, VideoAgencia
from app.models.favorito_model import Favorito
from app.models.hotel_model import Caracteristica, Habitacion, Hotel, HotelCaracteristica, ImagenHotel, TipoHabitacion
from app.models.mensaje_chat_model import MensajeChat
from app.models.resena_model import Resena
from app.models.reserva_model import (
    HistorialReserva,
    ImagenPaquete,
    MetodoPago,
    Pago,
    Paquete,
    PaqueteHotel,
    PaqueteServicio,
    Reserva,
    ReservaHabitacion,
    ReservaServicio,
)
from app.models.servicio_model import CategoriaServicio, Destino, Proveedor, Servicio, ServicioProveedor
from app.models.user_model import Usuario

__all__ = [
    "Usuario",
    "Cliente",
    "Empleado",
    "PreferenciaCliente",
    "Hotel",
    "Habitacion",
    "Caracteristica",
    "HotelCaracteristica",
    "TipoHabitacion",
    "Resena",
    "Servicio",
    "Destino",
    "CategoriaServicio",
    "Proveedor",
    "ServicioProveedor",
    "Reserva",
    "Paquete",
    "Pago",
    "MetodoPago",
    "HistorialReserva",
    "ReservaHabitacion",
    "ReservaServicio",
    "PaqueteServicio",
    "PaqueteHotel",
    "Rol",
    "UsuarioRol",
    "SesionUsuario",
    "RecuperacionPassword",
    "Favorito",
    "MensajeChat",
    "ImagenHotel",
    "ImagenPaquete",
    "PublicacionComunidad",
    "ImagenPublicacion",
    "ComentarioComunidad",
    "VideoAgencia",
]
