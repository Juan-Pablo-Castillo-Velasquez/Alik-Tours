import { useState } from "react";
import {
  Search, Building2, Mail, Phone, Users, Trash2, Pencil, Save, AlertCircle,
  CheckCircle,
} from "lucide-react";
import type { SolicitudCorporativa } from "../../services/empresa.service";
import AdminModal from "./ui/AdminModal";
import StatCard from "./ui/StatCard";
import SectionHeader from "./ui/SectionHeader";
import EmptyState from "./ui/EmptyState";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import { labelCls, type Cliente } from "./types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";

const ESTADOS = ["nuevo", "contactado", "cerrado", "descartado"] as const;
type Estado = typeof ESTADOS[number];
type EstadoFilter = "todos" | Estado;

const ESTADO_STYLES: Record<Estado, string> = {
  nuevo: "bg-gold/15 text-gold",
  contactado: "bg-primary/15 text-primary",
  cerrado: "bg-success/15 text-success",
  descartado: "bg-muted text-muted-foreground",
};

function formatFecha(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props {
  solicitudes: SolicitudCorporativa[];
  onUpdateEstado: (id: number, estado: Estado) => Promise<void>;
  onDelete: (id: number) => void;
  /** Opcional: si Admindashboard.tsx lo pasa, cada solicitud se cruza por
   * correo contra la base de clientes real para avisar si ese contacto ya
   * es cliente (útil para no tratar como lead frío a alguien que ya
   * reservó) — SolicitudCorporativa no tiene FK a Cliente (ver docstring
   * del modelo), así que este cruce es de solo lectura, nunca se inventa
   * ni se guarda una relación que no existe en la base de datos. */
  clientes?: Cliente[];
}

// Bandeja real de leads B2B — cada fila es un envío real del formulario
// "Solicita una cotización" de /corporate (antes ese formulario no llamaba
// a ningún backend, ver Corporate.tsx). No es un CRM con historial de
// contactos múltiples por empresa todavía, solo la bandeja de solicitudes
// entrantes con su estado de seguimiento.
export default function ModuleEmpresas({ solicitudes, onUpdateEstado, onDelete, clientes = [] }: Props) {
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todos");
  const [clienteFilter, setClienteFilter] = useState<"todos" | "ya_cliente" | "no_cliente">("todos");
  const [editing, setEditing] = useState<SolicitudCorporativa | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<Estado>("nuevo");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const clientePorCorreo = (correo: string) =>
    clientes.find(c => (c.correo ?? "").toLowerCase() === correo.toLowerCase());

  const filtered = solicitudes
    .filter(s => {
      const q = search.toLowerCase();
      const matchEstado = estadoFilter === "todos" || s.estado === estadoFilter;
      const matchSearch = !q
        || s.nombre_empresa.toLowerCase().includes(q)
        || s.nombre_contacto.toLowerCase().includes(q)
        || s.email_corporativo.toLowerCase().includes(q);
      const esCliente = !!clientePorCorreo(s.email_corporativo);
      const matchCliente = clienteFilter === "todos" || (clienteFilter === "ya_cliente" ? esCliente : !esCliente);
      return matchEstado && matchSearch && matchCliente;
    })
    .sort((a, b) => {
      // Mismo criterio que ModuleCancelaciones.tsx: los leads "nuevo" (sin
      // atender todavía) van primero y, entre ellos, el más antiguo
      // primero — para que uno viejo sin contactar no quede enterrado
      // debajo de leads que acaban de llegar.
      const aNueva = a.estado === "nuevo", bNueva = b.estado === "nuevo";
      if (aNueva && !bNueva) return -1;
      if (!aNueva && bNueva) return 1;
      if (aNueva && bNueva) {
        return new Date(a.fecha_creacion).getTime() - new Date(b.fecha_creacion).getTime();
      }
      return new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime();
    });

  const { page, pageCount, slice, setPage } = usePagination(filtered, 8);

  const hasActiveFilters = search.trim() !== "" || estadoFilter !== "todos" || clienteFilter !== "todos";
  function clearFilters() { setSearch(""); setEstadoFilter("todos"); setClienteFilter("todos"); }

  const nuevas = solicitudes.filter(s => s.estado === "nuevo").length;
  const cerradas = solicitudes.filter(s => s.estado === "cerrado").length;

  function openEdit(s: SolicitudCorporativa) {
    setEditing(s);
    setNuevoEstado(s.estado);
    setSaveError("");
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true); setSaveError("");
    try {
      await onUpdateEstado(editing.id_solicitud, nuevoEstado);
      setEditing(null);
    } catch {
      setSaveError("No se pudo actualizar el estado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Empresas y contactos"
        subtitle={`${solicitudes.length} solicitud${solicitudes.length === 1 ? "" : "es"} corporativa${solicitudes.length === 1 ? "" : "s"}`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total" value={solicitudes.length} icon={Building2} />
        <StatCard label="Nuevas" value={nuevas} icon={Users} gradient="from-[#C9A227] to-[#C9A227]" />
        <StatCard label="Cerradas" value={cerradas} icon={Building2} gradient="from-success to-success" />
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input maxLength={120}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por empresa, contacto o correo..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm outline-none bg-card text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/40 focus:border-transparent"
          />
        </div>
        <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as EstadoFilter)}>
          <SelectTrigger className="w-auto min-w-[140px] h-auto py-2 bg-card border-border text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Estado: todos</SelectItem>
            {ESTADOS.map(e => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
          </SelectContent>
        </Select>
        {clientes.length > 0 && (
          <Select value={clienteFilter} onValueChange={(v) => setClienteFilter(v as "todos" | "ya_cliente" | "no_cliente")}>
            <SelectTrigger className="w-auto min-w-[150px] h-auto py-2 bg-card border-border text-xs">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="todos">Clientes y leads</SelectItem>
              <SelectItem value="ya_cliente">Ya es cliente</SelectItem>
              <SelectItem value="no_cliente">Lead nuevo</SelectItem>
            </SelectContent>
          </Select>
        )}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Contacto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Empleados</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {slice.map(s => (
                <tr key={s.id_solicitud} className="hover:bg-accent transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{s.nombre_empresa}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <p className="font-medium text-foreground">{s.nombre_contacto}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{s.email_corporativo}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{s.telefono}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{s.numero_empleados || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold capitalize ${ESTADO_STYLES[s.estado]}`}>{s.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatFecha(s.fecha_creacion)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button aria-label="Cambiar estado / ver mensaje" onClick={() => openEdit(s)} className="p-1.5 text-primary/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Cambiar estado / ver mensaje">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button aria-label="Eliminar" onClick={() => onDelete(s.id_solicitud)} className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
        <EmptyState icon={Search} title="Sin solicitudes" description={solicitudes.length === 0 ? "Todavía no ha llegado ninguna solicitud corporativa." : "Prueba con otros filtros."} />
      )}

      <AdminModal
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        title={editing?.nombre_empresa}
        description={editing ? `${editing.nombre_contacto} · ${editing.email_corporativo}` : undefined}
        maxWidth="sm:max-w-md"
      >
        {editing && (
          <div className="space-y-3">
            {(() => {
              const clienteExistente = clientePorCorreo(editing.email_corporativo);
              return clienteExistente ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/10 text-success text-xs font-medium">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Este correo ya pertenece a un cliente registrado: {clienteExistente.nombre} {clienteExistente.apellido}
                </div>
              ) : null;
            })()}
            {editing.mensaje && (
              <div>
                <label className={labelCls}>Mensaje</label>
                <p className="mt-1 text-sm text-foreground/90 bg-muted/40 rounded-lg p-3">{editing.mensaje}</p>
              </div>
            )}
            <label className={labelCls}>Estado</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ESTADOS.map(e => (
                <button
                  key={e}
                  onClick={() => setNuevoEstado(e)}
                  className={`px-2.5 py-2 rounded-lg border text-xs font-medium capitalize transition-all ${
                    nuevoEstado === e
                      ? "border-primary/40 bg-primary/10 text-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-card"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            {saveError && (
              <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {saveError}</p>
            )}
            <button
              onClick={handleSave}
              disabled={saving || nuevoEstado === editing.estado}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all bg-gradient-to-r from-primary to-[#A13B55] text-white hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar cambio de estado"}
            </button>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
