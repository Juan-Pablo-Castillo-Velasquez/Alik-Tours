import { useEffect, useState } from "react";
import { Search, Trash2, PlusCircle, ShieldCheck, ShieldOff, Users, UserCheck, UserX, Mail, ChevronRight } from "lucide-react";
import { Usuario, Rol, inputCls, labelCls, resolveFotoUrl } from "./types";
import AdminModal from "./ui/AdminModal";
import StatCard from "./ui/StatCard";
import SectionHeader from "./ui/SectionHeader";
import StatusBadge from "./ui/StatusBadge";
import EmptyState from "./ui/EmptyState";
import ConfirmDialog from "./ui/ConfirmDialog";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import Avatar from "./ui/Avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";

const EMPTY_FORM = {
  username: "", correo_electronico: "", password: "", roles: [] as string[],
};

// Mismo criterio que formatFechaHora en ModulePagos.tsx — se duplica en vez
// de importarse (función pura, sin estado), siguiendo la convención ya
// usada en varios módulos de admin.
function formatFechaHora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground min-w-[120px]">{label}</span>
      <span className="text-xs font-medium text-foreground text-right ml-auto">{value ?? "—"}</span>
    </div>
  );
}

// Tipo de acción pendiente de confirmación — reemplaza el clic directo de
// activar/desactivar y verificar/quitar verificación por un ConfirmDialog
// centrado (mismo patrón ya usado en ModuleCancelaciones.tsx y en el
// executeDelete de Admindashboard.tsx), en vez de ejecutar la acción de
// inmediato al primer clic.
type PendingToggle = { usuario: Usuario; tipo: "activo" | "verificado" };

// Función pura (no depende de estado del componente) que arma el texto del
// ConfirmDialog según la acción pendiente — separada del JSX para no
// depender del estrechamiento de tipos de TypeScript sobre encadenamientos
// opcionales dentro de un ternario largo.
function getToggleCopy(pending: PendingToggle) {
  const nombre = pending.usuario.nombre_completo || pending.usuario.username;
  if (pending.tipo === "activo") {
    const activo = pending.usuario.activo;
    return {
      title: activo ? "Desactivar usuario" : "Activar usuario",
      description: activo
        ? `${nombre} no podrá iniciar sesión mientras la cuenta esté desactivada.`
        : `${nombre} podrá volver a iniciar sesión con normalidad.`,
      confirmLabel: activo ? "Desactivar" : "Activar",
      destructive: activo,
    };
  }
  const verificado = pending.usuario.verificado;
  return {
    title: verificado ? "Quitar verificación" : "Verificar usuario",
    description: verificado
      ? `${nombre} volverá a aparecer como cuenta no verificada.`
      : `Se marcará la cuenta de ${nombre} como verificada manualmente.`,
    confirmLabel: verificado ? "Quitar verificación" : "Verificar",
    destructive: verificado,
  };
}

interface Props {
  usuarios: Usuario[];
  roles: Rol[];
  onDelete: (id: number) => void;
  onSubmit: (data: any) => Promise<void>;
  onToggleActivo: (usuario: Usuario) => Promise<void>;
  // Override manual de admin: cuando el correo de verificación nunca le
  // llegó a un usuario (ej. falla de SMTP en producción, ver mail.py), el
  // admin puede marcar la cuenta como verificada a mano en vez de dejarlo
  // sin poder usar su cuenta indefinidamente.
  onToggleVerificado: (usuario: Usuario) => Promise<void>;
  // Antes los roles de un usuario ya existente eran de solo lectura en su
  // perfil -- solo se podian elegir al crear la cuenta (ver toggleRol, que
  // sigue siendo exclusivo del modal de creacion). Reusa el mismo
  // usuarioAdminService.update({roles}) que ya soporta el backend.
  onUpdateRoles: (usuario: Usuario, roles: string[]) => Promise<void>;
  // Id del usuario con la sesion activa -- evita que un admin se quite a si
  // mismo el rol de admin y quede fuera del panel sin querer.
  currentUsuarioId?: number;
  loading: boolean;
}

export default function ModuleUsuarios({ usuarios, roles, onDelete, onSubmit, onToggleActivo, onToggleVerificado, onUpdateRoles, currentUsuarioId, loading }: Props) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle | null>(null);
  const [profileRoles, setProfileRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  const profile = usuarios.find(u => u.id_usuario === profileId) ?? null;
  const toggleCopy = pendingToggle ? getToggleCopy(pendingToggle) : null;

  // Sincroniza el estado editable de roles con el usuario abierto en el
  // modal -- se resetea al abrir otro perfil y tambien cuando `usuarios`
  // se actualiza tras guardar (para reflejar lo que realmente quedo en el
  // backend), pero no mientras el admin esta togglenado botones sin haber
  // guardado aun (eso no toca `usuarios`).
  useEffect(() => {
    setProfileRoles(profile ? [...profile.roles] : []);
  }, [profileId, usuarios]);

  const esPropioUsuario = profile != null && profile.id_usuario === currentUsuarioId;
  const rolesCambiaron = profile != null && (
    profileRoles.length !== profile.roles.length || profileRoles.some(r => !profile.roles.includes(r))
  );

  const toggleProfileRol = (nombre_rol: string) => {
    setProfileRoles(prev => prev.includes(nombre_rol) ? prev.filter(r => r !== nombre_rol) : [...prev, nombre_rol]);
  };

  async function handleGuardarRoles() {
    if (!profile) return;
    setSavingRoles(true);
    try {
      await onUpdateRoles(profile, profileRoles);
    } finally {
      setSavingRoles(false);
    }
  }

  async function handleConfirmToggle() {
    if (!pendingToggle) return;
    if (pendingToggle.tipo === "activo") {
      await onToggleActivo(pendingToggle.usuario);
    } else {
      await onToggleVerificado(pendingToggle.usuario);
    }
    setPendingToggle(null);
  }

  // KPIs reales — activos/verificados calculados sobre el arreglo `usuarios`
  // que ya llega del backend, nada inventado.
  const activos = usuarios.filter(u => u.activo);
  const verificados = usuarios.filter(u => u.verificado);

  const [rolFilter, setRolFilter] = useState("todos");
  const [estadoFilter, setEstadoFilter] = useState<"todos" | "activos" | "inactivos">("todos");
  const [verificadoFilter, setVerificadoFilter] = useState<"todos" | "verificados" | "no_verificados">("todos");

  const filtered = usuarios.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${u.username} ${u.correo_electronico} ${u.nombre_completo ?? ""}`.toLowerCase().includes(q);
    const matchRol = rolFilter === "todos" || u.roles.includes(rolFilter);
    const matchEstado = estadoFilter === "todos" || (estadoFilter === "activos" ? u.activo : !u.activo);
    const matchVerificado = verificadoFilter === "todos" || (verificadoFilter === "verificados" ? u.verificado : !u.verificado);
    return matchSearch && matchRol && matchEstado && matchVerificado;
  });

  const { page, pageCount, slice, setPage } = usePagination(filtered, 8);

  const hasActiveFilters = search.trim() !== "" || rolFilter !== "todos" || estadoFilter !== "todos" || verificadoFilter !== "todos";
  function clearFilters() { setSearch(""); setRolFilter("todos"); setEstadoFilter("todos"); setVerificadoFilter("todos"); }

  const toggleRol = (nombre_rol: string) => {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(nombre_rol) ? f.roles.filter(r => r !== nombre_rol) : [...f.roles, nombre_rol],
    }));
  };

  function openCreate() { setForm(EMPTY_FORM); setMsg(null); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setForm(EMPTY_FORM); setMsg(null); }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await onSubmit(form);
      closeModal();
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Error al crear usuario" });
    }
  };

  const thCls = "px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap";

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Usuarios y roles"
        subtitle={`${usuarios.length} usuario${usuarios.length === 1 ? "" : "s"} registrado${usuarios.length === 1 ? "" : "s"}`}
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-[#A13B55] text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-primary/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" /> Nuevo usuario
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total"       value={usuarios.length}   icon={Users} />
        <StatCard label="Activos"     value={activos.length}    icon={ShieldCheck} gradient="from-success to-success" />
        <StatCard label="Verificados" value={verificados.length} icon={UserCheck}  gradient="from-[#C9A227] to-[#C9A227]" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input maxLength={120}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por usuario, correo o nombre..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm outline-none
              bg-card text-foreground placeholder:text-muted-foreground/60
              focus:ring-2 focus:ring-primary/40 focus:border-transparent"
          />
        </div>
        <Select value={rolFilter} onValueChange={setRolFilter}>
          <SelectTrigger className="w-auto min-w-[130px] h-auto py-2 bg-card border-border text-xs">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            {roles.map(r => <SelectItem key={r.id_rol} value={r.nombre_rol}>{r.nombre_rol}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as "todos" | "activos" | "inactivos")}>
          <SelectTrigger className="w-auto min-w-[120px] h-auto py-2 bg-card border-border text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Activos e inactivos</SelectItem>
            <SelectItem value="activos">Activos</SelectItem>
            <SelectItem value="inactivos">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={verificadoFilter} onValueChange={(v) => setVerificadoFilter(v as "todos" | "verificados" | "no_verificados")}>
          <SelectTrigger className="w-auto min-w-[150px] h-auto py-2 bg-card border-border text-xs">
            <SelectValue placeholder="Verificación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Verificados y no</SelectItem>
            <SelectItem value="verificados">Verificados</SelectItem>
            <SelectItem value="no_verificados">No verificados</SelectItem>
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
                <th className={thCls}>Usuario</th>
                <th className={thCls}>Correo</th>
                <th className={thCls}>Roles</th>
                <th className={thCls}>Estado</th>
                <th className={thCls}>Verificado</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {slice.map(u => (
                <tr
                  key={u.id_usuario}
                  className="hover:bg-accent transition-colors cursor-pointer group"
                  onClick={() => setProfileId(u.id_usuario)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        nombre={u.nombre_completo || u.username}
                        fotoUrl={resolveFotoUrl(u.foto_perfil)}
                        color="primary"
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {u.nombre_completo || u.username}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      {u.correo_electronico}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {u.roles.length > 0 ? u.roles.map(r => (
                        <span key={r} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-primary">{r}</span>
                      )) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.activo ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.verificado ? "verificado" : "no_verificado"} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      <button aria-label={u.activo ? "Desactivar" : "Activar"}
                        onClick={() => setPendingToggle({ usuario: u, tipo: "activo" })}
                        title={u.activo ? "Desactivar" : "Activar"}
                        className={`p-1.5 rounded-lg transition-all ${u.activo ? "text-success hover:bg-success/10" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {u.activo ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                      </button>
                      {!u.verificado && (
                        <button aria-label="Verificar manualmente (el correo de confirmación nunca le llegó)"
                          onClick={() => setPendingToggle({ usuario: u, tipo: "verificado" })}
                          title="Verificar manualmente (el correo de confirmación nunca le llegó)"
                          className="p-1.5 rounded-lg text-[#7A5F08] dark:text-[#E3C55A] hover:bg-[#C9A227]/10 transition-all"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      {u.verificado && (
                        <button aria-label="Quitar verificación"
                          onClick={() => setPendingToggle({ usuario: u, tipo: "verificado" })}
                          title="Quitar verificación"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-all"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      <button aria-label="Eliminar"
                        onClick={() => onDelete(u.id_usuario)}
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
          title="No se encontraron usuarios"
          description={usuarios.length === 0 ? "Crea el primer usuario para empezar." : "Prueba con otro término de búsqueda."}
        />
      )}

      <AdminModal
        open={modalOpen}
        onOpenChange={(o) => { if (!o) closeModal(); else setModalOpen(true); }}
        title="Crear usuario"
        maxWidth="sm:max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {msg && (
            <div className="p-3 rounded-xl text-sm font-medium bg-destructive/10 text-destructive">
              {msg.text}
            </div>
          )}
          <div>
            <label className={labelCls}>Usuario</label>
            <input maxLength={80} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
              className={inputCls} required placeholder="nuevo.usuario" minLength={3} />
          </div>
          <div>
            <label className={labelCls}>Correo</label>
            <input maxLength={120} type="email" value={form.correo_electronico}
              onChange={e => setForm({ ...form, correo_electronico: e.target.value })}
              className={inputCls} required placeholder="usuario@alektours.com" />
          </div>
          <div>
            <label className={labelCls}>Contraseña</label>
            <input maxLength={72} type="password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className={inputCls} required minLength={8} placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <label className={labelCls}>Roles</label>
            <div className="flex flex-wrap gap-2">
              {roles.map(r => (
                <button
                  key={r.id_rol}
                  type="button"
                  onClick={() => toggleRol(r.nombre_rol)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.roles.includes(r.nombre_rol)
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40"
                    }`}
                >
                  {r.nombre_rol}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-primary to-[#A13B55] text-primary-foreground font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 text-sm">
            {loading ? "Guardando..." : "Crear usuario"}
          </button>
        </form>
      </AdminModal>

      {/* Perfil detallado — antes la tabla era todo lo que se podía ver de
          un usuario. Todo lo que muestra viene de datos reales que ya llegan
          por props (nada inventado): fecha_creacion/ultimo_login son
          columnas reales de Usuario (ver user_model.py), expuestas ahora en
          UsuarioAdminResponse. ultimo_login queda en "—" para cuentas que no
          han iniciado sesión desde que auth_service.py empezó a
          registrarlo. */}
      {profile && (
        <AdminModal
          open={!!profile}
          onOpenChange={(o) => { if (!o) setProfileId(null); }}
          title={
            <span className="inline-flex items-center gap-2.5">
              <Avatar nombre={profile.nombre_completo || profile.username} fotoUrl={resolveFotoUrl(profile.foto_perfil)} color="primary" />
              {profile.nombre_completo || profile.username}
            </span>
          }
          description={`@${profile.username}`}
          maxWidth="sm:max-w-lg"
        >
          <div className="space-y-0.5">
            <Row label="Correo" value={profile.correo_electronico} />
            <div className="py-2.5 border-b border-border/50">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-xs text-muted-foreground min-w-[120px]">Roles</span>
                {rolesCambiaron && (
                  <button
                    type="button"
                    onClick={handleGuardarRoles}
                    disabled={savingRoles}
                    className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {savingRoles ? "Guardando..." : "Guardar cambios"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {roles.map(r => {
                  const activo = profileRoles.includes(r.nombre_rol);
                  // Un admin no puede quitarse a si mismo el rol de admin --
                  // evita que quede fuera del panel por accidente sin que
                  // quede otro admin para devolverselo.
                  const bloqueado = esPropioUsuario && r.nombre_rol === "admin" && activo;
                  return (
                    <button
                      key={r.id_rol}
                      type="button"
                      disabled={bloqueado}
                      title={bloqueado ? "No puedes quitarte el rol de admin a ti mismo" : undefined}
                      onClick={() => toggleProfileRol(r.nombre_rol)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${activo
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border text-muted-foreground hover:border-primary/40"
                        } ${bloqueado ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {r.nombre_rol}
                    </button>
                  );
                })}
              </div>
            </div>
            <Row label="Estado" value={<StatusBadge status={profile.activo ? "activo" : "inactivo"} />} />
            <Row label="Verificado" value={<StatusBadge status={profile.verificado ? "verificado" : "no_verificado"} />} />
            <Row label="Cuenta creada" value={formatFechaHora(profile.fecha_creacion)} />
            <Row label="Último acceso" value={formatFechaHora(profile.ultimo_login)} />
          </div>
        </AdminModal>
      )}

      {/* Confirmación centrada para activar/desactivar y verificar/quitar
          verificación — antes estas dos acciones se ejecutaban al primer
          clic sin ningún paso intermedio. La eliminación de usuarios ya
          pasa por su propio ConfirmDialog centralizado en
          Admindashboard.tsx (ver executeDelete), así que no se duplica acá. */}
      <ConfirmDialog
        open={!!pendingToggle}
        onOpenChange={(o) => { if (!o) setPendingToggle(null); }}
        title={toggleCopy?.title ?? ""}
        description={toggleCopy?.description}
        confirmLabel={toggleCopy?.confirmLabel}
        destructive={toggleCopy?.destructive}
        onConfirm={handleConfirmToggle}
      />
    </div>
  );
}
