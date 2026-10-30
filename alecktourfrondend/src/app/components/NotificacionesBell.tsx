import { Bell, Calendar, CircleCheck, Loader2, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ActividadClienteItem,
  notificacionService,
} from "../services/notificacion.service";

interface Props {
  idCliente: number;
}

const TIPO_ICON: Record<string, typeof Calendar> = {
  reserva: Calendar,
  cancelacion: XCircle,
  pago: CircleCheck,
};

// Mismo cálculo de tiempo relativo que ya usa ModuleNotificaciones.tsx del
// admin — duplicado acá porque es un componente público (no importa nada
// desde components/admin) y es una función pura sin estado que compartir.
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
  return new Date(fechaISO).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function claveUltimaVista(idCliente: number) {
  return `notif_ultima_vista_${idCliente}`;
}

// Campana de notificaciones del cliente autenticado: une cambios de estado
// de sus reservas y resoluciones de sus solicitudes de cancelación (ver
// GET /clientes/{id}/actividad). El conteo de "no leídas" no depende de
// ninguna columna nueva en la base de datos — se compara la fecha de cada
// item contra la última vez que ESTE navegador abrió la campana, guardada
// en localStorage (por eso es por dispositivo, no una bandeja del servidor).
export default function NotificacionesBell({ idCliente }: Props) {
  const [items, setItems] = useState<ActividadClienteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [ultimaVista, setUltimaVista] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      setUltimaVista(localStorage.getItem(claveUltimaVista(idCliente)));
    } catch {
      setUltimaVista(null);
    }
    notificacionService
      .getActividadCliente(idCliente)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [idCliente]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const noLeidas = ultimaVista
    ? items.filter((i) => new Date(i.fecha).getTime() > new Date(ultimaVista).getTime()).length
    : items.length;

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && items.length > 0) {
      const masReciente = items[0].fecha;
      try {
        localStorage.setItem(claveUltimaVista(idCliente), masReciente);
      } catch {
        // localStorage puede fallar en modo incógnito estricto — no es
        // crítico, solo se pierde el "ya visto" en ese navegador.
      }
      setUltimaVista(masReciente);
    }
  };

  const irAReserva = (idReferencia: number) => {
    setOpen(false);
    navigate("/profile", { state: { tab: "reservas", reservaId: idReferencia } });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        title="Notificaciones"
        className="relative w-10 h-10 flex items-center justify-center rounded-xl border border-border/60 hover:bg-muted text-foreground transition-all"
      >
        <Bell className="w-4.5 h-4.5" />
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute top-full right-0 mt-2 w-[320px] bg-card text-card-foreground rounded-2xl shadow-2xl shadow-black/10 border border-border/60 overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-border/60">
              <p className="text-sm font-bold text-foreground">Notificaciones</p>
            </div>

            {loading ? (
              <div className="py-8 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                No tienes notificaciones nuevas.
              </p>
            ) : (
              <ul className="max-h-96 overflow-y-auto divide-y divide-border/50">
                {items.slice(0, 8).map((item, i) => {
                  const Icon = TIPO_ICON[item.tipo] ?? Bell;
                  return (
                    <li key={`${item.tipo}-${item.id_referencia}-${i}`}>
                      <button
                        onClick={() => irAReserva(item.id_referencia)}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground leading-snug">
                            {item.titulo}
                          </p>
                          {item.mensaje && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {item.mensaje}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {tiempoRelativo(item.fecha)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              onClick={() => {
                setOpen(false);
                navigate("/profile", { state: { tab: "reservas" } });
              }}
              className="w-full px-4 py-2.5 text-xs font-semibold text-primary hover:bg-primary/5 border-t border-border/60 transition-colors"
            >
              Ver todas en Mi perfil
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
