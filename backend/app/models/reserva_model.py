from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.core.database import Base


class Paquete(Base):
    __tablename__ = "paquetes"

    id_paquete = Column(Integer, primary_key=True, index=True)
    nombre_paquete = Column(String(100), nullable=False)
    descripcion = Column(Text)
    duracion_dias = Column(Integer)
    precio_base = Column(Numeric(10, 2), CheckConstraint("precio_base >= 0"), nullable=False)
    activo = Column(Boolean, default=True)
    # Ciudad de SALIDA del viaje (vuelo/transporte incluido), distinta de la
    # ciudad de DESTINO (esa se deriva de paquete_hotel -> Hotel.ciudad). Sin
    # este campo no había forma de avisar que un paquete armado para salir
    # de Bogotá no le sirve tal cual a un cliente que vive en Barranquilla.
    ciudad_salida = Column(String(100), nullable=True)
    # Imagen de portada del paquete (mismo patrón que Hotel.imagen_url) --
    # antes Paquete no tenía NINGÚN campo de imagen propio, así que la
    # ficha pública siempre usaba la foto del hotel incluido (ver
    # getHotelImage en PackageDetail.tsx, que se mantiene como respaldo
    # para los paquetes sin portada propia todavía). Ver POST
    # /paquetes/{id}/imagen en reserva_route.py.
    imagen_url = Column(String(255), nullable=True)
    # Condiciones del paquete (requisitos, cambios, no reembolsables,
    # documentos...) administradas desde el panel. Nullable: se omite en
    # la vista pública si está vacío.
    condiciones = Column(Text, nullable=True)
    # Qué NO incluye el paquete (vuelos, tasas, comidas...), una línea por
    # ítem. Informar las exclusiones antes de la compra (Ley 1480).
    no_incluye = Column(Text, nullable=True)

    # --- Ficha comercial completa (todo nullable / con default: los
    # paquetes existentes siguen funcionando igual) ---
    noches = Column(Integer, CheckConstraint("noches IS NULL OR noches >= 0", name="ck_paquete_noches"))
    destino_ciudad = Column(String(100))
    destino_pais = Column(String(100))
    destinos_secundarios = Column(String(255))
    categoria = Column(String(60))
    vigencia_desde = Column(Date)
    vigencia_hasta = Column(Date)
    # sin | incluido | opcional
    modalidad_alojamiento = Column(
        String(20),
        CheckConstraint("modalidad_alojamiento IN ('sin', 'incluido', 'opcional')", name="ck_paquete_mod_aloj"),
        nullable=False,
        default="sin",
        server_default="sin",
    )
    # sin | incluido | opcional | cotizacion
    modalidad_vuelo = Column(
        String(20),
        CheckConstraint(
            "modalidad_vuelo IN ('sin', 'incluido', 'opcional', 'cotizacion')", name="ck_paquete_mod_vuelo"
        ),
        nullable=False,
        default="sin",
        server_default="sin",
    )
    # por_persona: precio_base es por adulto | por_paquete: precio único del paquete
    unidad_precio = Column(
        String(20),
        CheckConstraint("unidad_precio IN ('por_persona', 'por_paquete')", name="ck_paquete_unidad_precio"),
        nullable=False,
        default="por_persona",
        server_default="por_persona",
    )
    # None = el niño paga tarifa de adulto; los infantes solo se aceptan si
    # hay tarifa de infante configurada (puede ser 0).
    precio_nino = Column(
        Numeric(10, 2), CheckConstraint("precio_nino IS NULL OR precio_nino >= 0", name="ck_paquete_precio_nino")
    )
    precio_infante = Column(
        Numeric(10, 2),
        CheckConstraint("precio_infante IS NULL OR precio_infante >= 0", name="ck_paquete_precio_infante"),
    )
    min_viajeros = Column(Integer, CheckConstraint("min_viajeros IS NULL OR min_viajeros > 0", name="ck_paquete_min"))
    max_viajeros = Column(Integer, CheckConstraint("max_viajeros IS NULL OR max_viajeros > 0", name="ck_paquete_max"))

    paquete_servicios = relationship("PaqueteServicio", back_populates="paquete", cascade="all, delete-orphan")
    paquete_vuelos = relationship("PaqueteVuelo", back_populates="paquete", cascade="all, delete-orphan")
    itinerario = relationship(
        "ItinerarioDia", back_populates="paquete", cascade="all, delete-orphan", order_by="ItinerarioDia.dia"
    )
    inclusiones = relationship(
        "PaqueteInclusion", back_populates="paquete", cascade="all, delete-orphan", order_by="PaqueteInclusion.orden"
    )
    salidas = relationship(
        "SalidaPaquete", back_populates="paquete", cascade="all, delete-orphan", order_by="SalidaPaquete.fecha_salida"
    )
    paquete_hotel = relationship("PaqueteHotel", back_populates="paquete", cascade="all, delete-orphan")
    reservas = relationship("Reserva", back_populates="paquete")
    # Galería de fotos reales del paquete (distinta de imagen_url, la
    # portada) -- ver ImagenPaquete más abajo y POST/DELETE
    # /paquetes/{id}/galeria en reserva_route.py.
    imagenes = relationship(
        "ImagenPaquete", back_populates="paquete", cascade="all, delete-orphan", order_by="ImagenPaquete.orden"
    )

    @property
    def ciudad_destino(self):
        """Ciudad de destino real, tomada del primer hotel vinculado
        (paquete_hotel -> Hotel.ciudad) — mismo patrón que
        Hotel.total_resenas/calificacion_promedio (propiedad calculada,
        no una columna nueva). None si el paquete todavía no tiene ningún
        hotel real asociado. Se expone en PaqueteResponse para que el
        picker de Crear Reserva pueda mostrar salida Y destino sin pedir
        el detalle completo de cada paquete uno por uno."""
        for ph in self.paquete_hotel:
            if ph.hotel and ph.hotel.ciudad:
                return ph.hotel.ciudad
        return None


class PaqueteServicio(Base):
    __tablename__ = "paquete_servicios"

    id_paquete = Column(Integer, ForeignKey("paquetes.id_paquete", ondelete="CASCADE"), primary_key=True)
    id_servicio = Column(Integer, ForeignKey("servicios.id_servicio", ondelete="CASCADE"), primary_key=True)
    dia_actividad = Column(Integer)
    incluido = Column(Boolean, default=True)

    paquete = relationship("Paquete", back_populates="paquete_servicios")
    servicio = relationship("Servicio", back_populates="paquete_servicios")


class PaqueteHotel(Base):
    __tablename__ = "paquete_hotel"

    id_paquete = Column(Integer, ForeignKey("paquetes.id_paquete", ondelete="CASCADE"), primary_key=True)
    id_hotel = Column(Integer, ForeignKey("hoteles.id_hotel", ondelete="CASCADE"), primary_key=True)
    noches_incluidas = Column(Integer)

    paquete = relationship("Paquete", back_populates="paquete_hotel")
    hotel = relationship("Hotel")


class ItinerarioDia(Base):
    """Un día del itinerario real del paquete (lo define el admin; nunca se
    genera automáticamente)."""

    __tablename__ = "itinerario_paquete"

    id_dia = Column(Integer, primary_key=True, index=True)
    id_paquete = Column(Integer, ForeignKey("paquetes.id_paquete", ondelete="CASCADE"), nullable=False, index=True)
    dia = Column(Integer, CheckConstraint("dia > 0", name="ck_itinerario_dia"), nullable=False)
    titulo = Column(String(150), nullable=False)
    descripcion = Column(Text)
    actividades = Column(Text)  # una por línea
    horario = Column(String(120))
    lugar = Column(String(150))
    informacion_adicional = Column(Text)

    paquete = relationship("Paquete", back_populates="itinerario")


CATEGORIAS_INCLUSION = (
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
)


class PaqueteInclusion(Base):
    """Qué incluye / qué NO incluye el paquete, ítem por ítem y con su
    descripción propia (reemplaza a futuro el texto libre `no_incluye`, que
    se sigue mostrando mientras el paquete no tenga ítems estructurados)."""

    __tablename__ = "paquete_inclusiones"
    __table_args__ = (
        CheckConstraint("tipo IN ('incluye', 'no_incluye')", name="ck_inclusion_tipo"),
        CheckConstraint(f"categoria IN {CATEGORIAS_INCLUSION}", name="ck_inclusion_categoria"),
    )

    id_inclusion = Column(Integer, primary_key=True, index=True)
    id_paquete = Column(Integer, ForeignKey("paquetes.id_paquete", ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(String(12), nullable=False)
    categoria = Column(String(30), nullable=False)
    descripcion = Column(String(500), nullable=False)
    orden = Column(Integer, nullable=False, default=0)

    paquete = relationship("Paquete", back_populates="inclusiones")


class SalidaPaquete(Base):
    """Fecha de salida programada con cupos. Si un paquete no tiene salidas,
    el cliente elige la fecha de inicio (dentro de la vigencia)."""

    __tablename__ = "salidas_paquete"
    __table_args__ = (
        CheckConstraint("cupos IS NULL OR cupos >= 0", name="ck_salida_cupos"),
        CheckConstraint("fecha_regreso IS NULL OR fecha_regreso >= fecha_salida", name="ck_salida_fechas"),
        CheckConstraint("estado IN ('abierta', 'cerrada')", name="ck_salida_estado"),
    )

    id_salida = Column(Integer, primary_key=True, index=True)
    id_paquete = Column(Integer, ForeignKey("paquetes.id_paquete", ondelete="CASCADE"), nullable=False, index=True)
    fecha_salida = Column(Date, nullable=False)
    fecha_regreso = Column(Date)
    cupos = Column(Integer)
    estado = Column(String(10), nullable=False, default="abierta")
    notas = Column(String(255))

    paquete = relationship("Paquete", back_populates="salidas")


class ImagenPaquete(Base):
    """Una foto de la galería de un paquete turístico (distinta de
    Paquete.imagen_url, que es solo la portada) -- mismo patrón que
    ImagenHotel en hotel_model.py. `orden` es la posición en que el admin
    las subió/organizó (ver POST/DELETE /paquetes/{id}/galeria en
    reserva_route.py)."""

    __tablename__ = "imagenes_paquete"

    id_imagen = Column(Integer, primary_key=True, index=True)
    id_paquete = Column(Integer, ForeignKey("paquetes.id_paquete", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    orden = Column(Integer, nullable=False, default=0)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())

    paquete = relationship("Paquete", back_populates="imagenes")


class Reserva(Base):
    __tablename__ = "reservas"
    __table_args__ = (
        UniqueConstraint("id_cliente", "clave_idempotencia", name="uq_reserva_cliente_clave_idempotencia"),
    )

    id_reserva = Column(Integer, primary_key=True, index=True)
    id_cliente = Column(Integer, ForeignKey("clientes.id_cliente"), nullable=False)
    id_empleado = Column(Integer, ForeignKey("empleados.id_empleado", ondelete="SET NULL"))
    id_paquete = Column(Integer, ForeignKey("paquetes.id_paquete", ondelete="SET NULL"))
    fecha_reserva = Column(TIMESTAMP, server_default=func.now())
    fecha_inicio = Column(Date)
    fecha_fin = Column(Date)
    numero_personas = Column(Integer, CheckConstraint("numero_personas > 0"), nullable=False)
    estado = Column(
        String(20), CheckConstraint("estado IN ('pendiente', 'confirmada', 'cancelada', 'finalizada')"), nullable=False
    )
    canal_origen = Column(String(20), CheckConstraint("canal_origen IN ('web', 'empleado', 'telefono')"), default="web")
    # Versión de los términos aceptada por el cliente al reservar y cuándo
    # (evidencia de consentimiento). NULL en reservas anteriores o creadas
    # por un asesor.
    terminos_version = Column(String(40), nullable=True)
    terminos_aceptados_en = Column(TIMESTAMP, nullable=True)
    # Clave de idempotencia que manda quien crea la reserva (checkout o
    # panel), una por intento: si el mismo intento llega dos veces (doble
    # clic, reintento tras un corte de red) se devuelve la reserva ya
    # creada en vez de crear otra. Única por cliente.
    clave_idempotencia = Column(String(64), nullable=True)

    # --- Ecosistema de reservas (nullable: las reservas anteriores no los tienen) ---
    # hotel | paquete | vuelo
    tipo_producto = Column(
        String(10),
        CheckConstraint(
            "tipo_producto IS NULL OR tipo_producto IN ('hotel', 'paquete', 'vuelo')", name="ck_reserva_tipo"
        ),
    )
    adultos = Column(Integer, CheckConstraint("adultos IS NULL OR adultos >= 0", name="ck_reserva_adultos"))
    ninos = Column(Integer, CheckConstraint("ninos IS NULL OR ninos >= 0", name="ck_reserva_ninos"))
    infantes = Column(Integer, CheckConstraint("infantes IS NULL OR infantes >= 0", name="ck_reserva_infantes"))
    id_salida = Column(Integer, ForeignKey("salidas_paquete.id_salida", ondelete="SET NULL"), index=True)
    id_oferta_vuelo = Column(Integer, ForeignKey("ofertas_vuelo.id_oferta", ondelete="SET NULL"), index=True)
    # no_aplica | incluido | opcional | cotizacion_pendiente | cotizado
    estado_vuelo = Column(String(25))
    # Lo que pidió el cliente (lo ve él también).
    solicitudes_especiales = Column(Text)
    # Solo para el equipo: NUNCA se manda en respuestas al cliente.
    notas_internas = Column(Text)
    # Fotografía de lo vendido al momento de reservar (nombre, condiciones,
    # qué incluye, vuelo...) para que cambios posteriores del producto no
    # alteren lo que se le vendió al cliente.
    snapshot_producto = Column(JSON)

    cliente = relationship("Cliente", back_populates="reservas")
    empleado = relationship("Empleado", back_populates="reservas")
    paquete = relationship("Paquete", back_populates="reservas")
    reserva_habitaciones = relationship("ReservaHabitacion", back_populates="reserva", cascade="all, delete-orphan")
    reserva_servicios = relationship("ReservaServicio", back_populates="reserva", cascade="all, delete-orphan")
    pagos = relationship("Pago", back_populates="reserva")
    historial_reservas = relationship("HistorialReserva", back_populates="reserva", cascade="all, delete-orphan")
    conceptos = relationship(
        "ReservaConcepto", back_populates="reserva", cascade="all, delete-orphan", order_by="ReservaConcepto.orden"
    )
    viajeros = relationship(
        "ViajeroReserva", back_populates="reserva", cascade="all, delete-orphan", order_by="ViajeroReserva.id_viajero"
    )
    salida = relationship("SalidaPaquete")
    oferta_vuelo = relationship("OfertaVuelo")
    solicitudes_cancelacion = relationship(
        "SolicitudCancelacion", back_populates="reserva", cascade="all, delete-orphan"
    )

    @property
    def precio_total(self) -> float:
        """Total real de la reserva.

        Reservas nuevas: suma del desglose congelado (reserva_conceptos),
        que ya trae paquete, habitaciones, vuelo, extras y descuentos.
        Reservas anteriores (sin desglose): habitaciones + servicios, como
        siempre, para no cambiar retroactivamente ningún total."""
        if self.conceptos:
            return float(round(sum((c.subtotal or 0) for c in self.conceptos), 2))
        total = sum((rh.precio_acordado or 0) for rh in self.reserva_habitaciones)
        total += sum((rs.precio_acordado or 0) for rs in self.reserva_servicios)
        return float(total)

    @property
    def total_pagado(self) -> float:
        """Suma de los pagos aprobados ('pagado') de esta reserva."""
        return float(sum((p.monto or 0) for p in self.pagos if p.estado == "pagado"))

    @property
    def saldo_pendiente(self) -> float:
        """Lo que falta por pagar (0 si ya está cubierta)."""
        return max(round(self.precio_total - self.total_pagado, 2), 0.0)

    @property
    def nombre_paquete(self):
        """Nombre real del paquete reservado, para mostrar en las tarjetas de
        Mis Reservas en vez de solo el id_paquete (ver ReservaCard.tsx)."""
        return self.paquete.nombre_paquete if self.paquete else None

    @property
    def _primer_hotel(self):
        """Hotel de referencia para esta reserva: el del paquete si lo hay,
        y si no (reserva directa de habitación, sin paquete — id_paquete es
        nullable) el de la primera habitación reservada. Usado por
        `destino` y `hotel_nombre` para no depender solo de id_paquete."""
        if self.paquete and self.paquete.paquete_hotel:
            return self.paquete.paquete_hotel[0].hotel
        if self.reserva_habitaciones:
            habitacion = self.reserva_habitaciones[0].habitacion
            return habitacion.hotel if habitacion else None
        return None

    @property
    def destino(self):
        """Ciudad/país del hotel de esta reserva (por paquete o directo),
        para dar contexto rápido en el historial de reservas."""
        hotel = self._primer_hotel
        if not hotel:
            return None
        partes = [p for p in (hotel.ciudad, hotel.pais) if p]
        return ", ".join(partes) if partes else None

    @property
    def hotel_nombre(self):
        """Nombre del hotel de esta reserva — se usa como título de
        respaldo en el frontend cuando la reserva no tiene paquete (reserva
        directa de una habitación), para no mostrar "Paquete #None"."""
        hotel = self._primer_hotel
        return hotel.nombre_hotel if hotel else None

    @property
    def fecha_ultima_actualizacion(self):
        """Fecha del cambio de estado más reciente registrado en
        historial_reservas (pago aprobado, confirmación, cancelación...), o
        la fecha de creación de la reserva si todavía no tiene historial —
        para la columna 'Última actualización' del panel de admin. No
        agrega ninguna columna nueva, usa la relación historial_reservas
        que ya existe."""
        if self.historial_reservas:
            fechas = [h.fecha_cambio for h in self.historial_reservas if h.fecha_cambio]
            if fechas:
                return max(fechas)
        return self.fecha_reserva


class ReservaHabitacion(Base):
    __tablename__ = "reserva_habitaciones"

    id_reserva = Column(Integer, ForeignKey("reservas.id_reserva", ondelete="CASCADE"), primary_key=True)
    id_habitacion = Column(Integer, ForeignKey("habitaciones.id_habitacion"), primary_key=True)
    fecha_checkin = Column(Date)
    fecha_checkout = Column(Date)
    precio_acordado = Column(Numeric(10, 2))

    reserva = relationship("Reserva", back_populates="reserva_habitaciones")
    habitacion = relationship("Habitacion", back_populates="reserva_habitaciones")


class ReservaServicio(Base):
    __tablename__ = "reserva_servicios"

    id_reserva = Column(Integer, ForeignKey("reservas.id_reserva", ondelete="CASCADE"), primary_key=True)
    id_servicio = Column(Integer, ForeignKey("servicios.id_servicio"), primary_key=True)
    fecha_servicio = Column(Date)
    numero_personas = Column(Integer)
    precio_acordado = Column(Numeric(10, 2))

    reserva = relationship("Reserva", back_populates="reserva_servicios")
    servicio = relationship("Servicio", back_populates="reserva_servicios")


TIPOS_CONCEPTO = (
    "paquete",
    "habitacion",
    "alojamiento_incluido",
    "vuelo",
    "vuelo_incluido",
    "vuelo_cotizacion",
    "servicio_opcional",
    "cargo",
    "impuesto",
    "descuento",
)


class ReservaConcepto(Base):
    """Línea del desglose de precio de una reserva, congelada al reservar
    (precio unitario y descripción del momento de la compra). Lo incluido
    en el paquete aparece con subtotal 0 para que el cliente vea que no se
    le cobra dos veces."""

    __tablename__ = "reserva_conceptos"
    __table_args__ = (CheckConstraint(f"tipo IN {TIPOS_CONCEPTO}", name="ck_concepto_tipo"),)

    id_concepto = Column(Integer, primary_key=True, index=True)
    id_reserva = Column(Integer, ForeignKey("reservas.id_reserva", ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(String(25), nullable=False)
    descripcion = Column(String(255), nullable=False)
    cantidad = Column(Integer, nullable=False, default=1)
    precio_unitario = Column(Numeric(12, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    incluido = Column(Boolean, nullable=False, default=False)
    orden = Column(Integer, nullable=False, default=0)
    # Referencias opcionales al producto de origen (trazabilidad).
    id_habitacion = Column(Integer, ForeignKey("habitaciones.id_habitacion", ondelete="SET NULL"))
    id_oferta_vuelo = Column(Integer, ForeignKey("ofertas_vuelo.id_oferta", ondelete="SET NULL"))
    id_servicio = Column(Integer, ForeignKey("servicios.id_servicio", ondelete="SET NULL"))
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())

    reserva = relationship("Reserva", back_populates="conceptos")


class ViajeroReserva(Base):
    """Viajero / pasajero / huésped de una reserva. Solo los datos que pide
    la operación; el documento nunca se escribe en logs y al cliente se le
    devuelve enmascarado."""

    __tablename__ = "viajeros_reserva"
    __table_args__ = (CheckConstraint("tipo IN ('adulto', 'nino', 'infante')", name="ck_viajero_tipo"),)

    id_viajero = Column(Integer, primary_key=True, index=True)
    id_reserva = Column(Integer, ForeignKey("reservas.id_reserva", ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(String(10), nullable=False)
    nombres = Column(String(100), nullable=False)
    apellidos = Column(String(100), nullable=False)
    fecha_nacimiento = Column(Date)
    nacionalidad = Column(String(60))
    tipo_documento = Column(String(30))
    numero_documento = Column(String(30))
    es_titular = Column(Boolean, nullable=False, default=False)

    reserva = relationship("Reserva", back_populates="viajeros")


class MetodoPago(Base):
    __tablename__ = "metodos_pago"

    id_metodo = Column(Integer, primary_key=True, index=True)
    nombre_metodo = Column(String(50), nullable=False)
    # Identificador estable para decidir el flujo de pago simulado sin
    # comparar el nombre en español con regex (ver app/services/payment_service.py).
    # Valores conocidos: tarjeta_credito, tarjeta_debito, pse, nequi, paypal,
    # efectivo, transferencia, cripto, daviplata, cheque, otro.
    codigo = Column(String(30), nullable=False, default="otro")

    pagos = relationship("Pago", back_populates="metodo_pago")


class Pago(Base):
    __tablename__ = "pagos"

    id_pago = Column(Integer, primary_key=True, index=True)
    id_reserva = Column(Integer, ForeignKey("reservas.id_reserva"), nullable=False)
    id_metodo_pago = Column(Integer, ForeignKey("metodos_pago.id_metodo"), nullable=False)
    monto = Column(Numeric(10, 2), CheckConstraint("monto >= 0"), nullable=False)
    fecha_pago = Column(TIMESTAMP, server_default=func.now())
    referencia = Column(String(100))
    # 'procesando' es el estado intermedio que usan PSE y Nequi mientras se
    # simula la confirmacion externa (ver POST /api/pagos/{id}/confirmar).
    estado = Column(
        String(20),
        CheckConstraint("estado IN ('pendiente', 'procesando', 'pagado', 'rechazado', 'cancelado')"),
        nullable=False,
    )
    # Decidido al iniciar el pago (con los valores de prueba de tarjeta,
    # celular o documento) y aplicado al confirmar. No se expone al cliente.
    simular_rechazo = Column(Boolean, nullable=False, default=False)
    # Asignado automáticamente (FAC-000123, a partir del id_pago real) la
    # primera vez que el pago llega a 'pagado' — ver _asignar_numero_factura
    # en reserva_route.py. Nunca un consecutivo separado inventado.
    numero_factura = Column(String(20), unique=True, nullable=True)
    # Voucher/comprobante externo (transferencia, consignación) que el
    # cliente envía por fuera de la plataforma — vía POST /api/pagos/{id}/
    # comprobante (el propio cliente de la reserva o un admin).
    comprobante_url = Column(String(255), nullable=True)
    # Celular Nequi que el cliente escribió en el checkout (ver
    # NequiPayment.tsx) -- antes se usaba solo para decidir la simulación
    # de rechazo (payment_service.py) y se descartaba. Ahora se guarda para
    # que un asesor/admin pueda verificar la transferencia real contra su
    # propia app Nequi antes de confirmar (ver confirmar_pago).
    celular_nequi = Column(String(15), nullable=True)

    reserva = relationship("Reserva", back_populates="pagos")
    metodo_pago = relationship("MetodoPago", back_populates="pagos")


class HistorialReserva(Base):
    __tablename__ = "historial_reservas"

    id_historial = Column(Integer, primary_key=True, index=True)
    id_reserva = Column(Integer, ForeignKey("reservas.id_reserva", ondelete="CASCADE"), nullable=False)
    estado_anterior = Column(String(20))
    estado_nuevo = Column(String(20))
    fecha_cambio = Column(TIMESTAMP, server_default=func.now())
    id_empleado_responsable = Column(Integer, ForeignKey("empleados.id_empleado", ondelete="SET NULL"))
    comentarios = Column(Text)

    reserva = relationship("Reserva", back_populates="historial_reservas")
    empleado_responsable = relationship("Empleado", back_populates="historial_reservas")


class SolicitudCancelacion(Base):
    """
    Solicitud de cancelación enviada por el cliente desde el modal
    'Solicitar cancelación'. Queda en estado 'pendiente' hasta que
    un asesor/admin la evalúa y la aprueba o rechaza.
    """

    __tablename__ = "solicitudes_cancelacion"

    id_solicitud = Column(Integer, primary_key=True, index=True)
    id_reserva = Column(Integer, ForeignKey("reservas.id_reserva", ondelete="CASCADE"), nullable=False)
    id_cliente = Column(Integer, ForeignKey("clientes.id_cliente", ondelete="CASCADE"), nullable=False)

    motivo = Column(String(100), nullable=False)
    motivo_detalle = Column(Text)

    estado = Column(
        String(20),
        CheckConstraint("estado IN ('pendiente', 'aprobada', 'rechazada')"),
        nullable=False,
        default="pendiente",
    )

    fecha_solicitud = Column(TIMESTAMP, server_default=func.now())
    fecha_resolucion = Column(TIMESTAMP)
    id_empleado_resolutor = Column(Integer, ForeignKey("empleados.id_empleado", ondelete="SET NULL"))
    comentario_resolucion = Column(Text)

    reserva = relationship("Reserva", back_populates="solicitudes_cancelacion")
    cliente = relationship("Cliente")
    empleado_resolutor = relationship("Empleado")
