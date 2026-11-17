import { ArrowRight, Calendar, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import AdornoTarjeta from "./temporada/AdornoTarjeta";
import { motion } from "motion/react";
import { useRef } from "react";
import { Link } from "react-router";
import { PaqueteResponse } from "../services/paquete.service";
import { getCityImage, getDefaultImage } from "../utils/cityImages";

interface PaquetesDestacadosCarouselProps {
  paquetes: PaqueteResponse[];
}

const DEFAULT_IMAGE = getDefaultImage({ width: 900 });

function getImage(pkg: PaqueteResponse) {
  const ciudad = pkg.ciudad_destino ?? pkg.ciudad_salida;
  if (!ciudad) return DEFAULT_IMAGE;
  return getCityImage(ciudad, { width: 900 });
}

// Carrusel horizontal de paquetes destacados para el tope de /packages,
// inspirado en el carrusel "Paquetes imperdibles" de Despegar (tarjetas
// horizontales con foto + nombre + ruta + precio). A diferencia de esa
// referencia, NO mostramos ninguna insignia de descuento tipo "Ahorras $X":
// Paquete no guarda un precio "original" en la base de datos, así que
// inventar uno sería un dato falso -- el carrusel vende con diseño e
// imágenes reales, no con descuentos que no existen.
export default function PaquetesDestacadosCarousel({ paquetes }: PaquetesDestacadosCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (paquetes.length === 0) return null;

  const desplazar = (direccion: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const tarjeta = track.querySelector<HTMLElement>("[data-tarjeta]");
    const ancho = tarjeta ? tarjeta.offsetWidth + 16 : 300;
    track.scrollBy({ left: direccion * ancho * 2, behavior: "smooth" });
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-px w-8 bg-gold" />
            <span className="text-primary text-[11px] font-bold uppercase tracking-[0.2em]">
              Paquetes destacados
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            Los favoritos de nuestros viajeros
          </h2>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => desplazar(-1)}
            aria-label="Ver paquetes anteriores"
            className="h-9 w-9 flex items-center justify-center rounded-full border border-border bg-card text-foreground hover:border-primary/40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => desplazar(1)}
            aria-label="Ver más paquetes"
            className="h-9 w-9 flex items-center justify-center rounded-full border border-border bg-card text-foreground hover:border-primary/40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {paquetes.map((pkg, index) => {
          const ruta =
            pkg.ciudad_salida && pkg.ciudad_destino && pkg.ciudad_salida !== pkg.ciudad_destino
              ? `${pkg.ciudad_salida} → ${pkg.ciudad_destino}`
              : (pkg.ciudad_destino ?? pkg.ciudad_salida ?? "Colombia");

          return (
            <motion.div
              key={pkg.id_paquete}
              data-tarjeta
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="snap-start shrink-0 w-[78vw] sm:w-72"
            >
              <Link
                to={`/package/${pkg.id_paquete}`}
                className="group relative block h-80 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow"
              >
                <img loading="lazy" decoding="async"
                  src={getImage(pkg)}
                  alt={pkg.nombre_paquete}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/0" />
                <AdornoTarjeta />

                <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-primary shadow-sm">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="max-w-[9rem] truncate">{ruta}</span>
                </span>

                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  {pkg.duracion_dias > 0 && (
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-white/80">
                      <Calendar className="h-3.5 w-3.5" />
                      {pkg.duracion_dias} {pkg.duracion_dias === 1 ? "día" : "días"}
                    </div>
                  )}
                  <h3 className="text-base font-bold leading-tight mb-1.5 line-clamp-2">
                    {pkg.nombre_paquete}
                  </h3>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-white/70">Desde · por persona</p>
                      <p className="text-lg font-extrabold text-gold">
                        ${pkg.precio_base.toLocaleString("es-CO")}
                      </p>
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-transform group-hover:translate-x-0.5 group-hover:bg-white/25">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
