import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Globe,
  Headset,
  Hotel,
  Megaphone,
  Minus,
  Package,
  Percent,
  Phone,
  Plane,
  PlusCircle,
  Receipt,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ConteoNombre, DashboardResumen, TendenciaValor } from "../../services/dashboard.service";
import type { ActividadRecienteItem } from "../../services/reserva.service";
import AdornoTarjeta from "../temporada/AdornoTarjeta";
import type { Module } from "./types";
import StatusBadge from "./ui/StatusBadge";

// Dashboard comercial del administrador. Todas las cifras vienen de
// GET /api/dashboard/resumen (SQL sobre las tablas reales); nada se
// inventa: donde no hay datos se dice "Sin datos" en vez de un 0 o un %.

interface Props {
  resumen: DashboardResumen;
  actividad: ActividadRecienteItem[];
  nombreUsuario?: string;
  actualizando: boolean;
  onActualizar: () => void;
  setActiveModule: (m: Module) => void;
  onVerReserva: (id: number) => void;
  onFiltrarModulo: (m: Module, estado?: string) => void;
}

const ZONA = "America/Bogota";

// ---------- Formatos ----------
const pesos = (v: number) => `$${Math.round(v).toLocaleString("es-CO")}`;
function pesosCortos(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `$${(v / 1_000_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} mil M`;
  if (a >= 1_000_000) return `$${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  if (a >= 1_000) return `$${(v / 1_000).toLocaleString("es-CO", { maximumFractionDigits: 0 })} mil`;
  return pesos(v);
}
const formatMes = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
};
const formatDia = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(".", "");
};
function tiempoRelativo(fechaISO: string): string {
  const fecha = new Date(fechaISO).getTime();
  if (Number.isNaN(fecha)) return "";
  const min = Math.floor((Date.now() - fecha) / 60000);
  if (min < 1) return "Hace un momento";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Ayer" : `Hace ${d} días`;
}
function duracion(horas: number): string {
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas > 48) return `${(horas / 24).toLocaleString("es-CO", { maximumFractionDigits: 1 })} días`;
  return `${horas.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h`;
}

function saludo(): string {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: ZONA }));
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendientes",
  confirmada: "Confirmadas",
  finalizada: "Finalizadas",
  cancelada: "Canceladas",
};
const ESTADO_COLOR: Record<string, string> = {
  pendiente: "var(--gold)",
  confirmada: "var(--primary)",
  finalizada: "#10b981",
  cancelada: "#94a3b8",
};
const PALETA = ["var(--primary)", "var(--gold)", "#0ea5e9", "#10b981", "#a855f7", "#94a3b8"];
const ICONO_PRODUCTO: Record<string, typeof Package> = { Paquetes: Package, Hoteles: Hotel, Vuelos: Plane };
const ICONO_CANAL: Record<string, typeof Globe> = { "Sitio web": Globe, Asesor: Headset, Teléfono: Phone };

// ---------- Animación de cifras ----------
function useContador(valor: number, duracion = 900) {
  const reducir = useReducedMotion();
  const [actual, setActual] = useState(reducir ? valor : 0);
  const desde = useRef(0);
  useEffect(() => {
    if (reducir) {
      setActual(valor);
      return;
    }
    const inicio = performance.now();
    const origen = desde.current;
    let frame = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion);
      const e = 1 - Math.pow(1 - p, 3);
      setActual(origen + (valor - origen) * e);
      if (p < 1) frame = requestAnimationFrame(paso);
      else desde.current = valor;
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracion, reducir]);
  return actual;
}

function Cifra({ valor, formato }: { valor: number; formato: (v: number) => string }) {
  const v = useContador(valor);
  return <>{formato(v)}</>;
}

// ---------- Piezas ----------
function Tarjeta({
  children,
  className = "",
  retraso = 0,
}: {
  children: ReactNode;
  className?: string;
  retraso?: number;
}) {
  const reducir = useReducedMotion();
  return (
    <motion.section
      initial={reducir ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: retraso, ease: [0.22, 1, 0.36, 1] }}
      className={`min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm ${className}`}
    >
      {children}
    </motion.section>
  );
}

function Titulo({ icono: Icono, titulo, sub, accion }: { icono: typeof Package; titulo: string; sub?: string; accion?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icono className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-semibold leading-tight text-foreground">{titulo}</h3>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {accion}
    </div>
  );
}

function Variacion({ t, invertir = false }: { t: TendenciaValor; invertir?: boolean }) {
  if (t.variacion_pct == null) {
    return <span className="text-[11px] italic text-muted-foreground">Sin mes anterior para comparar</span>;
  }
  const sube = t.variacion_pct > 0;
  const igual = t.variacion_pct === 0;
  const bueno = igual ? null : invertir ? !sube : sube;
  const Icono = igual ? Minus : sube ? ArrowUpRight : ArrowDownRight;
  const color =
    bueno == null
      ? "bg-muted text-muted-foreground"
      : bueno
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${color}`}>
      <Icono className="h-3 w-3" aria-hidden="true" />
      {Math.abs(t.variacion_pct).toLocaleString("es-CO")}% vs. mes anterior
    </span>
  );
}

function Sparkline({ datos, color, id }: { datos: number[]; color: string; id: string }) {
  if (datos.every((d) => d === 0)) {
    return <div className="flex h-12 items-end text-[10px] text-muted-foreground">Sin movimiento en 14 días</div>;
  }
  const serie = datos.map((v, i) => ({ i, v }));
  return (
    <div className="h-12" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={serie} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KPI({
  icono: Icono,
  titulo,
  valor,
  formato,
  pie,
  serie,
  color,
  id,
  destacado = false,
  onClick,
  retraso,
}: {
  icono: typeof Package;
  titulo: string;
  valor: number | null;
  formato: (v: number) => string;
  pie: ReactNode;
  serie?: number[];
  color: string;
  id: string;
  destacado?: boolean;
  onClick?: () => void;
  retraso: number;
}) {
  const reducir = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reducir ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reducir ? undefined : { y: -3 }}
      transition={{ duration: 0.4, delay: retraso, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative overflow-hidden rounded-2xl border p-5 text-left shadow-sm transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        destacado
          ? "border-transparent bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_65%,black)] text-primary-foreground"
          : "border-border bg-card text-foreground"
      }`}
    >
      {destacado && (
        <span
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl"
          aria-hidden="true"
        />
      )}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider ${destacado ? "text-white/80" : "text-muted-foreground"}`}>
          {titulo}
        </span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            destacado ? "bg-white/15 text-white" : "bg-primary/10 text-primary"
          }`}
        >
          <Icono className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight">
        {valor == null ? <span className="text-lg font-medium opacity-70">Sin datos</span> : <Cifra valor={valor} formato={formato} />}
      </p>
      <div className={`mt-1.5 min-h-[22px] ${destacado ? "[&_span]:!bg-white/15 [&_span]:!text-white" : ""}`}>{pie}</div>
      {serie && (
        <div className="mt-2">
          <Sparkline datos={serie} color={destacado ? "#ffffff" : color} id={id} />
        </div>
      )}
    </motion.button>
  );
}

function TooltipOscuro({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-[#1f1a1c] px-3 py-2 text-xs text-white shadow-xl">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b>{p.dataKey === "ingresos" ? pesos(p.value) : p.value}</b>
        </p>
      ))}
    </div>
  );
}

function Ranking({
  items,
  vacio,
  sufijo,
  onClick,
}: {
  items: ConteoNombre[];
  vacio: string;
  sufijo: (n: number) => string;
  onClick?: () => void;
}) {
  if (!items.length) return <p className="py-8 text-center text-sm text-muted-foreground">{vacio}</p>;
  const max = Math.max(...items.map((i) => i.total), 1);
  const medallas = ["bg-[var(--gold)] text-[var(--gold-foreground)]", "bg-slate-300 text-slate-800", "bg-amber-700/80 text-white"];
  return (
    <ol className="space-y-3">
      {items.slice(0, 5).map((it, i) => (
        <li key={it.nombre}>
          <button type="button" onClick={onClick} className="group w-full text-left">
            <div className="mb-1 flex items-center gap-2.5">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  medallas[i] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground group-hover:text-primary">
                {it.nombre}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{sufijo(it.total)}</span>
            </div>
            <div className="ml-8 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--gold)]"
                initial={{ width: 0 }}
                animate={{ width: `${(it.total / max) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.1 * i, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Anillo({ pct, color, etiqueta, detalle }: { pct: number | null; color: string; etiqueta: string; detalle: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const valor = pct ?? 0;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * Math.min(valor, 100)) / 100 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div>
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {pct == null ? <span className="text-sm font-medium text-muted-foreground">Sin datos</span> : `${pct.toLocaleString("es-CO")}%`}
        </p>
        <p className="text-sm font-medium text-foreground">{etiqueta}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </div>
    </div>
  );
}

// ---------- Dashboard ----------
export default function DashboardAdmin({
  resumen: r,
  actividad,
  nombreUsuario,
  actualizando,
  onActualizar,
  setActiveModule,
  onVerReserva,
  onFiltrarModulo,
}: Props) {
  const [periodo, setPeriodo] = useState<"meses" | "dias">("meses");
  const hoyTexto = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONA,
  });

  const datosGrafico = useMemo(
    () =>
      periodo === "meses"
        ? r.comercial_por_mes.map((m) => ({ etiqueta: formatMes(m.mes), ingresos: m.ingresos, reservas: m.reservas }))
        : r.ingresos_ultimos_14d.map((d, i) => ({
            etiqueta: formatDia(d.fecha),
            ingresos: d.total,
            reservas: r.reservas_ultimos_14d[i]?.total ?? 0,
          })),
    [periodo, r],
  );
  const totalPeriodo = datosGrafico.reduce((s, d) => s + d.ingresos, 0);
  const reservasPeriodo = datosGrafico.reduce((s, d) => s + d.reservas, 0);

  const estados = Object.entries(r.reservas_por_estado)
    .map(([k, v]) => ({ clave: k, nombre: ESTADO_LABEL[k] ?? k, valor: Number(v) }))
    .filter((e) => e.valor > 0);
  const totalProductos = r.ventas_por_producto.reduce((s, v) => s + (v.monto ?? 0), 0);
  const totalCanales = r.reservas_por_canal.reduce((s, c) => s + c.total, 0);
  const totalMetodos = r.ingresos_por_metodo.reduce((s, m) => s + (m.monto ?? 0), 0);

  type Alerta = { texto: string; n: number; tono: "rojo" | "ambar" | "azul"; icono: typeof AlertCircle; ir: () => void };
  const alertas: Alerta[] = [
    { texto: "cancelaciones por resolver", n: r.solicitudes_cancelacion_pendientes, tono: "rojo" as const, icono: XCircle, ir: () => setActiveModule("cancelaciones") },
    { texto: "pagos fallidos", n: r.pagos_fallidos, tono: "rojo" as const, icono: AlertCircle, ir: () => onFiltrarModulo("pagos", "rechazado") },
    { texto: "pagos por confirmar", n: r.pagos_pendientes, tono: "ambar" as const, icono: Receipt, ir: () => onFiltrarModulo("pagos", "pendiente") },
    { texto: "reservas pendientes", n: r.reservas_pendientes, tono: "ambar" as const, icono: Clock, ir: () => onFiltrarModulo("reservas", "pendiente") },
    { texto: "empresas esperando contacto", n: r.contactos_empresariales_pendientes ?? 0, tono: "azul" as const, icono: Building2, ir: () => setActiveModule("empresas") },
    { texto: "viajes salen en 7 días", n: r.checkins_proximos_7d, tono: "azul" as const, icono: CalendarDays, ir: () => onFiltrarModulo("reservas", "confirmada") },
  ].filter((a) => a.n > 0);
  const TONO: Record<Alerta["tono"], string> = {
    rojo: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    ambar: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    azul: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  };

  const acciones = [
    { label: "Nueva reserva", mod: "crear-reserva" as Module, icon: PlusCircle },
    { label: "Crear paquete", mod: "paquetes" as Module, icon: Package },
    { label: "Registrar hotel", mod: "hoteles" as Module, icon: Hotel },
    { label: "Publicar vuelo", mod: "vuelos" as Module, icon: Plane },
    { label: "Banners y publicidad", mod: "banners" as Module, icon: Megaphone },
    { label: "Temas de temporada", mod: "temas" as Module, icon: Sparkles },
    { label: "Clientes", mod: "clientes" as Module, icon: Users },
    { label: "Pagos", mod: "pagos" as Module, icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      {/* ===== Cabecera ===== */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[color-mix(in_oklab,var(--primary)_85%,black)] to-[color-mix(in_oklab,var(--primary)_55%,black)] p-6 text-primary-foreground shadow-lg sm:p-8"
      >
        <AdornoTarjeta tamano="lg" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "20px 20px" }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[var(--gold)]/25 blur-3xl" aria-hidden="true" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70 first-letter:uppercase">{hoyTexto}</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl" style={{ fontFamily: "'Fraunces', serif" }}>
              {saludo()}
              {nombreUsuario ? `, ${nombreUsuario}` : ""}
            </h2>
            <p className="mt-2 text-sm text-white/85 sm:text-base">
              Hoy llevas <b className="text-[var(--gold-surface,#f5d77a)]">{pesos(r.ingresos_hoy)}</b> cobrados y{" "}
              <b className="text-white">
                {r.reservas_hoy} reserva{r.reservas_hoy === 1 ? "" : "s"} nueva{r.reservas_hoy === 1 ? "" : "s"}
              </b>
              .{" "}
              {alertas.length > 0
                ? `Tienes ${alertas.length} frente${alertas.length === 1 ? "" : "s"} que atender.`
                : "Todo está al día."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveModule("crear-reserva")}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-[var(--gold-foreground)] shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" /> Nueva reserva
              </button>
              <button
                type="button"
                onClick={onActualizar}
                disabled={actualizando}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${actualizando ? "animate-spin" : ""}`} aria-hidden="true" />
                {actualizando ? "Actualizando…" : "Actualizar"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { icono: Wallet, etiqueta: "Por cobrar", valor: pesosCortos(r.cartera_por_cobrar), sub: `${r.reservas_con_saldo} reservas`, ir: () => onFiltrarModulo("pagos", "pendiente") },
              { icono: CalendarDays, etiqueta: "Salen en 7 días", valor: String(r.checkins_proximos_7d), sub: "viajes confirmados", ir: () => onFiltrarModulo("reservas", "confirmada") },
              { icono: Users, etiqueta: "Clientes", valor: r.clientes_total.toLocaleString("es-CO"), sub: `+${r.clientes_nuevos_mes} este mes`, ir: () => setActiveModule("clientes") },
            ].map(({ icono: Icono, etiqueta, valor, sub, ir }) => (
              <button
                key={etiqueta}
                type="button"
                onClick={ir}
                className="min-w-0 rounded-2xl border border-white/15 bg-white/10 p-3 text-left backdrop-blur transition-colors hover:bg-white/15 sm:min-w-[9rem] sm:p-4"
              >
                <Icono className="h-4 w-4 text-[var(--gold-surface,#f5d77a)]" aria-hidden="true" />
                <p className="mt-2 whitespace-nowrap text-base font-bold tabular-nums sm:text-xl">{valor}</p>
                <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-white/75 sm:text-[11px]">{etiqueta}</p>
                <p className="text-[11px] text-white/60">{sub}</p>
              </button>
            ))}
          </div>
        </div>
      </motion.header>

      {/* ===== Requiere atención ===== */}
      {alertas.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Requiere atención">
          {alertas.map((a, i) => (
            <motion.button
              key={a.texto}
              type="button"
              onClick={a.ir}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-transform hover:-translate-y-0.5 ${TONO[a.tono]}`}
            >
              <a.icono className="h-4 w-4" aria-hidden="true" />
              <b className="tabular-nums">{a.n}</b> {a.texto}
              <ArrowUpRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            </motion.button>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Todo en orden: nada requiere tu atención ahora mismo.
        </p>
      )}

      {/* ===== KPIs ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPI
          id="spark-ingresos"
          destacado
          icono={Banknote}
          titulo="Ingresos del mes"
          valor={r.tendencia_ingresos.actual}
          formato={pesos}
          pie={<Variacion t={r.tendencia_ingresos} />}
          serie={r.ingresos_ultimos_14d.map((d) => d.total)}
          color="var(--primary)"
          onClick={() => setActiveModule("pagos")}
          retraso={0.05}
        />
        <KPI
          id="spark-reservas"
          icono={CalendarDays}
          titulo="Reservas del mes"
          valor={r.tendencia_reservas.actual}
          formato={(v) => Math.round(v).toLocaleString("es-CO")}
          pie={<Variacion t={r.tendencia_reservas} />}
          serie={r.reservas_ultimos_14d.map((d) => d.total)}
          color="var(--primary)"
          onClick={() => onFiltrarModulo("reservas")}
          retraso={0.1}
        />
        <KPI
          id="spark-ticket"
          icono={Receipt}
          titulo="Ticket promedio"
          valor={r.ticket_promedio}
          formato={pesos}
          pie={<span className="text-xs text-muted-foreground">Por pago aprobado · {r.pagos_pagados} pagos</span>}
          color="var(--gold)"
          onClick={() => setActiveModule("pagos")}
          retraso={0.15}
        />
        <KPI
          id="spark-clientes"
          icono={Users}
          titulo="Clientes nuevos"
          valor={r.tendencia_clientes_nuevos.actual}
          formato={(v) => Math.round(v).toLocaleString("es-CO")}
          pie={<Variacion t={r.tendencia_clientes_nuevos} />}
          color="#0ea5e9"
          onClick={() => setActiveModule("clientes")}
          retraso={0.2}
        />
      </div>

      {/* ===== Rendimiento + cartera/embudo ===== */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Tarjeta className="xl:col-span-2" retraso={0.1}>
          <Titulo
            icono={TrendingUp}
            titulo="Rendimiento comercial"
            sub={`${pesos(totalPeriodo)} cobrados y ${reservasPeriodo} reservas ${periodo === "meses" ? "en 6 meses" : "en 14 días"}`}
            accion={
              <div className="flex rounded-lg bg-muted p-0.5 text-xs font-semibold" role="tablist" aria-label="Periodo">
                {(["meses", "dias"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={periodo === p}
                    onClick={() => setPeriodo(p)}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 transition-colors ${
                      periodo === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p === "meses" ? "6 meses" : "14 días"}
                  </button>
                ))}
              </div>
            }
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={datosGrafico} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barra-ingresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" />
                <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis
                  yAxisId="izq"
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => pesosCortos(Number(v))}
                />
                <YAxis yAxisId="der" orientation="right" allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip content={<TooltipOscuro />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
                <Bar yAxisId="izq" dataKey="ingresos" name="Cobrado" fill="url(#barra-ingresos)" radius={[8, 8, 0, 0]} maxBarSize={44} />
                <Line
                  yAxisId="der"
                  type="monotone"
                  dataKey="reservas"
                  name="Reservas"
                  stroke="var(--gold)"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "var(--gold)", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Cobrado (pagos aprobados)</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--gold)]" /> Reservas creadas</span>
          </div>
        </Tarjeta>

        <div className="grid gap-4">
          <Tarjeta retraso={0.15} className="relative overflow-hidden">
            <Titulo icono={Wallet} titulo="Cartera por cobrar" sub="Saldo de reservas pendientes y confirmadas" />
            <p className="text-3xl font-bold tabular-nums text-foreground">
              <Cifra valor={r.cartera_por_cobrar} formato={pesos} />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {r.reservas_con_saldo === 0
                ? "Ninguna reserva vigente tiene saldo."
                : `${r.reservas_con_saldo} reserva${r.reservas_con_saldo === 1 ? "" : "s"} con saldo pendiente`}
            </p>
            <button
              type="button"
              onClick={() => onFiltrarModulo("pagos", "pendiente")}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Ver pagos pendientes <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </Tarjeta>
          <Tarjeta retraso={0.2}>
            <Titulo
              icono={Percent}
              titulo="Embudo de reservas"
              sub={
                r.tiempo_promedio_confirmacion_horas != null
                  ? `Se confirman en ${duracion(r.tiempo_promedio_confirmacion_horas)} en promedio`
                  : undefined
              }
            />
            <div className="space-y-4">
              <Anillo
                pct={r.tasa_conversion_pct}
                color="var(--primary)"
                etiqueta="Conversión"
                detalle="Reservas que llegaron a confirmarse"
              />
              <Anillo
                pct={r.tasa_cancelacion_pct}
                color="#94a3b8"
                etiqueta="Cancelación"
                detalle="Reservas que terminaron canceladas"
              />
            </div>
          </Tarjeta>
        </div>
      </div>

      {/* ===== Mezcla de ventas ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta retraso={0.1}>
          <Titulo icono={Package} titulo="Ventas por producto" sub="Lo cobrado por cada tipo de producto" />
          {r.ventas_por_producto.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Todavía no hay ventas registradas.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative h-36 w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={r.ventas_por_producto.map((v) => ({ name: v.nombre, value: v.monto || v.total }))}
                      dataKey="value"
                      innerRadius={44}
                      outerRadius={66}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {r.ventas_por_producto.map((v, i) => (
                        <Cell key={v.nombre} fill={PALETA[i % PALETA.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
                  <span className="text-sm font-bold text-foreground">{pesosCortos(totalProductos)}</span>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-2.5">
                {r.ventas_por_producto.map((v, i) => {
                  const Icono = ICONO_PRODUCTO[v.nombre] ?? Package;
                  return (
                    <li key={v.nombre} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETA[i % PALETA.length] }} />
                      <Icono className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-foreground">{v.nombre}</span>
                      <span className="text-right">
                        <b className="block text-xs tabular-nums text-foreground">{pesosCortos(v.monto ?? 0)}</b>
                        <span className="block text-[10px] text-muted-foreground">{v.total} reservas</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Tarjeta>

        <Tarjeta retraso={0.15}>
          <Titulo icono={Globe} titulo="Canales de venta" sub="Por dónde llegan las reservas" />
          {r.reservas_por_canal.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin reservas todavía.</p>
          ) : (
            <ul className="space-y-4">
              {r.reservas_por_canal.map((c, i) => {
                const Icono = ICONO_CANAL[c.nombre] ?? Globe;
                const pct = totalCanales ? Math.round((c.total / totalCanales) * 100) : 0;
                return (
                  <li key={c.nombre}>
                    <div className="mb-1.5 flex items-center gap-2 text-sm">
                      <Icono className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span className="flex-1 font-medium text-foreground">{c.nombre}</span>
                      <span className="text-xs text-muted-foreground">{c.total}</span>
                      <b className="w-10 text-right tabular-nums text-foreground">{pct}%</b>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: PALETA[i % PALETA.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, delay: 0.1 * i, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta retraso={0.2}>
          <Titulo icono={CreditCard} titulo="Medios de pago" sub="Lo cobrado por cada medio" />
          {r.ingresos_por_metodo.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aún no hay pagos aprobados.</p>
          ) : (
            <ul className="space-y-3">
              {r.ingresos_por_metodo.slice(0, 5).map((m, i) => {
                const pct = totalMetodos ? ((m.monto ?? 0) / totalMetodos) * 100 : 0;
                return (
                  <li key={m.nombre} className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                      style={{ background: PALETA[i % PALETA.length] }}
                    >
                      {m.nombre.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium text-foreground">{m.nombre}</span>
                        <b className="tabular-nums text-foreground">{pesosCortos(m.monto ?? 0)}</b>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: PALETA[i % PALETA.length] }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.9, delay: 0.1 * i }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>
      </div>

      {/* ===== Rankings ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta retraso={0.1}>
          <Titulo icono={Package} titulo="Paquetes más vendidos" sub="Por número de reservas" />
          <Ranking
            items={r.paquetes_mas_solicitados}
            vacio="Aún no hay reservas de paquetes."
            sufijo={(n) => `${n} reserva${n === 1 ? "" : "s"}`}
            onClick={() => setActiveModule("paquetes")}
          />
        </Tarjeta>
        <Tarjeta retraso={0.15}>
          <Titulo icono={Hotel} titulo="Hoteles más reservados" sub="Por número de reservas" />
          <Ranking
            items={r.hoteles_mas_reservados}
            vacio="Aún no hay reservas de hotel."
            sufijo={(n) => `${n} reserva${n === 1 ? "" : "s"}`}
            onClick={() => setActiveModule("hoteles")}
          />
        </Tarjeta>
        <Tarjeta retraso={0.2}>
          <Titulo icono={Crown} titulo="Asesores del mes" sub="Reservas registradas este mes" />
          <Ranking
            items={r.asesores_top_mes}
            vacio="Este mes ningún asesor ha registrado reservas."
            sufijo={(n) => `${n} reserva${n === 1 ? "" : "s"}`}
            onClick={() => setActiveModule("usuarios")}
          />
        </Tarjeta>
      </div>

      {/* ===== Operación ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta retraso={0.1}>
          <Titulo icono={CalendarDays} titulo="Próximos viajes" sub="Reservas que salen pronto" />
          {r.reservas_proximas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No hay viajes próximos.</p>
          ) : (
            <ul className="space-y-2">
              {r.reservas_proximas.slice(0, 6).map((p) => {
                const [y, m, d] = p.fecha_inicio.split("-").map(Number);
                const f = new Date(y, m - 1, d);
                return (
                  <li key={p.id_reserva}>
                    <button
                      type="button"
                      onClick={() => onVerReserva(p.id_reserva)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-muted/60"
                    >
                      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="text-[10px] font-semibold uppercase leading-none">
                          {f.toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
                        </span>
                        <span className="text-base font-bold leading-tight">{d}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{p.cliente_nombre}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.nombre_paquete ?? p.hotel_nombre ?? `Reserva #${p.id_reserva}`} · {p.numero_personas} pers.
                        </span>
                      </span>
                      <StatusBadge status={p.estado} className="shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta retraso={0.15}>
          <Titulo icono={Clock} titulo="Actividad reciente" sub="Últimos cambios de estado" />
          {actividad.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin actividad reciente.</p>
          ) : (
            <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-border">
              {actividad.slice(0, 7).map((a) => (
                <li key={a.id_historial} className="relative pl-6">
                  <span
                    className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-[3px] border-card"
                    style={{ background: ESTADO_COLOR[a.estado_nuevo ?? ""] ?? "var(--primary)" }}
                  />
                  <button type="button" onClick={() => onVerReserva(a.id_reserva)} className="text-left">
                    <span className="block text-sm text-foreground">
                      Reserva <b>#{a.id_reserva}</b>{" "}
                      {a.estado_nuevo ? `pasó a ${ESTADO_LABEL[a.estado_nuevo]?.toLowerCase().replace(/s$/, "") ?? a.estado_nuevo}` : "actualizada"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {tiempoRelativo(a.fecha_cambio)}
                      {a.nombre_empleado ? ` · ${a.nombre_empleado}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Tarjeta>

        <Tarjeta retraso={0.2}>
          <Titulo icono={CheckCircle2} titulo="Estado de las reservas" sub={`${r.reservas_total} en total`} />
          {estados.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin reservas todavía.</p>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                {estados.map((e) => (
                  <motion.div
                    key={e.clave}
                    initial={{ width: 0 }}
                    animate={{ width: `${(e.valor / r.reservas_total) * 100}%` }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    style={{ background: ESTADO_COLOR[e.clave] ?? "#999" }}
                    title={`${e.nombre}: ${e.valor}`}
                  />
                ))}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {estados.map((e) => (
                  <li key={e.clave}>
                    <button
                      type="button"
                      onClick={() => onFiltrarModulo("reservas", e.clave)}
                      className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ background: ESTADO_COLOR[e.clave] }} />
                        {e.nombre}
                      </span>
                      <span className="mt-0.5 block text-xl font-bold tabular-nums text-foreground">{e.valor}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {r.hoteles_activos} hoteles y {r.paquetes_activos} paquetes activos en el catálogo.
              </p>
            </>
          )}
        </Tarjeta>
      </div>

      {/* ===== Accesos rápidos ===== */}
      <Tarjeta retraso={0.1}>
        <Titulo icono={Sparkles} titulo="Accesos rápidos" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {acciones.map(({ label, mod, icon: Icono }) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveModule(mod)}
              className="group flex flex-col items-start gap-3 rounded-xl border border-border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icono className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-foreground">{label}</span>
            </button>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}
