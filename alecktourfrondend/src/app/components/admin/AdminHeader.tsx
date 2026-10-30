import BrandLogo from "../BrandLogo";
import { BRAND } from "../../config/brand";
import { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import {
  Menu, X, Moon, Sun, ChevronRight, LogOut, Bell,
  Search, CalendarDays, Hotel, Package, Users, UserPlus,
} from "lucide-react";
import type {
  Module, Reserva, HotelData, Paquete, Cliente, Usuario,
} from "./types";
import { resolveFotoUrl } from "./types";
import { NAV_SECTIONS } from "./AdminSidebar";
import QuickActions, { type QuickAction } from "./ui/QuickActions";

interface SearchResult {
  module: Module;
  type: string;
  title: string;
  subtitle?: string;
}

interface AdminHeaderProps {
  activeModule: Module;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  dark: boolean;
  onToggleDark: () => void;
  usuarioNombre?: string;
  // Real (Usuario.foto_perfil vía /me) — si no hay foto o falla al cargar,
  // se cae de vuelta al círculo con el ícono genérico de siempre.
  usuarioFoto?: string | null;
  // true cuando la cuenta es empleado sin el rol admin -- cambia la
  // etiqueta bajo el nombre (ver AdminSidebar.tsx, que ya usa el mismo
  // criterio para su propio pie de pagina).
  soloEmpleado?: boolean;
  onLogout: () => void;
  pendingCancelaciones: number;
  /** Conteo real de Notificacion.leido = false (ver notificacion_route.py) —
   * cubre cancelaciones, contacto, solicitudes corporativas y pagos, no
   * solo cancelaciones como antes. */
  notificacionesNoLeidas: number;
  quickActions: QuickAction[];
  onNavigate: (m: Module) => void;
  searchData: {
    reservas: Reserva[];
    hoteles: HotelData[];
    paquetes: Paquete[];
    clientes: Cliente[];
    usuarios: Usuario[];
  };
}

// Header fijo del admin: breadcrumb dinámico (a partir de NAV_SECTIONS, así
// que nunca queda desincronizado del menú real), buscador global sobre los
// datos que YA están cargados en memoria (nada inventado ni un endpoint
// nuevo), acciones rápidas, campana con el conteo REAL de solicitudes de
// cancelación pendientes, tema y menú de usuario.
export default function AdminHeader({
  soloEmpleado,
  activeModule,
  onToggleSidebar,
  sidebarOpen,
  dark,
  onToggleDark,
  usuarioNombre,
  usuarioFoto,
  onLogout,
  // No se usa aquí: notificacionesNoLeidas (Admindashboard.tsx) ya incluye
  // cancelaciones/contacto/corporativo/pagos, así que sumar este contador
  // a la campana duplicaría el conteo. Se mantiene en las props por si un
  // futuro rediseño necesita mostrar cancelaciones pendientes por separado.
  pendingCancelaciones: _pendingCancelaciones,
  notificacionesNoLeidas,
  quickActions,
  onNavigate,
  searchData,
}: AdminHeaderProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [fotoError, setFotoError] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const fotoUrl = resolveFotoUrl(usuarioFoto);

  const breadcrumb = useMemo(() => {
    for (const section of NAV_SECTIONS) {
      const item = section.items.find((i) => i.id === activeModule);
      if (item) return { section: section.label, item: item.label };
    }
    return { section: "Administración", item: "Panel" };
  }, [activeModule]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];

    for (const c of searchData.clientes) {
      const nombreCompleto = `${c.nombre} ${c.apellido}`.toLowerCase();
      if (nombreCompleto.includes(q) || c.cedula?.toLowerCase().includes(q) || c.correo?.toLowerCase().includes(q)) {
        out.push({ module: "clientes", type: "Cliente", title: `${c.nombre} ${c.apellido}`, subtitle: c.correo });
      }
    }

    for (const r of searchData.reservas) {
      if (`#${r.id_reserva}`.includes(q) || String(r.id_reserva) === q) {
        out.push({ module: "reservas", type: "Reserva", title: `Reserva #${r.id_reserva}`, subtitle: r.estado });
      }
    }

    for (const h of searchData.hoteles) {
      if (
        h.nombre_hotel?.toLowerCase().includes(q) ||
        h.ciudad?.toLowerCase().includes(q) ||
        h.pais?.toLowerCase().includes(q)
      ) {
        out.push({ module: "hoteles", type: "Hotel", title: h.nombre_hotel, subtitle: `${h.ciudad}, ${h.pais}` });
      }
    }

    for (const p of searchData.paquetes) {
      if (p.nombre_paquete?.toLowerCase().includes(q)) {
        out.push({ module: "paquetes", type: "Paquete", title: p.nombre_paquete });
      }
    }

    for (const u of searchData.usuarios) {
      if (u.username?.toLowerCase().includes(q) || u.correo_electronico?.toLowerCase().includes(q)) {
        out.push({ module: "usuarios", type: "Usuario", title: u.username, subtitle: u.correo_electronico });
      }
    }

    return out.slice(0, 8);
  }, [query, searchData]);

  const iconFor: Record<string, typeof Users> = {
    Cliente: Users,
    Reserva: CalendarDays,
    Hotel: Hotel,
    Paquete: Package,
    Usuario: UserPlus,
  };

  return (
    // Antes iba de granate a un dorado brillante (#C9A227) en un solo salto
    // diagonal -- se veía como dos colores peleando en vez de un degradado.
    // Ahora se queda dentro de la misma familia (los mismos tokens
    // derivados de --primary que ya usa PromoBar.tsx/footer-brand), así
    // que también se recolorea solo si cambia el tema de temporada.
    <header className="h-16 bg-gradient-to-r from-[var(--primary-deep)] via-[var(--primary-shade)] to-[var(--primary)] flex items-center px-4 sm:px-6 gap-3 sm:gap-4 sticky top-0 z-40 shadow-lg">
      <button
        onClick={onToggleSidebar}
        className="text-white/80 hover:text-white transition-colors lg:hidden flex-shrink-0"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <Link to="/" className="flex items-center gap-2 flex-shrink-0">
        <span className="bg-white rounded-full p-0.5">
          <BrandLogo size={32} />
        </span>
        <span className="text-white font-bold text-lg hidden sm:block">{BRAND.name}</span>
      </Link>

      {/* Breadcrumb dinámico */}
      <div className="hidden md:flex items-center gap-1.5 text-white/70 text-sm min-w-0">
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{breadcrumb.section}</span>
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-white font-medium truncate">{breadcrumb.item}</span>
      </div>

      {/* Buscador global */}
      <div ref={searchRef} className="relative flex-1 max-w-md ml-2 hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Buscar reserva, cliente, hotel, paquete..."
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/15 focus:bg-white/25 placeholder:text-white/50 text-white text-sm outline-none transition-colors"
        />

        {searchOpen && query.trim() && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden z-50">
            {results.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Sin resultados para "{query}"</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {results.map((r, i) => {
                  const Icon = iconFor[r.type] || Search;
                  return (
                    <li key={`${r.module}-${i}`}>
                      <button
                        onClick={() => { onNavigate(r.module); setQuery(""); setSearchOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
                      >
                        <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.type}{r.subtitle ? ` · ${r.subtitle}` : ""}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 md:hidden" />

      <div className="flex items-center gap-2 flex-shrink-0">
        <QuickActions actions={quickActions} />

        <button
          onClick={() => onNavigate("notificaciones")}
          title="Notificaciones"
          className="relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
        >
          <Bell className="w-5 h-5" />
          {notificacionesNoLeidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#C9A227] text-[#2E2E2E] text-[10px] font-bold flex items-center justify-center">
              {notificacionesNoLeidas > 9 ? "9+" : notificacionesNoLeidas}
            </span>
          )}
        </button>

        <button
          onClick={onToggleDark}
          title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none bg-white/20 hover:bg-white/30 flex items-center px-1"
        >
          <motion.div
            animate={{ x: dark ? 28 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="w-5 h-5 rounded-full bg-white shadow flex items-center justify-center"
          >
            {dark ? <Moon className="w-3 h-3 text-[#7B1E3A]" /> : <Sun className="w-3 h-3 text-[#C9A227]" />}
          </motion.div>
        </button>

        <button
          onClick={() => onNavigate("mi-cuenta")}
          title="Mi cuenta"
          className="flex items-center gap-2.5 pl-1 pr-1.5 py-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <div className="text-right hidden sm:block">
            <p className="text-white text-sm font-medium">{usuarioNombre}</p>
            <p className="text-white/60 text-xs">{soloEmpleado ? "Asesor" : "Administrador"}</p>
          </div>
          {fotoUrl && !fotoError ? (
            <img
              src={fotoUrl}
              alt={usuarioNombre ?? (soloEmpleado ? "Asesor" : "Administrador")}
              onError={() => setFotoError(true)}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-white/30"
            />
          ) : (
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
          )}
        </button>
        <button
          onClick={onLogout}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
