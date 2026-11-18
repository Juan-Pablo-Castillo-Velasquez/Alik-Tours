from datetime import date

from pydantic import BaseModel


class TendenciaValor(BaseModel):
    """Un valor con su variación real contra el período (mes calendario)
    anterior. `variacion_pct` es None cuando el período anterior no tiene
    datos suficientes para calcular un porcentaje real (evita inventar un
    +/-100% falso al dividir desde cero) — el frontend debe mostrar
    'Sin datos suficientes' en ese caso, nunca un número inventado."""

    actual: float
    anterior: float
    variacion_pct: float | None = None


class ReservaProximaItem(BaseModel):
    id_reserva: int
    cliente_nombre: str
    hotel_nombre: str | None = None
    nombre_paquete: str | None = None
    fecha_inicio: date
    fecha_fin: date
    numero_personas: int
    estado: str


class ConteoNombre(BaseModel):
    nombre: str
    total: int
    monto: float | None = None


class ReservasPorMesItem(BaseModel):
    mes: str  # "2026-06"
    total: int


class MesComercialItem(BaseModel):
    """Un mes calendario con sus reservas creadas y lo cobrado (pagos
    aprobados por fecha de pago)."""

    mes: str  # "2026-06"
    reservas: int
    ingresos: float


class SerieDiariaItem(BaseModel):
    """Un punto de una serie de los últimos 14 días (para sparklines) —
    `total` es genérico (cuenta de reservas o suma de ingresos según el
    campo que lo use)."""

    fecha: str  # "2026-08-20"
    total: float


class DashboardResumenResponse(BaseModel):
    # ---- Reservas ----
    reservas_total: int
    reservas_confirmadas: int
    reservas_pendientes: int
    reservas_canceladas: int
    reservas_finalizadas: int

    # ---- Pagos (ingresos_totales solo cuenta pagos con estado 'pagado' —
    # un pago pendiente o rechazado nunca es ingreso real) ----
    pagos_pagados: int
    pagos_pendientes: int
    pagos_fallidos: int
    # No existe todavía el concepto de reembolso en el modelo de Pago —
    # None a propósito, nunca 0 fabricado (0 significaría "sabemos que no
    # hay ninguno", que no es lo mismo que "no lo medimos todavía").
    pagos_reembolsados: int | None = None
    ingresos_totales: float
    ticket_promedio: float | None = None

    # ---- Clientes ----
    clientes_total: int
    clientes_nuevos_mes: int
    # "Activo" = tiene al menos una reserva registrada (no es un flag en BD,
    # es una definición de negocio real y consistente, no inventada por
    # reserva individual).
    clientes_activos: int
    clientes_con_reserva_proxima: int

    # ---- Operación ----
    checkins_proximos_7d: int
    checkouts_proximos_7d: int
    solicitudes_cancelacion_pendientes: int
    # None si la tabla solicitudes_corporativas todavía no existe en esta
    # base de datos (migración f1b8d3a75c26 pendiente de `alembic upgrade head`).
    contactos_empresariales_pendientes: int | None = None

    # ---- Tendencias: mes calendario actual vs. el anterior ----
    tendencia_reservas: TendenciaValor
    tendencia_ingresos: TendenciaValor
    tendencia_cancelaciones: TendenciaValor
    tendencia_clientes_nuevos: TendenciaValor

    # ---- Gráficos ----
    reservas_por_estado: dict
    ingresos_por_metodo: list[ConteoNombre]
    paquetes_mas_solicitados: list[ConteoNombre]
    reservas_por_mes: list[ReservasPorMesItem]
    cancelaciones_por_mes: list[ReservasPorMesItem]

    reservas_proximas: list[ReservaProximaItem]

    hoteles_activos: int
    paquetes_activos: int

    # ---- Métricas derivadas (calculables con las tablas ya existentes —
    # ninguna requiere una tabla nueva) ----
    # % de reservas creadas que llegaron a 'confirmada'. None solo si no hay
    # ninguna reserva todavía (no hay base sobre la que calcular un %).
    tasa_conversion_pct: float | None = None
    # % de reservas creadas que terminaron 'cancelada'.
    tasa_cancelacion_pct: float | None = None
    # Horas promedio entre que se crea una reserva (reservas.fecha_reserva)
    # y el primer momento en que pasa a 'confirmada' (historial_reservas).
    # None si todavía ninguna reserva ha sido confirmada.
    tiempo_promedio_confirmacion_horas: float | None = None

    # ---- Series diarias (últimos 14 días) para sparklines ----
    reservas_ultimos_14d: list[SerieDiariaItem]
    ingresos_ultimos_14d: list[SerieDiariaItem]

    # ---- Vista comercial (dashboard del admin) ----
    # Últimos 6 meses: reservas creadas + ingresos cobrados en cada mes.
    comercial_por_mes: list[MesComercialItem] = []
    # Reservas no canceladas por tipo de producto (total) y lo cobrado por
    # cada tipo (monto). "Otros" agrupa reservas viejas sin tipo.
    ventas_por_producto: list[ConteoNombre] = []
    # Reservas por canal de origen (web, asesor, teléfono).
    reservas_por_canal: list[ConteoNombre] = []
    hoteles_mas_reservados: list[ConteoNombre] = []
    # Reservas creadas este mes por cada asesor (Reserva.id_empleado).
    asesores_top_mes: list[ConteoNombre] = []
    # Saldo que falta cobrar de las reservas vigentes (pendientes y
    # confirmadas): total de cada reserva menos sus pagos aprobados.
    cartera_por_cobrar: float = 0
    reservas_con_saldo: int = 0
    ingresos_hoy: float = 0
    reservas_hoy: int = 0


class ResumenEmpleadoResponse(BaseModel):
    """KPIs propios de UN empleado (asesor) para la sección "Mis KPIs" del
    panel recortado del empleado -- ver GET /api/dashboard/resumen-empleado.
    Complementa (no reemplaza) a DashboardResumenResponse: el panel del
    empleado sigue mostrando también los KPIs generales de arriba, sin
    cambios (mismo endpoint /resumen que ya usa el admin)."""

    # ---- Chat (bandeja compartida -- no hay asignación 1-a-1 admin/empleado
    # <-> cliente, así que "pendientes" es el mismo total que ve cualquier
    # asesor: cuántas conversaciones tienen al menos un mensaje del cliente
    # todavía sin responder) ----
    chats_pendientes: int
    # De ESTOS, cuántos respondió HOY el empleado que pide este resumen.
    chats_respondidos_hoy: int
    # Minutos promedio entre el mensaje del cliente y la respuesta de este
    # empleado, sobre las respuestas de HOY. None si hoy todavía no respondió
    # ningún mensaje (no hay base sobre la que calcular un promedio).
    tiempo_promedio_respuesta_minutos: float | None = None

    # ---- Operación propia (Reserva.id_empleado -- ya existía en el
    # modelo) ----
    reservas_gestionadas: int

    # ---- Cancelaciones: vista de TODA la agencia, no solo "mías" -- desde
    # que solo el admin puede aprobar/rechazar (ver
    # solicitud_cancelacion_route.py), "cancelaciones que procesé yo" ya no
    # tiene sentido para un asesor. El asesor sigue viendo la cola completa
    # y puede registrar solicitudes nuevas (rol de "llamar y avisar al
    # admin"), así que estas cifras son agregadas de toda la agencia, igual
    # que las que ya ve el admin en el módulo de Cancelaciones. ----
    cancelaciones_pendientes: int
    cancelaciones_aprobadas: int
    cancelaciones_rechazadas: int
    cancelaciones_total: int

    # ---- Mis números del mes (Reserva.id_empleado = este asesor) ----
    nombre: str | None = None
    reservas_gestionadas_mes: int = 0
    reservas_gestionadas_mes_anterior: int = 0
    # Lo cobrado (pagos aprobados este mes) en reservas a cargo del asesor.
    ventas_cobradas_mes: float = 0
    # Mis reservas vigentes que aún tienen saldo por cobrar.
    mis_reservas_con_saldo: int = 0
    mis_reservas_pendientes: int = 0
    # Puesto en el ranking de reservas del mes (1 = el que más registró).
    # None si este mes no registró ninguna.
    posicion_ranking_mes: int | None = None
    asesores_activos_mes: int = 0
