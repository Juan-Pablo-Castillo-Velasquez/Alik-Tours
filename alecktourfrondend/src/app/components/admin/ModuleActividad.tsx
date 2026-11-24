import { useState } from "react";
import { Search, Activity, CalendarClock, ListTree, Loader2 } from "lucide-react";
import type { ActividadRecienteItem } from "../../services/reserva.service";
import StatCard from "./ui/StatCard";
import SectionHeader from "./ui/SectionHeader";
import StatusBadge from "./ui/StatusBadge";
import EmptyState from "./ui/EmptyState";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";

// Mismo formato relativo que ya usa el widget de "Actividad reciente" del
// Dashboard (ModuleDashboard.tsx) — se duplica acá (función pura, sin
// estado) en vez de importarla, siguiendo el mismo criterio que
// formatFechaHora en ModulePagos.tsx.
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

function esHoy(fechaISO: string): boolean {
  const d = new Date(fechaISO);
  const hoy = new Date();
  return d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
}

function dentroDeUltimosDias(fechaISO: string, dias: number): boolean {
  const fecha = new Date(fechaISO).getTime();
  if (Number.isNaN(fecha)) return false;
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  return fecha >= limite;
}

interface Props {
  actividad: ActividadRecienteItem[];
  loading?: boolean;
  loadingMore?: boolean;
  /** true cuando la última carga trajo menos ítems que el límite pedido —
   * ya no hay más historial que cargar. */
  agotado?: boolean;
  onCargarMas: () => void;
}

// Registro de actividad del sistema construido 100% sobre historial_reservas
// (la misma tabla que ya alimenta el historial de una reserva individual y
// el widget del Dashboard) — no crea ninguna tabla nueva. Cada fila es un
// cambio de estado real (reserva creada/confirmada/cancelada, pago
// aprobado/rechazado...) con su fecha, responsable y comentario reales;
// nunca un evento inventado.
export default function ModuleActividad({ actividad, loading, loadingMore, agotado, onCargarMas }: Props) {
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [periodoFilter, setPeriodoFilter] = useState<"todos" | "hoy" | "7dias">("todos");

  const estadosDisponibles = Array.from(
    new Set(actividad.map(a => a.estado_nuevo).filter((e): e is string => !!e)),
  );

  const filtered = actividad.filter(a => {
    const q = search.toLowerCase();
    const matchEstado = estadoFilter === "todos" || a.estado_nuevo === estadoFilter;
    const matchSearch = !q
      || String(a.id_reserva).includes(q)
      || (a.nombre_empleado ?? "").toLowerCase().includes(q)
      || (a.comentarios ?? "").toLowerCase().includes(q);
    const matchPeriodo = periodoFilter === "todos"
      || (periodoFilter === "hoy" ? esHoy(a.fecha_cambio) : dentroDeUltimosDias(a.fecha_cambio, 7));
    return matchEstado && matchSearch && matchPeriodo;
  });

  const hoyCount = actividad.filter(a => esHoy(a.fecha_cambio)).length;
  const reservasAfectadas = new Set(actividad.map(a => a.id_reserva)).size;

  const { page, pageCount, slice, setPage } = usePagination(filtered, 8);

  const hasActiveFilters = estadoFilter !== "todos" || search.trim() !== "" || periodoFilter !== "todos";
  function clearFilters() { setSearch(""); setEstadoFilter("todos"); setPeriodoFilter("todos"); }

  const selectTriggerCls = "w-auto min-w-[140px] h-auto py-2 bg-card border-border text-xs";

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Actividad del sistema"
        subtitle={`${actividad.length} evento${actividad.length === 1 ? "" : "s"} cargado${actividad.length === 1 ? "" : "s"}`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Eventos cargados" value={actividad.length} icon={ListTree} />
        <StatCard label="Hoy" value={hoyCount} icon={CalendarClock} gradient="from-[#C9A227] to-[#C9A227]" />
        <StatCard label="Reservas afectadas" value={reservasAfectadas} icon={Activity} />
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input maxLength={100}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por reserva, responsable o comentario..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm outline-none
              bg-card text-foreground placeholder:text-muted-foreground/60
              focus:ring-2 focus:ring-primary/40 focus:border-transparent"
          />
        </div>

        {estadosDisponibles.length > 0 && (
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className={selectTriggerCls}>
              <SelectValue placeholder="Estado resultante" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="todos">Estado: todos</SelectItem>
              {estadosDisponibles.map(e => (
                <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={periodoFilter} onValueChange={(v) => setPeriodoFilter(v as "todos" | "hoy" | "7dias")}>
          <SelectTrigger className={selectTriggerCls}>
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Cualquier fecha</SelectItem>
            <SelectItem value="hoy">Hoy</SelectItem>
            <SelectItem value="7dias">Últimos 7 días</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-[240px] flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length > 0 ? (
        <>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-2">
          <div className="divide-y divide-border/50">
            {slice.map(item => (
              <div key={item.id_historial} className="flex items-start gap-3 p-3.5 hover:bg-accent transition-colors rounded-xl">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Reserva #{item.id_reserva}</span>
                    {item.estado_anterior && item.estado_nuevo
                      ? ` pasó de ${item.estado_anterior} a ${item.estado_nuevo}`
                      : item.estado_nuevo ? ` ${item.estado_nuevo}` : " actualizada"}
                  </p>
                  {item.comentarios && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.comentarios}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/80 mt-1">
                    {tiempoRelativo(item.fecha_cambio)}
                    {item.nombre_empleado && ` · ${item.nombre_empleado}`}
                  </p>
                </div>
                {item.estado_nuevo && <StatusBadge status={item.estado_nuevo} className="flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} className="mt-4" />
        </>
      ) : (
        <EmptyState
          icon={Search}
          title="Sin actividad"
          description={actividad.length === 0 ? "Todavía no hay eventos registrados." : "Prueba con otros filtros o términos de búsqueda."}
          action={hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-xs font-medium transition-colors"
            >
              Limpiar filtros
            </button>
          ) : undefined}
        />
      )}

      {!loading && !agotado && actividad.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={onCargarMas}
            disabled={loadingMore}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground
              hover:border-primary/40 hover:text-primary transition-all disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loadingMore ? "Cargando..." : "Cargar más actividad"}
          </button>
        </div>
      )}
    </div>
  );
}
