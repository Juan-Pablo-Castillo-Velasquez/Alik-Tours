import { useEffect, useState } from "react";
import {
  Activity, ArrowUpRight, CalendarCheck, CalendarClock, CalendarDays, CalendarX2, Clock,
  DollarSign, Inbox, Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch } from "../../api/v1/api";
import type { DashboardResumen } from "../../services/dashboard.service";
import type { ActividadRecienteItem } from "../../services/reserva.service";
import StatusBadge from "./ui/StatusBadge";

// Panel de trabajo del asesor: TODAS las reservas de la agencia (no solo
// las asignadas), lo que necesita atención y la actividad del equipo. Los
// datos salen de endpoints reales (/dashboard/resumen, /reservas/buscar,
// /historial-reservas/recientes); nada se inventa en el navegador.

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
  actividad: ActividadRecienteItem[];
  onVerReserva: (id: number) => void;
  onFiltrarModulo: (m: string, estado?: string) => void;
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

function haceCuanto(fechaISO: string): string {
  const min = Math.floor((Date.now() - new Date(fechaISO).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

function StatCard({
  label, value, icon: Icon, tono, onClick, ayuda,
}: {
  label: string; value: string | number; icon: typeof Inbox; tono: string; onClick?: () => void; ayuda?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tono}`}>
          <Icon className="h-4 w-4" />
        </span>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {ayuda && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{ayuda}</p>}
      </div>
    </button>
  );
}

export default function DashboardEmpleado({ resumen, actividad, onVerReserva, onFiltrarModulo }: Props) {
  const [recientes, setRecientes] = useState<ReservaReciente[] | null>(null);
  const [errorRecientes, setErrorRecientes] = useState(false);

  useEffect(() => {
    apiFetch<{ items: ReservaReciente[] }>("/reservas/buscar?orden=creada&direccion=desc&por_pagina=6")
      .then((d) => setRecientes(d.items))
      .catch(() => setErrorRecientes(true));
  }, []);

  const serie = resumen.reservas_ultimos_14d.map((p) => ({
    dia: new Date(`${p.fecha}T12:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }),
    total: p.total,
  }));

  return (
    <div className="space-y-6">
      <section aria-labelledby="kpis-reservas">
        <h3 id="kpis-reservas" className="mb-3 font-semibold text-foreground">Reservas de la agencia</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total de reservas" value={resumen.reservas_total.toLocaleString("es-CO")} icon={CalendarDays}
            tono="bg-primary/10 text-primary" onClick={() => onFiltrarModulo("reservas")} />
          <StatCard label="Pendientes" value={resumen.reservas_pendientes} icon={CalendarClock}
            tono="bg-[#C9A227]/15 text-[#8a6d10] dark:text-[#C9A227]" onClick={() => onFiltrarModulo("reservas", "pendiente")}
            ayuda="Por confirmar o pagar" />
          <StatCard label="Confirmadas" value={resumen.reservas_confirmadas} icon={CalendarCheck}
            tono="bg-emerald-500/10 text-emerald-600" onClick={() => onFiltrarModulo("reservas", "confirmada")} />
          <StatCard label="Canceladas" value={resumen.reservas_canceladas} icon={CalendarX2}
            tono="bg-destructive/10 text-destructive" onClick={() => onFiltrarModulo("reservas", "cancelada")} />
          <StatCard label="Pagos pendientes" value={resumen.pagos_pendientes} icon={Wallet}
            tono="bg-[#C9A227]/15 text-[#8a6d10] dark:text-[#C9A227]" onClick={() => onFiltrarModulo("pagos", "pendiente")} />
          <StatCard label="Ingresos registrados" value={pesos(resumen.ingresos_totales)} icon={DollarSign}
            tono="bg-emerald-500/10 text-emerald-600" onClick={() => onFiltrarModulo("pagos", "pagado")}
            ayuda="Pagos aprobados" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="recientes">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 id="recientes" className="font-semibold text-foreground">Reservas recientes</h3>
              <p className="text-xs text-muted-foreground">Las últimas que entraron, de cualquier canal</p>
            </div>
            <button type="button" onClick={() => onFiltrarModulo("reservas")} className="text-xs font-medium text-primary hover:underline">
              Ver todas
            </button>
          </div>
          {errorRecientes ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No se pudieron cargar las reservas recientes.</p>
          ) : recientes == null ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : recientes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Inbox className="h-8 w-8" /><p className="text-sm">Todavía no hay reservas</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {recientes.map((r) => (
                <li key={r.id_reserva}>
                  <button
                    type="button"
                    onClick={() => onVerReserva(r.id_reserva)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-all hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        #{r.id_reserva} · {r.cliente_nombre ?? "Cliente"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.nombre_paquete || r.hotel_nombre || r.vuelo_ruta || r.destino || "Reserva"} · viaja{" "}
                        {new Date(`${r.fecha_inicio}T12:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                        {r.saldo_pendiente > 0 && <> · saldo {pesos(r.saldo_pendiente)}</>}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={r.estado} />
                      <span className="text-[11px] text-muted-foreground">{haceCuanto(r.fecha_reserva)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="actividad-equipo">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 id="actividad-equipo" className="font-semibold text-foreground">Actividad del equipo</h3>
          </div>
          {actividad.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Activity className="h-8 w-8" /><p className="text-sm">Todavía no hay actividad registrada</p>
            </div>
          ) : (
            <ul className="max-h-[360px] space-y-1 overflow-y-auto">
              {actividad.map((item) => (
                <li key={item.id_historial}>
                  <button
                    type="button"
                    onClick={() => onVerReserva(item.id_reserva)}
                    className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{item.nombre_empleado && item.nombre_empleado !== "Sistema" ? item.nombre_empleado : "Sistema"}</span>
                        {" "}· reserva #{item.id_reserva}
                        {item.estado_nuevo ? ` → ${item.estado_nuevo}` : ""}
                      </p>
                      {item.comentarios && <p className="truncate text-xs text-muted-foreground">{item.comentarios}</p>}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{haceCuanto(item.fecha_cambio)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="proximas">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 id="proximas" className="font-semibold text-foreground">Viajes próximos</h3>
          </div>
          {resumen.reservas_proximas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay viajes próximos por ahora</p>
          ) : (
            <ul className="max-h-[300px] space-y-1.5 overflow-y-auto">
              {resumen.reservas_proximas.map((r) => (
                <li key={r.id_reserva}>
                  <button
                    type="button"
                    onClick={() => onVerReserva(r.id_reserva)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-all hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">#{r.id_reserva} · {r.cliente_nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.hotel_nombre || r.nombre_paquete || "Sin hotel"} ·{" "}
                        {new Date(r.fecha_inicio).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                    <StatusBadge status={r.estado} className="flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="grafica-14d">
          <h3 id="grafica-14d" className="font-semibold text-foreground">Reservas nuevas · últimos 14 días</h3>
          <p className="mb-3 text-xs text-muted-foreground">Cuántas reservas se crearon cada día</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [v, "Reservas"]} />
                <Bar dataKey="total" fill="#7B1E3A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
