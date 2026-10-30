import { useEffect, useState } from "react";
import {
  CalendarDays, CheckCircle, Hotel, PlusCircle, Package, Users,
  TrendingUp, TrendingDown, Minus, DollarSign, ArrowUpRight, AlertCircle,
  XCircle, Activity, Building2, Info, Percent, Clock, MessageCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  ComposedChart, Line, LineChart,
} from "recharts";
import { dashboardService, type DashboardResumen, type ResumenEmpleado, type TendenciaValor } from "../../services/dashboard.service";
import { reservaDetailService, type ActividadRecienteItem } from "../../services/reserva.service";
import StatusBadge from "./ui/StatusBadge";
import {
  Tooltip as InfoTooltip,
  TooltipTrigger as InfoTooltipTrigger,
  TooltipContent as InfoTooltipContent,
} from "../ui/tooltip";

interface Props {
  setActiveModule: (m: any) => void;
  /** Abre directamente el detalle de esa reserva dentro del módulo
   * Reservas — así "Reservas próximas" y "Actividad reciente" llevan al
   * recurso real en vez de solo cambiar de pestaña (ver punto 44,
   * "coherencia operacional", del brief de FASE A). */
  onVerReserva: (id: number) => void;
  /** Navega a un módulo dejando un filtro de estado pre-aplicado (ej. clic
   * en "Pendientes" de la tarjeta de Pagos abre Pagos ya filtrado por
   * "pendiente") — ver ModuleReservas/ModulePagos.estadoInicial. */
  onFiltrarModulo: (m: any, estado?: string) => void;
  /** true = quien ve este dashboard es un "empleado" (asesor) sin rol
   * admin -- además del resumen operativo general (sin cambios), muestra
   * una tarjeta "Mis KPIs" con sus propias cifras (chats, reservas
   * gestionadas) más un donut de cancelaciones de TODA la agencia (ya no
   * "procesadas por mí" -- solo admin resuelve, ver solicitud_cancelacion_route.py). */
  soloEmpleado?: boolean;
}

function formatDuracionHoras(horas: number): string {
  if (horas > 48) return `${(horas / 24).toFixed(1)} días`;
  return `${horas.toFixed(1)} h`;
}

// Para el tiempo de respuesta del chat (minutos, ver ResumenEmpleado) --
// escala mucho más chica que formatDuracionHoras (horas), así que redondear
// a horas de una perdería la precisión que sí importa acá (la diferencia
// entre responder en 3 minutos y en 25 es justo lo que este número debe
// mostrar).
function formatDuracionMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos.toFixed(1)} min`;
  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);
  return `${horas} h ${resto} min`;
}

// Formato relativo simple ("Hace 5 min", "Ayer") para el feed de actividad
// reciente — sin librerías nuevas, solo Date nativo.
function tiempoRelativo(fechaISO: string): string {
  const fecha = new Date(fechaISO).getTime();
  if (Number.isNaN(fecha)) return "";
  const diffMin = Math.floor((Date.now() - fecha) / 60000);
  if (diffMin < 1) return "Hace un momento";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `Hace ${diffHoras} h`;
  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias === 1) return "Ayer";
  if (diffDias < 30) return `Hace ${diffDias} días`;
  return new Date(fechaISO).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
}

// Paleta brand Alik Tours: granate, dorado, oscuro, crema, rosa
const COLORS = ["#7B1E3A", "#C9A227", "#2E2E2E", "#A13B55", "#E6D3C5", "#a83255"];

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente", confirmada: "Confirmada", cancelada: "Cancelada", finalizada: "Finalizada",
};
const ESTADO_COLORS: Record<string, string> = {
  pendiente: "#C9A227", confirmada: "#7B1E3A", cancelada: "#2E2E2E", finalizada: "#A13B55",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#2E2E2E] text-white px-3 py-2 rounded-lg text-xs shadow-xl">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {typeof p.value === "number" && p.value > 10000
              ? `$${p.value.toLocaleString("es-CO")}`
              : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ModuleDashboard({ setActiveModule, onVerReserva, onFiltrarModulo, soloEmpleado = false }: Props) {
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actividad, setActividad] = useState<ActividadRecienteItem[]>([]);
  // "Mis KPIs" -- solo se pide para el panel recortado del empleado (el
  // admin sigue viendo exactamente el mismo dashboard de siempre, sin
  // cambios, tal como se decidió en el brief). No crítico si falla: el
  // resto del dashboard (resumen operativo general) sigue funcionando
  // igual, la tarjeta simplemente no aparece.
  const [resumenEmpleado, setResumenEmpleado] = useState<ResumenEmpleado | null>(null);

  useEffect(() => {
    dashboardService.getResumen()
      .then((r) => { setResumen(r); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
    reservaDetailService.getActividadReciente(12).then(setActividad).catch(() => {});
  }, []);

  useEffect(() => {
    if (!soloEmpleado) return;
    dashboardService.getResumenEmpleado().then(setResumenEmpleado).catch(() => {});
  }, [soloEmpleado]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center text-muted-foreground">
        Cargando resumen operativo...
      </div>
    );
  }

  if (error || !resumen) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-muted-foreground gap-2">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">No se pudo cargar el resumen operativo. Intenta recargar la página.</p>
      </div>
    );
  }

  // ---------- Requiere atención ----------
  type Tono = "critico" | "medio" | "info";
  const alertas: { tono: Tono; texto: string; onClick: () => void }[] = [];
  if (resumen.solicitudes_cancelacion_pendientes > 0) {
    const n = resumen.solicitudes_cancelacion_pendientes;
    alertas.push({
      tono: "critico",
      texto: `${n} solicitud${n > 1 ? "es" : ""} de cancelación pendiente${n > 1 ? "s" : ""}`,
      onClick: () => setActiveModule("cancelaciones"),
    });
  }
  if (resumen.pagos_fallidos > 0) {
    const n = resumen.pagos_fallidos;
    alertas.push({
      tono: "critico",
      texto: `${n} transacción${n > 1 ? "es" : ""} fallida${n > 1 ? "s" : ""}`,
      onClick: () => setActiveModule("pagos"),
    });
  }
  if (resumen.pagos_pendientes > 0) {
    const n = resumen.pagos_pendientes;
    alertas.push({
      tono: "medio",
      texto: `${n} pago${n > 1 ? "s" : ""} pendiente${n > 1 ? "s" : ""} de confirmar`,
      onClick: () => setActiveModule("pagos"),
    });
  }
  if (resumen.contactos_empresariales_pendientes != null && resumen.contactos_empresariales_pendientes > 0) {
    const n = resumen.contactos_empresariales_pendientes;
    alertas.push({
      tono: "info",
      texto: `${n} empresa${n > 1 ? "s" : ""} esperando contacto`,
      onClick: () => setActiveModule("empresas"),
    });
  }

  const TONO_BG: Record<Tono, string> = {
    critico: "bg-[#f5e6e6] hover:bg-[#f0d8d8]", medio: "bg-[#fdf6e3] hover:bg-[#fbeecb]", info: "bg-[#e6f0fa] hover:bg-[#d6e8f7]",
  };
  const TONO_TEXT: Record<Tono, string> = {
    critico: "text-[#c62828]", medio: "text-[#C9A227]", info: "text-[#2563EB]",
  };
  const TONO_EMOJI: Record<Tono, string> = { critico: "🔴", medio: "🟡", info: "🔵" };

  // ---------- Charts derivados del resumen ----------
  const estadoData = Object.entries(resumen.reservas_por_estado)
    .map(([estado, value]) => ({ name: ESTADO_LABELS[estado] ?? estado, value, color: ESTADO_COLORS[estado] ?? "#999" }))
    .filter((d) => d.value > 0);

  // Cancelaciones de TODA la agencia, para el donut de "Mis KPIs" del
  // empleado (ver ResumenEmpleado) -- mismos colores que los StatCard de
  // ModuleCancelaciones.tsx para que se reconozca de un vistazo.
  const cancelacionesData = resumenEmpleado ? [
    { name: "Pendientes", value: resumenEmpleado.cancelaciones_pendientes, color: "#C9A227" },
    { name: "Aprobadas", value: resumenEmpleado.cancelaciones_aprobadas, color: "#10b981" },
    { name: "Rechazadas", value: resumenEmpleado.cancelaciones_rechazadas, color: "#ef4444" },
  ].filter((d) => d.value > 0) : [];

  const evolucionMensual = resumen.reservas_por_mes.map((r, i) => ({
    mes: formatMes(r.mes),
    reservas: r.total,
    canceladas: resumen.cancelaciones_por_mes[i]?.total ?? 0,
  }));

  const paquetesData = resumen.paquetes_mas_solicitados.map((p) => ({
    name: p.nombre.split(" ").slice(0, 3).join(" "),
    reservas: p.total,
  }));

  const metodosData = resumen.ingresos_por_metodo.map((m) => ({ name: m.nombre, monto: m.monto ?? 0 }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Qué está pasando hoy en Alik Tours y qué necesita tu atención</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f1e4e8] border border-[rgba(123,30,58,0.2)] rounded-full">
          <div className="w-2 h-2 bg-[#7B1E3A] rounded-full animate-pulse" />
          <span className="text-xs font-medium text-[#7B1E3A]">Sistema activo</span>
        </div>
      </div>

      {/* Requiere atención */}
      <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-primary" /> Requiere atención
        </h3>
        {alertas.length === 0 ? (
          <div className="flex items-center gap-2 p-3 bg-[#f1e4e8] rounded-xl">
            <CheckCircle className="w-4 h-4 text-[#7B1E3A] flex-shrink-0" />
            <p className="text-sm text-[#7B1E3A] font-medium">Todo en orden — nada requiere tu atención ahora mismo.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {alertas.map((a, i) => (
              <button
                key={i}
                onClick={a.onClick}
                className={`flex items-center gap-2.5 p-3 rounded-xl text-left transition-all hover:shadow-sm ${TONO_BG[a.tono]}`}
              >
                <span className="text-base leading-none flex-shrink-0">{TONO_EMOJI[a.tono]}</span>
                <span className={`text-sm font-medium flex-1 ${TONO_TEXT[a.tono]}`}>{a.texto}</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mis KPIs -- solo panel recortado del empleado */}
      {soloEmpleado && resumenEmpleado && (
        <div>
          <h3 className="font-semibold text-foreground mb-3">Mis KPIs</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <GrupoResumen icon={MessageCircle} titulo="Chats">
              <FilaResumen
                label="Pendientes por responder"
                value={resumenEmpleado.chats_pendientes}
                strong
                onClick={() => setActiveModule("mensajes")}
              />
              <FilaResumen
                label="Respondidos hoy"
                value={resumenEmpleado.chats_respondidos_hoy}
                onClick={() => setActiveModule("mensajes")}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Tiempo de respuesta (hoy)</span>
                {resumenEmpleado.tiempo_promedio_respuesta_minutos == null ? (
                  <span className="text-xs text-muted-foreground italic">Sin datos</span>
                ) : (
                  <span className="font-medium text-foreground">
                    {formatDuracionMinutos(resumenEmpleado.tiempo_promedio_respuesta_minutos)}
                  </span>
                )}
              </div>
            </GrupoResumen>
            <GrupoResumen icon={CalendarDays} titulo="Reservas">
              <FilaResumen
                label="Gestionadas por mí"
                value={resumenEmpleado.reservas_gestionadas}
                strong
                onClick={() => setActiveModule("reservas")}
              />
            </GrupoResumen>
            <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground/70 mb-3 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Cancelaciones (agencia)
              </p>
              {cancelacionesData.length > 0 ? (
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width={84} height={84}>
                    <PieChart>
                      <Pie data={cancelacionesData} cx="50%" cy="50%" outerRadius={41} innerRadius={25} dataKey="value" paddingAngle={2}>
                        {cancelacionesData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 text-sm min-w-0">
                    <FilaResumen label="Pendientes" value={resumenEmpleado.cancelaciones_pendientes} onClick={() => setActiveModule("cancelaciones")} />
                    <FilaResumen label="Aprobadas" value={resumenEmpleado.cancelaciones_aprobadas} onClick={() => setActiveModule("cancelaciones")} />
                    <FilaResumen label="Rechazadas" value={resumenEmpleado.cancelaciones_rechazadas} onClick={() => setActiveModule("cancelaciones")} />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveModule("cancelaciones")}
                  className="w-full h-[84px] flex items-center justify-center text-muted-foreground text-xs hover:text-foreground transition-colors"
                >
                  Sin solicitudes registradas todavía
                </button>
              )}
              <div className="mt-3 pt-3 border-t border-border/60">
                <FilaResumen
                  label="Total"
                  value={resumenEmpleado.cancelaciones_total}
                  strong
                  onClick={() => setActiveModule("cancelaciones")}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Todo lo de aqui para abajo es agregado/negocio de TODA la
          agencia (resumen operativo, tendencias, charts, actividad
          reciente) -- nunca datos propios del empleado, asi que el
          panel recortado no lo muestra (ver "Mis KPIs" arriba, que si
          es de el). Acciones rapidas tambien se oculta aca porque
          duplica el quickActions de soloEmpleado en Admindashboard.tsx. */}
      {!soloEmpleado && (
      <>
      {/* Resumen operativo */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Resumen operativo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GrupoResumen icon={CalendarDays} titulo="Reservas">
            <FilaResumen label="Total" value={resumen.reservas_total} strong onClick={() => onFiltrarModulo("reservas")} />
            <FilaResumen label="Confirmadas" value={resumen.reservas_confirmadas} onClick={() => onFiltrarModulo("reservas", "confirmada")} />
            <FilaResumen label="Pendientes" value={resumen.reservas_pendientes} onClick={() => onFiltrarModulo("reservas", "pendiente")} />
            <FilaResumen label="Canceladas" value={resumen.reservas_canceladas} onClick={() => onFiltrarModulo("reservas", "cancelada")} />
            <FilaResumen label="Finalizadas" value={resumen.reservas_finalizadas} onClick={() => onFiltrarModulo("reservas", "finalizada")} />
          </GrupoResumen>
          <GrupoResumen icon={DollarSign} titulo="Pagos">
            <FilaResumen label="Pagados" value={resumen.pagos_pagados} strong onClick={() => onFiltrarModulo("pagos", "pagado")} />
            <FilaResumen label="Pendientes" value={resumen.pagos_pendientes} onClick={() => onFiltrarModulo("pagos", "pendiente")} />
            <FilaResumen label="Fallidos" value={resumen.pagos_fallidos} onClick={() => onFiltrarModulo("pagos", "rechazado")} />
            <FilaResumen label="Reembolsos" value={resumen.pagos_reembolsados} />
          </GrupoResumen>
          <GrupoResumen icon={Users} titulo="Clientes">
            <FilaResumen label="Total" value={resumen.clientes_total} strong onClick={() => onFiltrarModulo("clientes")} />
            <FilaResumen label="Nuevos este mes" value={resumen.clientes_nuevos_mes} onClick={() => onFiltrarModulo("clientes")} />
            <FilaResumen label="Activos" value={resumen.clientes_activos} onClick={() => onFiltrarModulo("clientes")} />
            <FilaResumen label="Con viaje próximo" value={resumen.clientes_con_reserva_proxima} onClick={() => onFiltrarModulo("clientes")} />
          </GrupoResumen>
          <GrupoResumen icon={Activity} titulo="Operación (7 días)">
            <FilaResumen label="Check-ins próximos" value={resumen.checkins_proximos_7d} strong />
            <FilaResumen label="Check-outs próximos" value={resumen.checkouts_proximos_7d} />
            <FilaResumen label="Cancelaciones pend." value={resumen.solicitudes_cancelacion_pendientes} onClick={() => onFiltrarModulo("cancelaciones")} />
            <FilaResumen label="Contactos pend." value={resumen.contactos_empresariales_pendientes} onClick={() => onFiltrarModulo("empresas")} />
          </GrupoResumen>
        </div>
      </div>

      {/* Tendencias */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Tendencias del mes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <TarjetaTendencia
            label="Reservas" tendencia={resumen.tendencia_reservas} icon={CalendarDays}
            serie={resumen.reservas_ultimos_14d} onClick={() => onFiltrarModulo("reservas")}
          />
          <TarjetaTendencia
            label="Ingresos" tendencia={resumen.tendencia_ingresos} icon={DollarSign} formato="moneda"
            serie={resumen.ingresos_ultimos_14d} onClick={() => onFiltrarModulo("pagos", "pagado")}
          />
          <TarjetaTendencia
            label="Cancelaciones" tendencia={resumen.tendencia_cancelaciones} icon={XCircle} invertido
            onClick={() => onFiltrarModulo("reservas", "cancelada")}
          />
          <TarjetaTendencia
            label="Clientes nuevos" tendencia={resumen.tendencia_clientes_nuevos} icon={Users}
            onClick={() => onFiltrarModulo("clientes")}
          />
        </div>
      </div>

      {/* Métricas derivadas — calculadas con las tablas ya existentes (ver
          dashboard_route.py): conversión, cancelación y tiempo de
          confirmación. None cuando todavía no hay base real para el
          cálculo (ninguna reserva, o ninguna confirmada todavía). */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Métricas derivadas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TarjetaMetricaSimple
            label="Tasa de conversión" icon={Percent} valorTexto={resumen.tasa_conversion_pct != null ? `${resumen.tasa_conversion_pct}%` : null}
            descripcion="Reservas que llegaron a confirmarse" onClick={() => onFiltrarModulo("reservas", "confirmada")}
          />
          <TarjetaMetricaSimple
            label="Tasa de cancelación" icon={XCircle} valorTexto={resumen.tasa_cancelacion_pct != null ? `${resumen.tasa_cancelacion_pct}%` : null}
            descripcion="Reservas que terminaron canceladas" onClick={() => onFiltrarModulo("reservas", "cancelada")}
          />
          <TarjetaMetricaSimple
            label="Tiempo de confirmación" icon={Clock}
            valorTexto={resumen.tiempo_promedio_confirmacion_horas != null ? formatDuracionHoras(resumen.tiempo_promedio_confirmacion_horas) : null}
            descripcion="Promedio entre crear la reserva y confirmarla"
          />
        </div>
      </div>

      {/* Charts fila 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Estados de reservas</h3>
              <p className="text-xs text-muted-foreground">Distribución actual</p>
            </div>
            <span className="text-xs bg-[#f1e4e8] text-[#7B1E3A] px-2 py-1 rounded-full font-medium">
              {resumen.reservas_total} total
            </span>
          </div>
          {estadoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={estadoData} cx="50%" cy="45%" outerRadius={75} innerRadius={40} dataKey="value" paddingAngle={3}>
                  {estadoData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground flex-col gap-2">
              <AlertCircle className="w-8 h-8" /><p className="text-sm">Sin datos</p>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Reservas y cancelaciones por mes</h3>
              <p className="text-xs text-muted-foreground">Últimos 6 meses, por fecha real de creación / cancelación</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={evolucionMensual}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(123,30,58,0.08)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="reservas" name="Reservas" fill="#7B1E3A" radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="canceladas" name="Canceladas" stroke="#c62828" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts fila 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Paquetes más solicitados</h3>
              <p className="text-xs text-muted-foreground">Por número de reservas</p>
            </div>
          </div>
          {paquetesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={paquetesData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(123,30,58,0.08)" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="reservas" name="Reservas" radius={[0, 6, 6, 0]}>
                  {paquetesData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground flex-col gap-2">
              <Package className="w-8 h-8" /><p className="text-sm">Sin datos</p>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Ingresos por método de pago</h3>
              <p className="text-xs text-muted-foreground">Solo pagos realmente aprobados</p>
            </div>
          </div>
          {metodosData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metodosData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(123,30,58,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="monto" name="Monto" radius={[6, 6, 0, 0]}>
                  {metodosData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground flex-col gap-2">
              <DollarSign className="w-8 h-8" /><p className="text-sm">Sin pagos aprobados registrados</p>
            </div>
          )}
        </div>
      </div>

      {/* Reservas próximas + Actividad reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Reservas próximas</h3>
              <p className="text-xs text-muted-foreground">Viajes que arrancan pronto — dan seguimiento al cliente</p>
            </div>
          </div>
          {resumen.reservas_proximas.length > 0 ? (
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
              {resumen.reservas_proximas.map((r) => (
                <button
                  key={r.id_reserva}
                  onClick={() => onVerReserva(r.id_reserva)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-all text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">#{r.id_reserva} · {r.cliente_nombre}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.hotel_nombre || r.nombre_paquete || "Sin hotel asignado"} · {new Date(r.fecha_inicio).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} → {new Date(r.fecha_fin).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} · {r.numero_personas} huésped{r.numero_personas > 1 ? "es" : ""}
                    </p>
                  </div>
                  <StatusBadge status={r.estado} className="flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground flex-col gap-2">
              <CalendarDays className="w-8 h-8" /><p className="text-sm">No hay viajes próximos por ahora</p>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Actividad reciente</h3>
          </div>
          {actividad.length > 0 ? (
            <div className="space-y-1 max-h-[340px] overflow-y-auto">
              {actividad.map((item) => (
                <button
                  key={item.id_historial}
                  onClick={() => onVerReserva(item.id_reserva)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-accent transition-colors text-left"
                >
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Reserva #{item.id_reserva}</span>
                      {item.estado_nuevo ? ` ${item.estado_nuevo}` : " actualizada"}
                      {item.nombre_empleado && item.nombre_empleado !== "Sistema" ? ` · ${item.nombre_empleado}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tiempoRelativo(item.fecha_cambio)}</p>
                  </div>
                  {item.estado_nuevo && <StatusBadge status={item.estado_nuevo} className="flex-shrink-0" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground flex-col gap-2">
              <Activity className="w-8 h-8" /><p className="text-sm">Todavía no hay actividad registrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Acciones rápidas con contexto real */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <h3 className="font-semibold text-foreground mb-4">Acciones rápidas</h3>
        {/* Antes cada botón tenía su propio gradiente saturado (granate,
            rosa, dorado, rojo, gris, azul) compitiendo entre sí -- se veía
            como un arcoíris en vez de un panel. Ahora todos comparten el
            mismo fondo neutro (misma tarjeta que el resto del dashboard) y
            solo el ícono lleva un acento de color, que sigue marcando la
            urgencia real (rojo = cancelaciones, dorado = pendiente) sin
            gritar. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[
            { label: "Nueva reserva", mod: "crear-reserva", icon: PlusCircle, tint: "bg-primary/10 text-primary" },
            { label: "Registrar hotel", mod: "hoteles", icon: Hotel, tint: "bg-primary/10 text-primary" },
            { label: "Crear paquete", mod: "paquetes", icon: Package, tint: "bg-[#C9A227]/15 text-[#8a6d10] dark:text-[#C9A227]" },
            {
              label: `Ver cancelaciones${resumen.solicitudes_cancelacion_pendientes ? ` (${resumen.solicitudes_cancelacion_pendientes})` : ""}`,
              mod: "cancelaciones", icon: XCircle, tint: "bg-destructive/10 text-destructive",
            },
            {
              label: `Pagos pendientes${resumen.pagos_pendientes ? ` (${resumen.pagos_pendientes})` : ""}`,
              mod: "pagos", icon: DollarSign, tint: "bg-muted text-foreground",
            },
            ...(resumen.contactos_empresariales_pendientes != null
              ? [{
                  label: `Contactos pendientes${resumen.contactos_empresariales_pendientes ? ` (${resumen.contactos_empresariales_pendientes})` : ""}`,
                  mod: "empresas", icon: Building2, tint: "bg-[#2563EB]/10 text-[#2563EB]",
                }]
              : []),
            { label: "Ver clientes", mod: "clientes", icon: Users, tint: "bg-primary/10 text-primary" },
          ].map(({ label, mod, icon: Icon, tint }) => (
            <button
              key={mod}
              onClick={() => setActiveModule(mod)}
              className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:border-primary/30 hover:shadow-md transition-all"
            >
              <span className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${tint}`}>
                <Icon className="w-4 h-4" />
              </span>
              {label}
              <ArrowUpRight className="w-3 h-3 ml-auto opacity-70 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

// ─── Sub-componentes internos (solo los usa este archivo) ──────────────────

function GrupoResumen({ icon: Icon, titulo, children }: { icon: any; titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
      <p className="text-xs font-bold uppercase tracking-wide text-foreground/70 mb-3 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {titulo}
      </p>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

function FilaResumen({
  label, value, strong, onClick,
}: { label: string; value: number | null; strong?: boolean; onClick?: () => void }) {
  const contenido = (
    <>
      <span className={onClick ? "" : "text-muted-foreground"}>{label}</span>
      {value == null ? (
        <span className="text-xs text-muted-foreground italic">Sin datos</span>
      ) : (
        <span className={strong ? "font-bold text-foreground text-base" : "font-medium text-foreground"}>
          {value.toLocaleString("es-CO")}
        </span>
      )}
    </>
  );

  if (!onClick) {
    return <div className="flex items-center justify-between gap-2">{contenido}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 -mx-1.5 px-1.5 py-0.5 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors text-left"
    >
      {contenido}
    </button>
  );
}

function TarjetaTendencia({
  label, tendencia, icon: Icon, formato, invertido, serie, onClick,
}: {
  label: string; tendencia: TendenciaValor; icon: any; formato?: "moneda"; invertido?: boolean;
  /** Serie de los últimos 14 días para el mini-sparkline — solo Reservas e
   * Ingresos la tienen hoy (ver dashboard_route.py); el resto de tarjetas
   * simplemente no la reciben y no muestran sparkline. */
  serie?: { fecha: string; total: number }[];
  onClick?: () => void;
}) {
  const valorFmt = formato === "moneda"
    ? `$${(tendencia.actual / 1000000).toFixed(1)}M`
    : tendencia.actual.toLocaleString("es-CO");

  let contenidoTendencia: React.ReactNode;
  if (tendencia.variacion_pct == null) {
    contenidoTendencia = (
      <InfoTooltip>
        <InfoTooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-help">
            <Info className="w-3.5 h-3.5" /> Sin variación calculable
          </span>
        </InfoTooltipTrigger>
        <InfoTooltipContent>
          <p className="max-w-[220px]">
            El mes anterior no tuvo actividad suficiente para calcular un cambio real.
          </p>
        </InfoTooltipContent>
      </InfoTooltip>
    );
  } else {
    const positivo = tendencia.variacion_pct > 0;
    const neutro = tendencia.variacion_pct === 0;
    const esBueno = neutro ? null : invertido ? !positivo : positivo;
    const TrendIcon = neutro ? Minus : positivo ? TrendingUp : TrendingDown;
    const colorCls = neutro ? "text-muted-foreground" : esBueno ? "text-success" : "text-destructive";
    contenidoTendencia = (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${colorCls}`}>
        <TrendIcon className="w-3.5 h-3.5" />
        {positivo ? "+" : ""}{tendencia.variacion_pct}% vs. mes anterior
      </span>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-2xl p-4 shadow-sm border border-border ${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground mb-1">{valorFmt}</p>
      {contenidoTendencia}
      {serie && serie.length > 1 && (
        <div className="h-8 -mx-1 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
              <Line
                type="monotone" dataKey="total" stroke="#7B1E3A" strokeWidth={1.75}
                dot={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function TarjetaMetricaSimple({
  label, icon: Icon, valorTexto, descripcion, onClick,
}: { label: string; icon: any; valorTexto: string | null; descripcion: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-2xl p-4 shadow-sm border border-border ${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      {valorTexto == null ? (
        <p className="text-sm text-muted-foreground italic">Sin datos suficientes todavía</p>
      ) : (
        <p className="text-2xl font-bold text-foreground mb-1">{valorTexto}</p>
      )}
      <p className="text-xs text-muted-foreground">{descripcion}</p>
    </div>
  );
}
