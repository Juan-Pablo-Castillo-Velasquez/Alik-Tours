import {
  FileQuestion,
  Calendar,
  ChevronRight,
  Heart,
  Home,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Receipt,
  Settings,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { motion } from "motion/react";

// Secciones del perfil del cliente. Las usan el menú lateral (escritorio)
// y la barra de pestañas deslizable (celular), ver PerfilTabsMovil.
export const PERFIL_TABS = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "reservas", label: "Mis reservas", icon: Calendar },
  { id: "mensajes", label: "Mensajes", icon: MessageCircle },
  { id: "pqr", label: "Solicitudes PQR", icon: FileQuestion },
  { id: "favoritos", label: "Favoritos", icon: Heart },
  { id: "facturas", label: "Comprobantes", icon: Receipt },
  { id: "metodos-pago", label: "Métodos de pago", icon: Wallet },
  { id: "preferencias", label: "Preferencias", icon: SlidersHorizontal },
  { id: "cuenta", label: "Mi cuenta", icon: Settings },
] as const;

interface NavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  // Cuando es true (ver requiereMetodoPago en Profile.tsx), todas las
  // pestañas salvo "metodos-pago" se muestran deshabilitadas: el cliente
  // debe guardar un método de pago antes de navegar al resto del perfil.
  bloqueado?: boolean;
  noLeidosMensajes?: number;
}

function Contador({ n, activo }: { n: number; activo: boolean }) {
  if (n <= 0) return null;
  return (
    <span
      className={`flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
        activo ? "bg-primary-foreground/20 text-primary-foreground" : "bg-destructive text-destructive-foreground"
      }`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Pestañas en fila deslizable, para celular y tablet (lg:hidden). */
export function PerfilTabsMovil({ activeTab, setActiveTab, bloqueado = false, noLeidosMensajes = 0 }: NavProps) {
  return (
    <nav
      aria-label="Secciones de tu perfil"
      className="sticky top-[68px] z-20 -mx-4 mb-5 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur lg:hidden"
    >
      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PERFIL_TABS.map((tab) => {
          const activo = activeTab === tab.id;
          const deshabilitado = bloqueado && tab.id !== "metodos-pago";
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => !deshabilitado && setActiveTab(tab.id)}
              disabled={deshabilitado}
              aria-current={activo ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                deshabilitado
                  ? "cursor-not-allowed bg-muted/50 text-muted-foreground/50"
                  : activo
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
              }`}
            >
              {deshabilitado ? <Lock className="h-3.5 w-3.5" /> : <tab.icon className="h-4 w-4" />}
              {tab.label}
              {tab.id === "mensajes" && !deshabilitado && <Contador n={noLeidosMensajes} activo={activo} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

interface Props extends NavProps {
  clienteData: any;
  onLogout: () => void;
}

/** Menú lateral del perfil en escritorio. */
export default function ProfileSidebar({
  clienteData,
  activeTab,
  setActiveTab,
  onLogout,
  bloqueado = false,
  noLeidosMensajes = 0,
}: Props) {
  return (
    <div className="sticky top-24 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm lg:block">
      <div className="p-3">
        <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tu cuenta</p>
        {bloqueado && (
          <p className="mb-2 rounded-lg bg-primary/5 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            Guarda un método de pago para desbloquear el resto de tu perfil.
          </p>
        )}
        <nav className="space-y-0.5" aria-label="Secciones de tu perfil">
          {PERFIL_TABS.map((tab) => {
            const activo = activeTab === tab.id;
            const deshabilitado = bloqueado && tab.id !== "metodos-pago";
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => !deshabilitado && setActiveTab(tab.id)}
                disabled={deshabilitado}
                aria-current={activo ? "page" : undefined}
                title={deshabilitado ? "Guarda un método de pago para desbloquear esta sección" : undefined}
                className={`relative flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  deshabilitado
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : activo
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {activo && !deshabilitado && (
                  <motion.span
                    layoutId="perfil-tab-activa"
                    className="absolute inset-0 rounded-xl bg-primary shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <tab.icon className="relative h-4 w-4 shrink-0" />
                <span className="relative flex-1 text-left">{tab.label}</span>
                {tab.id === "mensajes" && !deshabilitado && (
                  <span className="relative">
                    <Contador n={noLeidosMensajes} activo={activo} />
                  </span>
                )}
                {deshabilitado ? (
                  <Lock className="relative h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronRight className={`relative h-4 w-4 shrink-0 ${activo ? "opacity-80" : "opacity-40"}`} />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {clienteData && (clienteData.correo || clienteData.celular || clienteData.ciudad) && (
        <div className="space-y-2 border-t border-border px-6 py-4 text-xs text-muted-foreground">
          {clienteData.correo && (
            <p className="flex items-center gap-2.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{clienteData.correo}</span>
            </p>
          )}
          {clienteData.celular && (
            <p className="flex items-center gap-2.5">
              <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
              {clienteData.celular}
            </p>
          )}
          {clienteData.ciudad && (
            <p className="flex items-center gap-2.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">
                {clienteData.ciudad}
                {clienteData.pais ? `, ${clienteData.pais}` : ""}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
