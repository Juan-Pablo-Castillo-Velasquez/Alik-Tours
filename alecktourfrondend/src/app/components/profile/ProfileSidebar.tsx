import {
  Calendar,
  ChevronRight,
  Heart,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  Receipt,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  User,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { resolveFotoUrl } from "../admin/types";
import { mensajeChatService } from "../../services/mensajeChat.service";
const tabs = [
  { id: "reservas", label: "Mis Reservas", icon: Calendar },
  { id: "favoritos", label: "Favoritos", icon: Heart },
  { id: "mensajes", label: "Mensajes", icon: MessageCircle },
  { id: "facturas", label: "Comprobantes", icon: Receipt },
  { id: "metodos-pago", label: "Métodos de Pago", icon: Wallet },
  { id: "preferencias", label: "Preferencias", icon: SlidersHorizontal },
  { id: "cuenta", label: "Mi Cuenta", icon: Settings },
];

interface Props {
  usuario: any;
  clienteData: any;
  reservas: any[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  // Cuando es true (ver requiereMetodoPago en Profile.tsx), todas las
  // pestañas salvo "metodos-pago" se muestran deshabilitadas -- el cliente
  // debe guardar un método de pago antes de poder navegar al resto de su
  // perfil.
  bloqueado?: boolean;
}

export default function ProfileSidebar({
  usuario,
  clienteData,
  reservas,
  activeTab,
  setActiveTab,
  onLogout,
  bloqueado = false,
}: Props) {
  // Badge de mensajes no leídos junto al tab -- polling propio (18s),
  // mismo criterio autosuficiente que el badge equivalente de
  // AdminSidebar.tsx.
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

  const totalViajes = reservas.filter((r) => r.estado === "finalizada").length;
  const proximaReserva = reservas
    .filter(
      (r) => r.estado !== "cancelada" && new Date(r.fecha_inicio) >= new Date(),
    )
    .sort(
      (a, b) =>
        new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime(),
    )[0];

  return (
    <div className="bg-card text-card-foreground rounded-xl shadow-md border border-border overflow-hidden sticky top-24 transition-colors duration-200 lg:max-h-[calc(100vh-7rem)] flex flex-col">
      {/* ── Banner Sutil Superior ── */}
      <div className="h-16 bg-primary/10 border-b border-border relative shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
      </div>

      <div className="px-4 pb-4 flex flex-col flex-1 min-h-0">
        {/* Avatar Integrado -- si la cuenta no está verificada (admin la
            marcó así desde ModuleUsuarios.tsx, ver Profile.tsx que
            resincroniza esto al entrar) se oculta cualquier foto propia y
            se muestra el ícono genérico, en vez de seguir mostrando una
            foto personalizada de una cuenta que quedó sin verificar. */}
        <div className="-mt-10 mb-3 flex justify-center">
          <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center ring-4 ring-background shadow-md border border-border overflow-hidden">
            {usuario?.foto_perfil && usuario?.verificado !== false ? (
              <img
                src={resolveFotoUrl(usuario.foto_perfil)}
                alt="Foto de perfil"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full m-1 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <User className="w-9 h-9" />
              </div>
            )}
          </div>
        </div>

        {usuario?.verificado === false && (
          <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium leading-snug">
              Cuenta sin verificar. Revisa tu correo para activarla o contacta a soporte.
            </p>
          </div>
        )}

        {/* Nombre y Tipo de Viajero */}
        <div className="text-center mb-5">
          <h2 className="text-base font-bold text-foreground tracking-tight leading-tight">
            {clienteData
              ? `${clienteData.nombre} ${clienteData.apellido}`
              : usuario?.username}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            @{usuario?.username || "viajero"}
          </p>
        </div>

        {/* Contadores Semánticos */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            {
              value: reservas.length,
              label: "Reservas",
              color: "text-foreground",
            },
            { value: totalViajes, label: "Viajes", color: "text-primary" },
            {
              value: reservas.filter((r) => r.estado === "pendiente").length,
              label: "Pendientes",
              color: "text-amber-600 dark:text-amber-400",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="stat-chip rounded-lg py-2 text-center"
            >
              <p className={`text-lg font-bold tracking-tight ${s.color}`}>
                {s.value}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Información de Contacto */}
        {clienteData && (
          <div className="space-y-2 mb-4 py-3 border-t border-b border-border/60">
            {clienteData.correo && (
              <div className="flex items-center gap-2.5 text-muted-foreground text-xs">
                <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{clienteData.correo}</span>
              </div>
            )}
            {clienteData.celular && (
              <div className="flex items-center gap-2.5 text-muted-foreground text-xs">
                <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{clienteData.celular}</span>
              </div>
            )}
            {clienteData.ciudad && (
              <div className="flex items-center gap-2.5 text-muted-foreground text-xs">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">
                  {clienteData.ciudad}, {clienteData.pais}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Próximo Viaje -- tarjeta clara con acento de marca (antes era un
            bloque sólido bg-primary de pared a pared; el color ahora vive
            solo en el ícono/etiqueta, igual que el resto de la sidebar). */}
        {proximaReserva && (
          <div className="bg-primary/8 rounded-xl p-3.5 mb-4 border border-primary/20">
            <div className="flex items-center gap-1.5 mb-1.5 text-primary">
              <Plane className="w-3.5 h-3.5 transform rotate-45" />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Próximo viaje
              </span>
            </div>
            <p className="text-sm font-bold tracking-tight text-foreground">
              Paquete #{proximaReserva.id_paquete}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              {new Date(proximaReserva.fecha_inicio).toLocaleDateString(
                "es-CO",
                { day: "numeric", month: "short" },
              )}
              {" → "}
              {new Date(proximaReserva.fecha_fin).toLocaleDateString("es-CO", {
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>
        )}

        {/* Menú de Pestañas con Navegación Corporativa */}
        {bloqueado && (
          <p className="text-[11px] text-center text-muted-foreground px-2 mb-2 leading-snug">
            Guarda un método de pago para desbloquear el resto de tu perfil.
          </p>
        )}
        <nav className="space-y-0.5 mb-3 overflow-y-auto flex-1 min-h-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const deshabilitado = bloqueado && tab.id !== "metodos-pago";
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (!deshabilitado) setActiveTab(tab.id);
                }}
                disabled={deshabilitado}
                title={deshabilitado ? "Guarda un método de pago para desbloquear esta sección" : undefined}
                className={`w-full flex items-center gap-3 px-3 py-1.5 min-h-[36px] rounded-lg text-sm font-medium transition-all duration-200 ${
                  deshabilitado
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : isActive
                      ? "bg-primary text-primary-foreground shadow-sm cursor-pointer"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                }`}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.id === "mensajes" && noLeidosMensajes > 0 && !deshabilitado && (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full flex-shrink-0 flex items-center justify-center ${
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-destructive text-destructive-foreground"
                    }`}
                  >
                    {noLeidosMensajes > 99 ? "99+" : noLeidosMensajes}
                  </span>
                )}
                {deshabilitado ? (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                ) : (
                  <ChevronRight
                    className={`w-4 h-4 transition-transform duration-200 ${isActive ? "rotate-90 text-primary-foreground" : "text-muted-foreground/50"}`}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Botón de Salida Destructivo */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 min-h-[40px] rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all duration-200 mt-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
