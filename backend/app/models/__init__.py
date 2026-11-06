# Importar todos los modelos aquí para asegurar que SQLAlchemy los registre
from app.models.auth_model import Permiso, RecuperacionPassword, Rol, RolPermiso, SesionUsuario, UsuarioRol
from app.models.banner_model import Banner
from app.models.cliente_model import Cliente, Empleado, PreferenciaCliente
from app.models.comunidad_model import ComentarioComunidad, ImagenPublicacion, PublicacionComunidad, VideoAgencia
from app.models.configuracion_model import ConfiguracionSistema
from app.models.empresa_model import SolicitudCorporativa
from app.models.favorito_model import Favorito
from app.models.hotel_model import (
    Caracteristica,
    Habitacion,
    Hotel,
    HotelCaracteristica,
    ImagenHabitacion,
    ImagenHotel,
    TipoHabitacion,
)
from app.models.mensaje_chat_model import MensajeChat
from app.models.metodo_pago_guardado_model import MetodoPagoGuardado
from app.models.notificacion_model import Notificacion
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
from app.models.tema_model import Tema
from app.models.user_model import Usuario

# Semana 7 del bootcamp: faltaban aquí 9 modelos (banners, configuración,
# solicitudes corporativas, métodos de pago guardados, notificaciones,
# temas, permisos). Sin importarlos, Base.metadata no tenía sus tablas
# hasta que alguna ruta los importaba: la suite de pruebas las creaba o no
# según el ORDEN de los tests, y el autogenerate de Alembic no las veía.
__all__ = [
    "Permiso",
    "RolPermiso",
    "Banner",
    "ConfiguracionSistema",
    "SolicitudCorporativa",
    "MetodoPagoGuardado",
    "Notificacion",
    "Tema",
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
    "ImagenHabitacion",
    "ImagenPaquete",
    "PublicacionComunidad",
    "ImagenPublicacion",
    "ComentarioComunidad",
    "VideoAgencia",
]
