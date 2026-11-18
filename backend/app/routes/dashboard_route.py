"""
Endpoint de resumen operativo del Dashboard del admin.

Por qué existe este archivo (y no seguir calculando todo en el frontend
como antes): el Dashboard anterior calculaba TODOS sus KPIs en JavaScript
a partir de listas ya paginadas (`GET /reservas?limit=100`, `GET /pagos?limit=100`)
que el resto del panel usa para sus tablas. Eso significa que apenas la
agencia supere 100 reservas o 100 pagos reales, "Total Reservas", "Ingresos
totales", el gráfico de estados, etc. empiezan a estar SILENCIOSAMENTE mal
— nunca fallan, simplemente cuentan de menos sin avisar. Este endpoint
calcula cada número con SQL de verdad (COUNT/SUM/GROUP BY sobre la tabla
completa), así que es correcto sin importar cuántas reservas existan.

Todas las cifras salen de tablas reales ya existentes (reservas, pagos,
clientes, hoteles, paquetes, solicitudes_cancelacion, historial_reservas).
No se inventa ningún número: donde no hay suficiente información para una
cifra real (reembolsos, contactos empresariales si la migración todavía no
corrió), el campo va en None en vez de mostrar un 0 que podría confundirse
con "sabemos que son cero".
"""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.cache import get_cached, set_cached
from app.core.database import get_db
from app.core.security import require_empleado
from app.models.cliente_model import Cliente, Empleado
from app.models.hotel_model import Habitacion, Hotel
from app.models.reserva_model import (
    HistorialReserva,
    MetodoPago,
    Pago,
    Paquete,
    Reserva,
    ReservaHabitacion,
    SolicitudCancelacion,
)
from app.models.user_model import Usuario
from app.schemas.dashboard_schema import (
    ConteoNombre,
    DashboardResumenResponse,
    MesComercialItem,
    ReservaProximaItem,
    ReservasPorMesItem,
    ResumenEmpleadoResponse,
    SerieDiariaItem,
    TendenciaValor,
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

DASHBOARD_CACHE_KEY = "kpi:dashboard:resumen"
# Las marcas de tiempo se guardan sin zona, en UTC (now() de la BD). Para
# agrupar por día y por mes se pasan a la hora de Colombia: si no, lo que
# entra después de las 7 p. m. contaría para el día siguiente.
ZONA_NEGOCIO = ZoneInfo("America/Bogota")
DASHBOARD_CACHE_TTL = 60  # corto: el dashboard debe reflejar cambios casi en vivo


def _inicio_mes(d: date) -> date:
    return d.replace(day=1)


def _mes_anterior(d: date) -> tuple[date, date]:
    """Devuelve (inicio, fin_exclusivo) del mes calendario anterior a `d`."""
    fin = _inicio_mes(d)
    if fin.month == 1:
        inicio = fin.replace(year=fin.year - 1, month=12, day=1)
    else:
        inicio = fin.replace(month=fin.month - 1, day=1)
    return inicio, fin


def _variacion(actual: float, anterior: float) -> TendenciaValor:
    pct = None
    if anterior > 0:
        pct = round((actual - anterior) / anterior * 100, 1)
    return TendenciaValor(actual=actual, anterior=anterior, variacion_pct=pct)


@router.get("/resumen", response_model=DashboardResumenResponse)
def get_dashboard_resumen(db: Session = Depends(get_db), admin_id: int = Depends(require_empleado)):
    # require_empleado (no solo require_admin): el panel recortado del
    # empleado reutiliza este mismo endpoint tal cual -- ver la opción
    # "Los mismos KPIs generales del admin, sin cambios" del brief. Los
    # datos son globales de la agencia (no hay una versión "solo mía" de
    # ingresos totales, tasa de conversión, etc.), igual que ya ve
    # cualquier admin.
    cached = get_cached(DASHBOARD_CACHE_KEY)
    if cached is not None:
        return cached

    hoy = date.today()
    inicio_mes_actual = _inicio_mes(hoy)
    inicio_mes_anterior, fin_mes_anterior = _mes_anterior(hoy)
    en_7_dias = hoy + timedelta(days=7)

    # ---------- Reservas por estado (real, tabla completa) ----------
    conteo_estado = dict(db.query(Reserva.estado, func.count(Reserva.id_reserva)).group_by(Reserva.estado).all())
    reservas_total = sum(conteo_estado.values())

    # ---------- Pagos por estado + ingresos reales ----------
    conteo_pago_estado = dict(db.query(Pago.estado, func.count(Pago.id_pago)).group_by(Pago.estado).all())
    ingresos_totales = float(
        db.query(func.coalesce(func.sum(Pago.monto), 0)).filter(Pago.estado == "pagado").scalar() or 0
    )
    pagos_pagados_count = conteo_pago_estado.get("pagado", 0)
    ticket_promedio = round(ingresos_totales / pagos_pagados_count, 2) if pagos_pagados_count else None

    # ---------- Clientes ----------
    clientes_total = db.query(func.count(Cliente.id_cliente)).scalar() or 0
    clientes_nuevos_mes = (
        db.query(func.count(Cliente.id_cliente)).filter(Cliente.fecha_registro >= inicio_mes_actual).scalar() or 0
    )
    clientes_activos = db.query(func.count(func.distinct(Reserva.id_cliente))).scalar() or 0
    clientes_con_reserva_proxima = (
        db.query(func.count(func.distinct(Reserva.id_cliente)))
        .filter(Reserva.fecha_inicio >= hoy, Reserva.estado.in_(["confirmada", "pendiente"]))
        .scalar()
        or 0
    )

    # ---------- Operación ----------
    checkins_proximos_7d = (
        db.query(func.count(Reserva.id_reserva))
        .filter(Reserva.fecha_inicio.between(hoy, en_7_dias), Reserva.estado == "confirmada")
        .scalar()
        or 0
    )
    checkouts_proximos_7d = (
        db.query(func.count(Reserva.id_reserva))
        .filter(Reserva.fecha_fin.between(hoy, en_7_dias), Reserva.estado == "confirmada")
        .scalar()
        or 0
    )
    solicitudes_cancelacion_pendientes = (
        db.query(func.count(SolicitudCancelacion.id_solicitud))
        .filter(SolicitudCancelacion.estado == "pendiente")
        .scalar()
        or 0
    )

    # Empresas/Contactos: tabla nueva de esta misma sesión — puede no existir
    # todavía si el usuario no corrió `alembic upgrade head`. Nunca debe
    # tumbar el resto del dashboard por eso.
    contactos_empresariales_pendientes = None
    try:
        from app.models.empresa_model import SolicitudCorporativa

        contactos_empresariales_pendientes = (
            db.query(func.count(SolicitudCorporativa.id_solicitud))
            .filter(SolicitudCorporativa.estado == "nuevo")
            .scalar()
            or 0
        )
    except Exception:
        db.rollback()
        contactos_empresariales_pendientes = None

    # ---------- Tendencias: mes actual vs. mes calendario anterior ----------
    reservas_mes_actual = (
        db.query(func.count(Reserva.id_reserva)).filter(Reserva.fecha_reserva >= inicio_mes_actual).scalar() or 0
    )
    reservas_mes_anterior = (
        db.query(func.count(Reserva.id_reserva))
        .filter(Reserva.fecha_reserva >= inicio_mes_anterior, Reserva.fecha_reserva < fin_mes_anterior)
        .scalar()
        or 0
    )

    ingresos_mes_actual = float(
        db.query(func.coalesce(func.sum(Pago.monto), 0))
        .filter(Pago.estado == "pagado", Pago.fecha_pago >= inicio_mes_actual)
        .scalar()
        or 0
    )
    ingresos_mes_anterior = float(
        db.query(func.coalesce(func.sum(Pago.monto), 0))
        .filter(Pago.estado == "pagado", Pago.fecha_pago >= inicio_mes_anterior, Pago.fecha_pago < fin_mes_anterior)
        .scalar()
        or 0
    )

    # Cancelaciones: se cuentan por el momento REAL en que pasaron a
    # 'cancelada' (historial_reservas.fecha_cambio), no por la fecha en que
    # se creó la reserva originalmente — son eventos distintos.
    cancelaciones_mes_actual = (
        db.query(func.count(HistorialReserva.id_historial))
        .filter(HistorialReserva.estado_nuevo == "cancelada", HistorialReserva.fecha_cambio >= inicio_mes_actual)
        .scalar()
        or 0
    )
    cancelaciones_mes_anterior = (
        db.query(func.count(HistorialReserva.id_historial))
        .filter(
            HistorialReserva.estado_nuevo == "cancelada",
            HistorialReserva.fecha_cambio >= inicio_mes_anterior,
            HistorialReserva.fecha_cambio < fin_mes_anterior,
        )
        .scalar()
        or 0
    )

    clientes_nuevos_mes_anterior = (
        db.query(func.count(Cliente.id_cliente))
        .filter(Cliente.fecha_registro >= inicio_mes_anterior, Cliente.fecha_registro < fin_mes_anterior)
        .scalar()
        or 0
    )

    # ---------- Gráficos ----------
    ingresos_por_metodo_rows = (
        db.query(MetodoPago.nombre_metodo, func.sum(Pago.monto))
        .join(Pago, Pago.id_metodo_pago == MetodoPago.id_metodo)
        .filter(Pago.estado == "pagado")
        .group_by(MetodoPago.nombre_metodo)
        .order_by(func.sum(Pago.monto).desc())
        .all()
    )
    ingresos_por_metodo = [ConteoNombre(nombre=n, total=0, monto=float(m or 0)) for n, m in ingresos_por_metodo_rows]

    paquetes_top_rows = (
        db.query(Paquete.nombre_paquete, func.count(Reserva.id_reserva))
        .join(Reserva, Reserva.id_paquete == Paquete.id_paquete)
        .group_by(Paquete.nombre_paquete)
        .order_by(func.count(Reserva.id_reserva).desc())
        .limit(8)
        .all()
    )
    paquetes_mas_solicitados = [ConteoNombre(nombre=n, total=c) for n, c in paquetes_top_rows]

    # Reservas, cancelaciones e ingresos por mes — últimos 6 meses
    # calendario, incluyendo meses en cero (para que el gráfico no "salte").
    # Antes eran 2 consultas por mes y 2 por día (≈40 en total); ahora se
    # traen las fechas una vez y se agrupan en Python.
    hoy_local = datetime.now(ZONA_NEGOCIO).date()
    meses_rango = []
    for i in range(5, -1, -1):
        y, m = hoy_local.year, hoy_local.month - i
        while m <= 0:
            m += 12
            y -= 1
        meses_rango.append((y, m))
    # Un día de margen por la diferencia horaria con UTC.
    inicio_ventana = min(date(*meses_rango[0], 1), hoy_local - timedelta(days=13)) - timedelta(days=1)

    def _dia(valor) -> date | None:
        if valor is None:
            return None
        if isinstance(valor, datetime):
            if valor.tzinfo is None:
                valor = valor.replace(tzinfo=UTC)
            return valor.astimezone(ZONA_NEGOCIO).date()
        return valor

    fechas_reservas = [
        _dia(f) for (f,) in db.query(Reserva.fecha_reserva).filter(Reserva.fecha_reserva >= inicio_ventana).all()
    ]
    pagos_ventana = [
        (_dia(f), float(mnt or 0))
        for f, mnt in db.query(Pago.fecha_pago, Pago.monto)
        .filter(Pago.estado == "pagado", Pago.fecha_pago >= inicio_ventana)
        .all()
    ]
    fechas_canceladas = [
        _dia(f)
        for (f,) in db.query(HistorialReserva.fecha_cambio)
        .filter(HistorialReserva.estado_nuevo == "cancelada", HistorialReserva.fecha_cambio >= inicio_ventana)
        .all()
    ]

    def _clave_mes(d: date | None) -> str | None:
        return f"{d.year:04d}-{d.month:02d}" if d else None

    reservas_mes_cnt: dict[str, int] = {}
    for d in fechas_reservas:
        k = _clave_mes(d)
        reservas_mes_cnt[k] = reservas_mes_cnt.get(k, 0) + 1
    cancel_mes_cnt: dict[str, int] = {}
    for d in fechas_canceladas:
        k = _clave_mes(d)
        cancel_mes_cnt[k] = cancel_mes_cnt.get(k, 0) + 1
    ingresos_mes_sum: dict[str, float] = {}
    for d, mnt in pagos_ventana:
        k = _clave_mes(d)
        ingresos_mes_sum[k] = ingresos_mes_sum.get(k, 0.0) + mnt

    reservas_por_mes: list[ReservasPorMesItem] = []
    cancelaciones_por_mes: list[ReservasPorMesItem] = []
    comercial_por_mes: list[MesComercialItem] = []
    for y, m in meses_rango:
        k = f"{y:04d}-{m:02d}"
        reservas_por_mes.append(ReservasPorMesItem(mes=k, total=reservas_mes_cnt.get(k, 0)))
        cancelaciones_por_mes.append(ReservasPorMesItem(mes=k, total=cancel_mes_cnt.get(k, 0)))
        comercial_por_mes.append(
            MesComercialItem(
                mes=k, reservas=reservas_mes_cnt.get(k, 0), ingresos=round(ingresos_mes_sum.get(k, 0.0), 2)
            )
        )

    # ---------- Reservas próximas (para la lista "Reservas próximas") ----------
    proximas = (
        db.query(Reserva)
        .options(joinedload(Reserva.cliente), joinedload(Reserva.paquete))
        .filter(Reserva.fecha_inicio >= hoy, Reserva.estado.in_(["confirmada", "pendiente"]))
        .order_by(Reserva.fecha_inicio.asc())
        .limit(8)
        .all()
    )
    reservas_proximas = [
        ReservaProximaItem(
            id_reserva=r.id_reserva,
            cliente_nombre=f"{r.cliente.nombre} {r.cliente.apellido}" if r.cliente else "Cliente",
            hotel_nombre=r.hotel_nombre,
            nombre_paquete=r.nombre_paquete,
            fecha_inicio=r.fecha_inicio,
            fecha_fin=r.fecha_fin,
            numero_personas=r.numero_personas,
            estado=r.estado,
        )
        for r in proximas
    ]

    hoteles_activos = db.query(func.count(Hotel.id_hotel)).scalar() or 0
    paquetes_activos = db.query(func.count(Paquete.id_paquete)).filter(Paquete.activo == True).scalar() or 0  # noqa: E712

    # ---------- Métricas derivadas (nada inventado: todo sale de las
    # cuentas por estado y de historial_reservas que ya se calculan arriba
    # o son igual de directas) ----------
    tasa_conversion_pct = (
        # Una reserva finalizada también llegó a confirmarse.
        round((conteo_estado.get("confirmada", 0) + conteo_estado.get("finalizada", 0)) / reservas_total * 100, 1)
        if reservas_total
        else None
    )
    tasa_cancelacion_pct = (
        round(conteo_estado.get("cancelada", 0) / reservas_total * 100, 1) if reservas_total else None
    )

    # Tiempo promedio de confirmación: por cada reserva, el primer momento
    # en que su historial registra el paso a 'confirmada' (MIN por si algún
    # caso raro tuviera más de un registro), contra la fecha de creación de
    # esa misma reserva — promediado sobre todas las reservas que alguna
    # vez se confirmaron.
    primera_confirmacion = (
        db.query(
            HistorialReserva.id_reserva.label("id_reserva"),
            func.min(HistorialReserva.fecha_cambio).label("fecha_confirmacion"),
        )
        .filter(HistorialReserva.estado_nuevo == "confirmada")
        .group_by(HistorialReserva.id_reserva)
        .subquery()
    )
    horas_promedio_confirmacion = (
        db.query(
            func.avg(func.extract("epoch", primera_confirmacion.c.fecha_confirmacion - Reserva.fecha_reserva) / 3600.0)
        )
        .join(primera_confirmacion, primera_confirmacion.c.id_reserva == Reserva.id_reserva)
        .scalar()
    )
    tiempo_promedio_confirmacion_horas = (
        round(float(horas_promedio_confirmacion), 1) if horas_promedio_confirmacion is not None else None
    )

    # ---------- Series diarias (últimos 14 días, para sparklines) ----------
    reservas_dia_cnt: dict[date, int] = {}
    for d in fechas_reservas:
        reservas_dia_cnt[d] = reservas_dia_cnt.get(d, 0) + 1
    ingresos_dia_sum: dict[date, float] = {}
    for d, mnt in pagos_ventana:
        ingresos_dia_sum[d] = ingresos_dia_sum.get(d, 0.0) + mnt
    reservas_ultimos_14d: list[SerieDiariaItem] = []
    ingresos_ultimos_14d: list[SerieDiariaItem] = []
    for i in range(13, -1, -1):
        dia = hoy_local - timedelta(days=i)
        reservas_ultimos_14d.append(SerieDiariaItem(fecha=dia.isoformat(), total=reservas_dia_cnt.get(dia, 0)))
        ingresos_ultimos_14d.append(
            SerieDiariaItem(fecha=dia.isoformat(), total=round(ingresos_dia_sum.get(dia, 0.0), 2))
        )

    # ---------- Vista comercial ----------
    nombres_producto = {"paquete": "Paquetes", "hotel": "Hoteles", "vuelo": "Vuelos"}
    reservas_por_tipo = dict(
        db.query(Reserva.tipo_producto, func.count(Reserva.id_reserva))
        .filter(Reserva.estado != "cancelada")
        .group_by(Reserva.tipo_producto)
        .all()
    )
    ingresos_por_tipo = dict(
        db.query(Reserva.tipo_producto, func.sum(Pago.monto))
        .join(Pago, Pago.id_reserva == Reserva.id_reserva)
        .filter(Pago.estado == "pagado")
        .group_by(Reserva.tipo_producto)
        .all()
    )
    ventas_por_producto = []
    for tipo in sorted(set(reservas_por_tipo) | set(ingresos_por_tipo), key=lambda t: (t is None, str(t))):
        ventas_por_producto.append(
            ConteoNombre(
                nombre=nombres_producto.get(tipo, "Otros"),
                total=int(reservas_por_tipo.get(tipo, 0) or 0),
                monto=round(float(ingresos_por_tipo.get(tipo, 0) or 0), 2),
            )
        )
    ventas_por_producto.sort(key=lambda v: (v.monto or 0, v.total), reverse=True)

    nombres_canal = {"web": "Sitio web", "empleado": "Asesor", "telefono": "Teléfono"}
    reservas_por_canal = [
        ConteoNombre(nombre=nombres_canal.get(c, "Sin dato"), total=n)
        for c, n in db.query(Reserva.canal_origen, func.count(Reserva.id_reserva))
        .group_by(Reserva.canal_origen)
        .order_by(func.count(Reserva.id_reserva).desc())
        .all()
    ]

    hoteles_mas_reservados = [
        ConteoNombre(nombre=n, total=c)
        for n, c in db.query(Hotel.nombre_hotel, func.count(func.distinct(ReservaHabitacion.id_reserva)))
        .join(Habitacion, Habitacion.id_hotel == Hotel.id_hotel)
        .join(ReservaHabitacion, ReservaHabitacion.id_habitacion == Habitacion.id_habitacion)
        .group_by(Hotel.nombre_hotel)
        .order_by(func.count(func.distinct(ReservaHabitacion.id_reserva)).desc())
        .limit(5)
        .all()
    ]

    asesores_top_mes = [
        ConteoNombre(nombre=f"{nombre} {apellido}".strip(), total=c)
        for nombre, apellido, c in db.query(Empleado.nombre, Empleado.apellido, func.count(Reserva.id_reserva))
        .join(Reserva, Reserva.id_empleado == Empleado.id_empleado)
        .filter(Reserva.fecha_reserva >= inicio_mes_actual)
        .group_by(Empleado.id_empleado, Empleado.nombre, Empleado.apellido)
        .order_by(func.count(Reserva.id_reserva).desc())
        .limit(5)
        .all()
    ]

    # Cartera: el total de una reserva sale de su desglose (propiedad
    # precio_total, ver Reserva), así que se calcula en Python sobre las
    # reservas vigentes, con sus relaciones precargadas en 4 consultas.
    vigentes = (
        db.query(Reserva)
        .options(
            selectinload(Reserva.conceptos),
            selectinload(Reserva.reserva_habitaciones),
            selectinload(Reserva.reserva_servicios),
            selectinload(Reserva.pagos),
        )
        .filter(Reserva.estado.in_(["pendiente", "confirmada"]))
        .all()
    )
    saldos = [r.saldo_pendiente for r in vigentes]
    cartera_por_cobrar = round(sum(saldos), 2)
    reservas_con_saldo = sum(1 for x in saldos if x > 0)

    resultado = DashboardResumenResponse(
        reservas_total=reservas_total,
        reservas_confirmadas=conteo_estado.get("confirmada", 0),
        reservas_pendientes=conteo_estado.get("pendiente", 0),
        reservas_canceladas=conteo_estado.get("cancelada", 0),
        reservas_finalizadas=conteo_estado.get("finalizada", 0),
        pagos_pagados=pagos_pagados_count,
        pagos_pendientes=conteo_pago_estado.get("pendiente", 0) + conteo_pago_estado.get("procesando", 0),
        pagos_fallidos=conteo_pago_estado.get("rechazado", 0),
        pagos_reembolsados=None,
        ingresos_totales=ingresos_totales,
        ticket_promedio=ticket_promedio,
        clientes_total=clientes_total,
        clientes_nuevos_mes=clientes_nuevos_mes,
        clientes_activos=clientes_activos,
        clientes_con_reserva_proxima=clientes_con_reserva_proxima,
        checkins_proximos_7d=checkins_proximos_7d,
        checkouts_proximos_7d=checkouts_proximos_7d,
        solicitudes_cancelacion_pendientes=solicitudes_cancelacion_pendientes,
        contactos_empresariales_pendientes=contactos_empresariales_pendientes,
        tendencia_reservas=_variacion(reservas_mes_actual, reservas_mes_anterior),
        tendencia_ingresos=_variacion(ingresos_mes_actual, ingresos_mes_anterior),
        tendencia_cancelaciones=_variacion(cancelaciones_mes_actual, cancelaciones_mes_anterior),
        tendencia_clientes_nuevos=_variacion(clientes_nuevos_mes, clientes_nuevos_mes_anterior),
        reservas_por_estado=conteo_estado,
        ingresos_por_metodo=ingresos_por_metodo,
        paquetes_mas_solicitados=paquetes_mas_solicitados,
        reservas_por_mes=reservas_por_mes,
        cancelaciones_por_mes=cancelaciones_por_mes,
        reservas_proximas=reservas_proximas,
        hoteles_activos=hoteles_activos,
        paquetes_activos=paquetes_activos,
        tasa_conversion_pct=tasa_conversion_pct,
        tasa_cancelacion_pct=tasa_cancelacion_pct,
        tiempo_promedio_confirmacion_horas=tiempo_promedio_confirmacion_horas,
        reservas_ultimos_14d=reservas_ultimos_14d,
        ingresos_ultimos_14d=ingresos_ultimos_14d,
        comercial_por_mes=comercial_por_mes,
        ventas_por_producto=ventas_por_producto,
        reservas_por_canal=reservas_por_canal,
        hoteles_mas_reservados=hoteles_mas_reservados,
        asesores_top_mes=asesores_top_mes,
        cartera_por_cobrar=cartera_por_cobrar,
        reservas_con_saldo=reservas_con_saldo,
        ingresos_hoy=ingresos_ultimos_14d[-1].total,
        reservas_hoy=int(reservas_ultimos_14d[-1].total),
    )

    data = resultado.model_dump(mode="json")
    set_cached(DASHBOARD_CACHE_KEY, data, ttl_seconds=DASHBOARD_CACHE_TTL)
    return data


# Nunca se cachea (mismo criterio que /mensajes/no-leidos y /mensajes/hilos):
# son los KPIs propios del empleado que está viendo su panel en ESTE
# momento, no una cifra global de la agencia que valga la pena compartir
# entre peticiones distintas.
@router.get("/resumen-empleado", response_model=ResumenEmpleadoResponse)
def get_dashboard_resumen_empleado(db: Session = Depends(get_db), usuario_id: int = Depends(require_empleado)):
    """KPIs propios del empleado (asesor) que llama -- sección "Mis KPIs"
    del panel recortado del empleado (ver ResumenEmpleadoResponse). Un
    admin que llame este endpoint sin tener un perfil de empleado
    vinculado (Usuario.id_empleado) recibe todo en 0/None: no hay ningún
    "yo" que medir en ese caso."""
    from app.models.mensaje_chat_model import MensajeChat

    usuario = db.query(Usuario).filter(Usuario.id_usuario == usuario_id).first()
    id_empleado = usuario.id_empleado if usuario else None

    hoy = date.today()
    inicio_dia = datetime.combine(hoy, datetime.min.time())

    # ---------- Chat: bandeja compartida, "pendientes" es el mismo total
    # para cualquier asesor (no hay asignación 1-a-1) ----------
    chats_pendientes = (
        db.query(func.count(func.distinct(MensajeChat.id_cliente)))
        .filter(MensajeChat.remitente_tipo == "cliente", MensajeChat.leido.is_(False))
        .scalar()
        or 0
    )

    # Respuestas de HOY hechas por ESTE usuario (id_usuario_remitente, no
    # id_empleado -- un admin sin perfil de empleado también puede
    # responder chats, y sigue contando como "su" respuesta).
    respuestas_hoy = (
        db.query(MensajeChat)
        .filter(
            MensajeChat.remitente_tipo == "admin",
            MensajeChat.id_usuario_remitente == usuario_id,
            MensajeChat.fecha_envio >= inicio_dia,
        )
        .all()
    )
    chats_respondidos_hoy = len({m.id_cliente for m in respuestas_hoy})

    # Tiempo de respuesta: para cada respuesta de hoy, el mensaje del
    # cliente inmediatamente anterior en el MISMO hilo (mismo id_cliente,
    # id_mensaje menor) -- N consultas pequeñas (N = mensajes que este
    # empleado respondió hoy, típicamente unas pocas decenas), no una sola
    # consulta agregada, porque "el mensaje anterior en el hilo" no es una
    # agregación simple por cliente cuando un mismo cliente escribe varias
    # veces en el día.
    tiempos_respuesta_min: list[float] = []
    for m in respuestas_hoy:
        anterior = (
            db.query(MensajeChat)
            .filter(
                MensajeChat.id_cliente == m.id_cliente,
                MensajeChat.remitente_tipo == "cliente",
                MensajeChat.id_mensaje < m.id_mensaje,
            )
            .order_by(MensajeChat.id_mensaje.desc())
            .first()
        )
        if anterior and anterior.fecha_envio and m.fecha_envio:
            diff_min = (m.fecha_envio - anterior.fecha_envio).total_seconds() / 60.0
            if diff_min >= 0:
                tiempos_respuesta_min.append(diff_min)

    tiempo_promedio_respuesta_minutos = (
        round(sum(tiempos_respuesta_min) / len(tiempos_respuesta_min), 1) if tiempos_respuesta_min else None
    )

    # ---------- Operación propia (0 si el usuario no tiene perfil de
    # empleado vinculado -- ej. un admin puro) ----------
    reservas_gestionadas = 0
    if id_empleado is not None:
        reservas_gestionadas = (
            db.query(func.count(Reserva.id_reserva)).filter(Reserva.id_empleado == id_empleado).scalar() or 0
        )

    # ---------- Cancelaciones: de TODA la agencia, no solo las que este
    # empleado resolvió (ver nota en ResumenEmpleadoResponse) ----------
    conteo_por_estado = dict(
        db.query(SolicitudCancelacion.estado, func.count(SolicitudCancelacion.id_solicitud))
        .group_by(SolicitudCancelacion.estado)
        .all()
    )
    cancelaciones_pendientes = conteo_por_estado.get("pendiente", 0)
    cancelaciones_aprobadas = conteo_por_estado.get("aprobada", 0)
    cancelaciones_rechazadas = conteo_por_estado.get("rechazada", 0)
    cancelaciones_total = sum(conteo_por_estado.values())

    return ResumenEmpleadoResponse(
        chats_pendientes=chats_pendientes,
        chats_respondidos_hoy=chats_respondidos_hoy,
        tiempo_promedio_respuesta_minutos=tiempo_promedio_respuesta_minutos,
        reservas_gestionadas=reservas_gestionadas,
        cancelaciones_pendientes=cancelaciones_pendientes,
        cancelaciones_aprobadas=cancelaciones_aprobadas,
        cancelaciones_rechazadas=cancelaciones_rechazadas,
        cancelaciones_total=cancelaciones_total,
    )
