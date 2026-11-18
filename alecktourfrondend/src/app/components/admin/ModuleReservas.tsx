import { Fragment, useState, useEffect } from "react";
import {
  PlusCircle, Search, Trash2, X, User, Package,
  CreditCard, Calendar, Users, Phone, Mail, MapPin,
  Globe, UserCheck, PhoneCall, ChevronRight, AlertCircle,
  CheckCircle, Clock, XCircle, FileText, Save, MoreHorizontal,
  MessageCircle, Send, BedDouble, Sparkles, Receipt, Paperclip,
  Plane, Hotel, SlidersHorizontal, Wallet, CalendarDays,
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
import BotonExportarCsv from "./ui/BotonExportarCsv";
import DetalleComercialReserva from "./DetalleComercialReserva";
import { EncabezadoOrdenable, type DireccionOrden } from "./ui/useOrden";
import { abrirArchivoProtegido, apiFetch } from "../../api/v1/api";

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
  /** Solo en GET /reservas/buscar (listado paginado del panel). */
  cliente_nombre?: string | null;
  cliente_documento?: string | null;
  cliente_correo?: string | null;
  pagos?: Pago[];
  tipo_producto?: string | null;
}

interface TotalesBusqueda {
  reservas: number;
  viajeros: number;
  monto_total: number;
  cobrado: number;
  por_cobrar: number;
  con_saldo: number;
}

interface PaginaReservas {
  items: ReservaExtended[];
  total: number;
  pagina: number;
  por_pagina: number;
  conteos: Record<string, number>;
  totales?: TotalesBusqueda | null;
}

const POR_PAGINA_RESERVAS = 15;
const TIPOS_PRODUCTO = [
  { valor: "todos", texto: "Tipo: todos" },
  { valor: "hotel", texto: "Hotel" },
  { valor: "paquete", texto: "Paquete" },
  { valor: "vuelo", texto: "Vuelo" },
] as const;

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

const ETIQUETA_PAGO: Record<string, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando",
  pagado: "Pagado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  finalizada: "Finalizada",
};

type ReservaConDatos = ReservaExtended & {
  nombre_paquete?: string | null;
  vuelo_ruta?: string | null;
  total_pagado?: number;
  saldo_pendiente?: number;
};

/** Qué compró el cliente: nombre e ícono según paquete, hotel o vuelo. */
export function productoDe(r: ReservaConDatos, pk?: Paquete) {
  const tipo = r.tipo_producto ?? (r.id_paquete ? "paquete" : r.hotel_nombre ? "hotel" : r.vuelo_ruta ? "vuelo" : null);
  if (tipo === "vuelo" || (!pk && !r.nombre_paquete && !r.hotel_nombre && r.vuelo_ruta)) {
    return { Icono: Plane, tipo: "Vuelo", nombre: r.vuelo_ruta ?? r.destino ?? `Reserva #${r.id_reserva}` };
  }
  if (pk || r.nombre_paquete) {
    return { Icono: Package, tipo: "Paquete", nombre: pk?.nombre_paquete ?? r.nombre_paquete ?? "Paquete" };
  }
  if (r.hotel_nombre) return { Icono: Hotel, tipo: "Hotel", nombre: r.hotel_nombre };
  return { Icono: Package, tipo: "Reserva", nombre: r.destino ?? `Reserva #${r.id_reserva}` };
}

/** Cómo va el cobro de la reserva, con los totales que ya calcula el backend. */
export function cobroDe(r: ReservaConDatos) {
  const total = Number(r.precio_total ?? 0);
  const pagado = Number(r.total_pagado ?? 0);
  const saldo = Number(r.saldo_pendiente ?? Math.max(total - pagado, 0));
  const pct = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;
  if (total > 0 && saldo <= 0) return { etiqueta: "Pagada", clase: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", pct: 100, saldo: 0 };
  if (pagado > 0) return { etiqueta: "Abono", clase: "bg-sky-500/10 text-sky-700 dark:text-sky-400", pct, saldo };
  return { etiqueta: "Sin pago", clase: "bg-muted text-muted-foreground", pct: 0, saldo };
}

/** Pago más relevante de una reserva para el listado: primero uno que
 * espera revisión (pendiente/procesando), luego el aprobado más reciente. */
const PRIORIDAD_LISTADO: Record<string, number> = { procesando: 0, pendiente: 1, pagado: 2, rechazado: 3, cancelado: 4 };
function mejorPago<T extends { estado: string; fecha_pago?: string | null }>(pagos?: T[] | null): T | undefined {
  if (!pagos?.length) return undefined;
  return [...pagos].sort(
    (a, b) =>
      (PRIORIDAD_LISTADO[a.estado] ?? 9) - (PRIORIDAD_LISTADO[b.estado] ?? 9) ||
      (b.fecha_pago ?? "").localeCompare(a.fecha_pago ?? ""),
  )[0];
}

/** "En 12 días", "Hoy", "En curso", "Hace 3 días": cuándo es el viaje. */
export function cuandoViaja(inicio?: string | null, fin?: string | null): string {
  if (!inicio) return "";
  const parse = (f: string) => {
    const [y, m, d] = f.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  const h = new Date();
  const hoy = new Date(h.getFullYear(), h.getMonth(), h.getDate()).getTime();
  const dias = Math.round((parse(inicio) - hoy) / 86_400_000);
  if (dias === 0) return "Sale hoy";
  if (dias === 1) return "Sale mañana";
  if (dias > 1) return `En ${dias} días`;
  if (fin && parse(fin) >= hoy) return "En curso";
  return "Ya viajó";
}

function nochesEntre(inicio?: string | null, fin?: string | null): number | null {
  if (!inicio || !fin) return null;
  const a = new Date(`${inicio.slice(0, 10)}T12:00:00`).getTime();
  const b = new Date(`${fin.slice(0, 10)}T12:00:00`).getTime();
  const n = Math.round((b - a) / 86_400_000);
  return n >= 0 ? n : null;
}

/** "2 adultos, 1 niño" o "3 personas" si la reserva no trae el desglose. */
function textoViajeros(r: { numero_personas: number; adultos?: number | null; ninos?: number | null; infantes?: number | null }): string {
  const partes: string[] = [];
  if (r.adultos) partes.push(`${r.adultos} adulto${r.adultos === 1 ? "" : "s"}`);
  if (r.ninos) partes.push(`${r.ninos} niño${r.ninos === 1 ? "" : "s"}`);
  if (r.infantes) partes.push(`${r.infantes} infante${r.infantes === 1 ? "" : "s"}`);
  return partes.length ? partes.join(", ") : `${r.numero_personas} persona${r.numero_personas === 1 ? "" : "s"}`;
}

const NOMBRE_CANAL_ORIGEN: Record<string, string> = { web: "Sitio web", empleado: "Presencial (asesor)", telefono: "Teléfono" };

const BORDE_ESTADO: Record<string, string> = {
  pendiente: "border-l-amber-400",
  confirmada: "border-l-emerald-500",
  cancelada: "border-l-slate-300 dark:border-l-slate-600",
  finalizada: "border-l-sky-400",
};

const pesosCOP = (v: number) => `$${Math.round(v).toLocaleString("es-CO")}`;

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
      {ETIQUETA_ESTADO[estado] ?? estado}
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
  /** Abre otra reserva del mismo cliente en este panel. */
  onAbrirReserva?: (id: number) => void;
  /** Asesor (no admin): puede ver todo y dejar notas, pero cambiar el estado
   * o eliminar es solo del administrador (lo valida también el backend). */
  soloLectura?: boolean;
}

function SidePanel({ reserva, cliente, empleado, paquete, pago, solicitudesReserva = [], reservasClienteCount, onClose, onDelete, onUpdateEstado, onVerPagos, onAbrirReserva, soloLectura = false }: SidePanelProps) {
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
  // El panel puede montarse sin reserva (devuelve null más abajo).
  const producto = reserva ? productoDe(reserva as ReservaConDatos, paquete) : productoDe({ id_reserva: 0 } as ReservaConDatos);
  const [codigoCopiado, setCodigoCopiado] = useState(false);

  // Historial del cliente: sus otras reservas y cuánto ha comprado en total.
  const [historialCliente, setHistorialCliente] = useState<PaginaReservas | null>(null);
  useEffect(() => {
    if (!reserva) return;
    let vigente = true;
    setHistorialCliente(null);
    apiFetch<PaginaReservas>(`/reservas/buscar?id_cliente=${reserva.id_cliente}&por_pagina=6&orden=creada&direccion=desc&con_totales=true`)
      .then((d) => { if (vigente) setHistorialCliente(d); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [reserva?.id_cliente, reserva?.id_reserva]);
  const saldoReal = Math.max(totalReal - montoPagado, 0);

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
      footer={soloLectura ? undefined : (
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={() => onDelete(reserva.id_reserva)}
            className="flex items-center gap-1.5 px-3 py-2 text-destructive border border-destructive/20 hover:bg-destructive/10 rounded-lg text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
        </div>
      )}
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
      {/* Resumen de un vistazo: qué compró, cuándo viaja y cómo va el pago. */}
      <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
        <div className="col-span-3 flex items-center gap-3 rounded-xl bg-primary/5 p-3 ring-1 ring-primary/15 sm:col-span-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <producto.Icono className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">{producto.tipo}</p>
            <p className="truncate text-sm font-semibold text-foreground">{producto.nombre}</p>
          </div>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarDays className="h-3 w-3" /> Viaje</p>
          <p className="text-sm font-semibold text-foreground">{formatFechaCorta(reserva.fecha_inicio)}</p>
          <p className="text-[11px] text-muted-foreground">{reserva.numero_personas} viajero{reserva.numero_personas === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Receipt className="h-3 w-3" /> Total</p>
          <p className="text-sm font-semibold text-foreground">{pesosCOP(totalReal)}</p>
          <p className="text-[11px] text-muted-foreground">{pct}% pagado</p>
        </div>
        <div className={`rounded-xl p-3 ${saldoReal > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Wallet className="h-3 w-3" /> Saldo</p>
          <p className={`text-sm font-semibold ${saldoReal > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {saldoReal > 0 ? pesosCOP(saldoReal) : "Pagada"}
          </p>
          <p className="text-[11px] text-muted-foreground">Pagado {pesosCOP(montoPagado)}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {cliente?.celular && enlaceWhatsApp(cliente.celular) && (
          <a
            href={enlaceWhatsApp(cliente.celular, `Hola ${cliente.nombre}, te escribimos de Alik Tours por tu reserva #${reserva.id_reserva}.`) ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        )}
        {cliente?.celular && (
          <a href={`tel:${cliente.celular}`} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
            <Phone className="h-3.5 w-3.5" /> Llamar
          </a>
        )}
        {cliente?.correo && (
          <a href={`mailto:${cliente.correo}?subject=${encodeURIComponent(`Tu reserva #${reserva.id_reserva} en Alik Tours`)}`} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
            <Mail className="h-3.5 w-3.5" /> Correo
          </a>
        )}
        {onVerPagos && (
          <button type="button" onClick={() => onVerPagos(reserva.id_reserva)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
            <CreditCard className="h-3.5 w-3.5" /> Ver pagos
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(`#${reserva.id_reserva}`).catch(() => {});
            setCodigoCopiado(true);
            setTimeout(() => setCodigoCopiado(false), 1500);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
        >
          {codigoCopiado ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <FileText className="h-3.5 w-3.5" />}
          {codigoCopiado ? "Copiado" : "Copiar código"}
        </button>
      </div>

      {/* Recorrido: en qué punto está la reserva */}
      {estadoLocal === "cancelada" ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <XCircle className="h-4 w-4" /> Esta reserva está cancelada.
        </div>
      ) : (
        <ol className="mb-5 grid grid-cols-5 gap-1" aria-label="Recorrido de la reserva">
          {(() => {
            const hoy = new Date();
            const hoyT = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
            const t = (f?: string | null) => (f ? new Date(`${f.slice(0, 10)}T00:00:00`).getTime() : NaN);
            const pasos = [
              { label: "Reservada", hecho: true, detalle: (reserva as ReservaConDatos & { fecha_reserva?: string }).fecha_reserva ? formatFechaCorta((reserva as ReservaConDatos & { fecha_reserva?: string }).fecha_reserva) : "" },
              { label: "Pagada", hecho: pct >= 100, parcial: pct > 0 && pct < 100, detalle: pct >= 100 ? "100%" : `${pct}%` },
              { label: "Confirmada", hecho: estadoLocal === "confirmada" || estadoLocal === "finalizada", detalle: "" },
              { label: "Viaja", hecho: hoyT >= t(reserva.fecha_inicio), detalle: formatFechaCorta(reserva.fecha_inicio) },
              { label: "Finalizada", hecho: estadoLocal === "finalizada", detalle: formatFechaCorta(reserva.fecha_fin) },
            ];
            return pasos.map((p) => (
              <li key={p.label} className="min-w-0">
                <div className={`h-1.5 rounded-full ${p.hecho ? "bg-primary" : p.parcial ? "bg-gradient-to-r from-primary to-muted" : "bg-muted"}`} />
                <p className={`mt-1.5 truncate text-[11px] font-semibold ${p.hecho ? "text-foreground" : "text-muted-foreground"}`}>
                  {p.hecho && <CheckCircle className="mr-0.5 inline h-3 w-3 text-primary" />}
                  {p.label}
                </p>
                {p.detalle && <p className="truncate text-[10px] text-muted-foreground">{p.detalle}</p>}
              </li>
            ));
          })()}
        </ol>
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
                  <DetailRow icon={MapPin} label="Ciudad"     value={[cliente.ciudad, cliente.pais].filter(Boolean).join(", ") || undefined} />
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
          {historialCliente?.totales && historialCliente.totales.reservas > 0 && (
            <section>
              <h3 className={section}><Receipt className="w-3.5 h-3.5" /> Historial del cliente</h3>
              <div className={card}>
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 py-2">
                    <p className="text-base font-bold text-foreground">{historialCliente.totales.reservas}</p>
                    <p className="text-[10px] text-muted-foreground">Reservas</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 py-2">
                    <p className="text-base font-bold text-foreground">{pesosCOP(historialCliente.totales.monto_total)}</p>
                    <p className="text-[10px] text-muted-foreground">Comprado</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 py-2">
                    <p className="text-base font-bold text-foreground">{pesosCOP(historialCliente.totales.cobrado)}</p>
                    <p className="text-[10px] text-muted-foreground">Pagado</p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {historialCliente.items.filter((o) => o.id_reserva !== reserva.id_reserva).slice(0, 4).map((o) => {
                    const po = productoDe(o as ReservaConDatos);
                    return (
                      <li key={o.id_reserva}>
                        <button
                          type="button"
                          onClick={() => onAbrirReserva?.(o.id_reserva)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted"
                        >
                          <po.Icono className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-foreground">#{o.id_reserva} · {po.nombre}</span>
                          <span className="shrink-0 text-muted-foreground">{formatFechaCorta(o.fecha_inicio)}</span>
                          <EstadoBadge estado={o.estado} />
                        </button>
                      </li>
                    );
                  })}
                  {historialCliente.items.length <= 1 && (
                    <li className="px-2 text-xs text-muted-foreground">Es su primera reserva con la agencia.</li>
                  )}
                </ul>
              </div>
            </section>
          )}

          <section>
            <h3 className={section}>
              <producto.Icono className="w-3.5 h-3.5" /> {producto.tipo}
            </h3>
            <div className={card}>
              <p className="text-sm font-semibold text-foreground mb-3">{producto.nombre}</p>
              {reserva.destino && producto.tipo !== "Vuelo" && (
                <DetailRow icon={MapPin} label="Destino" value={reserva.destino} />
              )}
              <DetailRow icon={Calendar} label={producto.tipo === "Vuelo" ? "Ida" : "Llegada"} value={formatFechaCorta(reserva.fecha_inicio)} />
              <DetailRow icon={Calendar} label={producto.tipo === "Vuelo" ? "Regreso" : "Salida"} value={formatFechaCorta(reserva.fecha_fin)} />
              {paquete && <DetailRow icon={Clock} label="Duración" value={`${paquete.duracion_dias} días`} />}
              {nochesEntre(reserva.fecha_inicio, reserva.fecha_fin) != null && (
                <DetailRow icon={Clock} label="Noches" value={String(nochesEntre(reserva.fecha_inicio, reserva.fecha_fin))} />
              )}
              <DetailRow icon={Users} label="Viajeros" value={textoViajeros(reserva as ReservaConDatos & { adultos?: number | null; ninos?: number | null; infantes?: number | null })} />
              {cuandoViaja(reserva.fecha_inicio, reserva.fecha_fin) && estadoLocal !== "cancelada" && (
                <DetailRow icon={Plane} label="Cuándo" value={cuandoViaja(reserva.fecha_inicio, reserva.fecha_fin)} />
              )}
              {(reserva as { solicitudes_especiales?: string | null }).solicitudes_especiales && (
                <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  <b>Solicitud del cliente:</b> {(reserva as { solicitudes_especiales?: string | null }).solicitudes_especiales}
                </p>
              )}
            </div>
          </section>

          {/* Habitaciones y servicios reales de la reserva (GET /reservas/{id}/
              habitaciones y /servicios) — antes quedaban ocultos detrás de un
              botón "Ver habitaciones y servicios" en el footer; siendo esto el
              corazón de lo que el cliente realmente compró, se cargan y
              muestran de entrada, igual que el resto de esta ficha. */}
          {(producto.tipo !== "Vuelo" || habitaciones.length > 0) && (
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
          )}

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

          {/* Desglose, viajeros, vuelo y notas internas (reservas del flujo nuevo). */}
          <DetalleComercialReserva idReserva={reserva.id_reserva} />

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
                              <button
                                type="button"
                                onClick={() => abrirArchivoProtegido(`/pagos/${p.id_pago}/comprobante`).catch(() => {})}
                                className="text-primary hover:underline"
                              >
                                Ver comprobante
                              </button>
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
              {soloLectura ? (
                <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  Estado actual: <b className="capitalize text-foreground">{estadoLocal}</b>. Solo un administrador puede
                  cambiarlo; deja una nota interna abajo si hace falta un cambio.
                </p>
              ) : (
              <EstadoPicker current={estadoLocal} onChange={setEstadoLocal} />
              )}
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
              {!soloLectura && (
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
              )}
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
  estadoPago: "Cobro",
  estado: "Estado",
  canal: "Canal / asesor",
  asesor: "Asesor",
  actualizado: "Última actualización",
};
const ALL_COLUMNS = Object.keys(COLUMN_LABELS) as ColumnKey[];
// Método de pago y última actualización arrancan ocultas para no saturar la
// tabla por defecto — se activan desde el menú "Columnas" si se necesitan.
// "Asesor" se ve dentro de la columna Canal (ícono + quién la registró),
// así la tabla cabe sin barra horizontal en una pantalla normal.
const DEFAULT_HIDDEN: ColumnKey[] = ["metodoPago", "actualizado", "asesor"];

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
  /** Asesor: ve todas las reservas pero no cambia estados ni elimina. */
  soloEmpleado?: boolean;
}

type CampoOrden = "id" | "fechas" | "creada";

export default function ModuleReservas({
  reservas, clientes = [], empleados = [], paquetes = [], pagos = [], solicitudes = [],
  onDelete, onNueva, onUpdateEstado, reservaIdInicial = null, estadoInicial = null,
  clienteIdFiltro = null, onVerPagos, soloEmpleado = false,
}: Props) {
  const [search,       setSearch]       = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todos");
  const [pagoFilter,   setPagoFilter]   = useState<PagoFilter>("todos");
  const [canalFilter,  setCanalFilter]  = useState<CanalFilter>("todos");
  const [asesorFilter, setAsesorFilter] = useState("todos");
  const [selectedId,   setSelectedId]   = useState<number | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [tipoFilter,   setTipoFilter]   = useState<string>("todos");
  const [fechaDesde,   setFechaDesde]   = useState("");
  const [fechaHasta,   setFechaHasta]   = useState("");
  const [busquedaServidor, setBusquedaServidor] = useState("");
  const [page, setPage] = useState(0);
  const [orden, setOrden] = useState<{ campo: CampoOrden; dir: DireccionOrden }>({ campo: "id", dir: "desc" });
  const [datos, setDatos] = useState<PaginaReservas | null>(null);
  const [totales, setTotales] = useState<TotalesBusqueda | null>(null);
  const [expandida, setExpandida] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  // Reserva abierta desde otro módulo (chat, dashboard) que no está en la
  // página actual: se trae del backend por su código.
  const [reservaSuelta, setReservaSuelta] = useState<ReservaExtended | null>(null);

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

  const hasActiveFilters = estadoFilter !== "todos" || pagoFilter !== "todos"
    || canalFilter !== "todos" || asesorFilter !== "todos" || search.trim() !== ""
    || clienteFiltroActivo != null || tipoFilter !== "todos" || fechaDesde !== "" || fechaHasta !== "";

  // ---------- Vistas rápidas ----------
  const hoyISO = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const en7ISO = (() => {
    const [y, m, d] = hoyISO.split("-").map(Number);
    const f = new Date(y, m - 1, d + 7);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
  })();
  const VISTAS_RAPIDAS = [
    { id: "todas", label: "Todas", Icono: CalendarDays },
    { id: "por-confirmar", label: "Por confirmar", Icono: Clock },
    { id: "pago-pendiente", label: "Pago pendiente", Icono: Wallet },
    { id: "salen-semana", label: "Salen en 7 días", Icono: Plane },
    { id: "sin-asesor", label: "Llegaron por la web", Icono: Globe },
  ] as const;
  function aplicarVista(id: (typeof VISTAS_RAPIDAS)[number]["id"]) {
    clearFilters();
    if (id === "por-confirmar") setEstadoFilter("pendiente");
    if (id === "pago-pendiente") setPagoFilter("pendiente");
    if (id === "salen-semana") {
      setEstadoFilter("confirmada");
      setFechaDesde(hoyISO);
      setFechaHasta(en7ISO);
    }
    if (id === "sin-asesor") setAsesorFilter("sin_asesor");
  }
  const soloEstos = (cond: boolean, ...otros: boolean[]) => cond && otros.every(Boolean);
  const sinOtros = search.trim() === "" && canalFilter === "todos" && tipoFilter === "todos" && clienteFiltroActivo == null;
  const vistaActiva =
    !hasActiveFilters ? "todas"
    : soloEstos(estadoFilter === "pendiente", pagoFilter === "todos", asesorFilter === "todos", !fechaDesde, !fechaHasta, sinOtros) ? "por-confirmar"
    : soloEstos(pagoFilter === "pendiente", estadoFilter === "todos", asesorFilter === "todos", !fechaDesde, !fechaHasta, sinOtros) ? "pago-pendiente"
    : soloEstos(estadoFilter === "confirmada", fechaDesde === hoyISO, fechaHasta === en7ISO, pagoFilter === "todos", asesorFilter === "todos", sinOtros) ? "salen-semana"
    : soloEstos(asesorFilter === "sin_asesor", estadoFilter === "todos", pagoFilter === "todos", !fechaDesde, !fechaHasta, sinOtros) ? "sin-asesor"
    : null;

  // Filtros activos (fuera de búsqueda y estado, que se ven arriba) como chips.
  const NOMBRE_CANAL: Record<string, string> = { web: "Web", empleado: "Presencial", telefono: "Teléfono" };
  const chipsFiltros = [
    pagoFilter !== "todos" && { texto: `Pago: ${ETIQUETA_PAGO[pagoFilter] ?? pagoFilter}`, quitar: () => setPagoFilter("todos") },
    canalFilter !== "todos" && { texto: `Canal: ${NOMBRE_CANAL[canalFilter] ?? canalFilter}`, quitar: () => setCanalFilter("todos") },
    tipoFilter !== "todos" && { texto: `Tipo: ${TIPOS_PRODUCTO.find((t) => t.valor === tipoFilter)?.texto ?? tipoFilter}`, quitar: () => setTipoFilter("todos") },
    fechaDesde && { texto: `Desde ${formatFechaCorta(fechaDesde)}`, quitar: () => setFechaDesde("") },
    fechaHasta && { texto: `Hasta ${formatFechaCorta(fechaHasta)}`, quitar: () => setFechaHasta("") },
    asesorFilter !== "todos" && {
      texto: asesorFilter === "sin_asesor" ? "Sin asesor (web)" : `Asesor: ${empleados.find((e) => String(e.id_empleado) === asesorFilter)?.nombre ?? asesorFilter}`,
      quitar: () => setAsesorFilter("todos"),
    },
  ].filter(Boolean) as { texto: string; quitar: () => void }[];

  function clearFilters() {
    setSearch(""); setEstadoFilter("todos"); setPagoFilter("todos");
    setCanalFilter("todos"); setAsesorFilter("todos"); setClienteFiltroActivo(null);
    setTipoFilter("todos"); setFechaDesde(""); setFechaHasta("");
  }

  // Búsqueda con espera corta: no se pide al servidor en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaServidor(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Cualquier cambio de filtro u orden vuelve a la primera página.
  useEffect(() => {
    setPage(0);
  }, [busquedaServidor, estadoFilter, pagoFilter, canalFilter, asesorFilter, tipoFilter, fechaDesde, fechaHasta, clienteFiltroActivo, orden]);

  // Parámetros de /reservas/buscar con los filtros actuales (tabla y CSV).
  function paramsFiltros(pagina: number, porPagina: number): URLSearchParams {
    const params = new URLSearchParams({
      pagina: String(pagina),
      por_pagina: String(porPagina),
      orden: orden.campo,
      direccion: orden.dir,
    });
    if (busquedaServidor) params.set("q", busquedaServidor);
    if (estadoFilter !== "todos") params.set("estado", estadoFilter);
    if (pagoFilter !== "todos") params.set("estado_pago", pagoFilter);
    if (canalFilter !== "todos") params.set("canal", canalFilter);
    if (tipoFilter !== "todos") params.set("tipo_producto", tipoFilter);
    if (asesorFilter === "sin_asesor") params.set("sin_asesor", "true");
    else if (asesorFilter !== "todos") params.set("id_empleado", asesorFilter);
    if (clienteFiltroActivo != null) params.set("id_cliente", String(clienteFiltroActivo));
    if (fechaDesde) params.set("fecha_desde", fechaDesde);
    if (fechaHasta) params.set("fecha_hasta", fechaHasta);
    return params;
  }

  // CSV: TODAS las reservas que coinciden con los filtros (de 100 en 100),
  // no solo la página visible.
  async function cargarTodasFiltradas(): Promise<ReservaExtended[]> {
    const todas: ReservaExtended[] = [];
    for (let pagina = 1; pagina <= 200; pagina++) {
      const d = await apiFetch<PaginaReservas>(`/reservas/buscar?${paramsFiltros(pagina, 100).toString()}`);
      todas.push(...d.items);
      if (todas.length >= d.total || d.items.length === 0) break;
    }
    return todas;
  }

  // Listado paginado y filtrado EN EL BACKEND (GET /reservas/buscar). Se
  // vuelve a pedir cuando cambian los filtros, la página o la lista del
  // panel (el padre la refresca al crear, editar o borrar una reserva).
  useEffect(() => {
    let vigente = true;
    const params = paramsFiltros(page + 1, POR_PAGINA_RESERVAS);
    // Los totales cubren TODO el resultado: se piden al llegar a la primera
    // página (cualquier cambio de filtro vuelve a ella) y se conservan al paginar.
    if (page === 0) params.set("con_totales", "true");
    setCargando(true);
    apiFetch<PaginaReservas>(`/reservas/buscar?${params.toString()}`)
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        if (d.totales) setTotales(d.totales);
        setErrorCarga(null);
      })
      .catch((e: Error) => {
        if (vigente) setErrorCarga(e.message || "No se pudieron cargar las reservas");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [page, orden, busquedaServidor, estadoFilter, pagoFilter, canalFilter, asesorFilter, tipoFilter, fechaDesde, fechaHasta, clienteFiltroActivo, reservas]);

  const filtered: ReservaExtended[] = datos?.items ?? [];
  const totalFiltrado = datos?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalFiltrado / POR_PAGINA_RESERVAS));
  const slice = filtered;
  const ordenarPor = (campo: CampoOrden) =>
    setOrden((o) => ({ campo, dir: o.campo === campo && o.dir === "desc" ? "asc" : "desc" }));
  const thOrdenable = (campo: CampoOrden, texto: string) => (
    <EncabezadoOrdenable campo={campo} texto={texto} orden={orden} onOrdenar={ordenarPor} className={thCls} />
  );

  const counts: Record<string, number> = datos?.conteos ?? {};
  const totalReservas = Object.values(counts).reduce((a, b) => a + b, 0);

  // Pagos de las reservas de la página (vienen en cada fila) + los del panel.
  for (const r of filtered) {
    for (const p of r.pagos ?? []) {
      const actual = pagoMap[p.id_reserva];
      if (!actual || (PAGO_PRIORIDAD[p.estado] ?? 99) < (PAGO_PRIORIDAD[actual.estado] ?? 99)) pagoMap[p.id_reserva] = p;
    }
  }

  const selectedReserva: ReservaExtended | null = selectedId == null
    ? null
    : (filtered.find(r => r.id_reserva === selectedId)
      ?? reservas.find(r => r.id_reserva === selectedId)
      ?? (reservaSuelta?.id_reserva === selectedId ? reservaSuelta : null));

  // Abrir una reserva pedida desde otro módulo aunque no esté en la página.
  useEffect(() => {
    if (selectedId == null) {
      setReservaSuelta(null);
      return;
    }
    if (filtered.some((r) => r.id_reserva === selectedId) || reservas.some((r) => r.id_reserva === selectedId)) return;
    let vigente = true;
    apiFetch<PaginaReservas>(`/reservas/buscar?q=${selectedId}&por_pagina=20`)
      .then((d) => {
        if (vigente) setReservaSuelta(d.items.find((r) => r.id_reserva === selectedId) ?? null);
      })
      .catch(() => {
        if (vigente) setReservaSuelta(null);
      });
    return () => {
      vigente = false;
    };
    // filtered/reservas: solo importa si ya contienen la reserva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Ingresos = lo COBRADO: suma de los pagos aprobados. Antes se sumaba el
  // precio_total de TODAS las reservas, incluidas las canceladas y las que
  // nunca se pagaron, y la cifra salía inflada.
  const totalIngresos = pagos.reduce((sum, p) => sum + (p.estado === "pagado" ? Number(p.monto) || 0 : 0), 0);

  const CANAL_ICON: Record<CanalOrigen, React.ReactNode> = {
    web:      <Globe      className="w-3.5 h-3.5 text-primary/70"    />,
    empleado: <UserCheck  className="w-3.5 h-3.5 text-emerald-500" />,
    telefono: <PhoneCall  className="w-3.5 h-3.5 text-gold"  />,
  };

  const thCls = "px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap";
  const selectTriggerCls = "w-auto min-w-[140px] h-auto py-2 bg-card border-border text-xs";

  return (
    <div className="space-y-5">

      {/* Header */}
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Reservas</h2>
          <p className="text-sm text-muted-foreground">
            {totalReservas.toLocaleString("es-CO")} reservas en total
            {hasActiveFilters ? ` · ${totalFiltrado.toLocaleString("es-CO")} con los filtros` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BotonExportarCsv
            nombre="reservas"
            filas={filtered}
            total={totalFiltrado}
            cargarTodas={cargarTodasFiltradas}
            columnas={[
              { titulo: "ID", valor: (r) => r.id_reserva },
              {
                titulo: "Cliente",
                valor: (r) => {
                  const c = clientes.find((x) => x.id_cliente === r.id_cliente);
                  return c ? `${c.nombre} ${c.apellido}` : r.cliente_nombre ?? r.id_cliente;
                },
              },
              { titulo: "Documento", valor: (r) => r.cliente_documento ?? "" },
              {
                titulo: "Saldo pendiente",
                valor: (r) => r.saldo_pendiente,
              },
              {
                titulo: "Paquete / hotel",
                valor: (r) => paquetes.find((x) => x.id_paquete === r.id_paquete)?.nombre_paquete ?? r.hotel_nombre,
              },
              { titulo: "Destino", valor: (r) => r.destino },
              { titulo: "Inicio", valor: (r) => r.fecha_inicio?.slice(0, 10) },
              { titulo: "Fin", valor: (r) => r.fecha_fin?.slice(0, 10) },
              { titulo: "Personas", valor: (r) => r.numero_personas },
              { titulo: "Estado", valor: (r) => r.estado },
              { titulo: "Total", valor: (r) => r.precio_total },
              { titulo: "Canal", valor: (r) => r.canal_origen },
              { titulo: "Creada", valor: (r) => r.fecha_reserva?.slice(0, 10) },
            ]}
          />
          <button
            onClick={onNueva}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[color-mix(in_oklab,var(--primary)_75%,var(--gold))] px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20"
          >
            <PlusCircle className="h-4 w-4" /> Nueva reserva
          </button>
        </div>
      </div>

      {/* Métricas: cada tarjeta filtra la tabla por ese estado */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
        {[
          { label: "Todas", value: totalReservas.toLocaleString("es-CO"), estado: "todos", Icono: CalendarDays, tono: "bg-primary/10 text-primary" },
          { label: "Pendientes", value: counts.pendiente ?? 0, estado: "pendiente", Icono: Clock, tono: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
          { label: "Confirmadas", value: counts.confirmada ?? 0, estado: "confirmada", Icono: CheckCircle, tono: "bg-emerald-500/10 text-emerald-600" },
          { label: "Canceladas", value: counts.cancelada ?? 0, estado: "cancelada", Icono: XCircle, tono: "bg-destructive/10 text-destructive" },
        ].map(({ label, value, estado, Icono, tono }) => {
          const activa = estadoFilter === estado;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setEstadoFilter(estado as typeof estadoFilter)}
              aria-pressed={activa}
              className={`flex min-w-[9.5rem] shrink-0 items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:min-w-0 ${
                activa ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tono}`}>
                <Icono className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-2xl font-bold leading-tight text-foreground tabular-nums">{value}</span>
                <span className="block text-xs text-muted-foreground">{label}</span>
              </span>
            </button>
          );
        })}
        <div className="flex min-w-[11rem] shrink-0 items-center gap-3 rounded-2xl bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_65%,black)] p-4 text-primary-foreground shadow-sm sm:min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Wallet className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xl font-bold leading-tight tabular-nums">{pesosCOP(totalIngresos)}</span>
            <span className="block text-xs text-white/80">Cobrado (pagos aprobados)</span>
          </span>
        </div>
      </div>

      {/* Vistas rápidas: atajos a los filtros que más se usan en el día a día */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Vistas rápidas">
        {VISTAS_RAPIDAS.map((v) => {
          const activa = vistaActiva === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => aplicarVista(v.id)}
              aria-pressed={activa}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${
                activa
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground hover:ring-primary/30"
              }`}
            >
              <v.Icono className="h-3.5 w-3.5" />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Búsqueda, estado y filtros */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, cliente, documento, correo o destino..."
              aria-label="Buscar reservas"
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-9 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-primary/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Borrar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ESTADOS.map(e => (
              <button
                key={e}
                onClick={() => setEstadoFilter(e)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  estadoFilter === e ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {e === "todos" ? "Todas" : ETIQUETA_ESTADO[e] ?? e}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFiltrosAbiertos((v) => !v)}
            aria-expanded={filtrosAbiertos}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
              filtrosAbiertos || chipsFiltros.length > 0
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
            {chipsFiltros.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{chipsFiltros.length}</span>
            )}
          </button>

          <div className="hidden md:block">
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

        {filtrosAbiertos && (
          <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
        <Select value={pagoFilter} onValueChange={(v) => setPagoFilter(v as PagoFilter)}>
              <SelectTrigger className={selectTriggerCls}>
                <SelectValue placeholder="Estado de pago" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todos">Pago: todos</SelectItem>
                {PAGO_ESTADOS.map(p => (
                  <SelectItem key={p} value={p}>Pago: {ETIQUETA_PAGO[p] ?? p}</SelectItem>
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

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className={selectTriggerCls} aria-label="Tipo de viaje">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {TIPOS_PRODUCTO.map(t => (
                  <SelectItem key={t.valor} value={t.valor}>{t.texto}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Viaje desde
              <input type="date" value={fechaDesde} max={fechaHasta || undefined} onChange={e => setFechaDesde(e.target.value)}
                className="bg-transparent text-xs text-foreground outline-none" />
            </label>
            <label className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
              hasta
              <input type="date" value={fechaHasta} min={fechaDesde || undefined} onChange={e => setFechaHasta(e.target.value)}
                className="bg-transparent text-xs text-foreground outline-none" />
            </label>

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

          </div>
        )}

        {(chipsFiltros.length > 0 || clienteFiltroNombre) && (
          <div className="flex flex-wrap items-center gap-2">
            {clienteFiltroNombre && (
              <span className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-xs font-medium text-primary">
                Cliente: {clienteFiltroNombre}
                <button
                  type="button"
                  onClick={() => setClienteFiltroActivo(null)}
                  className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                  aria-label="Quitar filtro de cliente"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {chipsFiltros.map((c) => (
              <span key={c.texto} className="flex items-center gap-1.5 rounded-full bg-muted py-1 pl-3 pr-1.5 text-xs font-medium text-foreground">
                {c.texto}
                <button type="button" onClick={c.quitar} className="rounded-full p-0.5 hover:bg-background" aria-label={`Quitar ${c.texto}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button onClick={clearFilters} className="px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-destructive">
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {/* Totales de todo lo que coincide con los filtros (no solo esta página) */}
      {totales && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-5">
          {[
            { label: "Reservas", valor: totales.reservas.toLocaleString("es-CO"), sub: hasActiveFilters ? "con estos filtros" : "en total" },
            { label: "Viajeros", valor: totales.viajeros.toLocaleString("es-CO"), sub: "sin contar canceladas" },
            { label: "Valor vendido", valor: pesosCOP(totales.monto_total), sub: "sin contar canceladas" },
            { label: "Cobrado", valor: pesosCOP(totales.cobrado), sub: totales.monto_total > 0 ? `${Math.round((totales.cobrado / totales.monto_total) * 100)}% del valor vendido` : "pagos aprobados" },
            { label: "Por cobrar", valor: pesosCOP(totales.por_cobrar), sub: `${totales.con_saldo} reserva${totales.con_saldo === 1 ? "" : "s"} con saldo`, destacado: totales.por_cobrar > 0 },
          ].map((t) => (
            <div key={t.label} className={`bg-card px-4 py-3 ${t.label === "Reservas" ? "col-span-2 sm:col-span-1" : ""}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</p>
              <p className={`mt-0.5 text-lg font-bold tabular-nums ${t.destacado ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{t.valor}</p>
              <p className="text-[11px] text-muted-foreground">{t.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {errorCarga ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorCarga}
        </div>
      ) : cargando && !datos ? (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando reservas">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
        {/* Celular: tarjetas en vez de tabla (la tabla no cabe en 390 px). */}
        <ul className={`space-y-2.5 md:hidden transition-opacity ${cargando ? "opacity-60" : ""}`} aria-busy={cargando}>
          {slice.map(r => {
            const cl = clienteMap[r.id_cliente];
            const prod = productoDe(r as ReservaConDatos, paqueteMap[r.id_paquete]);
            const cobro = cobroDe(r as ReservaConDatos);
            const nombreCliente = cl ? `${cl.nombre} ${cl.apellido}` : r.cliente_nombre ?? `Cliente #${r.id_cliente}`;
            return (
              <li key={r.id_reserva}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id_reserva)}
                  className={`w-full rounded-2xl border border-l-4 border-border bg-card p-4 text-left shadow-sm transition-shadow active:shadow-md ${BORDE_ESTADO[r.estado] ?? ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{nombreCliente}</p>
                      <p className="text-[11px] text-muted-foreground">Reserva #{r.id_reserva}</p>
                    </div>
                    <EstadoBadge estado={r.estado} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-foreground">
                    <prod.Icono className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate font-medium">{prod.nombre}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatFechaCorta(r.fecha_inicio)}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{textoViajeros(r as ReservaConDatos & { adultos?: number | null; ninos?: number | null; infantes?: number | null })}</span>
                    {r.estado !== "cancelada" && <span className="font-semibold text-primary">{cuandoViaja(r.fecha_inicio, r.fecha_fin)}</span>}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <span className="text-sm font-bold text-foreground">{r.precio_total != null ? pesosCOP(r.precio_total) : "—"}</span>
                    <span className="flex items-center gap-2">
                      {cobro.saldo > 0 && <span className="text-[11px] text-muted-foreground">Saldo {pesosCOP(cobro.saldo)}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cobro.clase}`}>{cobro.etiqueta}</span>
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className={`hidden md:block bg-card rounded-2xl shadow-sm border border-border overflow-hidden overflow-x-auto transition-opacity ${cargando ? "opacity-60" : ""}`} aria-busy={cargando}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {thOrdenable("id", "ID")}
                {isVisible("cliente")    && <th className={thCls}>{COLUMN_LABELS.cliente}</th>}
                {isVisible("paquete")    && <th className={thCls}>{COLUMN_LABELS.paquete}</th>}
                {isVisible("fechas")     && thOrdenable("fechas", COLUMN_LABELS.fechas)}
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
                const pg = mejorPago(r.pagos) ?? pagoMap[r.id_reserva];
                const asesor = r.id_empleado != null ? empleadoMap[r.id_empleado] : undefined;
                const prod = productoDe(r as ReservaConDatos, pk);
                const cobro = cobroDe(r as ReservaConDatos);
                const rd = r as ReservaConDatos & {
                  adultos?: number | null; ninos?: number | null; infantes?: number | null;
                  solicitudes_especiales?: string | null; fecha_reserva?: string; estado_vuelo?: string | null;
                };
                const noches = nochesEntre(r.fecha_inicio, r.fecha_fin);
                return (
                  <Fragment key={r.id_reserva}>
                  <tr
                    onClick={() => setSelectedId(r.id_reserva)}
                    className="hover:bg-accent transition-colors cursor-pointer group"
                  >
                    <td className={`border-l-4 px-3 py-3 font-semibold text-foreground ${BORDE_ESTADO[r.estado] ?? "border-l-transparent"}`}>
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setExpandida(expandida === r.id_reserva ? null : r.id_reserva); }}
                          aria-expanded={expandida === r.id_reserva}
                          aria-label={`${expandida === r.id_reserva ? "Ocultar" : "Ver"} detalle rápido de la reserva #${r.id_reserva}`}
                          className="-ml-1 rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expandida === r.id_reserva ? "rotate-90" : ""}`} />
                        </button>
                        #{r.id_reserva}
                      </span>
                    </td>

                    {isVisible("cliente") && (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {cl ? (
                            <>
                              <Avatar nombre={cl.nombre} apellido={cl.apellido} fotoUrl={resolveFotoUrl(cl.foto_perfil)} color="primary" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate max-w-[180px]">
                                  {cl.nombre} {cl.apellido}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{cl.correo}</p>
                              </div>
                            </>
                          ) : r.cliente_nombre ? (
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate max-w-[180px]">{r.cliente_nombre}</p>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{r.cliente_correo ?? r.cliente_documento}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">#{r.id_cliente}</span>
                          )}
                        </div>
                      </td>
                    )}

                    {isVisible("paquete") && (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" title={prod.tipo}>
                            <prod.Icono className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate max-w-[150px]">{prod.nombre}</p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                              {prod.tipo}{r.destino && prod.tipo !== "Vuelo" ? ` · ${r.destino}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                    )}

                    {isVisible("fechas") && (
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <p className="text-foreground">{formatFechaCorta(r.fecha_inicio)}</p>
                        <p className={`text-[11px] font-medium ${r.estado === "cancelada" ? "text-muted-foreground/60" : cuandoViaja(r.fecha_inicio, r.fecha_fin).startsWith("En ") || cuandoViaja(r.fecha_inicio, r.fecha_fin).startsWith("Sale") ? "text-primary" : "text-muted-foreground/70"}`}>
                          {r.estado === "cancelada" ? `→ ${formatFechaCorta(r.fecha_fin)}` : cuandoViaja(r.fecha_inicio, r.fecha_fin)}
                        </p>
                      </td>
                    )}

                    {isVisible("pax") && (
                      <td className="px-3 py-3 text-xs text-muted-foreground">{r.numero_personas}</td>
                    )}

                    {isVisible("total") && (
                      <td className="px-3 py-3 text-xs font-semibold text-foreground whitespace-nowrap">
                        {r.precio_total != null ? `$${r.precio_total.toLocaleString("es-CO")}` : "—"}
                      </td>
                    )}

                    {isVisible("metodoPago") && (
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {pg?.metodo_pago?.nombre_metodo ?? "—"}
                      </td>
                    )}

                    {isVisible("estadoPago") && (
                      <td className="px-3 py-3">
                        <div className="w-[110px]">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cobro.clase}`}>
                            {cobro.etiqueta}
                          </span>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${cobro.pct}%` }} />
                          </div>
                          {pg && (pg.estado === "pendiente" || pg.estado === "procesando") && (
                            <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400" title="Hay un pago esperando revisión">
                              <Clock className="h-3 w-3" /> Pago por revisar
                            </span>
                          )}
                        </div>
                      </td>
                    )}

                    {isVisible("estado") && (
                      <td className="px-3 py-3">
                        <EstadoBadge estado={r.estado} />
                      </td>
                    )}

                    {isVisible("canal") && (
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground" title={r.canal_origen ?? "web"}>
                          {CANAL_ICON[r.canal_origen ?? "web"]}
                          <span className="max-w-[90px] truncate">{asesor ? asesor.nombre : "Web"}</span>
                        </span>
                      </td>
                    )}

                    {isVisible("asesor") && (
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {asesor ? (
                          <span className="text-foreground">{asesor.nombre} {asesor.apellido}</span>
                        ) : (
                          <span className="text-muted-foreground">Web</span>
                        )}
                      </td>
                    )}

                    {isVisible("actualizado") && (
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {r.fecha_ultima_actualizacion ? tiempoRelativo(r.fecha_ultima_actualizacion) : "—"}
                      </td>
                    )}

                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                      {cl?.celular && enlaceWhatsApp(cl.celular) && (
                        <a
                          href={enlaceWhatsApp(cl.celular, `Hola ${cl.nombre}, te escribimos de Alik Tours por tu reserva #${r.id_reserva}.`) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Escribir por WhatsApp a ${cl.nombre}`}
                          title="Escribir por WhatsApp"
                          className="rounded-lg p-1.5 text-emerald-600 opacity-0 transition-all hover:bg-emerald-500/10 group-hover:opacity-100 focus:opacity-100"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {!soloEmpleado && (
                      <button
                        aria-label={`Eliminar reserva #${r.id_reserva}`}
                        onClick={e => { e.stopPropagation(); onDelete(r.id_reserva); }}
                        className="p-1.5 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      )}
                      </div>
                    </td>
                  </tr>
                  {expandida === r.id_reserva && (
                    <tr className="bg-muted/30">
                      <td colSpan={99} className={`border-l-4 px-4 py-4 ${BORDE_ESTADO[r.estado] ?? "border-l-transparent"}`}>
                        <div className="sticky left-4 grid max-w-[calc(100vw-22rem)] gap-4 text-xs sm:grid-cols-2 xl:grid-cols-4 [&>div]:min-w-0 [&>div]:break-words">
                          <div className="space-y-1.5">
                            <p className="font-semibold uppercase tracking-wide text-muted-foreground">Viaje</p>
                            <p className="text-foreground"><Users className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />{textoViajeros(rd)}</p>
                            <p className="text-foreground">
                              <Calendar className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                              {formatFechaCorta(r.fecha_inicio)} → {formatFechaCorta(r.fecha_fin)}
                              {noches != null && <span className="text-muted-foreground"> · {noches} noche{noches === 1 ? "" : "s"}</span>}
                            </p>
                            {r.destino && <p className="text-foreground"><MapPin className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />{r.destino}</p>}
                            {rd.estado_vuelo && <p className="text-foreground"><Plane className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />Vuelo: {rd.estado_vuelo.replace(/_/g, " ")}</p>}
                          </div>
                          <div className="space-y-1.5">
                            <p className="font-semibold uppercase tracking-wide text-muted-foreground">Dinero</p>
                            <p className="flex justify-between gap-2"><span className="text-muted-foreground">Total</span><b className="text-foreground">{pesosCOP(Number(r.precio_total ?? 0))}</b></p>
                            <p className="flex justify-between gap-2"><span className="text-muted-foreground">Pagado</span><b className="text-emerald-600 dark:text-emerald-400">{pesosCOP(Number(rd.total_pagado ?? 0))}</b></p>
                            <p className="flex justify-between gap-2"><span className="text-muted-foreground">Saldo</span><b className={cobro.saldo > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}>{pesosCOP(cobro.saldo)}</b></p>
                          </div>
                          <div className="space-y-1.5">
                            <p className="font-semibold uppercase tracking-wide text-muted-foreground">Pagos ({r.pagos?.length ?? 0})</p>
                            {r.pagos && r.pagos.length > 0 ? (
                              [...r.pagos].sort((a, b) => (b.fecha_pago ?? "").localeCompare(a.fecha_pago ?? "")).slice(0, 3).map((pp) => (
                                <p key={pp.id_pago} className="flex items-center justify-between gap-2">
                                  <span className="truncate text-foreground">
                                    {pesosCOP(pp.monto)} · {pp.metodo_pago?.nombre_metodo ?? "Pago"}
                                    <span className="text-muted-foreground"> · {pp.fecha_pago ? formatFechaCorta(pp.fecha_pago) : "—"}</span>
                                  </span>
                                  <StatusBadge status={pp.estado} />
                                </p>
                              ))
                            ) : (
                              <p className="text-muted-foreground">Sin pagos registrados</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <p className="font-semibold uppercase tracking-wide text-muted-foreground">Gestión</p>
                            <p className="text-foreground">{NOMBRE_CANAL_ORIGEN[r.canal_origen ?? "web"]}{asesor ? ` · ${asesor.nombre} ${asesor.apellido}` : " · sin asesor"}</p>
                            {rd.fecha_reserva && <p className="text-muted-foreground">Creada el {formatFechaCorta(rd.fecha_reserva)} ({tiempoRelativo(rd.fecha_reserva).toLowerCase()})</p>}
                            {r.fecha_ultima_actualizacion && <p className="text-muted-foreground">Último cambio {tiempoRelativo(r.fecha_ultima_actualizacion).toLowerCase()}</p>}
                            {rd.solicitudes_especiales && (
                              <p className="rounded-lg bg-amber-500/10 px-2 py-1 text-amber-800 dark:text-amber-300">“{rd.solicitudes_especiales}”</p>
                            )}
                            <button type="button" onClick={() => setSelectedId(r.id_reserva)} className="pt-1 font-semibold text-primary hover:underline">
                              Abrir ficha completa →
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Mostrando {page * POR_PAGINA_RESERVAS + 1}–{Math.min((page + 1) * POR_PAGINA_RESERVAS, totalFiltrado)} de {totalFiltrado}
          </p>
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
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
          reservasClienteCount={Math.max(reservas.filter(r => r.id_cliente === selectedReserva.id_cliente).length, 1)}
          onClose={() => setSelectedId(null)}
          onVerPagos={onVerPagos}
          onAbrirReserva={(id) => setSelectedId(id)}
          onDelete={(id) => { onDelete(id); setSelectedId(null); }}
          onUpdateEstado={onUpdateEstado}
          soloLectura={soloEmpleado}
        />
      )}
    </div>
  );
}
