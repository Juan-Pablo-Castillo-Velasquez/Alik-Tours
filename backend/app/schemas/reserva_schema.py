from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.hotel_schema import ImagenGaleriaResponse
from app.schemas.validadores import FechaValida
from app.schemas.vuelo_schema import OfertaVueloResponse

ModalidadAlojamiento = Literal["sin", "incluido", "opcional"]
ModalidadVuelo = Literal["sin", "incluido", "opcional", "cotizacion"]
UnidadPrecio = Literal["por_persona", "por_paquete"]
CategoriaInclusion = Literal[
    "alojamiento",
    "desayuno",
    "alimentacion",
    "transporte_terrestre",
    "transporte_aereo",
    "actividades",
    "entradas",
    "guia",
    "traslados",
    "seguro",
    "gastos_personales",
    "equipaje",
    "impuestos",
    "otro",
]


class ItinerarioDiaInput(BaseModel):
    dia: int = Field(..., gt=0, le=60)
    titulo: str = Field(..., min_length=2, max_length=150)
    descripcion: str | None = Field(None, max_length=3000)
    actividades: str | None = Field(None, max_length=3000)
    horario: str | None = Field(None, max_length=120)
    lugar: str | None = Field(None, max_length=150)
    informacion_adicional: str | None = Field(None, max_length=2000)


class ItinerarioDiaResponse(ItinerarioDiaInput):
    id_dia: int
    model_config = ConfigDict(from_attributes=True)


class InclusionInput(BaseModel):
    tipo: Literal["incluye", "no_incluye"]
    categoria: CategoriaInclusion
    descripcion: str = Field(..., min_length=2, max_length=500)


class InclusionResponse(InclusionInput):
    id_inclusion: int
    orden: int = 0
    model_config = ConfigDict(from_attributes=True)


class SalidaInput(BaseModel):
    id_salida: int | None = None  # para conservar la salida al editar (tiene reservas)
    fecha_salida: FechaValida
    fecha_regreso: FechaValida | None = None
    cupos: int | None = Field(None, ge=0, le=10000)
    estado: Literal["abierta", "cerrada"] = "abierta"
    notas: str | None = Field(None, max_length=255)

    @model_validator(mode="after")
    def _fechas(self):
        if self.fecha_regreso and self.fecha_regreso < self.fecha_salida:
            raise ValueError("La fecha de regreso no puede ser antes de la salida")
        return self


class SalidaResponse(BaseModel):
    id_salida: int
    fecha_salida: date
    fecha_regreso: date | None = None
    cupos: int | None = None
    estado: str
    notas: str | None = None
    cupos_usados: int = 0
    cupos_disponibles: int | None = None
    model_config = ConfigDict(from_attributes=True)


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


class _FichaPaquete(BaseModel):
    """Campos de la ficha comercial completa (todos opcionales)."""

    noches: int | None = Field(None, ge=0, le=60)
    destino_ciudad: str | None = Field(None, max_length=100)
    destino_pais: str | None = Field(None, max_length=100)
    destinos_secundarios: str | None = Field(None, max_length=255)
    categoria: str | None = Field(None, max_length=60)
    vigencia_desde: FechaValida | None = None
    vigencia_hasta: FechaValida | None = None
    modalidad_alojamiento: ModalidadAlojamiento | None = None
    modalidad_vuelo: ModalidadVuelo | None = None
    unidad_precio: UnidadPrecio | None = None
    precio_nino: float | None = Field(None, ge=0)
    precio_infante: float | None = Field(None, ge=0)
    min_viajeros: int | None = Field(None, gt=0, le=500)
    max_viajeros: int | None = Field(None, gt=0, le=500)
    itinerario: list[ItinerarioDiaInput] | None = None
    inclusiones: list[InclusionInput] | None = None
    salidas: list[SalidaInput] | None = None
    # ids de ofertas aéreas asociadas
    vuelos: list[int] | None = None

    @model_validator(mode="after")
    def _coherencia_ficha(self):
        if self.vigencia_desde and self.vigencia_hasta and self.vigencia_hasta < self.vigencia_desde:
            raise ValueError("La vigencia termina antes de empezar")
        if self.min_viajeros and self.max_viajeros and self.max_viajeros < self.min_viajeros:
            raise ValueError("El máximo de viajeros no puede ser menor que el mínimo")
        if self.itinerario:
            dias = [d.dia for d in self.itinerario]
            if len(dias) != len(set(dias)):
                raise ValueError("Hay días repetidos en el itinerario")
        return self


class PaqueteCreate(_FichaPaquete):
    nombre_paquete: str = Field(..., min_length=1, max_length=100)
    descripcion: str | None = None
    duracion_dias: int | None = Field(None, gt=0)
    precio_base: float = Field(..., ge=0)
    activo: bool = True
    # Ciudad de salida del viaje (vuelo/transporte) — distinta de la ciudad
    # de destino, que se deriva de los hoteles reales vinculados.
    ciudad_salida: str | None = Field(None, max_length=100)
    condiciones: str | None = Field(None, max_length=5000)
    no_incluye: str | None = Field(None, max_length=3000)
    hoteles: list[PaqueteHotelInput] | None = None
    servicios: list[PaqueteServicioInput] | None = None


class PaqueteUpdate(_FichaPaquete):
    nombre_paquete: str | None = None
    descripcion: str | None = None
    duracion_dias: int | None = Field(None, gt=0)
    precio_base: float | None = Field(None, ge=0)
    activo: bool | None = None
    ciudad_salida: str | None = Field(None, max_length=100)
    condiciones: str | None = Field(None, max_length=5000)
    no_incluye: str | None = Field(None, max_length=3000)
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
    no_incluye: str | None = None
    # Calculada (Paquete.ciudad_destino), no una columna — ver el property
    # en el modelo. None si el paquete no tiene ningún hotel vinculado.
    ciudad_destino: str | None = None
    # Portada del paquete (mismo patrón que Hotel.imagen_url) -- antes
    # Paquete no tenía ningún campo de imagen propio, ver POST
    # /paquetes/{id}/imagen en reserva_route.py.
    imagen_url: str | None = None
    noches: int | None = None
    destino_ciudad: str | None = None
    destino_pais: str | None = None
    destinos_secundarios: str | None = None
    categoria: str | None = None
    vigencia_desde: date | None = None
    vigencia_hasta: date | None = None
    modalidad_alojamiento: str = "sin"
    modalidad_vuelo: str = "sin"
    unidad_precio: str = "por_persona"
    precio_nino: float | None = None
    precio_infante: float | None = None
    min_viajeros: int | None = None
    max_viajeros: int | None = None

    model_config = ConfigDict(from_attributes=True)


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
    # Precio por persona si es opcional (se cobra aparte al agregarlo).
    precio_por_persona: float | None = None


class PaqueteDetalleResponse(PaqueteResponse):
    """PaqueteResponse enriquecido con destinos, hoteles y servicios reales
    — usado por GET /paquetes/{id}/detalle para la página de detalle del
    frontend, que antes mostraba datos de ejemplo hardcodeados en
    data/packages.ts (nombres de hoteles, vuelos y horarios inventados)."""

    destinos: list[str] = []
    hoteles: list[PaqueteHotelDetalle] = []
    servicios: list[PaqueteServicioDetalle] = []
    itinerario: list[ItinerarioDiaResponse] = []
    inclusiones: list[InclusionResponse] = []
    salidas: list[SalidaResponse] = []
    vuelos: list[OfertaVueloResponse] = []
    # Galería de fotos reales del paquete (distinta de imagen_url, la
    # portada) -- ver ImagenPaquete en reserva_model.py.
    imagenes: list[ImagenGaleriaResponse] = []


class MetodoPagoCreate(BaseModel):
    nombre_metodo: str = Field(..., min_length=1, max_length=50)


class MetodoPagoResponse(BaseModel):
    id_metodo: int
    nombre_metodo: str
    codigo: str

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


class ViajeroInput(BaseModel):
    tipo: Literal["adulto", "nino", "infante"]
    nombres: str = Field(..., min_length=1, max_length=100)
    apellidos: str = Field(..., min_length=1, max_length=100)
    fecha_nacimiento: FechaValida | None = None
    nacionalidad: str | None = Field(None, max_length=60)
    tipo_documento: str | None = Field(None, max_length=30)
    numero_documento: str | None = Field(None, max_length=30, pattern=r"^[A-Za-z0-9.\- ]*$")
    es_titular: bool = False


class ViajeroResponse(BaseModel):
    id_viajero: int
    tipo: str
    nombres: str
    apellidos: str
    fecha_nacimiento: date | None = None
    nacionalidad: str | None = None
    tipo_documento: str | None = None
    numero_documento: str | None = None
    es_titular: bool = False
    model_config = ConfigDict(from_attributes=True)


class DescuentoInput(BaseModel):
    """Descuento autorizado (solo administración) — queda en el desglose y
    en el historial con su motivo."""

    monto: float = Field(..., gt=0)
    motivo: str = Field(..., min_length=3, max_length=200)


class SeleccionProducto(BaseModel):
    """Lo que el cliente (o el asesor) eligió. Es la entrada del cotizador:
    el precio SIEMPRE lo calcula el backend a partir de esto."""

    tipo_producto: Literal["hotel", "paquete", "vuelo"]
    id_paquete: int | None = None
    id_salida: int | None = None
    id_oferta_vuelo: int | None = None
    incluir_vuelo: bool = False
    fecha_inicio: FechaValida | None = None
    fecha_fin: FechaValida | None = None
    adultos: int = Field(1, ge=1, le=50)
    ninos: int = Field(0, ge=0, le=50)
    infantes: int = Field(0, ge=0, le=20)
    habitaciones: list[HabitacionReservaCreate] = []
    servicios_opcionales: list[int] = []
    descuento: DescuentoInput | None = None

    @model_validator(mode="after")
    def _coherencia(self):
        if self.tipo_producto == "paquete" and not self.id_paquete:
            raise ValueError("Elige el paquete")
        if self.tipo_producto == "vuelo" and not self.id_oferta_vuelo:
            raise ValueError("Elige la oferta aérea")
        if self.tipo_producto == "hotel" and not self.habitaciones:
            raise ValueError("Elige al menos una habitación")
        if self.infantes > self.adultos:
            raise ValueError("Cada infante debe viajar con un adulto")
        if self.fecha_inicio and self.fecha_fin and self.fecha_fin < self.fecha_inicio:
            raise ValueError("La fecha final no puede ser antes de la inicial")
        if len(set(self.servicios_opcionales)) != len(self.servicios_opcionales):
            raise ValueError("Hay servicios opcionales repetidos")
        return self


class ConceptoResponse(BaseModel):
    tipo: str
    descripcion: str
    cantidad: int
    precio_unitario: float
    subtotal: float
    incluido: bool = False
    model_config = ConfigDict(from_attributes=True)


class CotizacionResponse(BaseModel):
    tipo_producto: str
    fecha_inicio: date
    fecha_fin: date
    noches: int
    adultos: int
    ninos: int
    infantes: int
    conceptos: list[ConceptoResponse]
    total: float
    estado_vuelo: str | None = None
    advertencias: list[str] = []


class ReservaCreate(BaseModel):
    id_cliente: int
    id_empleado: int | None = None
    id_paquete: int | None = None
    # Obligatorias en el flujo anterior; en el nuevo (tipo_producto) las
    # calcula el backend según el producto.
    fecha_inicio: FechaValida | None = None
    fecha_fin: FechaValida | None = None
    numero_personas: int | None = Field(None, gt=0)
    # Versión de los términos aceptada en el checkout (evidencia de
    # consentimiento); la fecha la pone el servidor.
    terminos_version: str | None = Field(None, max_length=40)
    # Una por intento de reserva (ver Reserva.clave_idempotencia).
    clave_idempotencia: str | None = Field(None, min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    # Habitaciones reales que se reservan (precio calculado en backend).
    habitaciones: list[HabitacionReservaCreate] | None = None
    # --- Flujo nuevo: desglose, viajeros, vuelo ---
    tipo_producto: Literal["hotel", "paquete", "vuelo"] | None = None
    id_salida: int | None = None
    id_oferta_vuelo: int | None = None
    incluir_vuelo: bool = False
    adultos: int | None = Field(None, ge=1, le=50)
    ninos: int = Field(0, ge=0, le=50)
    infantes: int = Field(0, ge=0, le=20)
    servicios_opcionales: list[int] = []
    viajeros: list[ViajeroInput] = Field(default=[], max_length=120)
    solicitudes_especiales: str | None = Field(None, max_length=2000)
    notas_internas: str | None = Field(None, max_length=4000)  # solo staff
    descuento: DescuentoInput | None = None  # solo staff
    # Total que vio el cliente: si el precio cambió entretanto, 409.
    precio_esperado: float | None = Field(None, ge=0)
    estado_inicial: Literal["pendiente", "confirmada"] | None = None  # solo staff

    @model_validator(mode="after")
    def validate_fechas(self):
        if self.tipo_producto is None:
            # Flujo anterior: fechas y personas obligatorias, como siempre.
            if self.fecha_inicio is None or self.fecha_fin is None:
                raise ValueError("fecha_inicio y fecha_fin son obligatorias")
            if self.numero_personas is None:
                raise ValueError("numero_personas es obligatorio")
            if self.fecha_fin <= self.fecha_inicio:
                raise ValueError("fecha_fin debe ser posterior a fecha_inicio")
        return self

    def seleccion(self) -> SeleccionProducto:
        return SeleccionProducto(
            tipo_producto=self.tipo_producto,
            id_paquete=self.id_paquete,
            id_salida=self.id_salida,
            id_oferta_vuelo=self.id_oferta_vuelo,
            incluir_vuelo=self.incluir_vuelo,
            fecha_inicio=self.fecha_inicio,
            fecha_fin=self.fecha_fin,
            adultos=self.adultos or self.numero_personas or 1,
            ninos=self.ninos,
            infantes=self.infantes,
            habitaciones=self.habitaciones or [],
            servicios_opcionales=self.servicios_opcionales,
            descuento=self.descuento,
        )


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
    # Ruta del vuelo (reservas de vuelo o paquetes con vuelo).
    vuelo_ruta: str | None = None
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

    tipo_producto: str | None = None
    adultos: int | None = None
    ninos: int | None = None
    infantes: int | None = None
    id_salida: int | None = None
    id_oferta_vuelo: int | None = None
    estado_vuelo: str | None = None
    solicitudes_especiales: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AsesorResponse(BaseModel):
    """Datos mínimos del empleado asignado a la reserva (sin cédula ni
    fecha de contratación — esto lo ve el cliente en el popup de su reserva)."""

    id_empleado: int
    nombre: str
    apellido: str
    correo_electronico: str | None = None
    celular: str | None = None

    model_config = ConfigDict(from_attributes=True)


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
    conceptos: list[ConceptoResponse] = []
    viajeros: list[ViajeroResponse] = []
    salida: SalidaResponse | None = None
    oferta_vuelo: OfertaVueloResponse | None = None
    snapshot_producto: dict | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ReservaDetailAdminResponse(ReservaDetailResponse):
    """Igual que el detalle del cliente + notas internas (solo staff)."""

    notas_internas: str | None = None


class NotasInternasUpdate(BaseModel):
    notas_internas: str | None = Field(None, max_length=4000)


class CotizacionVueloInput(BaseModel):
    """La agencia confirma el precio de un vuelo que estaba 'sujeto a
    cotización'. Queda como un concepto del desglose y en el historial."""

    precio_total: float = Field(..., gt=0)
    descripcion: str = Field(..., min_length=3, max_length=200)
    id_oferta_vuelo: int | None = None
