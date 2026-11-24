import {
  Activity,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Crown,
  Headset,
  Inbox,
  MessageCircle,
  PlaneTakeoff,
  PlusCircle,
  Receipt,
  RefreshCw,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch } from "../../api/v1/api";
import type { DashboardResumen, ResumenEmpleado } from "../../services/dashboard.service";
import type { ActividadRecienteItem } from "../../services/reserva.service";
import AdornoTarjeta from "../temporada/AdornoTarjeta";
import { Cifra, pesos, Ranking, saludo, Tarjeta, tiempoRelativo, Titulo, Variacion } from "./DashboardAdmin";
import type { Module } from "./types";
import StatusBadge from "./ui/StatusBadge";

// Escritorio del asesor: su bandeja de trabajo (chats, pagos, reservas por
// atender), sus números del mes y lo que pasa en la agencia. Todas las
// cifras vienen de /dashboard/resumen, /dashboard/resumen-empleado,
// /reservas/buscar y /historial-reservas/recientes; nada se inventa aquí.

interface ReservaReciente {
  id_reserva: number;
  cliente_nombre?: string | null;
  nombre_paquete?: string | null;
  hotel_nombre?: string | null;
  vuelo_ruta?: string | null;
  destino?: string | null;
  fecha_reserva: string;
  fecha_inicio: string;
  estado: string;
  precio_total: number;
  saldo_pendiente: number;
}

interface Props {
  resumen: DashboardResumen;
  resumenEmpleado: ResumenEmpleado | null;
  actividad: ActividadRecienteItem[];
  nombreUsuario?: string;
  actualizando: boolean;
  onActualizar: () => void;
  setActiveModule: (m: Module) => void;
  onVerReserva: (id: number) => void;
  onFiltrarModulo: (m: Module, estado?: string) => void;
}

const ZONA = "America/Bogota";

function duracionMinutos(min: number): string {
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const resto = Math.round(min % 60);
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

const ESTADO_VERBO: Record<string, string> = {
  pendiente: "quedó pendiente",
  confirmada: "se confirmó",
  finalizada: "finalizó",
  cancelada: "se canceló",
};

export default function DashboardEmpleado({
  resumen: r,
  resumenEmpleado: e,
  actividad,
  nombreUsuario,
  actualizando,
  onActualizar,
  setActiveModule,
  onVerReserva,
  onFiltrarModulo,
}: Props) {
  const reducir = useReducedMotion();
  const [recientes, setRecientes] = useState<ReservaReciente[] | null>(null);
  const [errorRecientes, setErrorRecientes] = useState(false);

  useEffect(() => {
    apiFetch<{ items: ReservaReciente[] }>("/reservas/buscar?orden=creada&direccion=desc&por_pagina=6")
      .then((d) => setRecientes(d.items))
      .catch(() => setErrorRecientes(true));
  }, [actualizando]);

  const nombre = e?.nombre ?? nombreUsuario;
  const nombreCompletoRanking = r.asesores_top_mes.find((a) => e?.nombre && a.nombre.startsWith(`${e.nombre} `))?.nombre;
  const hoyTexto = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });
  const chats = e?.chats_pendientes ?? 0;

  // ---------- Bandeja de trabajo: lo que el asesor puede atender ya ----------
  type Tarea = {
    icono: typeof Inbox;
    titulo: string;
    detalle: string;
    n: number;
    tono: "rojo" | "ambar" | "azul" | "neutro";
    ir: () => void;
  };
  const tareas: Tarea[] = [
    {
      icono: MessageCircle,
      titulo: "Chats por responder",
      detalle: "Clientes esperando respuesta",
      n: chats,
      tono: "rojo",
      ir: () => setActiveModule("mensajes"),
    },
    {
      icono: Receipt,
      titulo: "Pagos por confirmar",
      detalle: "Comprobantes por revisar",
      n: r.pagos_pendientes,
      tono: "ambar",
      ir: () => onFiltrarModulo("pagos", "pendiente"),
    },
    {
      icono: CalendarClock,
      titulo: "Reservas por confirmar",
      detalle: "De toda la agencia",
      n: r.reservas_pendientes,
      tono: "ambar",
      ir: () => onFiltrarModulo("reservas", "pendiente"),
    },
    {
      icono: Wallet,
      titulo: "Mis reservas con saldo",
      detalle: "Clientes tuyos con pago pendiente",
      n: e?.mis_reservas_con_saldo ?? 0,
      tono: "azul",
      ir: () => onFiltrarModulo("reservas"),
    },
    {
      icono: PlaneTakeoff,
      titulo: "Salen en 7 días",
      detalle: "Confirma detalles con el viajero",
      n: r.checkins_proximos_7d,
      tono: "azul",
      ir: () => onFiltrarModulo("reservas", "confirmada"),
    },
    {
      icono: XCircle,
      titulo: "Cancelaciones en revisión",
      detalle: "Las resuelve un administrador",
      n: e?.cancelaciones_pendientes ?? r.solicitudes_cancelacion_pendientes,
      tono: "neutro",
      ir: () => setActiveModule("cancelaciones"),
    },
  ];
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const pendientesTexto = [
    chats > 0 && plural(chats, "chat por responder", "chats por responder"),
    r.pagos_pendientes > 0 && plural(r.pagos_pendientes, "pago por confirmar", "pagos por confirmar"),
    r.reservas_pendientes > 0 && plural(r.reservas_pendientes, "reserva por confirmar", "reservas por confirmar"),
  ].filter(Boolean) as string[];
  const TONO: Record<Tarea["tono"], string> = {
    rojo: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    ambar: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    azul: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    neutro: "bg-muted text-muted-foreground",
  };

  const serie = r.reservas_ultimos_14d.map((p) => ({
    dia: new Date(`${p.fecha}T12:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }).replace(".", ""),
    total: p.total,
  }));

  const variacionMes = e
    ? {
        actual: e.reservas_gestionadas_mes,
        anterior: e.reservas_gestionadas_mes_anterior,
        variacion_pct:
          e.reservas_gestionadas_mes_anterior > 0
            ? Math.round(((e.reservas_gestionadas_mes - e.reservas_gestionadas_mes_anterior) / e.reservas_gestionadas_mes_anterior) * 1000) / 10
            : null,
      }
    : null;

  const accesos: { label: string; mod: Module; icon: typeof Inbox }[] = [
    { label: "Nueva reserva", mod: "crear-reserva", icon: PlusCircle },
    { label: "Reservas", mod: "reservas", icon: CalendarDays },
    { label: "Mensajes", mod: "mensajes", icon: MessageCircle },
    { label: "Pagos", mod: "pagos", icon: Wallet },
    { label: "Cancelaciones", mod: "cancelaciones", icon: XCircle },
    { label: "Comunidad", mod: "comunidad", icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* ===== Cabecera ===== */}
      <motion.header
        initial={reducir ? false : { opacity: 0, y: -10 }}
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{hoyTexto}</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl" style={{ fontFamily: "'Fraunces', serif" }}>
              {saludo()}
              {nombre ? `, ${nombre}` : ""}
            </h2>
            <p className="mt-2 text-sm text-white/85 sm:text-base">
              {pendientesTexto.length === 0
                ? "Tu bandeja está al día. ¡Buen trabajo!"
                : `Tienes ${pendientesTexto.length > 1 ? `${pendientesTexto.slice(0, -1).join(", ")} y ${pendientesTexto[pendientesTexto.length - 1]}` : pendientesTexto[0]}.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveModule("mensajes")}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-[var(--gold-foreground)] shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <Headset className="h-4 w-4" aria-hidden="true" /> Responder chats
                {chats > 0 && (
                  <span className="rounded-full bg-[var(--gold-foreground)] px-1.5 text-[11px] text-[var(--gold)]">{chats}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveModule("crear-reserva")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/20"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" /> Nueva reserva
              </button>
              <button
                type="button"
                onClick={onActualizar}
                disabled={actualizando}
                aria-label="Actualizar"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${actualizando ? "animate-spin" : ""}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              {
                icono: CheckCircle2,
                valor: String(e?.chats_respondidos_hoy ?? 0),
                etiqueta: "Respondidos hoy",
              },
              {
                icono: Timer,
                valor: e?.tiempo_promedio_respuesta_minutos != null ? duracionMinutos(e.tiempo_promedio_respuesta_minutos) : "—",
                etiqueta: "Tiempo de respuesta",
              },
              {
                icono: Trophy,
                valor: e?.posicion_ranking_mes != null ? `#${e.posicion_ranking_mes}` : "—",
                etiqueta: e?.posicion_ranking_mes != null ? `de ${e.asesores_activos_mes} este mes` : "Puesto del mes",
              },
            ].map(({ icono: Icono, valor, etiqueta }) => (
              <div key={etiqueta} className="min-w-0 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur sm:min-w-[8.5rem] sm:p-4">
                <Icono className="h-4 w-4 text-[var(--gold-surface,#f5d77a)]" aria-hidden="true" />
                <p className="mt-2 whitespace-nowrap text-base font-bold tabular-nums sm:text-xl">{valor}</p>
                <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-white/75 sm:text-[11px]">{etiqueta}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.header>

      {/* ===== Bandeja de trabajo ===== */}
      <section aria-labelledby="bandeja">
        <h3 id="bandeja" className="mb-3 flex items-center gap-2 font-semibold text-foreground">
          <Inbox className="h-4 w-4 text-primary" aria-hidden="true" /> Tu bandeja de trabajo
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tareas.map((t, i) => (
            <motion.button
              key={t.titulo}
              type="button"
              onClick={t.ir}
              initial={reducir ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.04 * i }}
              className={`group flex items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                t.n > 0 && t.tono === "rojo" ? "border-rose-500/30" : "border-border"
              }`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.n > 0 ? TONO[t.tono] : TONO.neutro}`}>
                <t.icono className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{t.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.n > 0 ? t.detalle : "Al día"}</span>
              </span>
              <span className={`text-2xl font-bold tabular-nums ${t.n > 0 ? "text-foreground" : "text-muted-foreground"}`}>{t.n}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </motion.button>
          ))}
        </div>
      </section>

      {/* ===== Mis números ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta retraso={0.05} className="relative overflow-hidden !border-transparent bg-gradient-to-br from-[var(--gold)]/25 via-card to-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reservas que registré este mes</p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">
            <Cifra valor={e?.reservas_gestionadas_mes ?? 0} formato={(v) => Math.round(v).toLocaleString("es-CO")} />
          </p>
          <div className="mt-1.5 min-h-[22px]">{variacionMes && <Variacion t={variacionMes} />}</div>
          <p className="mt-1 text-xs text-muted-foreground">{e?.reservas_gestionadas ?? 0} en total</p>
        </Tarjeta>
        <Tarjeta retraso={0.1}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cobrado en mis reservas</p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">
            <Cifra valor={e?.ventas_cobradas_mes ?? 0} formato={pesos} />
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">Pagos aprobados este mes</p>
        </Tarjeta>
        <Tarjeta retraso={0.15}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mis reservas por confirmar</p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">{e?.mis_reservas_pendientes ?? 0}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">Esperando pago o confirmación</p>
        </Tarjeta>
        <Tarjeta retraso={0.2}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agencia este mes</p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">{r.tendencia_reservas.actual}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            reservas · {r.tasa_conversion_pct != null ? `${r.tasa_conversion_pct.toLocaleString("es-CO")}% se confirma` : "sin datos de conversión"}
          </p>
        </Tarjeta>
      </div>

      {/* ===== Reservas recientes + próximos viajes ===== */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta retraso={0.1}>
          <Titulo
            icono={Banknote}
            titulo="Reservas recientes"
            sub="Las últimas que entraron, de cualquier canal"
            accion={
              <button type="button" onClick={() => onFiltrarModulo("reservas")} className="shrink-0 text-xs font-semibold text-primary hover:underline">
                Ver todas
              </button>
            }
          />
          {errorRecientes ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No se pudieron cargar las reservas recientes.</p>
          ) : recientes == null ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : recientes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay reservas.</p>
          ) : (
            <ul className="space-y-1.5">
              {recientes.map((x) => (
                <li key={x.id_reserva}>
                  <button
                    type="button"
                    onClick={() => onVerReserva(x.id_reserva)}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(x.cliente_nombre ?? "C").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {x.cliente_nombre ?? "Cliente"} <span className="font-normal text-muted-foreground">#{x.id_reserva}</span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {x.nombre_paquete || x.hotel_nombre || x.vuelo_ruta || x.destino || "Reserva"}
                        {x.saldo_pendiente > 0 && <> · saldo {pesos(x.saldo_pendiente)}</>}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={x.estado} />
                      <span className="text-[11px] text-muted-foreground">{tiempoRelativo(x.fecha_reserva)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta retraso={0.15}>
          <Titulo icono={PlaneTakeoff} titulo="Próximos viajes" sub="Clientes que salen pronto" />
          {r.reservas_proximas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay viajes próximos por ahora.</p>
          ) : (
            <ul className="space-y-1.5">
              {r.reservas_proximas.slice(0, 6).map((p) => {
                const [y, m, d] = p.fecha_inicio.split("-").map(Number);
                const fecha = new Date(y, m - 1, d);
                return (
                  <li key={p.id_reserva}>
                    <button
                      type="button"
                      onClick={() => onVerReserva(p.id_reserva)}
                      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/60"
                    >
                      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="text-[10px] font-semibold uppercase leading-none">
                          {fecha.toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
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
      </div>

      {/* ===== Equipo ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta retraso={0.1}>
          <Titulo icono={Crown} titulo="Ranking del equipo" sub="Reservas registradas este mes" />
          <Ranking
            items={r.asesores_top_mes}
            vacio="Este mes nadie ha registrado reservas todavía."
            sufijo={(n) => `${n} reserva${n === 1 ? "" : "s"}`}
            destacar={nombreCompletoRanking}
          />
        </Tarjeta>

        <Tarjeta retraso={0.15}>
          <Titulo icono={Activity} titulo="Actividad del equipo" sub="Últimos cambios de estado" />
          {actividad.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay actividad registrada.</p>
          ) : (
            <ol className="relative max-h-[340px] space-y-3 overflow-y-auto pr-1 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-border">
              {actividad.slice(0, 10).map((a) => (
                <li key={a.id_historial} className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-[3px] border-card bg-primary" />
                  <button type="button" onClick={() => onVerReserva(a.id_reserva)} className="text-left">
                    <span className="block text-sm text-foreground">
                      Reserva <b>#{a.id_reserva}</b> {a.estado_nuevo ? (ESTADO_VERBO[a.estado_nuevo] ?? a.estado_nuevo) : "se actualizó"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {tiempoRelativo(a.fecha_cambio)}
                      {a.nombre_empleado ? ` · ${a.nombre_empleado}` : ""}
                    </span>
                    {a.comentarios && <span className="block truncate text-xs text-muted-foreground">{a.comentarios}</span>}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Tarjeta>

        <Tarjeta retraso={0.2}>
          <Titulo icono={CalendarDays} titulo="Reservas nuevas" sub="Últimos 14 días, toda la agencia" />
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="barra-asesor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [v, "Reservas"]} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
                <Bar dataKey="total" fill="url(#barra-asesor)" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
      </div>

      {/* ===== Accesos rápidos ===== */}
      <Tarjeta retraso={0.1}>
        <Titulo icono={Sparkles} titulo="Accesos rápidos" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {accesos.map(({ label, mod, icon: Icono }) => (
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
