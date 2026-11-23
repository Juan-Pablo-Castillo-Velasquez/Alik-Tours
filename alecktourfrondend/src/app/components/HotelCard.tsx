import {
  Baby,
  BedDouble,
  Camera,
  Car,
  Check,
  Coffee,
  ChevronRight,
  Dice5,
  Dumbbell,
  ExternalLink,
  Flame,
  Heart,
  MapPin,
  PawPrint,
  PlaneTakeoff,
  Sparkles,
  Star,
  Users,
  UtensilsCrossed,
  Waves,
  Wine,
} from "lucide-react";
import AdornoTarjeta from "./temporada/AdornoTarjeta";
import { motion } from "motion/react";
import { Link, useSearchParams } from "react-router";
import { HotelDetailResponse } from "../services/hotel.service";
import { useFavoritos } from "../context/FavoritosContext";
import { resolveFotoUrl } from "./admin/types";
import { getCityImage, getDefaultImage } from "../utils/cityImages";

interface HotelCardProps {
  hotel?: HotelDetailResponse;
  index?: number;
}

const CARACTERISTICA_ICONS: Record<string, React.ElementType> = {
  "Piscina al aire libre": Waves,
  Gimnasio: Dumbbell,
  "Spa y masajes": Sparkles,
  "Restaurante buffet": UtensilsCrossed,
  "Parqueadero gratuito": Car,
  "Pet Friendly": PawPrint,
  Casino: Dice5,
  Guardería: Baby,
  "Traslado al aeropuerto": PlaneTakeoff,
  "Bar en la azotea": Wine,
};

// Mapa de fotos por ciudad centralizado en utils/cityImages.ts (antes esta
// tarjeta tenía su propia copia incompleta, sin Salento/Villa de Leyva/
// Barranquilla, pese a que ya hay hoteles reales sembrados en esas
// ciudades -- ver el comentario de ese archivo).
const DEFAULT_IMAGE = getDefaultImage({ width: 1000, quality: 85 });

function getHotelImage(ciudad?: string): string {
  return getCityImage(ciudad, { width: 1000, quality: 85 });
}

function getPrecioMinimo(hotel: HotelDetailResponse): number | null {
  const disponibles =
    hotel.habitaciones?.filter(
      (habitacion) => habitacion.estado?.toLowerCase() === "disponible"
    ) ?? [];

  if (!disponibles.length) {
    return null;
  }

  return Math.min(...disponibles.map((habitacion) => habitacion.precio_noche));
}

export default function HotelCard({ hotel, index = 0 }: HotelCardProps) {
  const { isFavorito, toggleFavorito, loadingIds } = useFavoritos();

  // Propaga las fechas/huéspedes de la búsqueda al detalle del hotel (y de
  // ahí a Checkout — ver HotelDetail.tsx/Checkout.tsx). Antes se perdían al
  // hacer clic en un resultado y había que volver a escribirlas en
  // Checkout. Cuando HotelCard se usa fuera de /search (ej. favoritos) esta
  // query string simplemente viene vacía, sin efecto.
  const [searchParams] = useSearchParams();
  const searchQuery = (() => {
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const people = searchParams.get("people");
    if (!start && !end && !people) return "";
    const p = new URLSearchParams();
    if (start) p.set("start", start);
    if (end) p.set("end", end);
    if (people) p.set("people", people);
    return `?${p.toString()}`;
  })();

  /*
   * Protección importante:
   * mientras la información del hotel todavía está
   * llegando desde la API, no intentamos acceder a
   * hotel.ciudad, hotel.habitaciones, etc.
   */
  if (!hotel) {
    return (
      <div className="flex w-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm md:flex-row">
        <div className="h-[180px] w-full animate-pulse bg-muted md:h-[232px] md:w-[300px]" />

        <div className="flex-1 space-y-3 p-5">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  // Foto real del hotel si el admin ya subió una (ver POST
  // /hoteles/{id}/imagen) — si no, se sigue usando la imagen genérica
  // por ciudad como respaldo, igual que antes.
  const imagen = (hotel.imagen_url && resolveFotoUrl(hotel.imagen_url)) || getHotelImage(hotel.ciudad);

  const precioMin = getPrecioMinimo(hotel);

  const habitacionesDisponibles =
    hotel.habitaciones?.filter(
      (habitacion) => habitacion.estado?.toLowerCase() === "disponible"
    ) ?? [];

  const habitacionDestacada =
    habitacionesDisponibles.length > 0
      ? habitacionesDisponibles.reduce((prev, current) =>
          current.precio_noche < prev.precio_noche ? current : prev
        )
      : null;

  const caracteristicas =
    hotel.hotel_caracteristicas
      ?.filter((hc) => hc.disponible && hc.caracteristica)
      .slice(0, 4) ?? [];

  // Desayuno incluido: derivado de una característica real del hotel (no un
  // badge fijo) — solo aparece si el hotel realmente la tiene registrada.
  const desayunoIncluido = hotel.hotel_caracteristicas?.some(
    (hc) =>
      hc.disponible &&
      hc.caracteristica?.nombre_caracteristica.toLowerCase().includes("desayuno")
  );

  // Puntaje de huéspedes: SOLO de reseñas reales (tabla `resenas`). Antes,
  // sin reseñas, se tomaba la categoría del hotel (sus estrellas) × 2 y se
  // mostraba como "10.0 Excepcional", como si lo hubieran calificado
  // clientes. La categoría se muestra aparte, como estrellas.
  const puntaje = hotel.calificacion_promedio != null ? hotel.calificacion_promedio * 2 : null;
  const etiquetaPuntaje =
    puntaje == null
      ? null
      : puntaje >= 9
        ? "Excepcional"
        : puntaje >= 8
          ? "Excelente"
          : puntaje >= 7
            ? "Muy bueno"
            : puntaje >= 6
              ? "Bueno"
              : "Aceptable";

  // Categoría del hotel (estrellas que fija el hotel), no una opinión.
  const estrellas =
    hotel.calificacion != null && hotel.calificacion > 0
      ? Math.min(Math.max(Math.round(hotel.calificacion), 1), 5)
      : 0;

  const capacidad = habitacionDestacada?.tipo_habitacion?.capacidad_personas ?? null;
  const totalFotos = 1 + (hotel.imagenes?.length ?? 0);
  const caracteristicasExtra =
    (hotel.hotel_caracteristicas?.filter((hc) => hc.disponible && hc.caracteristica).length ?? 0) -
    caracteristicas.length;

  // Urgencia de disponibilidad: siempre calculada de las habitaciones reales
  // del hotel, nunca un "-23%" o "mejor precio" fijo sin base real.
  const quedan = habitacionesDisponibles.length;
  const disponibilidad =
    quedan === 0
      ? { texto: "Sin habitaciones libres", clase: "bg-muted text-muted-foreground", urgente: false }
      : quedan <= 3
        ? {
            texto: `Solo ${quedan === 1 ? "queda 1 habitación" : `quedan ${quedan} habitaciones`}`,
            clase: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
            urgente: true,
          }
        : {
            texto: "Hay disponibilidad",
            clase: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
            urgente: false,
          };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${hotel.nombre_hotel} ${hotel.ciudad ?? ""} ${hotel.pais ?? ""}`
  )}`;
  const enlace = `/hotel/${hotel.id_hotel}${searchQuery}`;
  const favorito = isFavorito(hotel.id_hotel);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      className="group relative flex w-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 md:flex-row"
    >
      {/* ================= FOTO ================= */}
      <Link
        to={enlace}
        className="relative block h-52 w-full shrink-0 overflow-hidden bg-muted md:h-auto md:min-h-[232px] md:w-[300px]"
        aria-label={`Ver ${hotel.nombre_hotel}`}
      >
        <img
          src={imagen}
          alt={hotel.nombre_hotel}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
        <AdornoTarjeta />

        {desayunoIncluido && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow">
            <Coffee className="h-3 w-3" /> Desayuno incluido
          </span>
        )}

        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 text-white">
          <span className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold drop-shadow">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{hotel.ciudad}</span>
          </span>
          {totalFotos > 1 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
              <Camera className="h-3 w-3" /> {totalFotos} fotos
            </span>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={() => toggleFavorito(hotel.id_hotel)}
        disabled={loadingIds.has(hotel.id_hotel)}
        className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md transition hover:scale-105 disabled:opacity-60 md:left-[252px] md:right-auto ${
          favorito ? "text-primary" : "text-neutral-500 hover:text-primary"
        }`}
        aria-label={favorito ? "Quitar de favoritos" : "Agregar a favoritos"}
        aria-pressed={favorito}
      >
        <Heart className={`h-4 w-4 ${favorito ? "fill-current" : ""}`} />
      </button>

      {/* ================= INFORMACIÓN ================= */}
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {estrellas > 0 && (
              <div className="mb-1 flex items-center gap-1.5" title={`Hotel de ${estrellas} estrellas`}>
                <span className="flex gap-0.5" aria-hidden="true">
                  {Array.from({ length: estrellas }, (_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-gold text-gold" />
                  ))}
                </span>
                <span className="sr-only">Hotel de {estrellas} estrellas</span>
              </div>
            )}
            <Link to={enlace}>
              <h3
                className="text-xl leading-tight text-foreground transition-colors group-hover:text-primary"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}
              >
                {hotel.nombre_hotel}
              </h3>
            </Link>
          </div>

          {puntaje != null ? (
            <div className="flex shrink-0 items-center gap-2 text-right">
              <div className="leading-tight">
                <p className="text-sm font-bold text-foreground">{etiquetaPuntaje}</p>
                <p className="text-[11px] text-muted-foreground">
                  {hotel.total_resenas} {hotel.total_resenas === 1 ? "reseña" : "reseñas"}
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl rounded-bl-sm bg-primary text-sm font-extrabold text-primary-foreground">
                {puntaje.toFixed(1)}
              </span>
            </div>
          ) : (
            <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Aún sin reseñas
            </span>
          )}
        </div>

        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            {hotel.direccion ? `${hotel.direccion} · ` : ""}
            {hotel.ciudad}
            {hotel.pais ? `, ${hotel.pais}` : ""}
          </span>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Ver en mapa <ExternalLink className="h-3 w-3" />
          </a>
        </p>

        {caracteristicas.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Servicios del hotel">
            {caracteristicas.map((hc) => {
              const nombre = hc.caracteristica!.nombre_caracteristica;
              const Icon = CARACTERISTICA_ICONS[nombre] ?? Check;
              return (
                <li
                  key={hc.id_caracteristica}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-muted/70 px-2.5 py-1 text-[11px] font-medium text-foreground/80"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {nombre}
                </li>
              );
            })}
            {caracteristicasExtra > 0 && (
              <li className="inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground">
                +{caracteristicasExtra} más
              </li>
            )}
          </ul>
        )}

        {/* -------- Habitación y precio -------- */}
        <div className="mt-auto pt-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${disponibilidad.clase}`}
              >
                {disponibilidad.urgente ? <Flame className="h-3 w-3" /> : <BedDouble className="h-3 w-3" />}
                {disponibilidad.texto}
              </span>
              {habitacionDestacada ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BedDouble className="h-3.5 w-3.5" />
                  {habitacionDestacada.tipo_habitacion?.nombre_tipo ?? "Habitación"}
                  {capacidad != null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <Users className="h-3.5 w-3.5" />
                      {capacidad === 1 ? "1 persona" : `hasta ${capacidad} personas`}
                    </>
                  )}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">Consulta otras fechas o escríbele a un asesor.</p>
              )}
            </div>

            <div className="flex items-end justify-between gap-4 sm:justify-end">
              {precioMin != null && (
                <div className="text-left sm:text-right">
                  <p className="text-[11px] text-muted-foreground">Desde</p>
                  <p className="text-2xl font-extrabold leading-none tracking-tight text-foreground">
                    ${precioMin.toLocaleString("es-CO")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">por noche</p>
                </div>
              )}
              <Link
                to={enlace}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/20 transition hover:opacity-90"
              >
                {precioMin != null ? "Ver habitaciones" : "Ver hotel"}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
