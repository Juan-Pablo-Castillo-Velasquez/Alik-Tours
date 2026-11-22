import {
  Clock,
  Coffee,
  Compass,
  CreditCard,
  Heart,
  MapPin,
  Mountain,
  Music,
  Palmtree,
  PenSquare,
  Plane,
  Sparkles,
  User,
  Utensils,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { preferenciasService } from "../../services/preferencias.service";
import type { HotelDetailResponse } from "../../services/hotel.service";
import HotelCard from "../HotelCard";
import { etiquetaPreferencia } from "../preferences.data";

// ── Mapeos de Negocio ──────────────────────────────────────────────────────
const interesIcons: Record<string, any> = {
  beach: Palmtree,
  nature: Mountain,
  culture: Music,
  food: Utensils,
  adventure: Compass,
  wellness: Coffee,
};

const interesLabels: Record<string, string> = {
  beach: "Playa y Relax",
  nature: "Naturaleza",
  culture: "Cultura",
  food: "Gastronomía",
  adventure: "Aventura",
  wellness: "Bienestar",
};

interface Props {
  preferencias: any;
  idCliente?: number;
}

export default function TabPreferencias({ preferencias, idCliente }: Props) {
  const [hoteles, setHoteles] = useState<HotelDetailResponse[]>([]);
  const [cargandoSugerencias, setCargandoSugerencias] = useState(false);

  useEffect(() => {
    if (!preferencias || !idCliente) {
      setHoteles([]);
      return;
    }
    setCargandoSugerencias(true);
    preferenciasService
      .getSugerenciasHoteles(idCliente)
      .then(setHoteles)
      .catch(() => setHoteles([]))
      .finally(() => setCargandoSugerencias(false));
  }, [preferencias, idCliente]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* ── Header de Sección ── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b border-border/50 pb-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            Mis Preferencias
          </h2>
          <p className="text-muted-foreground text-sm md:text-base mt-2">
            Calibramos nuestro motor de recomendaciones basándonos en tu estilo
            de viaje.
          </p>
        </div>
        <Link
          to="/preferences"
          state={{ preferencias }}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold hover:shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 shrink-0"
        >
          <PenSquare className="w-4 h-4" />
          <span>{preferencias ? "Actualizar perfil" : "Completar perfil"}</span>
        </Link>
      </div>

      {/* ── Estado Vacío (Sin Preferencias) ── */}
      {!preferencias ? (
        <div className="bg-card/50 border-2 border-dashed border-border rounded-3xl p-12 md:p-16 text-center hover:bg-card/80 transition-colors duration-300">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Heart className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-foreground tracking-tight mb-2">
            Descubre tu viaje ideal
          </h3>
          <p className="text-base text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
            Aún no conocemos tus gustos. Cuéntanos qué te apasiona y deja que
            diseñemos la experiencia perfecta para ti.
          </p>
          <Link
            to="/preferences"
            state={{ preferencias }}
            className="inline-block px-8 py-3.5 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-md"
          >
            Configurar preferencias ahora
          </Link>
        </div>
      ) : (
        // ── Vista de Datos Estructurada ──
        <div className="space-y-8">
          {/* Bloque: Intereses Primarios */}
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm transition-colors duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Tus intereses principales
              </h3>
            </div>

            {preferencias.intereses && preferencias.intereses.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {preferencias.intereses.map((interes: string) => {
                  const Icon = interesIcons[interes] || Compass;
                  return (
                    <div
                      key={interes}
                      className="group flex items-center gap-2.5 px-5 py-2.5 bg-background border border-border hover:border-primary/30 rounded-full text-sm font-semibold text-foreground transition-all hover:shadow-sm cursor-default"
                    >
                      <Icon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                      <span>{interesLabels[interes] || interes}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic bg-background p-4 rounded-xl border border-border/50">
                No has seleccionado intereses específicos aún.
              </p>
            )}
          </div>

          {/* Bloque: Requerimientos y Parámetros Logísticos (Estilo Bento Box) */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[
              { label: "Compañía", value: etiquetaPreferencia("compania", preferencias.compania), icon: User },
              { label: "Presupuesto", value: etiquetaPreferencia("presupuesto", preferencias.presupuesto), icon: CreditCard },
              { label: "Clima ideal", value: etiquetaPreferencia("clima", preferencias.clima), icon: MapPin },
              { label: "Ritmo", value: etiquetaPreferencia("ritmo", preferencias.ritmo), icon: Clock },
              { label: "Transporte", value: etiquetaPreferencia("transporte", preferencias.transporte), icon: Plane },
            ]
              .filter((item) => item.value)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="group card-elevated p-6 cursor-default"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="icon-tile w-12 h-12 rounded-2xl flex items-center justify-center">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <span
                          className="block text-xs font-bold uppercase tracking-widest mb-1"
                          style={{ color: "var(--gold)" }}
                        >
                          {item.label}
                        </span>
                        <p className="font-bold text-foreground text-lg truncate">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Bloque: Hoteles sugeridos según preferencias */}
          {(cargandoSugerencias || hoteles.length > 0) && (
            <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Hoteles sugeridos para ti
                </h3>
              </div>

              {cargandoSugerencias ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-32 rounded-2xl bg-muted/40 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {hoteles.map((hotel, index) => (
                    <HotelCard key={hotel.id_hotel} hotel={hotel} index={index} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
