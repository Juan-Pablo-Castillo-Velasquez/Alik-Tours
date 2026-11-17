import { ArrowRight, Clock, MapPin, Package as PackageIcon } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { resolveFotoUrl } from "./admin/types";
import { PaqueteResponse } from "../services/paquete.service";
import AdornoTarjeta from "./temporada/AdornoTarjeta";
import { getCityImage, getDefaultImage } from "../utils/cityImages";

interface PackageResultCardProps {
  pkg: PaqueteResponse;
  index?: number;
}

// La API no guarda foto para paquetes, así que usamos el mismo pool de fotos
// reales por ciudad centralizado en utils/cityImages.ts (nunca inventamos una
// URL de imagen que "parezca" pertenecer al paquete).
const DEFAULT_IMAGE = getDefaultImage({ width: 800 });

function getImage(ciudad?: string | null) {
  if (!ciudad) return DEFAULT_IMAGE;
  return getCityImage(ciudad, { width: 800 });
}

export default function PackageResultCard({ pkg, index = 0 }: PackageResultCardProps) {
  // Portada real del paquete (POST /paquetes/{id}/imagen) tiene prioridad
  // -- antes Paquete no tenía ningún campo de imagen propio y esta tarjeta
  // siempre usaba una foto genérica por ciudad (que se mantiene como
  // respaldo para paquetes sin portada propia todavía).
  const imagen = resolveFotoUrl(pkg.imagen_url) ?? getImage(pkg.ciudad_destino ?? pkg.ciudad_salida);
  const ruta =
    pkg.ciudad_salida && pkg.ciudad_destino && pkg.ciudad_salida !== pkg.ciudad_destino
      ? `${pkg.ciudad_salida} → ${pkg.ciudad_destino}`
      : (pkg.ciudad_destino ?? pkg.ciudad_salida ?? "Colombia");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
    >
      <Link
        to={`/package/${pkg.id_paquete}`}
        className="group block h-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-xl"
      >
        <div className="relative h-44 overflow-hidden bg-muted">
          <img loading="lazy" decoding="async"
            src={imagen}
            alt={ruta}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
            }}
          />
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary shadow-sm backdrop-blur">
            <PackageIcon className="h-3 w-3" />
            Paquete
          </span>
          <AdornoTarjeta insignia />
        </div>

        <div className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{ruta}</span>
          </div>

          <h3 className="mt-1 text-base font-bold leading-tight text-foreground group-hover:text-primary transition-colors">
            {pkg.nombre_paquete}
          </h3>

          {pkg.duracion_dias > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {pkg.duracion_dias} {pkg.duracion_dias === 1 ? "día" : "días"}
            </div>
          )}

          <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Desde · por persona</p>
              <p className="text-lg font-extrabold tracking-tight text-primary">
                ${pkg.precio_base.toLocaleString("es-CO")}
              </p>
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-primary transition-transform group-hover:translate-x-0.5">
              Ver paquete
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
