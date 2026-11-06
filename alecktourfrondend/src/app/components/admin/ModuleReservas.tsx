import { useState, useEffect } from "react";
import {
  PlusCircle, Search, Trash2, X, User, Package,
  CreditCard, Calendar, Users, Phone, Mail, MapPin,
  Globe, UserCheck, PhoneCall, ChevronRight, AlertCircle,
  CheckCircle, Clock, XCircle, FileText, Save, MoreHorizontal,
  MessageCircle, Send, BedDouble, Sparkles, Receipt, Paperclip,
} from "lucide-react";
import { Reserva, Cliente, Paquete, ESTADO_COLOR, inputCls, resolveFotoUrl } from "./types";
import { reservaDetailService, reservaService, type PagoResponse } from "../../services/reserva.service";
import { type SolicitudCancelacionResponse } from "../../services/solicitudCancelacion.service";
import AdminModal from "./ui/AdminModal";
import StatusBadge from "./ui/StatusBadge";
import EmptyState from "./ui/EmptyState";
import Avatar from "./ui/Avatar";
import Timeline, { type TimelineItem } from "./ui/Timeline";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { enlaceWhatsApp } from "../../utils/whatsapp";

// ─── Extended types ────────────────────────────────────────────────────────────

export interface Empleado {
  id_empleado: number;
  nombre: string;
  apellido: string;
  correo_electronico: string;
  celular?: string;
  // Ver Cliente.foto_perfil en types.ts — misma foto real vía la cuenta de
  // Usuario del asesor, usada por el Avatar compartido en este módulo.
  foto_perfil?: string | null;
}

export interface Pago {
  id_pago: number;
  id_reserva: number;
  monto: number;
  estado: "pendiente" | "procesando" | "pagado" | "rechazado" | "cancelado";
  referencia?: string;
  fecha_pago?: string;
  metodo_pago?: { id_metodo: number; nombre_metodo: string };
}

export type CanalOrigen = "web" | "empleado" | "telefono";

export interface ReservaExtended extends Reserva {
  id_empleado?: number;
  canal_origen?: CanalOrigen;
}

type EstadoReserva = "pendiente" | "confirmada" | "cancelada" | "finalizada";

// Forma real de /reservas/{id}/historial (ReservaHistorialDetail en el
// backend) — ya se consumía como `any[]`, se tipa acá para el Timeline.
interface HistorialItem {
  id_historial: number;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  fecha_cambio: string;
  comentarios: string | null;
  nombre_empleado: string | null;
}

// ─── Helpers de formato ────────────────────────────────────────────────────────

// Igual criterio que tiempoRelativo() en ModuleDashboard.tsx — se repite acá
// (no está exportado desde allá) para que el historial de una reserva se
// lea igual que el feed de "Actividad reciente" del dashboard.
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

// fecha_inicio/fecha_fin son fechas puras "YYYY-MM-DD" — se formatean
// partiendo el string a mano (sin pasar por Date()) para no arriesgar un
// corrimiento de día por zona horaria en una fecha sin hora.
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function formatFechaCorta(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mesIdx = Number(m[2]) - 1;
  return `${m[3]} ${MESES_CORTOS[mesIdx] ?? m[2]} ${m[1]}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const icons: Record<string, React.ReactNode> = {
    pendiente: <Clock className="w-3 h-3" />,
    confirmada: <CheckCircle className="w-3 h-3" />,
    cancelada: <XCircle className="w-3 h-3" />,
    finalizada: <FileText className="w-3 h-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${ESTADO_COLOR[estado] ?? "bg-muted text-muted-foreground"}`}>
      {icons[estado]}
      {estado}
    </span>
  );
}

function CanalBadge({ canal }: { canal?: CanalOrigen }) {
  const map: Record<CanalOrigen, { label: string; Icon: React.FC<{ className?: string }> }> = {
    web:      { label: "Web",        Icon: Globe     },
    empleado: { label: "Presencial", Icon: UserCheck },
    telefono: { label: "Teléfono",   Icon: PhoneCall },
  };
  const entry = canal ? map[canal] : map.web;
  const { label, Icon } = entry;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function DetailRow({ icon: Icon, label, value }: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground min-w-[100px]">{label}</span>
      <span className="text-xs font-medium text-foreground text-right ml-auto">{value ?? "—"}</span>
    </div>
  );
}

function MetricCard({ label, value, color = "default" }: {
  label: string; value: number | string; color?: "default" | "green" | "amber" | "red";
}) {
  const colorCls: Record<string, string> = {
    default: "text-foreground",
    green:   "text-primary",
    amber:   "text-[#C9A227]",
    red:     "text-destructive",
  };
  return (
    <div className="bg-muted/40 rounded-xl p-3 border border-border">
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-semibold ${colorCls[color]}`}>{value}</p>
    </div>
  );
}

// ─── Estado Picker ────────────────────────────────────────────────────────────

const ESTADO_OPTIONS: {
  value: EstadoReserva;
  label: string;
  icon: React.ReactNode;
  cls: string;
}[] = [
  {
    value: "pendiente",
    label: "Pendiente",
    icon: <Clock className="w-3.5 h-3.5" />,
    cls: "border-[#C9A227]/40 bg-[#C9A227]/10 text-[#C9A227] ring-[#C9A227]/50",
  },
  {
    value: "confirmada",
    label: "Confirmada",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    cls: "border-primary/40 bg-primary/10 text-primary ring-primary/50",
  },
  {
    value: "cancelada",
    label: "Cancelada",
    icon: <XCircle className="w-3.5 h-3.5" />,
    cls: "border-destructive/40 bg-destructive/10 text-destructive ring-destructive/50",
  },
  {
    value: "finalizada",
    label: "Finalizada",
    icon: <FileText className="w-3.5 h-3.5" />,
    cls: "border-[#A13B55]/40 bg-[#A13B55]/10 text-[#A13B55] ring-[#A13B55]/50",
  },
];

function EstadoPicker({ current, onChange }: {
  current: EstadoReserva;
  onChange: (e: EstadoReserva) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {ESTADO_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all
            ${current === opt.value
              ? `${opt.cls} ring-2 ring-offset-1 ring-offset-card shadow-sm`
              : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Detalle de reserva (modal centrado) ───────────────────────────────────────

interface SidePanelProps {
  reserva: ReservaExtended | null;
  cliente?: Cliente;
  empleado?: Empleado;
  paquete?: Paquete;
  pago?: Pago;
  /** Solicitudes de cancelación de ESTA reserva puntual (ya filtradas por
   * el módulo principal) — para avisar acá mismo si el cliente pidió
   * cancelar, sin obligar a saltar al módulo de Cancelaciones para verlo. */
  solicitudesReserva?: SolicitudCancelacionResponse[];
  /** Total de reservas de este cliente (ya calculado por el módulo principal
   * sobre el arreglo `reservas` que ya tiene cargado, sin pedir ningún
   * endpoint nuevo) — para que el admin sepa de un vistazo si es un cliente
   * nuevo o recurrente, algo que hoy solo se podía inferir buscando a mano
   * en la tabla filtrando por nombre. */
  reservasClienteCount?: number;
  onClose: () => void;
  onDelete: (id: number) => void;
  onUpdateEstado: (id: number, estado: EstadoReserva) => Promise<void>;
  /** Lleva a Módulo Pagos ya filtrado por esta reserva -- ver "reserva ->
   * ver sus pagos" en Admindashboard.tsx. Opcional: sin él, el enlace
   * "Ver en Pagos" simplemente no aparece. */
  onVerPagos?: (id: number) => void;
}

function SidePanel({ reserva, cliente, empleado, paquete, pago, solicitudesReserva = [], reservasClienteCount, onClose, onDelete, onUpdateEstado, onVerPagos }: SidePanelProps) {
  const solicitudPendiente = solicitudesReserva.find(s => s.estado === "pendiente");

  // reserva.precio_total ya viene calculado real desde el backend
  // (habitaciones + servicios + paquete) — se prefiere sobre una
  // estimación manual en el navegador. Se deja el cálculo con paquete
  // como respaldo únicamente para el caso raro de que aún no llegue.
  const totalReal = reserva?.precio_total ?? (paquete && reserva ? paquete.precio_base * reserva.numero_personas : 0);

  const [habitaciones, setHabitaciones] = useState<any[]>([]);
  const [servicios,    setServicios]    = useState<any[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(true);
  const [detailError,     setDetailError]   = useState("");

  const [historial,        setHistorial]        = useState<HistorialItem[]>([]);
  const [historialLoading, setHistorialLoading] = useState(true);

  // Historial COMPLETO real de pagos de esta reserva (GET /pagos/reserva/{id},
  // sin el límite de 100 ni el "un solo pago por reserva" que tiene la lista
  // que llega del Dashboard/módulo padre) — para verificar una reserva
  // pendiente hace falta ver TODOS los intentos de pago, no solo uno.
  // Arranca con el único `pago` que ya traía el módulo padre (pintado al
  // instante) y se reemplaza por la lista real apenas responde el backend.
  const [pagosCompletos, setPagosCompletos] = useState<PagoResponse[] | null>(null);
  useEffect(() => {
    if (!reserva) return;
    let cancelado = false;
    reservaService.getPagos(reserva.id_reserva)
      .then((data) => { if (!cancelado) setPagosCompletos(data); })
      .catch(() => { if (!cancelado) setPagosCompletos(null); });
    return () => { cancelado = true; };
  }, [reserva?.id_reserva]);

  const pagosReales: PagoResponse[] = pagosCompletos ?? (pago ? [pago as unknown as PagoResponse] : []);
  const montoPagado = pagosReales.filter(p => p.estado === "pagado").reduce((sum, p) => sum + p.monto, 0);
  const intentosFallidos = pagosReales.filter(p => p.estado === "rechazado").length;
  const pct = totalReal > 0 ? Math.min(100, Math.round((montoPagado / totalReal) * 100)) : 0;

  // Nota interna del asesor — no cambia el estado de la reserva, solo deja
  // trazabilidad real de la gestión (ver POST /reservas/{id}/notas). Es la
  // pieza central para que cualquier empleado que retome una reserva
  // pendiente sepa qué gestiones ya se hicieron para verificarla.
  const [notaTexto,     setNotaTexto]     = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [notaError,     setNotaError]     = useState("");

  async function handleAgregarNota() {
    const texto = notaTexto.trim();
    if (!texto) return;
    setGuardandoNota(true); setNotaError("");
    try {
      const nueva = await reservaDetailService.agregarNota(reserva.id_reserva, texto);
      setHistorial(prev => [...prev, nueva]);
      setNotaTexto("");
    } catch {
      setNotaError("No se pudo guardar la nota");
    } finally {
      setGuardandoNota(false);
    }
  }

  const [estadoLocal,  setEstadoLocal]  = useState<EstadoReserva>(reserva?.estado as EstadoReserva);
  const [savingEstado, setSavingEstado] = useState(false);
  const [saveSuccess,  setSaveSuccess]  = useState(false);
  const [saveError,    setSaveError]    = useState("");
  const hasChanges = !!reserva && estadoLocal !== reserva.estado;

  // El historial se carga solo al abrir el detalle porque la trazabilidad
  // debe verse de entrada, no quedar detrás de un clic extra.
  useEffect(() => {
    if (!reserva) return;
    let cancelado = false;
    setHistorialLoading(true);
    reservaDetailService.getHistorial(reserva.id_reserva)
      .then((h: HistorialItem[]) => { if (!cancelado) setHistorial(h); })
      .catch(() => { if (!cancelado) setHistorial([]); })
      .finally(() => { if (!cancelado) setHistorialLoading(false); });
    return () => { cancelado = true; };
  }, [reserva?.id_reserva]);

  // Habitaciones y servicios reales de esta reserva (GET /reservas/{id}/
  // habitaciones y /servicios) -- antes quedaban detrás de un botón "Ver
  // habitaciones y servicios" que había que apretar para enterarse de qué
  // se reservó realmente. Se cargan de entrada, mismo criterio que
  // historial/pagos arriba: esto es información central de la reserva, no
  // un detalle opcional.
  useEffect(() => {
    if (!reserva) return;
    let cancelado = false;
    setDetalleLoading(true); setDetailError("");
    Promise.all([
      reservaDetailService.getHabitaciones(reserva.id_reserva),
      reservaDetailService.getServicios(reserva.id_reserva),
    ])
      .then(([h, s]) => { if (!cancelado) { setHabitaciones(h); setServicios(s); } })
      .catch(() => { if (!cancelado) setDetailError("No se pudieron cargar las habitaciones y servicios"); })
      .finally(() => { if (!cancelado) setDetalleLoading(false); });
    return () => { cancelado = true; };
  }, [reserva?.id_reserva]);

  // El guard de "sin reserva" va DESPUÉS de todos los hooks de arriba
  // (useState/useEffect) a propósito: llamarlos condicionalmente violaba
  // las Rules of Hooks de React (detectado por ESLint al configurar
  // react-hooks/rules-of-hooks en esta ronda). Hoy el padre solo monta
  // <SidePanel> cuando hay una reserva seleccionada, así que esto nunca
  // se disparó en producción -- pero si algún día se monta el panel de
  // forma persistente (ej. para animar el cierre) con reserva en null,
  // React perdería la cuenta del orden de los hooks entre renders y
  // podría crashear o corromper el estado.
  if (!reserva) return null;

  async function handleSaveEstado() {
    if (!hasChanges) return;
    setSavingEstado(true); setSaveError(""); setSaveSuccess(false);
    try {
      await onUpdateEstado(reserva.id_reserva, estadoLocal);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      setSaveError("No se pudo actualizar el estado");
    } finally {
      setSavingEstado(false);
    }
  }

  const card = "bg-card rounded-xl border border-border p-3";
  const section = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5";

  // Arma los items del Timeline compartido a partir del historial real de
  // esta reserva (sin inventar nada: badge = estado anterior→nuevo, meta =
  // quién y cuándo, detail = comentario si lo hay).
  const historialItems: TimelineItem[] = historial.map(h => {
    // Una nota interna se guarda con estado_anterior === estado_nuevo (ver
    // POST /reservas/{id}/notas) — no fue un cambio real de estado, así que
    // se marca distinto en vez de mostrar el confuso "confirmada → confirmada".
    const esNota = !!h.estado_anterior && !!h.estado_nuevo && h.estado_anterior === h.estado_nuevo;
    return {
      id: h.id_historial,
      badge: esNota ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
          <FileText className="w-3 h-3" /> Nota interna
        </span>
      ) : (
        <>
          {h.estado_anterior && (
            <>
              <EstadoBadge estado={h.estado_anterior} />
              <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            </>
          )}
          {h.estado_nuevo && <EstadoBadge estado={h.estado_nuevo} />}
        </>
      ),
      meta: `${h.nombre_empleado ?? "Sistema"} · ${tiempoRelativo(h.fecha_cambio)}`,
      detail: h.comentarios ? `"${h.comentarios}"` : undefined,
    };
  });

  return (
    <AdminModal
      open={!!reserva}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title={<span className="inline-flex items-center gap-2">Reserva #{reserva.id_reserva} <EstadoBadge estado={estadoLocal} /></span>}
      description={cliente ? `${cliente.nombre} ${cliente.apellido}` : `Cliente #${reserva.id_cliente}`}
      maxWidth="sm:max-w-4xl"
      footer={
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={() => onDelete(reserva.id_reserva)}
            className="flex items-center gap-1.5 px-3 py-2 text-destructive border border-destructive/20 hover:bg-destructive/10 rounded-lg text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
        </div>
      }
    >
      {solicitudPendiente && (
        <div className="flex items-center gap-2.5 p-3 mb-5 rounded-xl bg-[#f5e6e6] border border-[#c62828]/20">
          <AlertCircle className="w-4 h-4 text-[#c62828] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#c62828]">El cliente solicitó cancelar esta reserva</p>
            <p className="text-xs text-[#c62828]/80">
              Motivo: {solicitudPendiente.motivo}{solicitudPendiente.motivo_detalle ? ` — ${solicitudPendiente.motivo_detalle}` : ""}
              {" · "}pendiente de resolver en el módulo de Cancelaciones
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">

        {/* Columna izquierda: contexto */}
        <div className="space-y-5 min-w-0">

          {/* Cliente */}
          <section>
            <h3 className={section}><User className="w-3.5 h-3.5" /> Cliente</h3>
            <div className={card}>
              {cliente ? (
                <>
                  <div className="flex items-center gap-2.5 mb-3">
                    <Avatar nombre={cliente.nombre} apellido={cliente.apellido} fotoUrl={resolveFotoUrl(cliente.foto_perfil)} color="primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {cliente.nombre} {cliente.apellido}
                      </p>
                      <p className="text-[11px] text-muted-foreground">CC {cliente.cedula}</p>
                    </div>
                  </div>
                  {/* Señal real de si es un cliente nuevo o recurrente — antes
                      solo se podía saber yendo al módulo de Clientes y
                      buscando a mano. reservasClienteCount ya viene calculado
                      del arreglo `reservas` que el módulo principal ya tiene
                      cargado, sin pedir ningún endpoint nuevo. */}
                  {reservasClienteCount != null && (
                    <p className="text-[11px] font-medium text-primary mb-3 -mt-1">
                      {reservasClienteCount === 1
                        ? "Primera reserva de este cliente"
                        : `Cliente recurrente · ${reservasClienteCount} reservas en total`}
                    </p>
                  )}
                  <DetailRow icon={Mail} label="Correo" value={
                    cliente.correo ? <a href={`mailto:${cliente.correo}`} className="hover:underline">{cliente.correo}</a> : undefined
                  } />
                  <DetailRow icon={Phone} label="Celular" value={
                    cliente.celular ? (
                      <span className="inline-flex items-center gap-2">
                        <a href={`tel:${cliente.celular}`} className="hover:underline">{cliente.celular}</a>
                        <a
                          href={enlaceWhatsApp(cliente.celular) ?? undefined}
                          target="_blank" rel="noopener noreferrer"
                          title="Contactar por WhatsApp"
                          className="text-emerald-500 hover:text-emerald-600"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </span>
                    ) : undefined
                  } />
                  <DetailRow icon={MapPin} label="Ciudad"     value={`${cliente.ciudad}, ${cliente.pais}`} />
                  <DetailRow icon={MapPin} label="Dirección"  value={cliente.direccion} />
                  <DetailRow icon={Calendar} label="Nacimiento" value={cliente.fecha_nacimiento ? formatFechaCorta(cliente.fecha_nacimiento) : undefined} />
                  <DetailRow icon={Calendar} label="Cliente desde" value={cliente.fecha_registro ? formatFechaCorta(cliente.fecha_registro) : undefined} />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Cliente #{reserva.id_cliente}</p>
              )}
            </div>
          </section>

          {/* Paquete / Hotel — antes esta sección siempre decía "Paquete" y
              cuando la reserva era directa de hotel (sin paquete) se quedaba
              sin ningún nombre visible acá (el hotel solo aparecía si se
              abría la sub-sección aparte "Ver habitaciones y servicios").
              reserva.hotel_nombre/destino ya vienen calculados desde el
              backend (ver Reserva.hotel_nombre en reserva_model.py) — se
              usan acá igual que ya se usan como fallback en la tabla. */}
          <section>
            <h3 className={section}>
              <Package className="w-3.5 h-3.5" /> {paquete ? "Paquete" : "Hotel"}
            </h3>
            <div className={card}>
              {paquete ? (
                <>
                  <p className="text-sm font-semibold text-foreground mb-3">{paquete.nombre_paquete}</p>
                  <DetailRow icon={Calendar} label="Check-in"  value={reserva.fecha_inicio} />
                  <DetailRow icon={Calendar} label="Check-out" value={reserva.fecha_fin} />
                  <DetailRow icon={Clock}    label="Duración"  value={`${paquete.duracion_dias} días`} />
                  <DetailRow icon={Users}    label="Viajeros"  value={`${reserva.numero_personas} personas`} />
                </>
              ) : (
                <>
                  {reserva.hotel_nombre && (
                    <p className="text-sm font-semibold text-foreground mb-3">{reserva.hotel_nombre}</p>
                  )}
                  <DetailRow icon={MapPin}   label="Destino"   value={reserva.destino} />
                  <DetailRow icon={Calendar} label="Check-in"  value={reserva.fecha_inicio} />
                  <DetailRow icon={Calendar} label="Check-out" value={reserva.fecha_fin} />
                  <DetailRow icon={Users}    label="Viajeros"  value={`${reserva.numero_personas} personas`} />
                </>
              )}
            </div>
          </section>

          {/* Habitaciones y servicios reales de la reserva (GET /reservas/{id}/
              habitaciones y /servicios) — antes quedaban ocultos detrás de un
              botón "Ver habitaciones y servicios" en el footer; siendo esto el
              corazón de lo que el cliente realmente compró, se cargan y
              muestran de entrada, igual que el resto de esta ficha. */}
          <section>
            <h3 className={section}><BedDouble className="w-3.5 h-3.5" /> Habitaciones</h3>
            <div className="space-y-2">
              {detalleLoading ? (
                <div className={`${card} text-xs text-muted-foreground`}>Cargando habitaciones...</div>
              ) : habitaciones.length > 0 ? (
                habitaciones.map((h, i) => (
                  <div key={i} className={`${card} text-xs space-y-1`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">{h.nombre_hotel} — Hab. {h.numero_habitacion}</p>
                      {h.estado && <StatusBadge status={h.estado} />}
                    </div>
                    <p className="text-muted-foreground">
                      {h.nombre_tipo}
                      {h.precio_acordado != null && ` · $${h.precio_acordado.toLocaleString("es-CO")} acordado`}
                      {h.precio_noche != null && ` ($${h.precio_noche.toLocaleString("es-CO")}/noche)`}
                    </p>
                    <p className="text-muted-foreground">{formatFechaCorta(h.fecha_checkin)} → {formatFechaCorta(h.fecha_checkout)}</p>
                  </div>
                ))
              ) : (
                <div className={`${card} text-xs text-muted-foreground`}>Sin habitaciones registradas para esta reserva</div>
              )}
            </div>
          </section>

          <section>
            <h3 className={section}><Sparkles className="w-3.5 h-3.5" /> Servicios adicionales</h3>
            <div className="space-y-2">
              {detalleLoading ? (
                <div className={`${card} text-xs text-muted-foreground`}>Cargando servicios...</div>
              ) : servicios.length > 0 ? (
                servicios.map((s, i) => (
                  <div key={i} className={`${card} text-xs space-y-1`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">{s.nombre_servicio}</p>
                      {s.precio_acordado != null && (
                        <span className="text-foreground font-medium">${s.precio_acordado.toLocaleString("es-CO")}</span>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {[s.nombre_categoria, s.duracion_horas != null ? `${s.duracion_horas}h` : null].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-muted-foreground">
                      {formatFechaCorta(s.fecha_servicio)}{s.numero_personas != null ? ` · ${s.numero_personas} personas` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <div className={`${card} text-xs text-muted-foreground`}>Sin servicios adicionales para esta reserva</div>
              )}
            </div>
          </section>

          {/* Error al cargar habitaciones/servicios */}
          {detailError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {detailError}
            </div>
          )}

          {/* Financiero */}
          <section>
            <h3 className={section}>
              <CreditCard className="w-3.5 h-3.5" /> Pago
              {onVerPagos && (
                <button
                  type="button"
                  onClick={() => onVerPagos(reserva.id_reserva)}
                  className="ml-auto normal-case text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  Ver en Pagos <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </h3>
            <div className={card}>
              {totalReal > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-xs text-muted-foreground">Total de la reserva</span>
                    <span className="text-base font-semibold text-foreground">
                      ${totalReal.toLocaleString("es-CO")}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{pct}% pagado</p>
                </div>
              )}
              {intentosFallidos > 0 && (
                <p className="text-xs text-warning flex items-center gap-1.5 mb-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {intentosFallidos} intento{intentosFallidos > 1 ? "s" : ""} de pago rechazado{intentosFallidos > 1 ? "s" : ""} antes de este historial
                </p>
              )}
              {pagosReales.length > 0 ? (
                <div className="space-y-2.5">
                  {[...pagosReales]
                    .sort((a, b) => (b.fecha_pago ?? "").localeCompare(a.fecha_pago ?? ""))
                    .map((p) => (
                      <div key={p.id_pago} className="pb-2.5 border-b border-border/50 last:border-0 last:pb-0">
                        <DetailRow icon={CreditCard}  label="Método"      value={p.metodo_pago?.nombre_metodo} />
                        <DetailRow icon={FileText}    label="Referencia"  value={p.referencia} />
                        <DetailRow icon={CheckCircle} label="Estado pago" value={<StatusBadge status={p.estado} />} />
                        <DetailRow icon={CreditCard}  label="Monto"       value={`$${p.monto.toLocaleString("es-CO")}`} />
                        {/* Dato ya disponible en PagoResponse.fecha_pago — antes solo se
                            usaba para ordenar la lista, nunca se mostraba al admin. */}
                        <DetailRow icon={Calendar}    label="Fecha"       value={p.fecha_pago ? formatFechaCorta(p.fecha_pago) : undefined} />
                        {/* Reales (PagoResponse.numero_factura/.comprobante_url), antes
                            nunca se mostraban acá -- numero_factura solo existe una vez
                            que el pago llega a 'pagado' (ver _asignar_numero_factura en
                            reserva_route.py); comprobante_url es el voucher que un admin
                            subió a mano para pagos por transferencia/consignación. */}
                        <DetailRow icon={Receipt} label="Factura" value={p.numero_factura} />
                        {p.comprobante_url && (
                          <DetailRow
                            icon={Paperclip}
                            label="Comprobante"
                            value={
                              <a
                                href={resolveFotoUrl(p.comprobante_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                Ver comprobante
                              </a>
                            }
                          />
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-warning" />
                  Sin información de pago registrada
                </p>
              )}
            </div>
          </section>

          {/* Asesor + canal */}
          <section>
            <h3 className={section}><UserCheck className="w-3.5 h-3.5" /> Asesor y canal de origen</h3>
            <div className={`${card} space-y-3`}>
              {empleado ? (
                <div className="flex items-center gap-2.5">
                  <Avatar nombre={empleado.nombre} apellido={empleado.apellido} fotoUrl={resolveFotoUrl(empleado.foto_perfil)} color="gold" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {empleado.nombre} {empleado.apellido}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {empleado.correo_electronico}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-primary/70" />
                  Reserva realizada directamente por el cliente (web)
                </p>
              )}
              <div className="pt-3 border-t border-border/50">
                <CanalBadge canal={reserva.canal_origen} />
              </div>
            </div>
          </section>

        </div>

        {/* Columna derecha: estado + trazabilidad */}
        <div className="space-y-5 min-w-0">

          {/* Estado */}
          <section>
            <h3 className={section}><Clock className="w-3.5 h-3.5" /> Estado de la reserva</h3>
            <div className={`${card} space-y-3`}>
              {/* Ya existía en el backend (Reserva.fecha_reserva) — solo faltaba
                  mostrarse. Distinta de "Última actualización": esta es cuándo se
                  HIZO la reserva, para saber su antigüedad real de un vistazo. */}
              {reserva.fecha_reserva && (
                <p className="text-[11px] text-muted-foreground">
                  Reservada: {tiempoRelativo(reserva.fecha_reserva)}
                </p>
              )}
              {reserva.fecha_ultima_actualizacion && (
                <p className="text-[11px] text-muted-foreground">
                  Última actualización: {tiempoRelativo(reserva.fecha_ultima_actualizacion)}
                </p>
              )}
              <EstadoPicker current={estadoLocal} onChange={setEstadoLocal} />
              {saveError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {saveError}
                </p>
              )}
              {saveSuccess && (
                <p className="text-xs text-success flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Estado actualizado correctamente
                </p>
              )}
              <button
                onClick={handleSaveEstado}
                disabled={!hasChanges || savingEstado}
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                  ${hasChanges
                    ? "bg-gradient-to-r from-primary to-[#A13B55] text-white hover:shadow-md hover:shadow-primary/20"
                    : "bg-muted text-muted-foreground/60 cursor-not-allowed"
                  } disabled:opacity-60`}
              >
                <Save className="w-3.5 h-3.5" />
                {savingEstado ? "Guardando..." : "Guardar cambio de estado"}
              </button>
            </div>
          </section>

          {/* Nota interna — no cambia el estado, queda trazada abajo en el
              historial. Pieza central para verificar reservas pendientes:
              cualquier empleado que retome el caso ve qué gestiones ya se
              hicieron sin depender de que se lo cuenten de viva voz. */}
          <section>
            <h3 className={section}><Send className="w-3.5 h-3.5" /> Nota interna</h3>
            <div className={`${card} space-y-2`}>
              <textarea
                value={notaTexto}
                onChange={(e) => setNotaTexto(e.target.value)}
                placeholder="Ej: Llamé al cliente, confirmó que llega el día 10..."
                rows={2}
                className={`${inputCls} resize-none`}
              />
              {notaError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {notaError}
                </p>
              )}
              <button
                onClick={handleAgregarNota}
                disabled={!notaTexto.trim() || guardandoNota}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {guardandoNota ? "Guardando..." : "Agregar nota"}
              </button>
            </div>
          </section>

          {/* Historial / Timeline */}
          <section>
            <h3 className={section}><FileText className="w-3.5 h-3.5" /> Historial de cambios</h3>
            <div className={card}>
              <Timeline items={historialItems} loading={historialLoading} emptyLabel="Sin cambios de estado registrados todavía" />
            </div>
          </section>

          {/* Solicitudes de cancelación de ESTA reserva — antes solo se
              avisaba arriba si había una PENDIENTE (banner rojo); las ya
              resueltas (aprobadas/rechazadas) se perdían de vista aunque
              `solicitudesReserva` ya las traía completas. Acá se ve el
              historial completo, para saber si el cliente ya intentó
              cancelar antes y qué se decidió. */}
          {solicitudesReserva.length > 0 && (
            <section>
              <h3 className={section}><AlertCircle className="w-3.5 h-3.5" /> Solicitudes de cancelación</h3>
              <div className="space-y-2">
                {[...solicitudesReserva]
                  .sort((a, b) => (b.fecha_solicitud ?? "").localeCompare(a.fecha_solicitud ?? ""))
                  .map((s) => (
                    <div key={s.id_solicitud} className={`${card} text-xs space-y-1.5`}>
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge status={s.estado} />
                        <span className="text-muted-foreground">{formatFechaCorta(s.fecha_solicitud)}</span>
                      </div>
                      <p className="font-medium text-foreground">{s.motivo}</p>
                      {s.motivo_detalle && <p className="text-muted-foreground">{s.motivo_detalle}</p>}
                      {s.estado !== "pendiente" && s.comentario_resolucion && (
                        <p className="text-muted-foreground italic border-t border-border/50 pt-1.5 mt-1.5">
                          "{s.comentario_resolucion}"
                          {s.fecha_resolucion && ` · ${formatFechaCorta(s.fecha_resolucion)}`}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </AdminModal>
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────

const ESTADOS = ["todos", "pendiente", "confirmada", "cancelada", "finalizada"] as const;
type EstadoFilter = typeof ESTADOS[number];

const PAGO_ESTADOS = ["pendiente", "procesando", "pagado", "rechazado", "cancelado"] as const;
type PagoFilter = "todos" | typeof PAGO_ESTADOS[number];
type CanalFilter = "todos" | CanalOrigen;

type ColumnKey =
  | "cliente" | "paquete" | "fechas" | "pax" | "total"
  | "metodoPago" | "estadoPago" | "estado" | "canal" | "asesor" | "actualizado";

const COLUMN_LABELS: Record<ColumnKey, string> = {
  cliente: "Cliente",
  paquete: "Hotel / Paquete",
  fechas: "Fechas",
  pax: "Pax",
  total: "Total",
  metodoPago: "Método de pago",
  estadoPago: "Estado de pago",
  estado: "Estado",
  canal: "Canal",
  asesor: "Asesor",
  actualizado: "Última actualización",
};
const ALL_COLUMNS = Object.keys(COLUMN_LABELS) as ColumnKey[];
// Método de pago y última actualización arrancan ocultas para no saturar la
// tabla por defecto — se activan desde el menú "Columnas" si se necesitan.
const DEFAULT_HIDDEN: ColumnKey[] = ["metodoPago", "actualizado"];

interface Props {
  reservas: ReservaExtended[];
  clientes?: Cliente[];
  empleados?: Empleado[];
  paquetes?: Paquete[];
  pagos?: Pago[];
  /** Solicitudes de cancelación de TODAS las reservas — para avisar en el
   * detalle de una reserva puntual si el cliente pidió cancelarla (ver
   * `solicitudPendiente` en SidePanel), sin tener que ir al módulo de
   * Cancelaciones a enterarse. */
  solicitudes?: SolicitudCancelacionResponse[];
  onDelete: (id: number) => void;
  onNueva: () => void;
  onUpdateEstado: (id: number, estado: EstadoReserva) => Promise<void>;
  /** Cuando el Dashboard (u otro módulo) quiere abrir el detalle de una
   * reserva puntual directamente al entrar a este módulo — ver "Ver reserva"
   * en Dashboard > Reservas próximas / Actividad reciente. Cambiar este
   * valor abre el modal de esa reserva; no fuerza nada si el admin ya cerró
   * el modal y no llegó un id nuevo. */
  reservaIdInicial?: number | null;
  /** Cuando el Dashboard navega acá desde una tarjeta de KPI (ej. "Reservas
   * canceladas") — deja el filtro de estado pre-aplicado en vez de que el
   * admin tenga que volver a elegirlo. Mismo criterio que `reservaIdInicial`. */
  estadoInicial?: string | null;
  /** Cuando el Dashboard navega acá desde "Ver sus reservas" en Clientes --
   * deja la tabla filtrada a las reservas de ese cliente, con un chip para
   * quitar el filtro. Mismo criterio que `reservaIdInicial`/`estadoInicial`. */
  clienteIdFiltro?: number | null;
  /** "Ver en Pagos" del detalle de una reserva -- ver SidePanelProps.onVerPagos. */
  onVerPagos?: (id: number) => void;
}

export default function ModuleReservas({
  reservas, clientes = [], empleados = [], paquetes = [], pagos = [], solicitudes = [],
  onDelete, onNueva, onUpdateEstado, reservaIdInicial = null, estadoInicial = null,
  clienteIdFiltro = null, onVerPagos,
}: Props) {
  const [search,       setSearch]       = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todos");
  const [pagoFilter,   setPagoFilter]   = useState<PagoFilter>("todos");
  const [canalFilter,  setCanalFilter]  = useState<CanalFilter>("todos");
  const [asesorFilter, setAsesorFilter] = useState("todos");
  const [selectedId,   setSelectedId]   = useState<number | null>(null);

  // Ver comentario de `reservaIdInicial` en Props — solo reacciona cuando
  // el valor realmente cambia (ej. un nuevo click en "Ver reserva" desde
  // Dashboard), no en cada render de este módulo.
  useEffect(() => {
    if (reservaIdInicial != null) setSelectedId(reservaIdInicial);
  }, [reservaIdInicial]);

  // Ver comentario de `estadoInicial` en Props.
  useEffect(() => {
    if (estadoInicial && (ESTADOS as readonly string[]).includes(estadoInicial)) {
      setEstadoFilter(estadoInicial as EstadoFilter);
    }
  }, [estadoInicial]);
  // Ver comentario de `clienteIdFiltro` en Props -- filtro EXACTO por
  // id_cliente (no una búsqueda de texto), para no depender de que el
  // nombre del cliente sea único ni de escribirlo a mano.
  const [clienteFiltroActivo, setClienteFiltroActivo] = useState<number | null>(null);
  useEffect(() => {
    if (clienteIdFiltro != null) setClienteFiltroActivo(clienteIdFiltro);
  }, [clienteIdFiltro]);

  // Nombre del cliente filtrado (para el chip "Filtrando por cliente" --
  // ver comentario de `clienteIdFiltro` en Props). null si no hay filtro
  // activo o el cliente no está en la lista cargada.
  const clienteFiltroNombre = clienteFiltroActivo == null
    ? null
    : (() => {
        const c = clientes.find(c => c.id_cliente === clienteFiltroActivo);
        return c ? `${c.nombre} ${c.apellido}` : null;
      })();
  const [hiddenCols,   setHiddenCols]   = useState<Set<ColumnKey>>(new Set(DEFAULT_HIDDEN));

  const isVisible = (key: ColumnKey) => !hiddenCols.has(key);
  const toggleCol = (key: ColumnKey) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const clienteMap  = Object.fromEntries(clientes.map(c  => [c.id_cliente,  c]));
  const empleadoMap = Object.fromEntries(empleados.map(e => [e.id_empleado, e]));
  const paqueteMap  = Object.fromEntries(paquetes.map(p  => [p.id_paquete,  p]));

  // Antes: Object.fromEntries se quedaba con el ÚLTIMO pago de cada reserva
  // en el orden en que llegara la lista (el backend no aplica ORDER BY en
  // GET /pagos) — con dos pagos para la misma reserva (ej. un intento
  // rechazado y su reintento aprobado) la tabla podía mostrar el estado de
  // pago equivocado. Se prioriza el pago más representativo del estado real
  // de la reserva: pagado > procesando > pendiente > rechazado > cancelado,
  // y entre pagos del mismo estado se queda con el más reciente.
  const PAGO_PRIORIDAD: Record<string, number> = { pagado: 0, procesando: 1, pendiente: 2, rechazado: 3, cancelado: 4 };
  const pagoMap: Record<number, Pago> = {};
  for (const p of pagos) {
    const actual = pagoMap[p.id_reserva];
    if (!actual) { pagoMap[p.id_reserva] = p; continue; }
    const prioActual = PAGO_PRIORIDAD[actual.estado] ?? 99;
    const prioNuevo  = PAGO_PRIORIDAD[p.estado] ?? 99;
    if (prioNuevo < prioActual) { pagoMap[p.id_reserva] = p; }
    else if (prioNuevo === prioActual && (p.fecha_pago ?? "") > (actual.fecha_pago ?? "")) { pagoMap[p.id_reserva] = p; }
  }

  const selectedReserva = reservas.find(r => r.id_reserva === selectedId) ?? null;

  const hasActiveFilters = estadoFilter !== "todos" || pagoFilter !== "todos"
    || canalFilter !== "todos" || asesorFilter !== "todos" || search.trim() !== ""
    || clienteFiltroActivo != null;

  function clearFilters() {
    setSearch(""); setEstadoFilter("todos"); setPagoFilter("todos");
    setCanalFilter("todos"); setAsesorFilter("todos"); setClienteFiltroActivo(null);
  }

  const filtered = reservas.filter(r => {
    const cl = clienteMap[r.id_cliente];
    const pk = paqueteMap[r.id_paquete];
    const pg = pagoMap[r.id_reserva];
    const q  = search.toLowerCase();
    const matchEstado = estadoFilter === "todos" || r.estado === estadoFilter;
    const matchPago   = pagoFilter === "todos" || (pg?.estado ?? "") === pagoFilter;
    const matchCanal  = canalFilter === "todos" || (r.canal_origen ?? "web") === canalFilter;
    const matchAsesor = asesorFilter === "todos"
      ? true
      : asesorFilter === "sin_asesor"
        ? r.id_empleado == null
        : String(r.id_empleado) === asesorFilter;
    const matchCliente = clienteFiltroActivo == null || r.id_cliente === clienteFiltroActivo;
    const matchSearch = !q
      || String(r.id_reserva).includes(q)
      || (cl && `${cl.nombre} ${cl.apellido}`.toLowerCase().includes(q))
      || (pk && pk.nombre_paquete.toLowerCase().includes(q))
      || r.estado.includes(q);
    return matchEstado && matchPago && matchCanal && matchAsesor && matchCliente && matchSearch;
  });

  const { page, pageCount, slice, setPage } = usePagination(filtered, 10);

  const counts = reservas.reduce((acc, r) => {
    acc[r.estado] = (acc[r.estado] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Suma real de precio_total (ya calculado en el backend) — nunca un
  // número inventado, solo la agregación de lo que ya trae cada reserva.
  const totalIngresos = reservas.reduce((sum, r) => sum + (r.precio_total ?? 0), 0);

  const CANAL_ICON: Record<CanalOrigen, React.ReactNode> = {
    web:      <Globe      className="w-3.5 h-3.5 text-primary/70"    />,
    empleado: <UserCheck  className="w-3.5 h-3.5 text-emerald-500" />,
    telefono: <PhoneCall  className="w-3.5 h-3.5 text-gold"  />,
  };

  const thCls = "px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap";
  const selectTriggerCls = "w-auto min-w-[140px] h-auto py-2 bg-card border-border text-xs";

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Reservas</h2>
          <p className="text-muted-foreground text-sm">{reservas.length} reservas en total</p>
        </div>
        <button
          onClick={onNueva}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-[#A13B55] text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-primary/20 transition-all"
        >
          <PlusCircle className="w-4 h-4" /> Nueva
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard label="Total"       value={reservas.length}        />
        <MetricCard label="Confirmadas" value={counts.confirmada ?? 0} color="green" />
        <MetricCard label="Pendientes"  value={counts.pendiente  ?? 0} color="amber" />
        <MetricCard label="Canceladas"  value={counts.cancelada  ?? 0} color="red"   />
        <MetricCard label="Ingresos"    value={`$${totalIngresos.toLocaleString("es-CO")}`} color="green" />
      </div>

      {/* Búsqueda + estado */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, paquete o ID..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm outline-none
              bg-card
              text-foreground
              placeholder:text-muted-foreground/60
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

      {/* Filtros avanzados + columnas */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <Select value={pagoFilter} onValueChange={(v) => setPagoFilter(v as PagoFilter)}>
          <SelectTrigger className={selectTriggerCls}>
            <SelectValue placeholder="Estado de pago" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Pago: todos</SelectItem>
            {PAGO_ESTADOS.map(p => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={canalFilter} onValueChange={(v) => setCanalFilter(v as CanalFilter)}>
          <SelectTrigger className={selectTriggerCls}>
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Canal: todos</SelectItem>
            <SelectItem value="web">Web</SelectItem>
            <SelectItem value="empleado">Presencial</SelectItem>
            <SelectItem value="telefono">Teléfono</SelectItem>
          </SelectContent>
        </Select>

        <Select value={asesorFilter} onValueChange={setAsesorFilter}>
          <SelectTrigger className={selectTriggerCls}>
            <SelectValue placeholder="Asesor" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Asesor: todos</SelectItem>
            <SelectItem value="sin_asesor">Web (sin asesor)</SelectItem>
            {empleados.map(e => (
              <SelectItem key={e.id_empleado} value={String(e.id_empleado)}>
                {e.nombre} {e.apellido}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {clienteFiltroNombre && (
          <span className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
            Cliente: {clienteFiltroNombre}
            <button
              type="button"
              onClick={() => setClienteFiltroActivo(null)}
              className="p-0.5 rounded-full hover:bg-primary/20 transition-colors"
              aria-label="Quitar filtro de cliente"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpiar filtros
          </button>
        )}

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors bg-card"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
                Columnas
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase tracking-wide">
                Mostrar columnas
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_COLUMNS.map(key => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={isVisible(key)}
                  onCheckedChange={() => toggleCol(key)}
                  className="text-xs"
                >
                  {COLUMN_LABELS[key]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <>
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className={thCls}>ID</th>
                {isVisible("cliente")    && <th className={thCls}>{COLUMN_LABELS.cliente}</th>}
                {isVisible("paquete")    && <th className={thCls}>{COLUMN_LABELS.paquete}</th>}
                {isVisible("fechas")     && <th className={thCls}>{COLUMN_LABELS.fechas}</th>}
                {isVisible("pax")        && <th className={thCls}>{COLUMN_LABELS.pax}</th>}
                {isVisible("total")      && <th className={thCls}>{COLUMN_LABELS.total}</th>}
                {isVisible("metodoPago") && <th className={thCls}>{COLUMN_LABELS.metodoPago}</th>}
                {isVisible("estadoPago") && <th className={thCls}>{COLUMN_LABELS.estadoPago}</th>}
                {isVisible("estado")     && <th className={thCls}>{COLUMN_LABELS.estado}</th>}
                {isVisible("canal")      && <th className={thCls}>{COLUMN_LABELS.canal}</th>}
                {isVisible("asesor")     && <th className={thCls}>{COLUMN_LABELS.asesor}</th>}
                {isVisible("actualizado")&& <th className={thCls}>{COLUMN_LABELS.actualizado}</th>}
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {slice.map(r => {
                const cl = clienteMap[r.id_cliente];
                const pk = paqueteMap[r.id_paquete];
                const pg = pagoMap[r.id_reserva];
                const asesor = r.id_empleado != null ? empleadoMap[r.id_empleado] : undefined;
                return (
                  <tr
                    key={r.id_reserva}
                    onClick={() => setSelectedId(r.id_reserva)}
                    className="hover:bg-accent transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">
                      #{r.id_reserva}
                    </td>

                    {isVisible("cliente") && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {cl ? (
                            <>
                              <Avatar nombre={cl.nombre} apellido={cl.apellido} fotoUrl={resolveFotoUrl(cl.foto_perfil)} color="primary" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">
                                  {cl.nombre} {cl.apellido}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">{cl.correo}</p>
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">#{r.id_cliente}</span>
                          )}
                        </div>
                      </td>
                    )}

                    {isVisible("paquete") && (
                      <td className="px-4 py-3">
                        {pk ? (
                          <div>
                            <p className="text-xs font-medium text-foreground truncate max-w-[140px]">
                              {pk.nombre_paquete}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {pk.duracion_dias}d · ${pk.precio_base.toLocaleString("es-CO")}
                            </p>
                          </div>
                        ) : r.hotel_nombre ? (
                          <div>
                            <p className="text-xs font-medium text-foreground truncate max-w-[140px]">
                              {r.hotel_nombre}
                            </p>
                            <p className="text-[11px] text-muted-foreground">Reserva directa</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">#{r.id_paquete}</span>
                        )}
                      </td>
                    )}

                    {isVisible("fechas") && (
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <p>{formatFechaCorta(r.fecha_inicio)}</p>
                        <p className="text-[11px] text-muted-foreground/70">→ {formatFechaCorta(r.fecha_fin)}</p>
                      </td>
                    )}

                    {isVisible("pax") && (
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.numero_personas}</td>
                    )}

                    {isVisible("total") && (
                      <td className="px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap">
                        {r.precio_total != null ? `$${r.precio_total.toLocaleString("es-CO")}` : "—"}
                      </td>
                    )}

                    {isVisible("metodoPago") && (
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {pg?.metodo_pago?.nombre_metodo ?? "—"}
                      </td>
                    )}

                    {isVisible("estadoPago") && (
                      <td className="px-4 py-3">
                        {pg ? <StatusBadge status={pg.estado} /> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    )}

                    {isVisible("estado") && (
                      <td className="px-4 py-3">
                        <EstadoBadge estado={r.estado} />
                      </td>
                    )}

                    {isVisible("canal") && (
                      <td className="px-4 py-3">
                        <span title={r.canal_origen ?? "web"}>
                          {CANAL_ICON[r.canal_origen ?? "web"]}
                        </span>
                      </td>
                    )}

                    {isVisible("asesor") && (
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {asesor ? (
                          <span className="text-foreground">{asesor.nombre} {asesor.apellido}</span>
                        ) : (
                          <span className="text-muted-foreground">Web</span>
                        )}
                      </td>
                    )}

                    {isVisible("actualizado") && (
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {r.fecha_ultima_actualizacion ? tiempoRelativo(r.fecha_ultima_actualizacion) : "—"}
                      </td>
                    )}

                    <td className="px-4 py-3">
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(r.id_reserva); }}
                        className="p-1.5 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
          title="No se encontraron reservas"
          description="Prueba con otros filtros o términos de búsqueda."
          action={hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-xs font-medium transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Limpiar filtros
            </button>
          ) : undefined}
        />
      )}

      {/* Detalle de reserva */}
      {selectedReserva && (
        <SidePanel
          reserva={selectedReserva}
          cliente={clienteMap[selectedReserva.id_cliente]}
          empleado={selectedReserva.id_empleado != null ? empleadoMap[selectedReserva.id_empleado] : undefined}
          paquete={paqueteMap[selectedReserva.id_paquete]}
          pago={pagoMap[selectedReserva.id_reserva]}
          solicitudesReserva={solicitudes.filter(sc => sc.id_reserva === selectedReserva.id_reserva)}
          reservasClienteCount={reservas.filter(r => r.id_cliente === selectedReserva.id_cliente).length}
          onClose={() => setSelectedId(null)}
          onVerPagos={onVerPagos}
          onDelete={(id) => { onDelete(id); setSelectedId(null); }}
          onUpdateEstado={onUpdateEstado}
        />
      )}
    </div>
  );
}
