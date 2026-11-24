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
import EncabezadoTab, { PanelPerfil, VacioPerfil } from "./EncabezadoTab";
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
    <div className="w-full">
      {/* ── Header de Sección ── */}
      <EncabezadoTab
        titulo="Preferencias de viaje"
        descripcion="Con tus gustos te recomendamos hoteles y paquetes que de verdad van contigo."
        accion={
          <Link
            to="/preferences"
            state={{ preferencias }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <PenSquare className="h-4 w-4" />
            {preferencias ? "Actualizar" : "Completar"}
          </Link>
        }
      />

      {/* ── Estado Vacío (Sin Preferencias) ── */}
      {!preferencias ? (
        <PanelPerfil>
          <VacioPerfil
            icono={Heart}
            titulo="Cuéntanos cómo te gusta viajar"
            texto="Tres pasos cortos: tu tipo de viaje, tu presupuesto y lo que no puede faltar. Con eso te recomendamos mejor."
            accion={
              <Link
                to="/preferences"
                state={{ preferencias }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                Empezar ahora
              </Link>
            }
          />
        </PanelPerfil>
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
