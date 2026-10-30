import { useState, useEffect } from "react";
import {
  Search, Trash2, Pencil, PlusCircle, Users, MapPin, Globe,
  CreditCard, ChevronRight, AlertCircle, Heart, CalendarDays,
  Wallet, MessageCircle,
} from "lucide-react";
import type { SolicitudCancelacionResponse } from "../../services/solicitudCancelacion.service";
import { preferenciasService, type PreferenciaResponse } from "../../services/preferencias.service";
import { clienteService, type MetodoPagoGuardadoAdminResponse } from "../../services/cliente.service";
import { Cliente, Reserva, inputCls, labelCls, resolveFotoUrl } from "./types";
import AdminModal from "./ui/AdminModal";
import StatCard from "./ui/StatCard";
import SectionHeader from "./ui/SectionHeader";
import StatusBadge from "./ui/StatusBadge";
import EmptyState from "./ui/EmptyState";
import Avatar from "./ui/Avatar";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import Timeline, { type TimelineItem } from "./ui/Timeline";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";

const EMPTY_FORM = {
  nombre: "", apellido: "", cedula: "", correo: "",
  celular: "", direccion: "", ciudad: "", pais: "", fecha_nacimiento: "",
};

// Mismo criterio de fechas "puras" que ModuleReservas.tsx / ModuleCancelaciones.tsx.
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
      <span className="text-xs text-muted-foreground min-w-[120px]">{label}</span>
      <span className="text-xs font-medium text-foreground text-right ml-auto">{value ?? "—"}</span>
    </div>
  );
}

interface Props {
  clientes: Cliente[];
  onDelete: (id: number) => void;
  onSubmit: (data: any, id?: number) => Promise<void>;
  loading: boolean;
  // Opcionales: si Admindashboard.tsx los pasa, el perfil del cliente
  // muestra su historial real de reservas y solicitudes de cancelación
  // (brief: "Clientes: full profiles"). Sin ellos, el perfil sigue
  // funcionando mostrando solo los datos propios del cliente — nunca se
  // inventa un historial si no llega la data.
  reservas?: Reserva[];
  solicitudes?: SolicitudCancelacionResponse[];
  /** Accesos rápidos desde el perfil del cliente a sus otras pantallas --
   * ver `clienteIdFiltro` en ModuleReservas.tsx/ModulePagos.tsx y
   * `clienteIdInicial` en ModuleMensajes.tsx. Sin ellos (Admindashboard no
   * los pasa) el perfil simplemente no muestra estos botones. */
  onVerReservas?: (idCliente: number) => void;
  onVerPagos?: (idCliente: number) => void;
  onVerMensajes?: (idCliente: number) => void;
}

export default function ModuleClientes({
  clientes, onDelete, onSubmit, loading, reservas = [], solicitudes = [],
  onVerReservas, onVerPagos, onVerMensajes,
}: Props) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);

  // KPIs reales — ciudades/países cubiertos por la base de clientes. Se
  // reutilizan también como opciones de los filtros de abajo, así nunca
  // aparece una ciudad/país que en realidad no tiene ningún cliente.
  const ciudades = Array.from(new Set(clientes.map(c => c.ciudad).filter(Boolean))).sort();
  const paises = Array.from(new Set(clientes.map(c => c.pais).filter(Boolean))).sort();

  const [ciudadFilter, setCiudadFilter] = useState("todos");
  const [paisFilter, setPaisFilter] = useState("todos");
  // Antes solo se podía buscar por texto — con una base de clientes grande
  // no había forma de aislar, por ejemplo, a los que nunca han reservado
  // (candidatos a una campaña de reactivación) sin salir a otro módulo.
  const [conReservasFilter, setConReservasFilter] = useState<"todos" | "con" | "sin">("todos");

  const idsClientesConReservas = new Set(reservas.map(r => r.id_cliente));

  const filtered = clientes.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${c.nombre} ${c.apellido} ${c.cedula} ${c.correo}`.toLowerCase().includes(q);
    const matchCiudad = ciudadFilter === "todos" || c.ciudad === ciudadFilter;
    const matchPais = paisFilter === "todos" || c.pais === paisFilter;
    const tieneReservas = idsClientesConReservas.has(c.id_cliente);
    const matchReservas = conReservasFilter === "todos"
      || (conReservasFilter === "con" ? tieneReservas : !tieneReservas);
    return matchSearch && matchCiudad && matchPais && matchReservas;
  });

  const { page, pageCount, slice, setPage } = usePagination(filtered, 8);

  const hasActiveFilters = search.trim() !== "" || ciudadFilter !== "todos" || paisFilter !== "todos" || conReservasFilter !== "todos";
  function clearFilters() { setSearch(""); setCiudadFilter("todos"); setPaisFilter("todos"); setConReservasFilter("todos"); }

  const profile = clientes.find(c => c.id_cliente === profileId) ?? null;
  const reservasCliente = profile ? reservas.filter(r => r.id_cliente === profile.id_cliente) : [];
  const solicitudesCliente = profile
    ? solicitudes.filter(s => reservasCliente.some(r => r.id_reserva === s.id_reserva))
    : [];
  const totalGastado = reservasCliente
    .filter(r => r.estado !== "cancelada")
    .reduce((sum, r) => sum + (r.precio_total ?? 0), 0);

  const historialItems: TimelineItem[] = reservasCliente
    .slice()
    .sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime())
    .map(r => ({
      id: r.id_reserva,
      badge: <StatusBadge status={r.estado} />,
      meta: `${r.hotel_nombre ?? r.destino ?? `Paquete #${r.id_paquete}`} · ${formatFechaCorta(r.fecha_inicio)} → ${formatFechaCorta(r.fecha_fin)}`,
      detail: r.precio_total != null ? `Total: $${r.precio_total.toLocaleString()}` : undefined,
    }));

  // Preferencias de viaje reales del cliente (formulario que llena desde su
  // propia cuenta, ver PreferenciaCliente en cliente_model.py) — ya
  // existían en la base de datos pero el panel de admin nunca las
  // consultaba. Útiles para un asesor que va a llamar/escribirle: saber de
  // antemano qué tipo de viaje busca antes de hablar con él. 404 real
  // (cliente que nunca las completó) se trata como "sin preferencias", no
  // como error.
  const [preferencias, setPreferencias] = useState<PreferenciaResponse | null>(null);
  const [preferenciasCargando, setPreferenciasCargando] = useState(false);
  useEffect(() => {
    if (!profileId) { setPreferencias(null); return; }
    let cancelado = false;
    setPreferenciasCargando(true);
    preferenciasService.getByCliente(profileId)
      .then((data) => { if (!cancelado) setPreferencias(data); })
      .catch(() => { if (!cancelado) setPreferencias(null); })
      .finally(() => { if (!cancelado) setPreferenciasCargando(false); });
    return () => { cancelado = true; };
  }, [profileId]);

  // Métodos de pago guardados reales del cliente (alias/tipo/últimos4 —
  // nunca la clave ni datos sensibles, ver MetodoPagoGuardado) — mismo
  // patrón de carga que preferencias, para que el admin/asesor vea de
  // entrada con qué suele pagar sin tener que ir a buscarlo en Pagos.
  const [metodosPago, setMetodosPago] = useState<MetodoPagoGuardadoAdminResponse[]>([]);
  const [metodosPagoCargando, setMetodosPagoCargando] = useState(false);
  useEffect(() => {
    if (!profileId) { setMetodosPago([]); return; }
    let cancelado = false;
    setMetodosPagoCargando(true);
    clienteService.getMetodosPago(profileId)
      .then((data) => { if (!cancelado) setMetodosPago(data); })
      .catch(() => { if (!cancelado) setMetodosPago([]); })
      .finally(() => { if (!cancelado) setMetodosPagoCargando(false); });
    return () => { cancelado = true; };
  }, [profileId]);

  function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setMsg(null); setModalOpen(true); }

  function openEdit(c: Cliente) {
    setEditingId(c.id_cliente);
    setForm({
      nombre: c.nombre, apellido: c.apellido, cedula: c.cedula, correo: c.correo ?? "",
      celular: c.celular ?? "", direccion: c.direccion ?? "", ciudad: c.ciudad ?? "",
      pais: c.pais ?? "", fecha_nacimiento: c.fecha_nacimiento ?? "",
    });
    setMsg(null);
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); setMsg(null); }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await onSubmit(form, editingId ?? undefined);
      closeModal();
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Error al guardar cliente" });
    }
  };

  const thCls = "px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap";

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Clientes"
        subtitle={`${clientes.length} cliente${clientes.length === 1 ? "" : "s"} registrado${clientes.length === 1 ? "" : "s"}`}
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-[#A13B55] text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-primary/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" /> Nuevo cliente
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total"    value={clientes.length} icon={Users} />
        <StatCard label="Ciudades" value={ciudades.length} icon={MapPin}  gradient="from-[#C9A227] to-[#C9A227]" />
        <StatCard label="Países"   value={paises.length}   icon={Globe}   gradient="from-[#A13B55] to-[#A13B55]" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cédula o correo..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm outline-none
              bg-card text-foreground placeholder:text-muted-foreground/60
              focus:ring-2 focus:ring-primary/40 focus:border-transparent"
          />
        </div>
        <Select value={ciudadFilter} onValueChange={setCiudadFilter}>
          <SelectTrigger className="w-auto min-w-[140px] h-auto py-2 bg-card border-border text-xs">
            <SelectValue placeholder="Ciudad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las ciudades</SelectItem>
            {ciudades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paisFilter} onValueChange={setPaisFilter}>
          <SelectTrigger className="w-auto min-w-[130px] h-auto py-2 bg-card border-border text-xs">
            <SelectValue placeholder="País" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los países</SelectItem>
            {paises.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={conReservasFilter} onValueChange={(v) => setConReservasFilter(v as "todos" | "con" | "sin")}>
          <SelectTrigger className="w-auto min-w-[150px] h-auto py-2 bg-card border-border text-xs">
            <SelectValue placeholder="Reservas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Con o sin reservas</SelectItem>
            <SelectItem value="con">Con reservas</SelectItem>
            <SelectItem value="sin">Sin reservas</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2">
            Limpiar filtros
          </button>
        )}
      </div>

      {filtered.length > 0 ? (
        <>
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className={thCls}>Cliente</th>
                <th className={thCls}>Cédula</th>
                <th className={thCls}>Ubicación</th>
                <th className={thCls}>Contacto</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {slice.map(c => (
                <tr
                  key={c.id_cliente}
                  className="hover:bg-accent transition-colors cursor-pointer group"
                  onClick={() => setProfileId(c.id_cliente)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar nombre={c.nombre} apellido={c.apellido} fotoUrl={resolveFotoUrl(c.foto_perfil)} color="primary" size="sm" />
                      <p className="text-xs font-semibold text-foreground truncate">{c.nombre} {c.apellido}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{c.cedula}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {[c.ciudad, c.pais].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.correo && <p className="truncate max-w-[180px]">{c.correo}</p>}
                    {c.celular && <p>{c.celular}</p>}
                    {!c.correo && !c.celular && "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-primary/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(c.id_cliente)}
                        className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} className="mt-4" />
        </>
      ) : (
        <EmptyState
          icon={Search}
          title="No se encontraron clientes"
          description={clientes.length === 0 ? "Registra el primer cliente para empezar." : "Prueba con otro término de búsqueda."}
        />
      )}

      {/* Modal de creación/edición */}
      <AdminModal
        open={modalOpen}
        onOpenChange={(o) => { if (!o) closeModal(); else setModalOpen(true); }}
        title={editingId ? "Editar cliente" : "Registrar cliente"}
        maxWidth="sm:max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {msg && (
            <div className="p-3 rounded-xl text-sm font-medium bg-destructive/10 text-destructive">
              {msg.text}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                className={inputCls} required placeholder="Juan" />
            </div>
            <div>
              <label className={labelCls}>Apellido</label>
              <input value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })}
                className={inputCls} required placeholder="Pérez" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cédula</label>
              <input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })}
                className={inputCls} required placeholder="1000111222" />
            </div>
            <div>
              <label className={labelCls}>Celular</label>
              <input value={form.celular} onChange={e => setForm({ ...form, celular: e.target.value })}
                className={inputCls} placeholder="3001234567" inputMode="tel" required={editingId == null} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Correo</label>
            <input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })}
              className={inputCls} placeholder="juan@email.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ciudad</label>
              <input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })}
                className={inputCls} placeholder="Bogotá" />
            </div>
            <div>
              <label className={labelCls}>País</label>
              <input value={form.pais} onChange={e => setForm({ ...form, pais: e.target.value })}
                className={inputCls} placeholder="Colombia" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Fecha de nacimiento</label>
            <input type="date"
                max="2100-12-31" value={form.fecha_nacimiento}
              onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })}
              className={inputCls} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-primary to-[#A13B55] text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 text-sm">
            {loading ? "Guardando..." : editingId ? "Guardar cambios" : "Registrar cliente"}
          </button>
        </form>
      </AdminModal>

      {/* Perfil completo — brief: "Clientes: full profiles". Todo lo que
          muestra viene de datos reales que ya llegan por props (reservas,
          solicitudes); si Admindashboard no las pasa, simplemente no se
          muestra el historial, nunca se inventa. */}
      {profile && (
        <AdminModal
          open={!!profile}
          onOpenChange={(o) => { if (!o) setProfileId(null); }}
          title={
            <span className="inline-flex items-center gap-2.5">
              <Avatar nombre={profile.nombre} apellido={profile.apellido} fotoUrl={resolveFotoUrl(profile.foto_perfil)} color="primary" />
              {profile.nombre} {profile.apellido}
            </span>
          }
          description={`Cédula ${profile.cedula}`}
          maxWidth="sm:max-w-2xl"
        >
          {(onVerReservas || onVerPagos || onVerMensajes) && (
            <div className="flex items-center gap-2 flex-wrap mb-5 -mt-1">
              {onVerReservas && (
                <button
                  type="button"
                  onClick={() => onVerReservas(profile.id_cliente)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground text-xs font-medium rounded-lg hover:bg-muted hover:text-foreground transition-all"
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Ver sus reservas
                </button>
              )}
              {onVerPagos && (
                <button
                  type="button"
                  onClick={() => onVerPagos(profile.id_cliente)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground text-xs font-medium rounded-lg hover:bg-muted hover:text-foreground transition-all"
                >
                  <Wallet className="w-3.5 h-3.5" /> Ver sus pagos
                </button>
              )}
              {onVerMensajes && (
                <button
                  type="button"
                  onClick={() => onVerMensajes(profile.id_cliente)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground text-xs font-medium rounded-lg hover:bg-muted hover:text-foreground transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Ver mensajes
                </button>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Datos de contacto</h4>
              <div className="space-y-0.5">
                <Row label="Correo" value={profile.correo} />
                <Row label="Celular" value={profile.celular} />
                <Row label="Dirección" value={profile.direccion} />
                <Row label="Ciudad" value={[profile.ciudad, profile.pais].filter(Boolean).join(", ") || "—"} />
                <Row label="Nacimiento" value={formatFechaCorta(profile.fecha_nacimiento)} />
                <Row label="Cliente desde" value={formatFechaCorta(profile.fecha_registro)} />
              </div>

              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">Resumen</h4>
              <div className="space-y-0.5">
                <Row label="Reservas totales" value={reservasCliente.length} />
                <Row label="Total gastado" value={reservasCliente.length ? `$${totalGastado.toLocaleString()}` : "—"} />
                <Row
                  label="Solicitudes de cancelación"
                  value={
                    solicitudesCliente.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-3 h-3" /> {solicitudesCliente.length}
                      </span>
                    ) : 0
                  }
                />
              </div>

              {/* Preferencias de viaje reales — ya existían en la base de
                  datos (formulario que el cliente llena desde su cuenta),
                  el panel de admin nunca las mostraba. Nada se inventa: si
                  el cliente nunca las completó, se dice explícitamente. */}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" /> Preferencias de viaje
              </h4>
              <div className="space-y-0.5">
                {preferenciasCargando ? (
                  <p className="text-xs text-muted-foreground py-1">Cargando...</p>
                ) : preferencias ? (
                  <>
                    <Row label="Intereses" value={preferencias.intereses?.length ? preferencias.intereses.join(", ") : undefined} />
                    <Row label="Compañía de viaje" value={preferencias.compania} />
                    <Row label="Presupuesto" value={preferencias.presupuesto} />
                    <Row label="Clima preferido" value={preferencias.clima} />
                    <Row label="Ritmo de viaje" value={preferencias.ritmo} />
                    <Row label="Transporte" value={preferencias.transporte} />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground py-1">Este cliente no ha completado sus preferencias de viaje todavía.</p>
                )}
              </div>

              {/* Métodos de pago guardados — nunca se muestra la clave ni
                  el número completo, solo alias/tipo/últimos4 (lo mismo
                  que ya ve el propio cliente en su cuenta). */}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Métodos de pago
              </h4>
              <div className="space-y-1.5">
                {metodosPagoCargando ? (
                  <p className="text-xs text-muted-foreground py-1">Cargando...</p>
                ) : metodosPago.length > 0 ? (
                  metodosPago.map((m) => (
                    <div key={m.id_metodo_guardado} className="flex items-center gap-2.5 py-1">
                      <CreditCard className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-foreground flex-1 min-w-0 truncate">
                        {m.alias} <span className="text-muted-foreground">· {m.tipo}{m.ultimos4 ? ` •••• ${m.ultimos4}` : ""}</span>
                      </span>
                      {m.predeterminado && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">Predeterminado</span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-1">Este cliente no tiene ningún método de pago guardado todavía.</p>
                )}
              </div>
            </section>

            <section>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Historial de reservas</h4>
              <div className="max-h-[340px] overflow-y-auto pr-1">
                <Timeline items={historialItems} emptyLabel="Este cliente todavía no tiene reservas registradas" />
              </div>
            </section>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
