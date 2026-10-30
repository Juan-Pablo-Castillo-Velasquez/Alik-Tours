import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Clapperboard,
  LayoutDashboard, CalendarDays, XCircle, PlusCircle, Users, Hotel,
  Package, Building2, Wallet, Bell, UserPlus, ShieldCheck, Activity,
  Settings, Plane, ChevronLeft, ChevronRight, UserCircle, Megaphone, Palette,
  MessageCircle,
} from "lucide-react";
import type { Module } from "./types";
import { mensajeChatService } from "../../services/mensajeChat.service";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "../ui/tooltip";

interface NavItem {
  id: Module;
  label: string;
  icon: typeof LayoutDashboard;
  /** true = ya existe una pantalla real conectada al backend */
  ready: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// Estructura de navegación propuesta por el brief de rediseño, agrupada
// por área de la agencia en vez de una lista plana de botones. Los ítems
// con ready:false todavía no tienen un módulo construido en esta fase —
// se muestran para que la información completa del panel sea visible
// desde ya, pero abren un EmptyState honesto en vez de datos inventados
// (ver MODULES en Admindashboard.tsx).
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "General",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { id: "reservas", label: "Reservas", icon: CalendarDays, ready: true },
      { id: "crear-reserva", label: "Crear reserva", icon: PlusCircle, ready: true },
      { id: "cancelaciones", label: "Solicitudes de cancelación", icon: XCircle, ready: true },
      { id: "clientes", label: "Clientes", icon: Users, ready: true },
    ],
  },
  {
    label: "Productos",
    items: [
      { id: "hoteles", label: "Hoteles", icon: Hotel, ready: true },
      { id: "paquetes", label: "Paquetes turísticos", icon: Package, ready: true },
    ],
  },
  {
    label: "Comercial",
    items: [
      { id: "empresas", label: "Empresas y contactos", icon: Building2, ready: true },
      { id: "banners", label: "Promociones y banners", icon: Megaphone, ready: true },
      { id: "temas", label: "Temas de temporada", icon: Palette, ready: true },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { id: "pagos", label: "Pagos", icon: Wallet, ready: true },
    ],
  },
  {
    label: "Comunicación",
    items: [
      { id: "notificaciones", label: "Notificaciones", icon: Bell, ready: true },
      { id: "mensajes", label: "Mensajes", icon: MessageCircle, ready: true },
      { id: "comunidad", label: "Comunidad y videos", icon: Clapperboard, ready: true },
    ],
  },
  {
    label: "Administración",
    items: [
      { id: "usuarios", label: "Usuarios", icon: UserPlus, ready: true },
      { id: "roles", label: "Roles y permisos", icon: ShieldCheck, ready: true },
      { id: "actividad", label: "Actividad del sistema", icon: Activity, ready: true },
      { id: "configuracion", label: "Configuración", icon: Settings, ready: true },
      { id: "mi-cuenta", label: "Mi cuenta", icon: UserCircle, ready: true },
    ],
  },
];

// Módulos visibles para un "empleado" (asesor) SIN rol admin -- panel
// recortado (ver brief: "vamos por el apartador de empleado... re utiliza
// componentes que ya existen"). Todo lo de catálogo/gestión de cuenta
// (hoteles, paquetes, usuarios, roles, empresas, banners, temas,
// configuración) queda fuera: sigue siendo exclusivo de admin. Exportado
// para que Admindashboard.tsx pueda reusar el mismo allowlist al decidir
// qué módulo renderizar (nunca confiar solo en que el ítem de nav esté
// oculto -- ver MODULOS_EMPLEADO en Admindashboard.tsx).
export const MODULOS_EMPLEADO: Module[] = [
  "dashboard",
  "reservas",
  // No es un item de nav (no tiene entrada propia en NAV_SECTIONS, se llega
  // por el boton "Nueva reserva" del header o dentro de Reservas), pero
  // tiene que estar en este allowlist o el guard de Admindashboard.tsx lo
  // redirige de vuelta al dashboard apenas el empleado intenta crear una.
  "crear-reserva",
  "cancelaciones",
  "pagos",
  "mensajes",
  // Los asesores también moderan la comunidad; los videos de la agencia
  // los gestiona solo el admin (el backend responde 403 y la pestaña se oculta).
  "comunidad",
  "notificaciones",
  "mi-cuenta",
];

const SIDEBAR_COLLAPSE_KEY = "admin-sidebar-collapsed";

interface AdminSidebarProps {
  activeModule: Module;
  setActiveModule: (m: Module) => void;
  /** Controla visibilidad completa en mobile (ya existía antes) */
  open: boolean;
  usuarioInicial: string;
  usuarioNombre?: string;
  /** true = quien entró tiene rol "empleado" pero NO "admin" -- muestra
   * solo MODULOS_EMPLEADO y la etiqueta "Asesor" en vez de "Administrador". */
  soloEmpleado?: boolean;
}

export default function AdminSidebar({
  activeModule,
  setActiveModule,
  open,
  usuarioInicial,
  usuarioNombre,
  soloEmpleado = false,
}: AdminSidebarProps) {
  // Mismas secciones para admin (sin filtrar); para "empleado" sin admin,
  // solo los ítems de MODULOS_EMPLEADO, y se descartan las secciones que
  // quedarían vacías (ej. "Productos", "Comercial", "Administración").
  const NAV_SECTIONS_FILTRADAS = soloEmpleado
    ? NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => MODULOS_EMPLEADO.includes(i.id)) })).filter(
        (s) => s.items.length > 0,
      )
    : NAV_SECTIONS;

  // "Colapsado" = solo íconos. Se recuerda entre navegaciones (persiste en
  // localStorage, mismo patrón que el toggle de tema oscuro del admin).
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1"
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Badge de mensajes no leídos junto al ítem de nav -- polling propio,
  // 18s (no necesita ser tan frecuente como el hilo abierto de
  // ModuleMensajes.tsx, que sondea cada 5s).
  const [noLeidosMensajes, setNoLeidosMensajes] = useState(0);
  const noLeidosRef = useRef(0);
  useEffect(() => {
    const cargar = () => {
      mensajeChatService
        .getNoLeidos()
        .then(({ no_leidos }) => {
          if (no_leidos !== noLeidosRef.current) {
            noLeidosRef.current = no_leidos;
            setNoLeidosMensajes(no_leidos);
          }
        })
        .catch(() => { /* no crítico -- se reintenta en el próximo ciclo */ });
    };
    cargar();
    const interval = setInterval(cargar, 18000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: -280 }}
          animate={{ x: 0, width: collapsed ? 76 : 256 }}
          exit={{ x: -280 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex-shrink-0 flex flex-col border-r transition-colors duration-300 bg-sidebar border-sidebar-border overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-sidebar-border flex items-center justify-between gap-2">
            {!collapsed && (
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
                Panel de control
              </p>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Expandir menú" : "Colapsar menú"}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="flex-1 py-2.5 px-2.5 space-y-3 overflow-y-auto">
            {NAV_SECTIONS_FILTRADAS.map((section) => (
              <div key={section.label}>
                {!collapsed && (
                  <p className="px-2.5 mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map(({ id, label, icon: Icon, ready }) => {
                    const isActive = activeModule === id;
                    const button = (
                      <button
                        key={id}
                        onClick={() => setActiveModule(id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 min-h-[40px] rounded-xl text-sm font-medium transition-all group relative ${
                          collapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-gradient-to-r from-primary to-[#A13B55] text-white shadow-lg shadow-[rgba(123,30,58,0.25)]"
                            : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}
                      >
                        <span className="relative flex-shrink-0">
                          <Icon
                            className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                              isActive ? "text-white" : ""
                            }`}
                          />
                          {/* Punto rojo sobre el ícono en modo colapsado -- el
                              badge numérico de abajo solo se ve expandido. */}
                          {collapsed && id === "mensajes" && noLeidosMensajes > 0 && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive" />
                          )}
                        </span>
                        {!collapsed && <span className="truncate">{label}</span>}
                        {!collapsed && !ready && (
                          <span
                            className={`ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground/70"
                            }`}
                          >
                            Próx.
                          </span>
                        )}
                        {!collapsed && id === "mensajes" && noLeidosMensajes > 0 && (
                          <span
                            className={`ml-auto min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full flex-shrink-0 flex items-center justify-center ${
                              isActive ? "bg-white/20 text-white" : "bg-destructive text-destructive-foreground"
                            }`}
                          >
                            {noLeidosMensajes > 99 ? "99+" : noLeidosMensajes}
                          </span>
                        )}
                      </button>
                    );

                    if (!collapsed) return button;

                    return (
                      <Tooltip key={id}>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent side="right">
                          {label}
                          {!ready && " · Próximamente"}
                          {id === "mensajes" && noLeidosMensajes > 0 && ` · ${noLeidosMensajes} sin leer`}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-2.5 border-t border-sidebar-border space-y-1">
            <div
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-sidebar-accent ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7B1E3A] to-[#C9A227] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {usuarioInicial}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate">
                    {usuarioNombre}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{soloEmpleado ? "Asesor" : "Administrador"}</p>
                </div>
              )}
            </div>

            <Link
              to="/"
              className={`flex items-center gap-2 px-3.5 py-2 text-xs rounded-xl transition-all text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent ${
                collapsed ? "justify-center" : ""
              }`}
              title="Ir al sitio"
            >
              <Plane className="w-3.5 h-3.5 flex-shrink-0" />
              {!collapsed && "Ir al sitio"}
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
