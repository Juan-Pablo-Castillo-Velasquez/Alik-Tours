"""Cotizador único de reservas (hotel, paquete, vuelo).

Toda reserva del flujo nuevo pasa por aquí, tanto para mostrar el precio
(POST /api/reservas/cotizar) como para crearla (POST /api/reservas): así el
total que ve el cliente y el que se guarda salen del MISMO cálculo, siempre
en el backend y con los precios de la base de datos (nunca los del navegador).

Reglas de negocio clave:
- Lo incluido en un paquete (alojamiento, vuelo) aparece en el desglose
  con valor $0: el cliente ve que está incluido y no se cobra dos veces.
- Lo opcional solo se cobra si el cliente lo eligió.
- El vuelo "sujeto a cotización" no suma al total hasta que la agencia lo
  confirma (ver POST /reservas/{id}/cotizacion-vuelo).
- Cupos de salidas y de vuelos, y disponibilidad de habitaciones, se
  verifican con bloqueo de fila al crear (dos clientes no pueden quedarse
  con el último cupo).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import BaseAPIException, CapacidadInsuficienteError
from app.models.hotel_model import Habitacion
from app.models.reserva_model import Paquete, PaqueteServicio, Reserva, SalidaPaquete
from app.models.servicio_model import Servicio
from app.models.vuelo_model import OfertaVuelo

ESTADOS_ACTIVOS = ("pendiente", "confirmada")


class CotizacionError(BaseAPIException):
    """Selección inválida o incompatible con el producto (mensaje para el cliente)."""

    def __init__(self, detail: str, status_code: int = 422, code: str = "COTIZACION_INVALIDA"):
        super().__init__(status_code=status_code, detail=detail, code=code)


class CuposAgotadosError(CotizacionError):
    def __init__(self, detail: str):
        super().__init__(detail, status_code=409, code="CUPOS_AGOTADOS")


@dataclass
class Linea:
    tipo: str
    descripcion: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal
    incluido: bool = False
    id_habitacion: int | None = None
    id_oferta_vuelo: int | None = None
    id_servicio: int | None = None


@dataclass
class HabitacionCotizada:
    habitacion: Habitacion
    fecha_checkin: date
    fecha_checkout: date
    precio_acordado: Decimal


@dataclass
class ServicioCotizado:
    servicio: Servicio
    fecha_servicio: date | None
    personas: int
    precio_acordado: Decimal


@dataclass
class Cotizacion:
    tipo_producto: str
    fecha_inicio: date
    fecha_fin: date
    adultos: int
    ninos: int
    infantes: int
    lineas: list[Linea] = field(default_factory=list)
    advertencias: list[str] = field(default_factory=list)
    estado_vuelo: str | None = None
    id_paquete: int | None = None
    id_salida: int | None = None
    id_oferta_vuelo: int | None = None
    habitaciones: list[HabitacionCotizada] = field(default_factory=list)
    servicios: list[ServicioCotizado] = field(default_factory=list)
    snapshot: dict = field(default_factory=dict)

    @property
    def personas(self) -> int:
        return self.adultos + self.ninos + self.infantes

    @property
    def total(self) -> Decimal:
        return sum((linea.subtotal for linea in self.lineas), Decimal("0"))

    @property
    def noches(self) -> int:
        return max((self.fecha_fin - self.fecha_inicio).days, 0)

    def como_respuesta(self) -> dict:
        return {
            "tipo_producto": self.tipo_producto,
            "fecha_inicio": self.fecha_inicio,
            "fecha_fin": self.fecha_fin,
            "noches": self.noches,
            "adultos": self.adultos,
            "ninos": self.ninos,
            "infantes": self.infantes,
            "conceptos": [
                {
                    "tipo": linea.tipo,
                    "descripcion": linea.descripcion,
                    "cantidad": linea.cantidad,
                    "precio_unitario": float(linea.precio_unitario),
                    "subtotal": float(linea.subtotal),
                    "incluido": linea.incluido,
                }
                for linea in self.lineas
            ],
            "total": float(self.total),
            "estado_vuelo": self.estado_vuelo,
            "advertencias": self.advertencias,
        }


def _d(valor) -> Decimal:
    return Decimal(str(valor or 0))


def _pesos(valor: Decimal) -> str:
    return f"${valor:,.0f}".replace(",", ".")


# ---------------------------------------------------------------------------
# Habitaciones
# ---------------------------------------------------------------------------


def _verificar_habitacion(db: Session, id_habitacion: int, checkin: date, checkout: date) -> Habitacion:
    # Reutiliza la verificación existente (bloquea la fila de la habitación
    # con FOR UPDATE: dos reservas simultáneas de la última habitación se
    # serializan y la segunda recibe 409).
    from app.repositories.reserva_repository import ReservaRepository

    return ReservaRepository._verificar_disponibilidad(db, id_habitacion, checkin, checkout)


def _cotizar_habitaciones(
    db: Session,
    cot: Cotizacion,
    solicitadas,
    *,
    gratis: bool,
    hoteles_permitidos: set[int] | None,
    es_staff: bool = False,
) -> None:
    for i, a in enumerate(solicitadas):
        for b in solicitadas[i + 1 :]:
            if (
                a.id_habitacion == b.id_habitacion
                and a.fecha_checkin < b.fecha_checkout
                and b.fecha_checkin < a.fecha_checkout
            ):
                raise CotizacionError("Elegiste la misma habitación dos veces en fechas que se cruzan")
    capacidad = 0
    cap_adultos: list[int | None] = []
    cap_ninos: list[int | None] = []
    for h in solicitadas:
        hab = _verificar_habitacion(db, h.id_habitacion, h.fecha_checkin, h.fecha_checkout)
        if not es_staff and (not hab.publicada or (hab.hotel and not hab.hotel.publicado)):
            raise CotizacionError("Esa habitación no está disponible para reservar en línea")
        if hoteles_permitidos is not None and hab.id_hotel not in hoteles_permitidos:
            raise CotizacionError("Esa habitación no pertenece a un hotel de este paquete")
        noches = (h.fecha_checkout - h.fecha_checkin).days or 1
        precio = Decimal("0") if gratis else _d(hab.precio_noche) * noches
        nombre_tipo = hab.tipo_habitacion.nombre_tipo if hab.tipo_habitacion else "Habitación"
        hotel = hab.hotel.nombre_hotel if hab.hotel else ""
        cot.habitaciones.append(HabitacionCotizada(hab, h.fecha_checkin, h.fecha_checkout, precio))
        cot.lineas.append(
            Linea(
                tipo="habitacion",
                descripcion=(
                    f"{nombre_tipo} #{hab.numero_habitacion} · {hotel} "
                    f"({noches} noche{'s' if noches != 1 else ''}"
                    f"{'' if gratis else f' × {_pesos(_d(hab.precio_noche))}'})"
                    f"{' — incluida en el paquete' if gratis else ''}"
                ),
                cantidad=noches,
                precio_unitario=Decimal("0") if gratis else _d(hab.precio_noche),
                subtotal=precio,
                incluido=gratis,
                id_habitacion=hab.id_habitacion,
            )
        )
        capacidad += hab.tipo_habitacion.capacidad_personas if hab.tipo_habitacion else 0
        cap_adultos.append(hab.capacidad_adultos)
        cap_ninos.append(hab.capacidad_ninos)
    if capacidad and cot.personas > capacidad:
        raise CapacidadInsuficienteError(cot.personas, capacidad)
    # Si TODAS las habitaciones tienen capacidad de adultos/niños cargada,
    # también se respeta (ej. una cabaña para 4 pero máximo 2 adultos).
    if cap_adultos and all(c is not None for c in cap_adultos) and cot.adultos > sum(cap_adultos):
        raise CotizacionError(f"Las habitaciones elegidas admiten máximo {sum(cap_adultos)} adulto(s)")
    if cap_ninos and all(c is not None for c in cap_ninos) and cot.ninos > sum(cap_ninos):
        raise CotizacionError(f"Las habitaciones elegidas admiten máximo {sum(cap_ninos)} niño(s)")


# ---------------------------------------------------------------------------
# Vuelos
# ---------------------------------------------------------------------------


def sillas_usadas(db: Session, id_oferta: int, excluir_reserva: int | None = None) -> int:
    """Sillas ocupadas (adultos + niños; los infantes viajan en brazos) por
    reservas activas que tienen esta oferta con vuelo confirmado o incluido."""
    q = db.query(
        func.coalesce(func.sum(func.coalesce(Reserva.adultos, 0) + func.coalesce(Reserva.ninos, 0)), 0)
    ).filter(
        Reserva.id_oferta_vuelo == id_oferta,
        Reserva.estado.in_(ESTADOS_ACTIVOS),
        Reserva.estado_vuelo.in_(("incluido", "opcional", "independiente", "cotizado")),
    )
    if excluir_reserva:
        q = q.filter(Reserva.id_reserva != excluir_reserva)
    return int(q.scalar() or 0)


def _oferta(db: Session, id_oferta: int, *, bloquear: bool) -> OfertaVuelo:
    q = db.query(OfertaVuelo).filter(OfertaVuelo.id_oferta == id_oferta)
    if bloquear:
        q = q.with_for_update()
    oferta = q.first()
    if not oferta:
        raise CotizacionError("La oferta aérea no existe", status_code=404, code="OFERTA_NO_ENCONTRADA")
    return oferta


def _validar_oferta_vendible(db: Session, oferta: OfertaVuelo, cot: Cotizacion, *, es_staff: bool) -> None:
    hoy = date.today()
    if oferta.estado == "finalizada" or (oferta.estado != "publicada" and not es_staff):
        raise CotizacionError("Esta oferta aérea no está disponible para la venta")
    if oferta.estado == "agotada":
        raise CuposAgotadosError("Esta oferta aérea está agotada")
    if oferta.fecha_salida < hoy:
        raise CotizacionError("Esta oferta aérea ya salió")
    if oferta.vigencia_hasta and oferta.vigencia_hasta < hoy:
        raise CotizacionError("La tarifa de esta oferta aérea ya no está vigente")
    if cot.infantes and oferta.precio_infante is None:
        raise CotizacionError("Esta oferta aérea no tiene tarifa de infante; consulta con un asesor")
    if oferta.cupos is not None:
        libres = oferta.cupos - sillas_usadas(db, oferta.id_oferta)
        if cot.adultos + cot.ninos > libres:
            raise CuposAgotadosError(
                f"Quedan {max(libres, 0)} silla(s) en este vuelo y la reserva necesita {cot.adultos + cot.ninos}"
            )


def _ruta(oferta: OfertaVuelo) -> str:
    o = f"{oferta.origen_ciudad}{f' ({oferta.origen_iata})' if oferta.origen_iata else ''}"
    d = f"{oferta.destino_ciudad}{f' ({oferta.destino_iata})' if oferta.destino_iata else ''}"
    flecha = "⇄" if oferta.tipo_trayecto == "ida_regreso" else "→"
    return f"{o} {flecha} {d}"


def _lineas_vuelo(cot: Cotizacion, oferta: OfertaVuelo, *, incluido: bool) -> None:
    ruta = _ruta(oferta)
    if incluido:
        cot.lineas.append(
            Linea(
                tipo="vuelo_incluido",
                descripcion=f"Vuelo {ruta} — incluido en el paquete",
                cantidad=cot.adultos + cot.ninos + cot.infantes,
                precio_unitario=Decimal("0"),
                subtotal=Decimal("0"),
                incluido=True,
                id_oferta_vuelo=oferta.id_oferta,
            )
        )
        return
    adulto = _d(oferta.precio_adulto)
    nino = _d(oferta.precio_nino) if oferta.precio_nino is not None else adulto
    for cantidad, etiqueta, unitario in (
        (cot.adultos, "adulto", adulto),
        (cot.ninos, "niño", nino),
        (cot.infantes, "infante", _d(oferta.precio_infante)),
    ):
        if cantidad:
            cot.lineas.append(
                Linea(
                    tipo="vuelo",
                    descripcion=f"Vuelo {ruta} · {etiqueta}",
                    cantidad=cantidad,
                    precio_unitario=unitario,
                    subtotal=unitario * cantidad,
                    id_oferta_vuelo=oferta.id_oferta,
                )
            )
    cargos = _d(oferta.cargos_adicionales)
    pasajeros = cot.adultos + cot.ninos + cot.infantes
    if cargos > 0:
        cot.lineas.append(
            Linea(
                tipo="cargo",
                descripcion=f"Cargos del vuelo por pasajero{f' ({oferta.descripcion_cargos})' if oferta.descripcion_cargos else ''}",
                cantidad=pasajeros,
                precio_unitario=cargos,
                subtotal=cargos * pasajeros,
                id_oferta_vuelo=oferta.id_oferta,
            )
        )
    if oferta.impuestos_incluidos is False:
        cot.advertencias.append(
            "La tarifa aérea NO incluye impuestos: la agencia te informará el valor antes de emitir el tiquete."
        )
    elif oferta.impuestos_incluidos is None:
        cot.advertencias.append("La agencia confirmará si la tarifa aérea incluye impuestos.")


def _snapshot_vuelo(oferta: OfertaVuelo) -> dict:
    return {
        "id_oferta": oferta.id_oferta,
        "titulo": oferta.titulo,
        "ruta": _ruta(oferta),
        "aerolinea": oferta.aerolinea,
        "numero_vuelo": oferta.numero_vuelo,
        "fecha_salida": str(oferta.fecha_salida),
        "hora_salida": str(oferta.hora_salida) if oferta.hora_salida else None,
        "fecha_regreso": str(oferta.fecha_regreso) if oferta.fecha_regreso else None,
        "hora_regreso": str(oferta.hora_regreso) if oferta.hora_regreso else None,
        "clase": oferta.clase,
        "equipaje_mano": oferta.equipaje_mano,
        "equipaje_bodega": oferta.equipaje_bodega,
        "condiciones_cambio": oferta.condiciones_cambio,
        "condiciones_cancelacion": oferta.condiciones_cancelacion,
        "precio_adulto": float(oferta.precio_adulto),
        "impuestos_incluidos": oferta.impuestos_incluidos,
    }


# ---------------------------------------------------------------------------
# Producto: hotel
# ---------------------------------------------------------------------------


def _cotizar_hotel(db: Session, sel, cot: Cotizacion, *, es_staff: bool) -> None:
    _cotizar_habitaciones(db, cot, sel.habitaciones, gratis=False, hoteles_permitidos=None, es_staff=es_staff)
    cot.fecha_inicio = min(h.fecha_checkin for h in sel.habitaciones)
    cot.fecha_fin = max(h.fecha_checkout for h in sel.habitaciones)
    hoteles = {h.habitacion.hotel for h in cot.habitaciones if h.habitacion.hotel}
    for hotel in hoteles:
        if hotel.impuestos_cargos:
            cot.advertencias.append(f"Impuestos y cargos de {hotel.nombre_hotel}: {hotel.impuestos_cargos}")
    cot.snapshot = {
        "tipo": "hotel",
        "hoteles": [
            {
                "id_hotel": h.id_hotel,
                "nombre": h.nombre_hotel,
                "ciudad": h.ciudad,
                "politicas": h.politicas,
                "hora_checkin": str(h.hora_checkin) if h.hora_checkin else None,
                "hora_checkout": str(h.hora_checkout) if h.hora_checkout else None,
                "politica_cancelacion": h.politica_cancelacion,
                "impuestos_cargos": h.impuestos_cargos,
            }
            for h in hoteles
        ],
        "habitaciones": [
            {
                "id_habitacion": h.habitacion.id_habitacion,
                "numero": h.habitacion.numero_habitacion,
                "tipo": h.habitacion.tipo_habitacion.nombre_tipo if h.habitacion.tipo_habitacion else None,
                "precio_noche": float(h.habitacion.precio_noche),
                "desayuno_incluido": h.habitacion.desayuno_incluido,
            }
            for h in cot.habitaciones
        ],
    }


# ---------------------------------------------------------------------------
# Producto: vuelo independiente
# ---------------------------------------------------------------------------


def _cotizar_vuelo(db: Session, sel, cot: Cotizacion, *, es_staff: bool, bloquear: bool) -> None:
    oferta = _oferta(db, sel.id_oferta_vuelo, bloquear=bloquear)
    if not oferta.venta_independiente and not es_staff:
        raise CotizacionError("Este vuelo solo se vende dentro de un paquete")
    _validar_oferta_vendible(db, oferta, cot, es_staff=es_staff)
    _lineas_vuelo(cot, oferta, incluido=False)
    cot.fecha_inicio = oferta.fecha_salida
    cot.fecha_fin = oferta.fecha_llegada_regreso or oferta.fecha_regreso or oferta.fecha_llegada or oferta.fecha_salida
    cot.id_oferta_vuelo = oferta.id_oferta
    cot.estado_vuelo = "independiente"
    cot.snapshot = {"tipo": "vuelo", "vuelo": _snapshot_vuelo(oferta)}


# ---------------------------------------------------------------------------
# Producto: paquete
# ---------------------------------------------------------------------------


def cupos_usados_salida(db: Session, id_salida: int) -> int:
    q = db.query(
        func.coalesce(
            func.sum(func.coalesce(Reserva.adultos, Reserva.numero_personas) + func.coalesce(Reserva.ninos, 0)), 0
        )
    ).filter(Reserva.id_salida == id_salida, Reserva.estado.in_(ESTADOS_ACTIVOS))
    return int(q.scalar() or 0)


def _fechas_paquete(db: Session, sel, cot: Cotizacion, paquete: Paquete, *, es_staff: bool, bloquear: bool) -> None:
    hoy = date.today()
    salidas_abiertas = [s for s in paquete.salidas if s.estado == "abierta" and s.fecha_salida >= hoy]
    duracion_noches = (
        paquete.noches if paquete.noches is not None else (paquete.duracion_dias - 1 if paquete.duracion_dias else None)
    )
    if paquete.salidas:
        if not sel.id_salida:
            if not salidas_abiertas:
                raise CotizacionError("Este paquete no tiene salidas disponibles por ahora")
            raise CotizacionError("Elige una de las fechas de salida del paquete")
        q = db.query(SalidaPaquete).filter(
            SalidaPaquete.id_salida == sel.id_salida, SalidaPaquete.id_paquete == paquete.id_paquete
        )
        if bloquear:
            q = q.with_for_update()
        salida = q.first()
        if not salida:
            raise CotizacionError("Esa fecha de salida no pertenece a este paquete")
        if salida.estado != "abierta" or salida.fecha_salida < hoy:
            raise CotizacionError("Esa fecha de salida ya no está disponible")
        if salida.cupos is not None:
            libres = salida.cupos - cupos_usados_salida(db, salida.id_salida)
            necesarios = cot.adultos + cot.ninos
            if necesarios > libres:
                raise CuposAgotadosError(
                    f"Quedan {max(libres, 0)} cupo(s) en la salida del {salida.fecha_salida} y la reserva necesita {necesarios}"
                )
        cot.id_salida = salida.id_salida
        cot.fecha_inicio = salida.fecha_salida
        cot.fecha_fin = salida.fecha_regreso or (
            salida.fecha_salida + timedelta(days=duracion_noches)
            if duracion_noches is not None
            else salida.fecha_salida
        )
        return
    if sel.id_salida:
        raise CotizacionError("Este paquete no maneja salidas programadas: elige la fecha de inicio")
    if not sel.fecha_inicio:
        raise CotizacionError("Elige la fecha de inicio del viaje")
    if sel.fecha_inicio < hoy and not es_staff:
        raise CotizacionError("La fecha de inicio ya pasó")
    if paquete.vigencia_desde and sel.fecha_inicio < paquete.vigencia_desde:
        raise CotizacionError(f"Este paquete se puede tomar desde el {paquete.vigencia_desde}")
    if paquete.vigencia_hasta and sel.fecha_inicio > paquete.vigencia_hasta:
        raise CotizacionError(f"Este paquete está vigente hasta el {paquete.vigencia_hasta}")
    cot.fecha_inicio = sel.fecha_inicio
    if duracion_noches is not None:
        fin = sel.fecha_inicio + timedelta(days=duracion_noches)
        if sel.fecha_fin and sel.fecha_fin != fin:
            raise CotizacionError(
                f"Este paquete dura {paquete.duracion_dias or duracion_noches + 1} días: el regreso es el {fin}"
            )
        cot.fecha_fin = fin
    else:
        cot.fecha_fin = sel.fecha_fin or sel.fecha_inicio


def _precio_base_paquete(cot: Cotizacion, paquete: Paquete) -> None:
    nombre = paquete.nombre_paquete
    base = _d(paquete.precio_base)
    if paquete.unidad_precio == "por_paquete":
        cot.lineas.append(
            Linea(
                tipo="paquete",
                descripcion=f"Paquete {nombre} (precio por paquete)",
                cantidad=1,
                precio_unitario=base,
                subtotal=base,
            )
        )
        return
    nino = _d(paquete.precio_nino) if paquete.precio_nino is not None else base
    cot.lineas.append(
        Linea(
            tipo="paquete",
            descripcion=f"Paquete {nombre} · adulto",
            cantidad=cot.adultos,
            precio_unitario=base,
            subtotal=base * cot.adultos,
        )
    )
    if cot.ninos:
        etiqueta = "niño" if paquete.precio_nino is not None else "niño (tarifa de adulto)"
        cot.lineas.append(
            Linea(
                tipo="paquete",
                descripcion=f"Paquete {nombre} · {etiqueta}",
                cantidad=cot.ninos,
                precio_unitario=nino,
                subtotal=nino * cot.ninos,
            )
        )
    if cot.infantes:
        if paquete.precio_infante is None:
            raise CotizacionError("Este paquete no tiene tarifa de infante configurada; consulta con un asesor")
        inf = _d(paquete.precio_infante)
        cot.lineas.append(
            Linea(
                tipo="paquete",
                descripcion=f"Paquete {nombre} · infante{' (sin costo)' if inf == 0 else ''}",
                cantidad=cot.infantes,
                precio_unitario=inf,
                subtotal=inf * cot.infantes,
                incluido=inf == 0,
            )
        )


def _cotizar_paquete(db: Session, sel, cot: Cotizacion, *, es_staff: bool, bloquear: bool) -> None:
    paquete = db.query(Paquete).filter(Paquete.id_paquete == sel.id_paquete).first()
    if not paquete:
        raise CotizacionError("El paquete no existe", status_code=404, code="PAQUETE_NO_ENCONTRADO")
    if not paquete.activo and not es_staff:
        raise CotizacionError("Este paquete no está disponible")
    cot.id_paquete = paquete.id_paquete
    if paquete.min_viajeros and cot.adultos + cot.ninos < paquete.min_viajeros:
        raise CotizacionError(f"Este paquete es para mínimo {paquete.min_viajeros} viajero(s)")
    if paquete.max_viajeros and cot.adultos + cot.ninos > paquete.max_viajeros:
        raise CotizacionError(f"Este paquete es para máximo {paquete.max_viajeros} viajero(s)")

    _fechas_paquete(db, sel, cot, paquete, es_staff=es_staff, bloquear=bloquear)
    _precio_base_paquete(cot, paquete)

    # --- Alojamiento ---
    hoteles = {ph.id_hotel: ph for ph in paquete.paquete_hotel if ph.hotel}
    modalidad_aloj = paquete.modalidad_alojamiento or "sin"
    if modalidad_aloj == "sin" and sel.habitaciones:
        raise CotizacionError("Este paquete no incluye alojamiento: no se pueden agregar habitaciones")
    if modalidad_aloj == "incluido":
        for ph in hoteles.values():
            noches = ph.noches_incluidas or cot.noches
            cot.lineas.append(
                Linea(
                    tipo="alojamiento_incluido",
                    descripcion=f"Alojamiento incluido: {ph.hotel.nombre_hotel} ({noches} noche{'s' if noches != 1 else ''})",
                    cantidad=noches,
                    precio_unitario=Decimal("0"),
                    subtotal=Decimal("0"),
                    incluido=True,
                )
            )
        if not hoteles:
            cot.advertencias.append("El alojamiento está incluido; la agencia te confirmará el hotel.")
    if sel.habitaciones and modalidad_aloj in ("incluido", "opcional"):
        for h in sel.habitaciones:
            if h.fecha_checkin < cot.fecha_inicio or h.fecha_checkout > cot.fecha_fin:
                raise CotizacionError("Las noches de hotel deben estar dentro de las fechas del paquete")
        _cotizar_habitaciones(
            db,
            cot,
            sel.habitaciones,
            gratis=modalidad_aloj == "incluido",
            hoteles_permitidos=set(hoteles),
            es_staff=es_staff,
        )

    # --- Vuelo ---
    modalidad_vuelo = paquete.modalidad_vuelo or "sin"
    ofertas = {pv.id_oferta: pv.oferta for pv in paquete.paquete_vuelos if pv.oferta}
    oferta = None
    if modalidad_vuelo == "sin":
        if sel.id_oferta_vuelo or sel.incluir_vuelo:
            raise CotizacionError("Este paquete no incluye vuelo ni lo ofrece como opción")
        cot.estado_vuelo = "no_aplica"
    elif modalidad_vuelo == "incluido":
        if sel.id_oferta_vuelo:
            if sel.id_oferta_vuelo not in ofertas:
                raise CotizacionError("Ese vuelo no está asociado a este paquete")
            oferta = _oferta(db, sel.id_oferta_vuelo, bloquear=bloquear)
        elif len(ofertas) == 1:
            oferta = _oferta(db, next(iter(ofertas)), bloquear=bloquear)
        elif len(ofertas) > 1:
            raise CotizacionError("Elige con cuál de los vuelos del paquete quieres viajar")
        if oferta:
            _validar_oferta_vendible(db, oferta, cot, es_staff=True)  # incluido: lo vende el paquete
            _lineas_vuelo(cot, oferta, incluido=True)
        else:
            cot.lineas.append(
                Linea(
                    tipo="vuelo_incluido",
                    descripcion="Vuelo incluido en el paquete (la agencia te confirmará horarios)",
                    cantidad=cot.personas,
                    precio_unitario=Decimal("0"),
                    subtotal=Decimal("0"),
                    incluido=True,
                )
            )
        cot.estado_vuelo = "incluido"
    elif modalidad_vuelo == "opcional":
        if sel.incluir_vuelo or sel.id_oferta_vuelo:
            if sel.id_oferta_vuelo:
                if sel.id_oferta_vuelo not in ofertas:
                    raise CotizacionError("Ese vuelo no está asociado a este paquete")
                oferta = _oferta(db, sel.id_oferta_vuelo, bloquear=bloquear)
            elif len(ofertas) == 1:
                oferta = _oferta(db, next(iter(ofertas)), bloquear=bloquear)
            elif not ofertas:
                raise CotizacionError("Este paquete todavía no tiene vuelos configurados")
            else:
                raise CotizacionError("Elige cuál vuelo quieres agregar")
            _validar_oferta_vendible(db, oferta, cot, es_staff=es_staff)
            _lineas_vuelo(cot, oferta, incluido=False)
            cot.estado_vuelo = "opcional"
        else:
            cot.estado_vuelo = "no_aplica"
    elif modalidad_vuelo == "cotizacion":
        if sel.id_oferta_vuelo:
            raise CotizacionError("El vuelo de este paquete se cotiza aparte: no se elige una oferta")
        if sel.incluir_vuelo:
            cot.lineas.append(
                Linea(
                    tipo="vuelo_cotizacion",
                    descripcion="Vuelo sujeto a cotización — la agencia te confirmará la tarifa (no se cobra todavía)",
                    cantidad=cot.adultos + cot.ninos + cot.infantes,
                    precio_unitario=Decimal("0"),
                    subtotal=Decimal("0"),
                )
            )
            cot.estado_vuelo = "cotizacion_pendiente"
            cot.advertencias.append(
                "El vuelo NO está incluido en este total: la agencia te enviará la cotización y solo se cobra si la aceptas."
            )
        else:
            cot.estado_vuelo = "no_aplica"
    if oferta:
        cot.id_oferta_vuelo = oferta.id_oferta

    # --- Servicios opcionales ---
    if sel.servicios_opcionales:
        opcionales = {
            ps.id_servicio: ps
            for ps in db.query(PaqueteServicio).filter(PaqueteServicio.id_paquete == paquete.id_paquete).all()
            if ps.incluido is False and ps.servicio
        }
        personas_pagan = cot.adultos + cot.ninos
        for id_servicio in sel.servicios_opcionales:
            ps = opcionales.get(id_servicio)
            if not ps:
                raise CotizacionError("Uno de los servicios elegidos no es un opcional de este paquete")
            servicio = ps.servicio
            if servicio.capacidad_maxima and personas_pagan > servicio.capacidad_maxima:
                raise CotizacionError(
                    f"{servicio.nombre_servicio} es para máximo {servicio.capacidad_maxima} persona(s)"
                )
            unitario = _d(servicio.precio_base)
            fecha = cot.fecha_inicio + timedelta(days=(ps.dia_actividad or 1) - 1)
            cot.servicios.append(ServicioCotizado(servicio, fecha, personas_pagan, unitario * personas_pagan))
            cot.lineas.append(
                Linea(
                    tipo="servicio_opcional",
                    descripcion=f"{servicio.nombre_servicio} (opcional, por persona)",
                    cantidad=personas_pagan,
                    precio_unitario=unitario,
                    subtotal=unitario * personas_pagan,
                    id_servicio=servicio.id_servicio,
                )
            )

    cot.snapshot = {
        "tipo": "paquete",
        "paquete": {
            "id_paquete": paquete.id_paquete,
            "nombre": paquete.nombre_paquete,
            "descripcion": paquete.descripcion,
            "duracion_dias": paquete.duracion_dias,
            "noches": paquete.noches,
            "destino": paquete.destino_ciudad or paquete.ciudad_destino,
            "unidad_precio": paquete.unidad_precio,
            "precio_base": float(paquete.precio_base),
            "precio_nino": float(paquete.precio_nino) if paquete.precio_nino is not None else None,
            "precio_infante": float(paquete.precio_infante) if paquete.precio_infante is not None else None,
            "modalidad_alojamiento": modalidad_aloj,
            "modalidad_vuelo": modalidad_vuelo,
            "condiciones": paquete.condiciones,
            "incluye": [i.descripcion for i in paquete.inclusiones if i.tipo == "incluye"],
            "no_incluye": [i.descripcion for i in paquete.inclusiones if i.tipo == "no_incluye"]
            or [linea for linea in (paquete.no_incluye or "").splitlines() if linea.strip()],
            "itinerario": [{"dia": d.dia, "titulo": d.titulo} for d in paquete.itinerario],
            "hoteles": [{"id_hotel": ph.id_hotel, "nombre": ph.hotel.nombre_hotel} for ph in hoteles.values()],
        },
        "vuelo": _snapshot_vuelo(oferta) if oferta else None,
    }


# ---------------------------------------------------------------------------
# Entrada principal
# ---------------------------------------------------------------------------


def cotizar(db: Session, sel, *, es_staff: bool = False, bloquear: bool = False) -> Cotizacion:
    """Calcula el desglose de `sel` (SeleccionProducto). Lanza CotizacionError
    (o las excepciones de disponibilidad existentes) si algo no cuadra."""
    hoy = date.today()
    cot = Cotizacion(
        tipo_producto=sel.tipo_producto,
        fecha_inicio=sel.fecha_inicio or hoy,
        fecha_fin=sel.fecha_fin or sel.fecha_inicio or hoy,
        adultos=sel.adultos,
        ninos=sel.ninos,
        infantes=sel.infantes,
    )
    if sel.tipo_producto == "hotel":
        if sel.id_paquete or sel.id_oferta_vuelo:
            raise CotizacionError("Una reserva de hotel no lleva paquete ni vuelo")
        _cotizar_hotel(db, sel, cot, es_staff=es_staff)
    elif sel.tipo_producto == "vuelo":
        if sel.habitaciones or sel.id_paquete:
            raise CotizacionError("Una reserva de vuelo no lleva paquete ni habitaciones")
        _cotizar_vuelo(db, sel, cot, es_staff=es_staff, bloquear=bloquear)
    else:
        _cotizar_paquete(db, sel, cot, es_staff=es_staff, bloquear=bloquear)

    if sel.servicios_opcionales and sel.tipo_producto != "paquete":
        raise CotizacionError("Los servicios opcionales solo aplican a paquetes")

    if sel.descuento:
        if not es_staff:
            raise CotizacionError("Solo la agencia puede aplicar descuentos", status_code=403, code="SOLO_STAFF")
        monto = _d(sel.descuento.monto)
        if monto > cot.total:
            raise CotizacionError("El descuento no puede ser mayor que el total")
        cot.lineas.append(
            Linea(
                tipo="descuento",
                descripcion=f"Descuento autorizado: {sel.descuento.motivo}",
                cantidad=1,
                precio_unitario=-monto,
                subtotal=-monto,
            )
        )
    return cot
