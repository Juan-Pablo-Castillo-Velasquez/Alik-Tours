import { useState, useEffect } from "react";
import {
  Search, XCircle, CheckCircle, Clock, MessageSquare, ChevronRight,
  AlertCircle, MessageCircle, ArrowUpRight, Plus,
} from "lucide-react";
import { Cliente, Empleado, Reserva, ESTADO_COLOR } from "./types";
import type { SolicitudCancelacionResponse } from "../../services/solicitudCancelacion.service";
import { reservaService, type PagoResponse } from "../../services/reserva.service";
import AdminModal from "./ui/AdminModal";
import StatCard from "./ui/StatCard";
import SectionHeader from "./ui/SectionHeader";
import StatusBadge from "./ui/StatusBadge";
import EmptyState from "./ui/EmptyState";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import ConfirmDialog from "./ui/ConfirmDialog";
import Timeline, { type TimelineItem } from "./ui/Timeline";
import { MOTIVOS } from "../profile/TabReservas/constants";
import { enlaceWhatsApp } from "../../utils/whatsapp";

// Solo estos 3 estados existen de verdad en la base de datos (CHECK
// constraint en SolicitudCancelacion.estado, ver reserva_model.py). El
// brief pedía también "En revisión"/"Procesando reembolso"/"Reembolsada",
// pero eso no está soportado hoy — no se inventan acá, ver nota en
// alektours_admin_redesign.md sobre qué migración haría falta.
type EstadoSolicitudFilter = "todos" | "pendiente" | "aprobada" | "rechazada";
const ESTADOS: EstadoSolicitudFilter[] = ["todos", "pendiente", "aprobada", "rechazada"];

// Mismo criterio que en ModuleDashboard.tsx / ModuleReservas.tsx.
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

// fecha_inicio/fecha_fin son fechas puras "YYYY-MM-DD" — mismo criterio que
// ModuleReservas.tsx: se parte el string a mano (sin Date()) para no
// arriesgar un corrimiento de día por zona horaria.
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function formatFechaCorta(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mesIdx = Number(m[2]) - 1;
  return `${m[3]} ${MESES_CORTOS[mesIdx] ?? m[2]} ${m[1]}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground min-w-[140px]">{label}</span>
      <span className="text-xs font-medium text-foreground text-right ml-auto">{value ?? "—"}</span>
    </div>
  );
}

interface Props {
  solicitudes: SolicitudCancelacionResponse[];
  clientes?: Cliente[];
  empleados?: Empleado[];
  reservas?: Reserva[];
  onResolve: (id: number, data: { estado: "aprobada" | "rechazada"; comentario_resolucion: string }) => Promise<void>;
  /** Abre el detalle completo de la reserva vinculada en el módulo de
   * Reservas (mismo mecanismo que "Reservas próximas" en el Dashboard, ver
   * `reservaIdInicial` en ModuleReservas.tsx) — para no forzar al admin a
   * buscarla manualmente cuando necesita más contexto del que cabe acá. */
  onVerReserva?: (id: number) => void;
  /** Registra una solicitud nueva en nombre de un cliente que llamó por
   * teléfono -- tanto admin como asesor pueden hacerlo; la decisión final
   * de aprobar/rechazar sigue siendo exclusiva de admin (ver soloEmpleado
   * más abajo). */
  onCrearSolicitud?: (reservaId: number, data: { motivo: string; motivo_detalle?: string }) => Promise<void>;
  /** Oculta las acciones de Aprobar/Rechazar para el asesor: por ahora
   * solo el admin decide el estado final de una cancelación. El asesor
   * puede ver la cola y registrar solicitudes nuevas igual. */
  soloEmpleado?: boolean;
}

export default function ModuleCancelaciones({
  solicitudes, clientes = [], empleados = [], reservas = [], onResolve, onVerReserva,
  onCrearSolicitud, soloEmpleado = false,
}: Props) {
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoSolicitudFilter>("todos");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<"aprobada" | "rechazada" | null>(null);

  // "Nueva solicitud" -- el asesor llama al cliente, confirma que quiere
  // cancelar y la registra acá mismo en vez de tener que avisarle al admin
  // por otro lado (ver onCrearSolicitud).
  const [creando, setCreando] = useState(false);
  const [crearReservaId, setCrearReservaId] = useState("");
  const [crearMotivo, setCrearMotivo] = useState(MOTIVOS[0]);
  const [crearDetalle, setCrearDetalle] = useState("");
  const [creandoSubmitting, setCreandoSubmitting] = useState(false);

  const clienteMap  = Object.fromEntries(clientes.map(c => [c.id_cliente, c]));
  const empleadoMap = Object.fromEntries(empleados.map(e => [e.id_empleado, e]));
  const reservaMap  = Object.fromEntries(reservas.map(r => [r.id_reserva, r]));

  // Reservas que de verdad tiene sentido ofrecer en el selector: no las que
  // ya están canceladas/finalizadas, ni las que ya tienen una solicitud
  // pendiente (el backend la rechazaría con 409 por duplicada).
  const idsConSolicitudPendiente = new Set(
    solicitudes.filter(s => s.estado === "pendiente").map(s => s.id_reserva)
  );
  const reservasElegibles = reservas.filter(
    r => r.estado !== "cancelada" && r.estado !== "finalizada" && !idsConSolicitudPendiente.has(r.id_reserva)
  );

  const selected = solicitudes.find(s => s.id_solicitud === selectedId) ?? null;

  // Pago(s) real(es) de la reserva vinculada a la solicitud abierta — para
  // que aprobar/rechazar una cancelación se decida con el cuadro completo
  // (¿ya se le cobró algo al cliente?), no solo con el motivo del cliente.
  // GET /pagos/reserva/{id} trae la lista real completa, sin el límite de
  // 100 ni el problema de "un solo pago por reserva" del arreglo global.
  const [pagosReserva, setPagosReserva] = useState<PagoResponse[]>([]);
  useEffect(() => {
    if (!selected) { setPagosReserva([]); return; }
    let cancelado = false;
    reservaService.getPagos(selected.id_reserva)
      .then((data) => { if (!cancelado) setPagosReserva(data); })
      .catch(() => { if (!cancelado) setPagosReserva([]); });
    return () => { cancelado = true; };
  }, [selected?.id_reserva]);

  // Suma real de lo ya pagado (solo pagos con estado "pagado" cuentan como
  // ingreso real, mismo criterio que el Dashboard y ModuleReservas.tsx) —
  // esto es lo que queda en el aire si se aprueba la cancelación, porque el
  // sistema hoy no tiene forma de marcar un pago como reembolsado (ver nota
  // en alektours_admin_redesign.md).
  const montoYaPagado = pagosReserva.filter(p => p.estado === "pagado").reduce((sum, p) => sum + p.monto, 0);

  const counts = solicitudes.reduce((acc, s) => {
    acc[s.estado] = (acc[s.estado] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filtered = solicitudes
    .filter(s => {
      const cl = clienteMap[s.id_cliente];
      const q = search.toLowerCase();
      const matchEstado = estadoFilter === "todos" || s.estado === estadoFilter;
      const matchSearch = !q
        || String(s.id_reserva).includes(q)
        || (cl && `${cl.nombre} ${cl.apellido}`.toLowerCase().includes(q))
        || s.motivo.toLowerCase().includes(q);
      return matchEstado && matchSearch;
    })
    .sort((a, b) => {
      // Mismo criterio que el backend: pendientes primero (más antigua
      // primero), luego el resto por fecha de solicitud descendente.
      if (a.estado === "pendiente" && b.estado !== "pendiente") return -1;
      if (a.estado !== "pendiente" && b.estado === "pendiente") return 1;
      if (a.estado === "pendiente" && b.estado === "pendiente") {
        return new Date(a.fecha_solicitud).getTime() - new Date(b.fecha_solicitud).getTime();
      }
      return new Date(b.fecha_solicitud).getTime() - new Date(a.fecha_solicitud).getTime();
    });

  const { page, pageCount, slice, setPage } = usePagination(filtered, 8);

  async function handleResolve(reason?: string) {
    if (!selected || !pendingAction) return;
    await onResolve(selected.id_solicitud, { estado: pendingAction, comentario_resolucion: reason ?? "" });
    setPendingAction(null);
    setSelectedId(null);
  }

  function cerrarCrearSolicitud() {
    setCreando(false);
    setCrearReservaId("");
    setCrearMotivo(MOTIVOS[0]);
    setCrearDetalle("");
  }

  async function handleCrearSolicitud() {
    if (!onCrearSolicitud || !crearReservaId) return;
    if (crearMotivo === "Otro motivo" && !crearDetalle.trim()) return;
    setCreandoSubmitting(true);
    try {
      await onCrearSolicitud(Number(crearReservaId), {
        motivo: crearMotivo,
        motivo_detalle: crearDetalle.trim() || undefined,
      });
      cerrarCrearSolicitud();
    } finally {
      setCreandoSubmitting(false);
    }
  }

  const thCls = "px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap";

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Cancelaciones"
        subtitle={`${solicitudes.length} solicitud${solicitudes.length === 1 ? "" : "es"} en total`}
        action={onCrearSolicitud && (
          <button
            onClick={() => setCreando(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-primary to-[#A13B55] text-white rounded-xl text-xs font-semibold hover:shadow-md hover:shadow-primary/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva solicitud
          </button>
        )}
      />

      {/* KPIs reales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pendientes"  value={counts.pendiente ?? 0}  icon={Clock}        gradient="from-[#C9A227] to-[#C9A227]" />
        <StatCard label="Aprobadas"   value={counts.aprobada ?? 0}   icon={CheckCircle}  gradient="from-emerald-500 to-emerald-600" />
        <StatCard label="Rechazadas"  value={counts.rechazada ?? 0}  icon={XCircle}      gradient="from-destructive to-destructive" />
        <StatCard label="Total"       value={solicitudes.length}     icon={MessageSquare} />
      </div>

      {/* Búsqueda + estado */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, reserva o motivo..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm outline-none
              bg-card text-foreground placeholder:text-muted-foreground/60
              focus:ring-2 focus:ring-primary/40 focus:border-transparent"
          />
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border">
          {ESTADOS.map(e => (
            <button
              key={e}
              onClick={() => setEstadoFilter(e)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                estadoFilter === e
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Bandeja de solicitudes */}
      {filtered.length > 0 ? (
        <>
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className={thCls}>Cliente</th>
                <th className={thCls}>Reserva</th>
                <th className={thCls}>Motivo</th>
                <th className={thCls}>Solicitada</th>
                <th className={thCls}>Estado</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {slice.map(s => {
                const cl = clienteMap[s.id_cliente];
                const r = reservaMap[s.id_reserva];
                return (
                  <tr
                    key={s.id_solicitud}
                    onClick={() => setSelectedId(s.id_solicitud)}
                    className="hover:bg-accent transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      {cl ? (
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{cl.nombre} {cl.apellido}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{cl.correo}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">#{s.id_cliente}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-foreground">#{s.id_reserva}</p>
                      {r?.hotel_nombre && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{r.hotel_nombre}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{s.motivo}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{tiempoRelativo(s.fecha_solicitud)}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.estado} /></td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} className="mt-4" />
        </>
      ) : (
        <EmptyState
          icon={Search}
          title="No se encontraron solicitudes"
          description={
            solicitudes.length === 0
              ? "No hay solicitudes de cancelación registradas todavía."
              : "Prueba con otros filtros o términos de búsqueda."
          }
        />
      )}

      {/* Detalle */}
      {selected && (() => {
        const cl = clienteMap[selected.id_cliente];
        const r = reservaMap[selected.id_reserva];
        const resolutor = selected.id_empleado_resolutor != null ? empleadoMap[selected.id_empleado_resolutor] : undefined;

        const items: TimelineItem[] = [
          {
            id: "solicitud",
            badge: (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${ESTADO_COLOR.pendiente}`}>
                <Clock className="w-3 h-3" /> Solicitud enviada
              </span>
            ),
            meta: `${cl ? `${cl.nombre} ${cl.apellido}` : `Cliente #${selected.id_cliente}`} · ${tiempoRelativo(selected.fecha_solicitud)}`,
            detail: `Motivo: ${selected.motivo}${selected.motivo_detalle ? ` — "${selected.motivo_detalle}"` : ""}`,
          },
          ...(selected.fecha_resolucion ? [{
            id: "resolucion",
            badge: <StatusBadge status={selected.estado} />,
            meta: `${resolutor ? `${resolutor.nombre} ${resolutor.apellido}` : "Un asesor"} · ${tiempoRelativo(selected.fecha_resolucion)}`,
            detail: selected.comentario_resolucion ? `"${selected.comentario_resolucion}"` : undefined,
          }] : []),
        ];

        return (
          <AdminModal
            open={!!selected}
            onOpenChange={(o) => { if (!o) setSelectedId(null); }}
            title={<span className="inline-flex items-center gap-2">Solicitud #{selected.id_solicitud} <StatusBadge status={selected.estado} /></span>}
            description={`Reserva #${selected.id_reserva}`}
            maxWidth="sm:max-w-2xl"
            footer={selected.estado === "pendiente" ? (
              soloEmpleado ? (
                <p className="text-xs text-muted-foreground w-full text-center py-1">
                  Pendiente de revisión del admin — ya quedó registrada.
                </p>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <button
                    onClick={() => setPendingAction("rechazada")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rechazar
                  </button>
                  <button
                    onClick={() => setPendingAction("aprobada")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-primary to-[#A13B55] text-white rounded-lg text-xs font-semibold hover:shadow-md hover:shadow-primary/20 transition-all"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                  </button>
                </div>
              )
            ) : undefined}
          >
            <div className="space-y-5">
              <section>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Cliente y reserva
                </h3>
                <div className="bg-card rounded-xl border border-border p-3">
                  <Row label="Cliente" value={cl ? `${cl.nombre} ${cl.apellido}` : `#${selected.id_cliente}`} />
                  <Row label="Correo" value={cl?.correo} />
                  <Row label="Celular" value={
                    cl?.celular ? (
                      <span className="inline-flex items-center gap-2 justify-end">
                        <a href={`tel:${cl.celular}`} className="hover:underline">{cl.celular}</a>
                        <a
                          href={enlaceWhatsApp(cl.celular) ?? undefined}
                          target="_blank" rel="noopener noreferrer"
                          title="Contactar por WhatsApp"
                          className="text-emerald-500 hover:text-emerald-600"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </span>
                    ) : undefined
                  } />
                  <Row label="Reserva vinculada" value={r ? (r.hotel_nombre ?? `Paquete #${r.id_paquete}`) : `#${selected.id_reserva}`} />
                  <Row label="Fechas" value={r ? `${formatFechaCorta(r.fecha_inicio)} → ${formatFechaCorta(r.fecha_fin)}` : "—"} />
                  <Row label="Viajeros" value={r ? `${r.numero_personas} personas` : undefined} />
                  <Row label="Canal de origen" value={r ? (r.canal_origen === "empleado" ? "Presencial" : r.canal_origen === "telefono" ? "Teléfono" : "Web") : undefined} />
                  <Row label="Total de la reserva" value={r?.precio_total != null ? `$${r.precio_total.toLocaleString("es-CO")}` : undefined} />
                  <Row label="Estado actual de la reserva" value={r ? <StatusBadge status={r.estado} /> : "—"} />
                  <Row
                    label="Pago ya realizado"
                    value={montoYaPagado > 0 ? `$${montoYaPagado.toLocaleString("es-CO")}` : "Sin pagos aprobados registrados"}
                  />
                </div>
                {onVerReserva && (
                  <button
                    onClick={() => onVerReserva(selected.id_reserva)}
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    Ver reserva completa en Reservas <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </section>

              {montoYaPagado > 0 && selected.estado === "pendiente" && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#fdf6e3] border border-[#C9A227]/30">
                  <AlertCircle className="w-4 h-4 text-[#C9A227] flex-shrink-0" />
                  <p className="text-xs text-[#8a6d10] dark:text-[#C9A227]">
                    El cliente ya pagó ${montoYaPagado.toLocaleString("es-CO")} por esta reserva. Aprobar la
                    cancelación NO reembolsa el dinero automáticamente — el sistema todavía no tiene un estado
                    de "reembolsado", así que el reembolso hay que gestionarlo por fuera de la plataforma.
                  </p>
                </div>
              )}

              <section>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Historial de cambios
                </h3>
                <div className="bg-card rounded-xl border border-border p-3">
                  <Timeline items={items} emptyLabel="Sin eventos registrados" />
                </div>
              </section>
            </div>
          </AdminModal>
        );
      })()}

      <ConfirmDialog
        open={!!pendingAction}
        onOpenChange={(o) => { if (!o) setPendingAction(null); }}
        title={pendingAction === "aprobada" ? "Aprobar solicitud de cancelación" : "Rechazar solicitud de cancelación"}
        description={
          pendingAction === "aprobada"
            ? "La reserva vinculada quedará cancelada de inmediato. Esta acción no se puede deshacer."
            : "El cliente verá que su solicitud fue rechazada. Esta acción no se puede deshacer."
        }
        confirmLabel={pendingAction === "aprobada" ? "Aprobar" : "Rechazar"}
        destructive={pendingAction === "rechazada"}
        requireReason
        reasonLabel="Motivo interno (obligatorio)"
        reasonPlaceholder="Explica la decisión para el registro interno..."
        onConfirm={handleResolve}
      />

      {/* Nueva solicitud -- flujo de "el asesor llama y envía la solicitud
       * al admin" (ver onCrearSolicitud). No decide nada: solo la deja en
       * 'pendiente' para que el admin la revise desde este mismo módulo. */}
      <AdminModal
        open={creando}
        onOpenChange={(o) => { if (!o) cerrarCrearSolicitud(); else setCreando(true); }}
        title="Nueva solicitud de cancelación"
        description="Regístrala cuando un cliente llame o escriba pidiendo cancelar. El admin la revisa y decide desde esta misma bandeja."
        maxWidth="sm:max-w-lg"
        footer={
          <div className="flex items-center gap-2 w-full justify-end">
            <button
              onClick={cerrarCrearSolicitud}
              className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCrearSolicitud}
              disabled={!crearReservaId || creandoSubmitting || (crearMotivo === "Otro motivo" && !crearDetalle.trim())}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-primary to-[#A13B55] text-white rounded-lg text-xs font-semibold hover:shadow-md hover:shadow-primary/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {creandoSubmitting ? "Enviando..." : "Enviar solicitud"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Reserva
            </label>
            <select
              value={crearReservaId}
              onChange={e => setCrearReservaId(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none
                bg-card text-foreground focus:ring-2 focus:ring-primary/40 focus:border-transparent"
            >
              <option value="">Selecciona la reserva a cancelar...</option>
              {reservasElegibles.map(r => {
                const cl = clienteMap[r.id_cliente];
                return (
                  <option key={r.id_reserva} value={r.id_reserva}>
                    #{r.id_reserva} — {cl ? `${cl.nombre} ${cl.apellido}` : `Cliente #${r.id_cliente}`}
                    {r.hotel_nombre ? ` — ${r.hotel_nombre}` : ""}
                  </option>
                );
              })}
            </select>
            {reservasElegibles.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                No hay reservas activas disponibles para solicitar cancelación.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Motivo
            </label>
            <select
              value={crearMotivo}
              onChange={e => setCrearMotivo(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none
                bg-card text-foreground focus:ring-2 focus:ring-primary/40 focus:border-transparent"
            >
              {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Detalle {crearMotivo === "Otro motivo" ? "(obligatorio)" : "(opcional)"}
            </label>
            <textarea
              value={crearDetalle}
              onChange={e => setCrearDetalle(e.target.value)}
              rows={3}
              placeholder="Lo que te contó el cliente por teléfono..."
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none resize-none
                bg-card text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/40 focus:border-transparent"
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
