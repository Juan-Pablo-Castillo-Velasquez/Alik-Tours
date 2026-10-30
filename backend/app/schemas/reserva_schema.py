from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.validadores import FechaValida

from app.schemas.hotel_schema import ImagenGaleriaResponse


class PaqueteHotelInput(BaseModel):
    """Un hotel real vinculado al paquete (tabla paquete_hotel, ya existía
    en el modelo pero nunca se podía escribir desde el admin — ver
    PaqueteRepository._sync_hoteles en reserva_repository.py)."""

    id_hotel: int
    noches_incluidas: int | None = Field(None, gt=0)


class PaqueteServicioInput(BaseModel):
    """Un servicio real incluido en el paquete (tabla paquete_servicios,
    ya existía en el modelo y ya se leía en GET /paquetes/{id}/detalle,
    pero tampoco tenía ningún punto de escritura desde el admin — mismo
    hueco que tenían los hoteles antes de PaqueteRepository._sync_hoteles."""

    id_servicio: int
    dia_actividad: int | None = Field(None, gt=0)
    incluido: bool = True


class PaqueteCreate(BaseModel):
    nombre_paquete: str = Field(..., min_length=1, max_length=100)
    descripcion: str | None = None
    duracion_dias: int | None = Field(None, gt=0)
    precio_base: float = Field(..., ge=0)
    activo: bool = True
    # Ciudad de salida del viaje (vuelo/transporte) — distinta de la ciudad
    # de destino, que se deriva de los hoteles reales vinculados.
    ciudad_salida: str | None = Field(None, max_length=100)
    condiciones: str | None = Field(None, max_length=5000)
    hoteles: list[PaqueteHotelInput] | None = None
    servicios: list[PaqueteServicioInput] | None = None


class PaqueteUpdate(BaseModel):
    nombre_paquete: str | None = None
    descripcion: str | None = None
    duracion_dias: int | None = Field(None, gt=0)
    precio_base: float | None = Field(None, ge=0)
    activo: bool | None = None
    ciudad_salida: str | None = Field(None, max_length=100)
    condiciones: str | None = Field(None, max_length=5000)
    # None = no tocar servicios ya vinculados; [] = quitar todos — mismo
    # patrón exclude_unset ya usado para "hoteles".
    servicios: list[PaqueteServicioInput] | None = None
    # None = no se mandó, no tocar los hoteles ya vinculados (mismo patrón
    # de exclude_unset ya usado para reactivar solo con {activo: true});
    # [] = sí se mandó, y significa "quitar todos los hoteles".
    hoteles: list[PaqueteHotelInput] | None = None


class PaqueteResponse(BaseModel):
    id_paquete: int
    nombre_paquete: str
    descripcion: str | None
    duracion_dias: int | None
    precio_base: float
    activo: bool
    ciudad_salida: str | None = None
    condiciones: str | None = None
    # Calculada (Paquete.ciudad_destino), no una columna — ver el property
    # en el modelo. None si el paquete no tiene ningún hotel vinculado.
    ciudad_destino: str | None = None
    # Portada del paquete (mismo patrón que Hotel.imagen_url) -- antes
    # Paquete no tenía ningún campo de imagen propio, ver POST
    # /paquetes/{id}/imagen en reserva_route.py.
    imagen_url: str | None = None

    class Config:
        from_attributes = True


class PaqueteHotelDetalle(BaseModel):
    id_hotel: int
    nombre_hotel: str
    ciudad: str | None = None
    pais: str | None = None
    calificacion: int | None = None
    noches_incluidas: int | None = None
    caracteristicas: list[str] = []
    # Antes la ficha de paquete usaba una foto genérica por ciudad
    # (CITY_IMAGES en el frontend) en vez de la foto real del hotel incluido
    # -- ya se cargaba el objeto Hotel completo acá mismo (ver
    # get_paquete_detalle), así que exponerla es solo este campo.
    imagen_url: str | None = None


class PaqueteServicioDetalle(BaseModel):
    id_servicio: int
    nombre_servicio: str
    categoria: str | None = None
    descripcion: str | None = None
    dia_actividad: int | None = None
    incluido: bool = True
    # Para cuántas personas alcanza este servicio — info comercial real que
    # ya vive en Servicio.capacidad_maxima, antes nunca viajaba hasta acá.
    capacidad_maxima: int | None = None


class PaqueteDetalleResponse(PaqueteResponse):
    """PaqueteResponse enriquecido con destinos, hoteles y servicios reales
    — usado por GET /paquetes/{id}/detalle para la página de detalle del
    frontend, que antes mostraba datos de ejemplo hardcodeados en
    data/packages.ts (nombres de hoteles, vuelos y horarios inventados)."""

    destinos: list[str] = []
    hoteles: list[PaqueteHotelDetalle] = []
    servicios: list[PaqueteServicioDetalle] = []
    # Galería de fotos reales del paquete (distinta de imagen_url, la
    # portada) -- ver ImagenPaquete en reserva_model.py.
    imagenes: list[ImagenGaleriaResponse] = []


class MetodoPagoCreate(BaseModel):
    nombre_metodo: str = Field(..., min_length=1, max_length=50)


class MetodoPagoResponse(BaseModel):
    id_metodo: int
    nombre_metodo: str
    codigo: str

    class Config:
        from_attributes = True


class PagoCreate(BaseModel):
    id_reserva: int
    id_metodo_pago: int
    monto: float = Field(..., ge=0)
    referencia: str | None = Field(None, max_length=100)


class PagoUpdate(BaseModel):
    monto: float | None = Field(None, ge=0)
    referencia: str | None = None
    estado: str | None = None

    @field_validator("estado")
    @classmethod
    def validate_estado(cls, v):
        if v and v not in ["pendiente", "procesando", "pagado", "rechazado", "cancelado"]:
            raise ValueError("estado debe ser: pendiente, procesando, pagado, rechazado o cancelado")
        return v


class PagoResponse(BaseModel):
    id_pago: int
    id_reserva: int
    id_metodo_pago: int
    monto: float
    fecha_pago: datetime
    referencia: str | None
    estado: str
    numero_factura: str | None = None
    comprobante_url: str | None = None
    celular_nequi: str | None = None
    metodo_pago: MetodoPagoResponse | None = None

    class Config:
        from_attributes = True


# ===================== NUEVO: Habitación dentro de una reserva =====================


class HabitacionReservaCreate(BaseModel):
    """Una habitación específica que el cliente quiere reservar dentro de la reserva."""

    id_habitacion: int
    fecha_checkin: FechaValida
    fecha_checkout: FechaValida

    @field_validator("fecha_checkout")
    @classmethod
    def validate_fechas_habitacion(cls, v, info):
        if "fecha_checkin" in info.data and v <= info.data["fecha_checkin"]:
            raise ValueError("fecha_checkout debe ser posterior a fecha_checkin")
        return v


class HabitacionReservaResponse(BaseModel):
    id_habitacion: int
    fecha_checkin: date
    fecha_checkout: date
    precio_acordado: float | None = None

    class Config:
        from_attributes = True


class ReservaCreate(BaseModel):
    id_cliente: int
    id_empleado: int | None = None
    id_paquete: int | None = None
    fecha_inicio: FechaValida
    fecha_fin: FechaValida
    numero_personas: int = Field(..., gt=0)
    # Versión de los términos aceptada en el checkout (evidencia de
    # consentimiento); la fecha la pone el servidor.
    terminos_version: str | None = Field(None, max_length=40)
    # NUEVO: habitaciones reales que se están reservando (precio se calcula en backend, no se confía en el frontend)
    habitaciones: list[HabitacionReservaCreate] | None = None

    @field_validator("fecha_fin")
    @classmethod
    def validate_fechas(cls, v, info):
        if "fecha_inicio" in info.data and v <= info.data["fecha_inicio"]:
            raise ValueError("fecha_fin debe ser posterior a fecha_inicio")
        return v


class ReservaUpdate(BaseModel):
    id_paquete: int | None = None
    fecha_inicio: FechaValida | None = None
    fecha_fin: FechaValida | None = None
    numero_personas: int | None = Field(None, gt=0)
    estado: str | None = None

    @field_validator("estado")
    @classmethod
    def validate_estado(cls, v):
        if v and v not in ["pendiente", "confirmada", "cancelada", "finalizada"]:
            raise ValueError("estado debe ser: pendiente, confirmada, cancelada o finalizada")
        return v


class ReservaResponse(BaseModel):
    id_reserva: int
    id_cliente: int
    id_empleado: int | None
    id_paquete: int | None
    fecha_reserva: datetime
    fecha_inicio: date
    fecha_fin: date
    numero_personas: int
    estado: str
    precio_total: float = 0
    # Suma de pagos aprobados y lo que falta por pagar (Reserva.total_pagado /
    # Reserva.saldo_pendiente) -- para mostrar "Pagar saldo" tras el anticipo.
    total_pagado: float = 0
    saldo_pendiente: float = 0
    # Nombre del paquete y destino (ciudad/país del hotel), calculados en
    # Reserva.nombre_paquete / Reserva.destino — para que el historial de
    # reservas del frontend no tenga que mostrar solo el id_paquete crudo.
    nombre_paquete: str | None = None
    destino: str | None = None
    # Nombre del hotel — respaldo para cuando la reserva no tiene paquete
    # (reserva directa de habitación, id_paquete nulo): ver Reserva.hotel_nombre.
    hotel_nombre: str | None = None
    # Fecha del último cambio de estado registrado en historial_reservas (o
    # fecha_reserva si aún no hay historial) — ver Reserva.fecha_ultima_actualizacion.
    # Usado por la columna "Última actualización" del panel de admin.
    fecha_ultima_actualizacion: datetime | None = None
    # BUG real corregido: esta columna ya existía en el modelo (Reserva.canal_origen)
    # pero solo se exponía en ReservaDetailResponse, nunca en la lista base — el
    # resultado era que GET /reservas (el que usa la tabla del panel de admin)
    # siempre mandaba canal_origen=None, y el frontend lo interpretaba como "web"
    # para TODAS las filas sin importar el valor real en la base de datos.
    canal_origen: str | None = None
    # BUG real corregido: ReservaResponse nunca declaraba `pagos`, aunque el
    # modelo Reserva sí tiene la relación (Reserva.pagos) y PagoResponse ya
    # incluye numero_factura/comprobante_url/metodo_pago. GET /reservas/cliente
    # (el que usa TabFacturas.tsx en el perfil del cliente) siempre devolvía
    # reserva.pagos == undefined en el frontend, así que el tab de Facturas
    # se veía siempre vacío aunque el cliente tuviera pagos confirmados con
    # factura real -- nunca fue un problema del componente, sino de este
    # schema. Ver ReservaRepository.get_all/get_by_cliente para el eager
    # load agregado (selectinload) que evita N+1 al resolver esto por fila.
    pagos: list[PagoResponse] = []

    class Config:
        from_attributes = True


class AsesorResponse(BaseModel):
    """Datos mínimos del empleado asignado a la reserva (sin cédula ni
    fecha de contratación — esto lo ve el cliente en el popup de su reserva)."""

    id_empleado: int
    nombre: str
    apellido: str
    correo_electronico: str | None = None
    celular: str | None = None

    class Config:
        from_attributes = True


class PagarRequest(BaseModel):
    id_metodo_pago: int
    tipo_pago: str = "completo"

    # Cuando se paga con un método GUARDADO en la billetera del cliente
    # (MetodoPagoGuardado), el frontend envía su id. El backend entonces
    # ignora los campos de pago que envíe el cliente y usa los datos REALES
    # del método guardado (ver pagar_reserva) — así el backend no confía en
    # un ultimos4/celular/documento arbitrario del navegador.
    id_metodo_guardado: int | None = Field(None)

    # Campos especificos por metodo — nunca se envia el numero completo de
    # tarjeta ni datos sensibles reales, todo esto es simulado:
    ultimos4: str | None = Field(None, max_length=4, min_length=4)  # tarjeta
    celular: str | None = Field(None, max_length=15)  # nequi
    banco: str | None = Field(None, max_length=100)  # pse
    documento: str | None = Field(None, max_length=20)  # pse

    @field_validator("tipo_pago")
    @classmethod
    def validate_tipo_pago(cls, v):
        # 'saldo' = lo que falta tras el anticipo del 50% (ver pagar_reserva).
        if v not in ("completo", "parcial", "saldo"):
            raise ValueError("tipo_pago debe ser: completo, parcial o saldo")
        return v


class PagarResponse(BaseModel):
    pago: PagoResponse
    reserva: ReservaResponse


class ReservaDetailResponse(ReservaResponse):
    paquete: PaqueteResponse | None = None
    # OJO: el modelo SQLAlchemy llama a esta relación "reserva_habitaciones", por eso el alias.
    habitaciones: list[HabitacionReservaResponse] = Field(default=[], validation_alias="reserva_habitaciones")
    empleado: AsesorResponse | None = None
    # canal_origen y pagos ya vienen heredados de ReservaResponse (ver
    # arriba) — se quitó la redeclaración duplicada que había acá.

    class Config:
        from_attributes = True
        populate_by_name = True
