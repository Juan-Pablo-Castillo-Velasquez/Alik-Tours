"""
Excepciones personalizadas para la API
"""


class BaseAPIException(Exception):
    """Excepción base para la API"""

    def __init__(self, status_code: int, detail: str, code: str = None):
        self.status_code = status_code
        self.detail = detail
        self.code = code or self.__class__.__name__
        super().__init__(self.detail)


class ValidationError(BaseAPIException):
    """Error de validación de datos"""

    def __init__(self, detail: str):
        super().__init__(status_code=422, detail=detail)


class DuplicateError(BaseAPIException):
    """Intento de crear un registro duplicado"""

    def __init__(self, detail: str):
        super().__init__(status_code=409, detail=detail)


class NotFoundError(BaseAPIException):
    """Registro no encontrado"""

    def __init__(self, detail: str):
        super().__init__(status_code=404, detail=detail)


class DependencyError(BaseAPIException):
    """Error al intentar eliminar un registro que tiene dependencias"""

    def __init__(self, entity: str, id_value: int, dependent_entity: str, dependent_count: int):
        detail = (
            f"No se puede eliminar {entity} con ID {id_value} porque tiene "
            f"{dependent_count} {dependent_entity}(s) asociado(s). "
            f"Elimina primero los {dependent_entity}(s) o actualiza sus relaciones."
        )
        super().__init__(status_code=409, detail=detail, code="DEPENDENCY_ERROR")


class HotelDependencyError(DependencyError):
    """Error al eliminar hotel con habitaciones, características o paquetes vinculados"""

    def __init__(self, hotel_id: int, habitaciones: int = 0, caracteristicas: int = 0, paquetes: int = 0):
        dependencies = []
        if habitaciones > 0:
            dependencies.append(f"{habitaciones} habitación(es)")
        if caracteristicas > 0:
            dependencies.append(f"{caracteristicas} característica(s)")
        # Antes no se validaba esto: borrar un hotel vinculado a un paquete
        # activo (PaqueteHotel.id_hotel es ondelete="CASCADE") eliminaba en
        # silencio ese vínculo, dejando el paquete roto sin ningún aviso.
        if paquetes > 0:
            dependencies.append(f"{paquetes} paquete(s) turístico(s)")

        detail = (
            f"No se puede eliminar el hotel ID {hotel_id} porque tiene {' y '.join(dependencies)} asociadas. "
            f"Elimina o reasigna primero."
        )
        self.status_code = 409
        self.detail = detail
        self.code = "HOTEL_HAS_DEPENDENCIES"


class ClienteDependencyError(DependencyError):
    """Error al eliminar cliente con reservas"""

    def __init__(self, cliente_id: int, reservas: int):
        detail = (
            f"No se puede eliminar el cliente ID {cliente_id} porque tiene "
            f"{reservas} reserva(s) asociada(s). Cancela o reasigna las reservas primero."
        )
        self.status_code = 409
        self.detail = detail
        self.code = "CLIENTE_HAS_RESERVATIONS"


class EmpleadoDependencyError(DependencyError):
    """Error al eliminar empleado con reservas o historial"""

    def __init__(self, empleado_id: int, reservas: int = 0, historial: int = 0):
        dependencies = []
        if reservas > 0:
            dependencies.append(f"{reservas} reserva(s)")
        if historial > 0:
            dependencies.append(f"{historial} entrada(s) de historial")

        detail = (
            f"No se puede eliminar el empleado ID {empleado_id} porque tiene "
            f"{' y '.join(dependencies)} asociadas. Reasigna primero."
        )
        self.status_code = 409
        self.detail = detail
        self.code = "EMPLEADO_HAS_DEPENDENCIES"


class ReservaDependencyError(DependencyError):
    """Error al eliminar reserva con pagos o habitaciones"""

    def __init__(self, reserva_id: int, pagos: int = 0, habitaciones: int = 0, servicios: int = 0):
        dependencies = []
        if pagos > 0:
            dependencies.append(f"{pagos} pago(s)")
        if habitaciones > 0:
            dependencies.append(f"{habitaciones} habitación(es)")
        if servicios > 0:
            dependencies.append(f"{servicios} servicio(s)")

        detail = (
            f"No se puede eliminar la reserva ID {reserva_id} porque tiene "
            f"{' y '.join(dependencies)} asociados. Elimina primero."
        )
        self.status_code = 409
        self.detail = detail
        self.code = "RESERVA_HAS_DEPENDENCIES"


class PaqueteDependencyError(DependencyError):
    """Error al eliminar paquete con reservas"""

    def __init__(self, paquete_id: int, reservas: int):
        detail = (
            f"No se puede eliminar el paquete ID {paquete_id} porque tiene "
            f"{reservas} reserva(s) usando este paquete. Actualiza las reservas primero."
        )
        self.status_code = 409
        self.detail = detail
        self.code = "PAQUETE_HAS_RESERVATIONS"


class ServicioDependencyError(DependencyError):
    """Error al eliminar servicio con relaciones"""

    def __init__(self, servicio_id: int, paquetes: int = 0, reservas: int = 0, proveedores: int = 0):
        dependencies = []
        if paquetes > 0:
            dependencies.append(f"{paquetes} paquete(s)")
        if reservas > 0:
            dependencies.append(f"{reservas} reserva(s)")
        if proveedores > 0:
            dependencies.append(f"{proveedores} proveedor(es)")

        detail = (
            f"No se puede eliminar el servicio ID {servicio_id} porque está asociado a "
            f"{' y '.join(dependencies)}. Actualiza primero."
        )
        self.status_code = 409
        self.detail = detail
        self.code = "SERVICIO_HAS_DEPENDENCIES"


class DestinoDependencyError(DependencyError):
    """Error al eliminar destino con servicios"""

    def __init__(self, destino_id: int, servicios: int):
        detail = (
            f"No se puede eliminar el destino ID {destino_id} porque tiene "
            f"{servicios} servicio(s) en este destino. Elimina o reasigna primero."
        )
        self.status_code = 409
        self.detail = detail
        self.code = "DESTINO_HAS_SERVICES"


class ProveeDependencyError(DependencyError):
    """Error al eliminar proveedor con servicios"""

    def __init__(self, proveedor_id: int, servicios: int):
        detail = (
            f"No se puede eliminar el proveedor ID {proveedor_id} porque está asociado a "
            f"{servicios} servicio(s). Desascia primero."
        )
        self.status_code = 409
        self.detail = detail
        self.code = "PROVEEDOR_HAS_SERVICES"


class HabitacionNoDisponibleError(BaseAPIException):
    """La habitación no está disponible en las fechas solicitadas"""

    def __init__(self, id_habitacion: int, fecha_checkin=None, fecha_checkout=None):
        detail = (
            f"La habitación ID {id_habitacion} no está disponible "
            f"entre {fecha_checkin} y {fecha_checkout}. Ya tiene otra reserva en ese rango "
            f"o su estado actual no permite reservarla."
        )
        super().__init__(status_code=409, detail=detail, code="HABITACION_NO_DISPONIBLE")


class CapacidadInsuficienteError(BaseAPIException):
    """Más huéspedes de los que caben en las habitaciones elegidas."""

    def __init__(self, personas: int, capacidad: int):
        super().__init__(
            status_code=422,
            detail=(
                f"Las habitaciones elegidas son para máximo {capacidad} persona(s) y la reserva es para {personas}. "
                "Agrega otra habitación o elige una más grande."
            ),
            code="CAPACIDAD_INSUFICIENTE",
        )


class PaqueteNoEncontradoError(NotFoundError):
    """El paquete referenciado en la reserva no existe"""

    def __init__(self, id_paquete: int):
        super().__init__(detail=f"El paquete con ID {id_paquete} no existe.")


class HabitacionNoEncontradaError(NotFoundError):
    """La habitación referenciada en la reserva no existe"""

    def __init__(self, id_habitacion: int):
        super().__init__(detail=f"La habitación con ID {id_habitacion} no existe.")
