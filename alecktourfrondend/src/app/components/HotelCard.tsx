import {
  Baby,
  Car,
  Check,
  ChevronRight,
  Dice5,
  Dumbbell,
  ExternalLink,
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
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:flex-row">
        <div className="h-[180px] w-full animate-pulse bg-muted md:h-[188px] md:w-[224px]" />

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
      .slice(0, 3) ?? [];

  // Desayuno incluido: derivado de una característica real del hotel (no un
  // badge fijo) — solo aparece si el hotel realmente la tiene registrada.
  const desayunoIncluido = hotel.hotel_caracteristicas?.some(
    (hc) =>
      hc.disponible &&
      hc.caracteristica?.nombre_caracteristica.toLowerCase().includes("desayuno")
  );

  // Calificación real de clientes (tabla `resenas`) si ya existe alguna;
  // si no, se usa la calificación fija del hotel como respaldo — nunca un
  // número inventado.
  const calificacionBase = hotel.calificacion_promedio ?? hotel.calificacion;

  // Sin calificación real (ni reseñas ni calificación del hotel) no se
  // muestra ningún puntaje: antes salía "8.0 Excelente" y 4 estrellas
  // inventados para cualquier hotel nuevo.
  const tieneCalificacion = calificacionBase != null && calificacionBase > 0;
  const rating = tieneCalificacion ? calificacionBase * 2 : 0;

  // Etiqueta comercial estilo Despegar derivada del rating real del hotel
  // (nunca un texto fijo): a mayor calificación, mejor palabra en la escala.
  const ratingLabel =
    rating >= 9
      ? "Excepcional"
      : rating >= 8
        ? "Excelente"
        : rating >= 7
          ? "Muy bueno"
          : rating >= 6
            ? "Bueno"
            : "Aceptable";

  const estrellas = tieneCalificacion ? Math.min(Math.max(Math.round(calificacionBase), 1), 5) : 0;

  // Urgencia de disponibilidad: siempre calculada de las habitaciones reales
  // del hotel, nunca un "-23%" o "mejor precio" fijo sin base real.
  const disponibilidad =
    habitacionesDisponibles.length === 0
      ? { texto: "Sin disponibilidad", clase: "bg-muted text-muted-foreground" }
      : habitacionesDisponibles.length <= 3
        ? {
            texto: `Solo quedan ${habitacionesDisponibles.length} habitaci${
              habitacionesDisponibles.length === 1 ? "ón" : "ones"
            }`,
            clase: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
          }
        : {
            texto: "Disponible",
            clase: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
          };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${hotel.nombre_hotel} ${hotel.ciudad ?? ""} ${hotel.pais ?? ""}`
  )}`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      whileHover={{ y: -3, transition: { duration: 0.25 } }}
      className="
        group
        flex
        w-full
        flex-col
        overflow-hidden
        rounded-2xl
        border
        border-border
        bg-card
        shadow-sm
        transition-shadow
        hover:shadow-lg
        md:flex-row
      "
    >
      {/* ============================================ */}
      {/* IMAGEN */}
      {/* ============================================ */}
      <Link
        to={`/hotel/${hotel.id_hotel}${searchQuery}`}
        className="relative block h-[180px] w-full shrink-0 overflow-hidden bg-muted md:h-[188px] md:w-[224px]"
      >
        <motion.img
          src={imagen}
          alt={hotel.nombre_hotel}
          whileHover={{ scale: 1.06 }}
          transition={{ duration: 0.6 }}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
          }}
        />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary shadow-sm backdrop-blur">
            Hotel
          </span>

          {desayunoIncluido && (
            <span className="rounded-full bg-[#008f6b] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
              Desayuno incluido
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorito(hotel.id_hotel);
          }}
          disabled={loadingIds.has(hotel.id_hotel)}
          className={`
            absolute
            right-3
            top-3
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-full
            bg-white/90
            shadow-md
            backdrop-blur
            transition
            hover:bg-white
            disabled:opacity-60
            ${isFavorito(hotel.id_hotel) ? "text-primary" : "text-muted-foreground hover:text-primary"}
          `}
          aria-label={isFavorito(hotel.id_hotel) ? "Quitar de favoritos" : "Agregar a favoritos"}
          aria-pressed={isFavorito(hotel.id_hotel)}
        >
          <Heart className={`h-4 w-4 ${isFavorito(hotel.id_hotel) ? "fill-current" : ""}`} />
        </button>
      </Link>

      {/* ============================================ */}
      {/* INFO + PRECIO */}
      {/* ============================================ */}
      <div className="flex flex-1 flex-col gap-3 p-4 md:flex-row md:items-stretch">
        {/* -------- INFO COMERCIAL -------- */}
        <div className="min-w-0 flex-1">
          <Link to={`/hotel/${hotel.id_hotel}${searchQuery}`} className="block">
            <h3 className="text-base font-bold leading-tight text-foreground group-hover:text-primary transition-colors">
              {hotel.nombre_hotel}
            </h3>
          </Link>

          <div className="mt-1.5 flex items-center gap-2">
            {tieneCalificacion ? (
              <>
                <span className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                  {rating.toFixed(1)}
                </span>
                <span className="text-xs font-semibold text-foreground">{ratingLabel}</span>
              </>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">Aún sin calificaciones</span>
            )}

            {hotel.total_resenas > 0 && (
              <span className="text-xs text-muted-foreground">({hotel.total_resenas})</span>
            )}

            <div className="ml-1 flex items-center gap-0.5">
              {Array.from({ length: estrellas }, (_, i) => (
                <Star key={i} className="h-3 w-3 fill-gold text-gold" />
              ))}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              {hotel.direccion ? `${hotel.direccion} · ` : ""}
              {hotel.ciudad}
              {hotel.pais ? `, ${hotel.pais}` : ""}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(mapsUrl, "_blank", "noopener,noreferrer");
              }}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Ver en mapa
            </button>
          </div>

          <div className="mt-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${disponibilidad.clase}`}
            >
              <Check className="h-3 w-3" />
              {disponibilidad.texto}
            </span>

            {habitacionDestacada && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Users className="h-3 w-3" />
                Hasta {habitacionDestacada.tipo_habitacion?.capacidad_personas ?? 2} personas
              </span>
            )}
          </div>

          {caracteristicas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {caracteristicas.map((hc) => {
                const nombre = hc.caracteristica!.nombre_caracteristica;
                const Icon = CARACTERISTICA_ICONS[nombre];

                return (
                  <span
                    key={hc.id_caracteristica}
                    className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground"
                  >
                    {Icon ? (
                      <Icon className="h-3 w-3 text-primary" />
                    ) : (
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    )}
                    {nombre}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* -------- PRECIO / CTA -------- */}
        <div className="flex shrink-0 flex-row items-end justify-between gap-3 border-t border-border pt-3 md:w-[152px] md:flex-col md:items-end md:justify-start md:gap-4 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          {precioMin ? (
            <div className="md:text-right">
              <p className="text-[10px] text-muted-foreground">Desde · por noche</p>

              <div className="flex items-baseline gap-1 md:justify-end">
                <span className="text-sm font-medium text-foreground">$</span>
                <span className="text-lg font-extrabold tracking-tight text-primary">
                  {precioMin.toLocaleString("es-CO")}
                </span>
              </div>

              <p className="text-[10px] text-muted-foreground">
                {habitacionDestacada?.tipo_habitacion?.nombre_tipo ?? "Habitación estándar"}
              </p>
            </div>
          ) : (
            <p className="text-xs font-medium text-muted-foreground md:text-right">
              Consulta otras fechas
            </p>
          )}

          <Link
            to={`/hotel/${hotel.id_hotel}${searchQuery}`}
            className="flex items-center gap-1 whitespace-nowrap rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Ver hotel
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
