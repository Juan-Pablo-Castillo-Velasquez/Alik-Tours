import { useState } from "react";
import {
  Bell, Mail, XCircle, Building2, Wallet, Check, Trash2, CheckCheck, Loader2, Search, Send, CalendarCheck, Users, Star,
} from "lucide-react";
import type { NotificacionItem } from "../../services/notificacion.service";
import SectionHeader from "./ui/SectionHeader";
import EmptyState from "./ui/EmptyState";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";

// Contacto llega como una sola cadena armada por el backend ("nombre
// (correo): mensaje", ver enviar_contacto en contacto_route.py) porque
// Notificacion es una tabla generica compartida con cancelacion/
// corporativo/pago, sin columnas propias para nombre/correo. Se separa acá
// solo para mostrarlo mas claro y armar el link de "Responder por correo"
// -- si el formato no calza (por ejemplo un nombre con parentesis), se cae
// de vuelta al mensaje tal cual, sin romper nada.
function parseContacto(mensaje: string | null): { nombre: string; correo: string; cuerpo: string } | null {
  if (!mensaje) return null;
  const m = mensaje.match(/^(.+?) \(([^()]+@[^()]+)\):\s*([\s\S]*)$/);
  if (!m) return null;
  return { nombre: m[1], correo: m[2], cuerpo: m[3] };
}

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

const TIPO_ICON: Record<string, React.ReactNode> = {
  contacto: <Mail className="w-4 h-4" />,
  cancelacion: <XCircle className="w-4 h-4" />,
  corporativo: <Building2 className="w-4 h-4" />,
  pago: <Wallet className="w-4 h-4" />,
  reserva: <CalendarCheck className="w-4 h-4" />,
  comunidad: <Users className="w-4 h-4" />,
  resena: <Star className="w-4 h-4" />,
};

const TIPO_LABEL: Record<string, string> = {
  contacto: "Contacto",
  cancelacion: "Cancelación",
  corporativo: "Corporativo",
  pago: "Pago",
  reserva: "Reserva",
  comunidad: "Comunidad",
  resena: "Reseña",
};

interface Props {
  notificaciones: NotificacionItem[];
  loading?: boolean;
  onMarcarLeida: (id: number) => void;
  onMarcarTodasLeidas: () => void;
  onDelete: (id: number) => void;
  // El backend deja "eliminar notificacion" solo para admin (ver
  // notificacion_route.py) -- se oculta el boton en vez de dejarlo fallar
  // con un 403 al hacer clic.
  soloEmpleado?: boolean;
}

// Bandeja real de notificaciones (ver Notificacion en
// backend/app/models/notificacion_model.py) — cada fila llegó acá porque
// ocurrió un evento real (mensaje de contacto, solicitud de cancelación,
// solicitud corporativa, pago aprobado), nunca un evento inventado.
export default function ModuleNotificaciones({
  notificaciones, loading, onMarcarLeida, onMarcarTodasLeidas, onDelete, soloEmpleado,
}: Props) {
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [leidoFilter, setLeidoFilter] = useState<"todos" | "leidas" | "no_leidas">("todos");
  const [search, setSearch] = useState("");

  const tiposDisponibles = Array.from(new Set(notificaciones.map(n => n.tipo)));
  const filtered = notificaciones.filter(n => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${n.titulo} ${n.mensaje ?? ""}`.toLowerCase().includes(q);
    const matchTipo = tipoFilter === "todos" || n.tipo === tipoFilter;
    const matchLeido = leidoFilter === "todos" || (leidoFilter === "leidas" ? n.leido : !n.leido);
    return matchSearch && matchTipo && matchLeido;
  });

  const { page, pageCount, slice, setPage } = usePagination(filtered, 8);
  const noLeidas = notificaciones.filter(n => !n.leido).length;
  const hasActiveFilters = search.trim() !== "" || tipoFilter !== "todos" || leidoFilter !== "todos";
  function clearFilters() { setSearch(""); setTipoFilter("todos"); setLeidoFilter("todos"); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SectionHeader
          title="Notificaciones"
          subtitle={`${notificaciones.length} notificación${notificaciones.length === 1 ? "" : "es"}${noLeidas > 0 ? ` · ${noLeidas} sin leer` : ""}`}
        />
        {noLeidas > 0 && (
          <button
            onClick={onMarcarTodasLeidas}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary transition-all"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título o mensaje..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm outline-none
              bg-card text-foreground placeholder:text-muted-foreground/60
              focus:ring-2 focus:ring-primary/40 focus:border-transparent"
          />
        </div>
        {tiposDisponibles.length > 1 && (
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-auto py-2 bg-card border-border text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="todos">Tipo: todos</SelectItem>
              {tiposDisponibles.map(t => (
                <SelectItem key={t} value={t}>{TIPO_LABEL[t] ?? t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={leidoFilter} onValueChange={(v) => setLeidoFilter(v as "todos" | "leidas" | "no_leidas")}>
          <SelectTrigger className="w-auto min-w-[150px] h-auto py-2 bg-card border-border text-xs">
            <SelectValue placeholder="Leídas" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="todos">Leídas y no leídas</SelectItem>
            <SelectItem value="no_leidas">Sin leer</SelectItem>
            <SelectItem value="leidas">Leídas</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2">
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length > 0 ? (
        <>
        <div className="bg-card rounded-2xl shadow-sm border border-border divide-y divide-border/50">
          {slice.map(n => {
            const contacto = n.tipo === "contacto" ? parseContacto(n.mensaje) : null;
            return (
            <div
              key={n.id_notificacion}
              className={`flex items-start gap-3 p-4 transition-colors ${!n.leido ? "bg-primary/[0.03]" : ""}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${!n.leido ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {TIPO_ICON[n.tipo] ?? <Bell className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.leido ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                  {contacto ? `Mensaje de contacto de ${contacto.nombre}` : n.titulo}
                  {!n.leido && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />}
                </p>
                {contacto ? (
                  <>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">{contacto.correo}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{contacto.cuerpo}</p>
                    <a
                      href={`mailto:${contacto.correo}?subject=${encodeURIComponent(`Re: ${n.titulo.replace(/^Nuevo mensaje de contacto:\s*/, "")}`)}`}
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-primary hover:underline"
                    >
                      <Send className="w-3 h-3" /> Responder por correo
                    </a>
                  </>
                ) : (
                  n.mensaje && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensaje}</p>
                )}
                <p className="text-[11px] text-muted-foreground/70 mt-1">{tiempoRelativo(n.fecha_creacion)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!n.leido && (
                  <button onClick={() => onMarcarLeida(n.id_notificacion)} className="p-1.5 text-primary/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Marcar como leída">
                    <Check className="w-4 h-4" />
                  </button>
                )}
                {!soloEmpleado && (
                  <button onClick={() => onDelete(n.id_notificacion)} className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all" title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} className="mt-4" />
        </>
      ) : (
        <EmptyState icon={Bell} title="Sin notificaciones" description="Todavía no hay ninguna notificación registrada." />
      )}
    </div>
  );
}
