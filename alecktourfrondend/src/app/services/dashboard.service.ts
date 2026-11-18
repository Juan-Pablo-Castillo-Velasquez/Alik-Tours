import { apiFetch } from "../api/v1/api";

export interface TendenciaValor {
  actual: number;
  anterior: number;
  /** null cuando el período anterior no tiene datos suficientes para un
   * porcentaje real — nunca se calcula un +/-100% inventado desde cero. */
  variacion_pct: number | null;
}

export interface ReservaProximaItem {
  id_reserva: number;
  cliente_nombre: string;
  hotel_nombre: string | null;
  nombre_paquete: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  numero_personas: number;
  estado: string;
}

export interface ConteoNombre {
  nombre: string;
  total: number;
  monto: number | null;
}

export interface ReservasPorMesItem {
  mes: string; // "2026-06"
  total: number;
}

export interface MesComercialItem {
  mes: string; // "2026-06"
  reservas: number;
  ingresos: number;
}

export interface SerieDiariaItem {
  fecha: string; // "2026-08-20"
  total: number;
}

// Espejo exacto de DashboardResumenResponse (backend/app/schemas/dashboard_schema.py).
// Todo lo que llega en null significa "no hay información real suficiente para
// calcular esto todavía" — nunca se debe reemplazar por un 0 inventado en la UI.
export interface DashboardResumen {
  reservas_total: number;
  reservas_confirmadas: number;
  reservas_pendientes: number;
  reservas_canceladas: number;
  reservas_finalizadas: number;

  pagos_pagados: number;
  pagos_pendientes: number;
  pagos_fallidos: number;
  pagos_reembolsados: number | null;
  ingresos_totales: number;
  ticket_promedio: number | null;

  clientes_total: number;
  clientes_nuevos_mes: number;
  clientes_activos: number;
  clientes_con_reserva_proxima: number;

  checkins_proximos_7d: number;
  checkouts_proximos_7d: number;
  solicitudes_cancelacion_pendientes: number;
  contactos_empresariales_pendientes: number | null;

  tendencia_reservas: TendenciaValor;
  tendencia_ingresos: TendenciaValor;
  tendencia_cancelaciones: TendenciaValor;
  tendencia_clientes_nuevos: TendenciaValor;

  reservas_por_estado: Record<string, number>;
  ingresos_por_metodo: ConteoNombre[];
  paquetes_mas_solicitados: ConteoNombre[];
  reservas_por_mes: ReservasPorMesItem[];
  cancelaciones_por_mes: ReservasPorMesItem[];

  reservas_proximas: ReservaProximaItem[];

  hoteles_activos: number;
  paquetes_activos: number;

  // Métricas derivadas — null solo cuando todavía no hay base real para
  // calcularlas (ver dashboard_route.py), nunca un 0/100 inventado.
  tasa_conversion_pct: number | null;
  tasa_cancelacion_pct: number | null;
  tiempo_promedio_confirmacion_horas: number | null;

  reservas_ultimos_14d: SerieDiariaItem[];
  ingresos_ultimos_14d: SerieDiariaItem[];

  // ---- Vista comercial (dashboard del admin) ----
  comercial_por_mes: MesComercialItem[];
  ventas_por_producto: ConteoNombre[];
  reservas_por_canal: ConteoNombre[];
  hoteles_mas_reservados: ConteoNombre[];
  asesores_top_mes: ConteoNombre[];
  cartera_por_cobrar: number;
  reservas_con_saldo: number;
  ingresos_hoy: number;
  reservas_hoy: number;
}

// Espejo exacto de ResumenEmpleadoResponse (backend/app/schemas/dashboard_schema.py)
// -- KPIs propios de UN empleado (asesor), para la sección "Mis KPIs" del
// panel recortado del empleado. Complementa a DashboardResumen (arriba),
// que el empleado sigue viendo tal cual -- ver GET /dashboard/resumen-empleado.
export interface ResumenEmpleado {
  chats_pendientes: number;
  chats_respondidos_hoy: number;
  tiempo_promedio_respuesta_minutos: number | null;
  reservas_gestionadas: number;
  // Cancelaciones de TODA la agencia (no solo las que resolvió este
  // empleado) -- desde que solo el admin aprueba/rechaza, ver nota en
  // ResumenEmpleadoResponse en el backend.
  cancelaciones_pendientes: number;
  cancelaciones_aprobadas: number;
  cancelaciones_rechazadas: number;
  cancelaciones_total: number;
}

export const dashboardService = {
  getResumen: () => apiFetch<DashboardResumen>("/dashboard/resumen"),
  getResumenEmpleado: () => apiFetch<ResumenEmpleado>("/dashboard/resumen-empleado"),
};
