import { useState } from "react";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import { ShieldCheck, PlusCircle, Trash2, KeyRound, Layers } from "lucide-react";
import { Rol, inputCls, labelCls, primaryBtnCls } from "./types";
import type { PermisoResponse, RolConPermisosResponse } from "../../services/usuarioAdmin.service";
import AdminModal from "./ui/AdminModal";
import StatCard from "./ui/StatCard";
import SectionHeader from "./ui/SectionHeader";
import EmptyState from "./ui/EmptyState";

// Roles que este módulo nunca deja borrar desde la UI: 'admin' porque
// require_admin/require_permission (backend) lo reconocen por su nombre
// literal -- borrarlo rompería el panel para siempre -- y
// 'cliente'/'empleado' porque son los roles que auth_service.py asigna
// automáticamente al registrarse, no roles de uso administrativo. El
// backend (eliminar_rol en usuario_route.py) también bloquea 'admin' del
// lado del servidor pase lo que pase acá; este bloqueo del lado del
// cliente es solo para no ni siquiera ofrecer el botón.
const ROLES_PROTEGIDOS = new Set(["admin", "cliente", "empleado"]);

interface Props {
  roles: Rol[];
  permisos: PermisoResponse[];
  onCreateRol: (nombre: string) => Promise<void>;
  onDeleteRol: (id: number) => void;
  onCargarPermisosDeRol: (id: number) => Promise<RolConPermisosResponse>;
  onSubmitPermisosDeRol: (id: number, permisos: string[]) => Promise<void>;
  loading: boolean;
}

export default function ModuleRoles({
  roles,
  permisos,
  onCreateRol,
  onDeleteRol,
  onCargarPermisosDeRol,
  onSubmitPermisosDeRol,
  loading,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Permisos del rol que se está editando -- se piden al backend recién al
  // abrir el modal (GET /api/roles/{id}/permisos), no de entrada para
  // todos los roles: son ~10 roles hoy, pero no tiene sentido pedir el
  // detalle de todos si el admin solo va a abrir uno o dos.
  const [rolEditando, setRolEditando] = useState<Rol | null>(null);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [totalUsuariosRol, setTotalUsuariosRol] = useState(0);
  const [cargandoPermisos, setCargandoPermisos] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const pagRoles = usePagination(roles, 9);
  const categorias = Array.from(new Set(permisos.map((p) => p.categoria)));
  const esAdmin = rolEditando?.nombre_rol === "admin";

  async function abrirPermisos(rol: Rol) {
    setRolEditando(rol);
    setCargandoPermisos(true);
    try {
      const data = await onCargarPermisosDeRol(rol.id_rol);
      setSeleccion(data.permisos);
      setTotalUsuariosRol(data.total_usuarios);
    } catch {
      setSeleccion([]);
      setTotalUsuariosRol(0);
    } finally {
      setCargandoPermisos(false);
    }
  }

  function cerrarPermisos() {
    setRolEditando(null);
    setSeleccion([]);
  }

  function toggleClave(clave: string) {
    setSeleccion((prev) => (prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]));
  }

  async function guardarPermisos() {
    if (!rolEditando) return;
    setGuardando(true);
    try {
      await onSubmitPermisosDeRol(rolEditando.id_rol, seleccion);
      cerrarPermisos();
    } finally {
      setGuardando(false);
    }
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await onCreateRol(nombreNuevo);
      setCreateOpen(false);
      setNombreNuevo("");
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "No se pudo crear el rol" });
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Roles y permisos"
        subtitle={`${roles.length} rol${roles.length === 1 ? "" : "es"} · ${permisos.length} permisos disponibles`}
        action={
          <button
            onClick={() => {
              setCreateOpen(true);
              setMsg(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-[#A13B55] text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-primary/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" /> Nuevo rol
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Roles" value={roles.length} icon={ShieldCheck} />
        <StatCard label="Permisos disponibles" value={permisos.length} icon={KeyRound} gradient="from-[#C9A227] to-[#C9A227]" />
        <StatCard label="Categorías" value={categorias.length} icon={Layers} gradient="from-emerald-500 to-emerald-600" />
      </div>

      {roles.length > 0 ? (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pagRoles.slice.map((rol) => {
            const protegido = ROLES_PROTEGIDOS.has(rol.nombre_rol);
            return (
              <div key={rol.id_rol} className="bg-card rounded-2xl p-4 shadow-sm border border-border flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate capitalize">{rol.nombre_rol}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rol.nombre_rol === "admin" ? "Acceso total, siempre" : "Permisos personalizados"}
                    </p>
                  </div>
                  {!protegido && (
                    <button
                      onClick={() => onDeleteRol(rol.id_rol)}
                      title="Eliminar rol"
                      className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => abrirPermisos(rol)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {rol.nombre_rol === "admin" ? "Ver permisos" : "Gestionar permisos"}
                </button>
              </div>
            );
          })}
        </div>
        <Pagination page={pagRoles.page} pageCount={pagRoles.pageCount} onPageChange={pagRoles.setPage} className="mt-4" />
      </>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title="No hay roles todavía"
          description="Crea el primer rol para empezar a repartir permisos."
        />
      )}

      {/* Crear rol */}
      <AdminModal
        open={createOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setNombreNuevo("");
            setMsg(null);
          }
        }}
        title="Nuevo rol"
        maxWidth="sm:max-w-md"
      >
        <form onSubmit={handleCrear} className="space-y-3">
          {msg && <div className="p-3 rounded-xl text-sm font-medium bg-destructive/10 text-destructive">{msg.text}</div>}
          <div>
            <label className={labelCls}>Nombre del rol</label>
            <input maxLength={80}
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              className={inputCls}
              required
              minLength={2}
              placeholder="ej. soporte, marketing, contabilidad"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se crea sin permisos — asígnaselos desde "Gestionar permisos" apenas lo crees.
            </p>
          </div>
          <button type="submit" disabled={loading} className={primaryBtnCls}>
            {loading ? "Creando..." : "Crear rol"}
          </button>
        </form>
      </AdminModal>

      {/* Permisos de un rol */}
      {rolEditando && (
        <AdminModal
          open={!!rolEditando}
          onOpenChange={(o) => {
            if (!o) cerrarPermisos();
          }}
          title={<span className="capitalize">Permisos de "{rolEditando.nombre_rol}"</span>}
          description={
            esAdmin
              ? "El rol admin siempre tiene acceso total en el código, sin importar lo que esté marcado aquí abajo."
              : totalUsuariosRol > 0
                ? `${totalUsuariosRol} usuario${totalUsuariosRol === 1 ? "" : "s"} tiene${totalUsuariosRol === 1 ? "" : "n"} este rol asignado.`
                : "Ningún usuario tiene este rol asignado todavía."
          }
          maxWidth="sm:max-w-lg"
        >
          {cargandoPermisos ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Cargando permisos...</p>
          ) : (
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {categorias.map((categoria) => (
                <div key={categoria}>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1.5">{categoria}</p>
                  <div className="flex flex-wrap gap-2">
                    {permisos
                      .filter((p) => p.categoria === categoria)
                      .map((p) => (
                        <button
                          key={p.clave}
                          type="button"
                          disabled={esAdmin}
                          onClick={() => toggleClave(p.clave)}
                          title={p.clave}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                            seleccion.includes(p.clave) || esAdmin
                              ? "bg-primary border-primary text-primary-foreground"
                              : "bg-card border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {p.nombre}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
              {!esAdmin && (
                <button onClick={guardarPermisos} disabled={guardando} className={`${primaryBtnCls} mt-2`}>
                  {guardando ? "Guardando..." : "Guardar permisos"}
                </button>
              )}
            </div>
          )}
        </AdminModal>
      )}
    </div>
  );
}
