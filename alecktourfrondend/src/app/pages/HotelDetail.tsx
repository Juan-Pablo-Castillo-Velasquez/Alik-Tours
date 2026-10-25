import {
  ArrowLeft,
  Baby,
  Bed,
  CalendarDays,
  Car,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Dice5,
  Dumbbell,
  Heart,
  Info,
  MapPin,
  PawPrint,
  PlaneTakeoff,
  Quote,
  Share,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  UtensilsCrossed,
  Waves,
  Wine,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import CalendarioOcupacion from "../components/hotel/CalendarioOcupacion";
import Footer from "../components/Footer";
import HalloweenAccentDiscreto from "../components/HalloweenAccentDiscreto";
import Navbar from "../components/Navbar";
import { useFavoritos } from "../context/FavoritosContext";
import { useTema } from "../context/TemaContext";
import { resolveFotoUrl } from "../components/admin/types";
import { useSeoMeta } from "../hooks/useSeoMeta";
import {
  HabitacionResponse,
  HotelDetailResponse,
  HabitacionFechasOcupadas,
  hotelService,
} from "../services/hotel.service";
import { resenaService, ResenaResponse } from "../services/resena.service";
import { getCityImage, getDefaultImage } from "../utils/cityImages";
import ImageLightbox from "../components/ui/ImageLightbox";
import HotelCard from "../components/HotelCard";

// ── Mapa de íconos de características con colores semánticos basados en tu tema ──
const CARACTERISTICA_ICONS: Record<
  string,
  { icon: React.ElementType; color: string }
> = {
  "Piscina al aire libre": { icon: Waves, color: "text-primary" },
  Gimnasio: { icon: Dumbbell, color: "text-chart-1" },
  "Spa y masajes": { icon: Sparkles, color: "text-chart-5" },
  "Restaurante buffet": { icon: UtensilsCrossed, color: "text-chart-2" },
  "Parqueadero gratuito": { icon: Car, color: "text-muted-foreground" },
  "Pet Friendly": { icon: PawPrint, color: "text-chart-2" },
  Casino: { icon: Dice5, color: "text-destructive" },
  Guardería: { icon: Baby, color: "text-chart-5" },
  "Traslado al aeropuerto": { icon: PlaneTakeoff, color: "text-primary" },
  "Bar en la azotea": { icon: Wine, color: "text-destructive" },
};

// Mapa de fotos por ciudad centralizado en utils/cityImages.ts (antes
// cada página tenía su propia copia -- ver el comentario de ese archivo).
const DEFAULT_IMAGE = getDefaultImage({ width: 1200 });

// Galería de la ficha del hotel: antes eran 4 URLs genéricas IDÉNTICAS para
// TODOS los hoteles (GALLERY_FILLERS) -- una de ellas apuntaba a un ID de
// Unsplash que ya ni existe (404), lo que se veía como el ícono roto de
// "Instalaciones" que reportó el usuario. Ahora cada hotel arma su propia
// galería de 4 fotos reales, verificadas una por una abriéndolas antes de
// guardarlas (mismo criterio que las fotos principales, ver alembic/versions/
// 7972baf77f44_corregir_fotos_hoteles_demo.py):
//   1. Si ya se verificó una pareja de fotos propias de ese hotel
//      (HOTEL_EXTRA_PHOTOS), se usan primero.
//   2. El resto de la galería (o toda, si el hotel no tiene fotos propias)
//      se completa con AMENITY_POOL -- fotos reales de instalaciones de
//      hotel genéricas (piscina, restaurante, recepción, spa, gimnasio,
//      terraza), elegidas de forma determinística según id_hotel para que
//      cada hotel muestre siempre la misma combinación y hoteles distintos
//      no luzcan idénticos entre sí.
const AMENITY_POOL = [
  "https://images.unsplash.com/photo-1743525922686-badbeac16a34?w=800&q=80", // piscina
  "https://images.unsplash.com/photo-1695094411862-0e047fbddcb1?w=800&q=80", // restaurante
  "https://images.unsplash.com/photo-1660557989695-14fac79c086d?w=800&q=80", // recepción
  "https://images.unsplash.com/photo-1778331246390-2b91f56864e4?w=800&q=80", // spa
  "https://images.unsplash.com/photo-1716367840407-f9414a84b325?w=800&q=80", // gimnasio
  "https://images.unsplash.com/photo-1777113310184-140ff530f4dd?w=800&q=80", // terraza
];

const HOTEL_EXTRA_PHOTOS: Record<string, string[]> = {
  "Hotel Paraiso": [
    "https://images.unsplash.com/photo-1777169794972-12095816073b?w=800&q=80",
    "https://images.unsplash.com/photo-1777180249046-abf7d640e0d9?w=800&q=80",
  ],
  "Resort Sol y Arena": [
    "https://images.unsplash.com/photo-1729605411476-defbdab14c54?w=800&q=80",
    "https://images.unsplash.com/photo-1619329268107-5aba62ca4528?w=800&q=80",
  ],
  "Montana Magica": [
    "https://images.unsplash.com/photo-1696860740767-f4211c9209f4?w=800&q=80",
    "https://images.unsplash.com/photo-1783295541977-a3d9331e2378?w=800&q=80",
  ],
  "Gran Hotel Centro": [
    "https://images.unsplash.com/photo-1758193783649-13371d7fb8dd?w=800&q=80",
    "https://images.unsplash.com/photo-1744025098626-66c0b9cb1ba8?w=800&q=80",
  ],
  "Cabanas del Bosque": [
    "https://images.unsplash.com/photo-1782846484501-d4b1c5b57953?w=800&q=80",
  ],
};

function getGalleryImages(hotel: HotelDetailResponse): string[] {
  // Fotos reales subidas desde el admin (POST /hoteles/{id}/galeria) tienen
  // prioridad -- antes no existía ninguna forma de subir más de una foto
  // real por hotel, así que la galería siempre se rellenaba con fotos de
  // stock genéricas (ver HOTEL_EXTRA_PHOTOS/AMENITY_POOL abajo, que se
  // mantienen como respaldo para los hoteles sin galería propia todavía).
  if (hotel.imagenes && hotel.imagenes.length > 0) {
    return hotel.imagenes.map((img) => resolveFotoUrl(img.url) ?? img.url).slice(0, 4);
  }
  const propias = HOTEL_EXTRA_PHOTOS[hotel.nombre_hotel] ?? [];
  const faltan = 4 - propias.length;
  if (faltan <= 0) return propias.slice(0, 4);
  const inicio = hotel.id_hotel % AMENITY_POOL.length;
  const relleno: string[] = [];
  for (let i = 0; i < AMENITY_POOL.length && relleno.length < faltan; i++) {
    relleno.push(AMENITY_POOL[(inicio + i) % AMENITY_POOL.length]);
  }
  return [...propias, ...relleno];
}

// La API no guarda foto por habitación individual, así que usamos un pool
// determinístico de fotos de habitación reales (mismo id -> misma foto siempre).
const ROOM_IMAGES = [
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&q=80",
  "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80",
  "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80",
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80",
];

function getRoomImage(idHabitacion: number) {
  return ROOM_IMAGES[idHabitacion % ROOM_IMAGES.length];
}

function getImage(ciudad: string) {
  return getCityImage(ciudad, { width: 1200 });
}

// Estados mapeados usando opacidades de tus tokens globales o semánticos
const ESTADO_STYLES: Record<string, string> = {
  disponible:
    "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  ocupada: "bg-destructive/10 text-destructive border-destructive/20",
  mantenimiento: "bg-chart-2/10 text-chart-2 border-chart-2/20",
};

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// yyyy-mm-dd (fecha "pura", sin hora) → "10 jul" — evita Date() para no
// arriesgar un corrimiento de día por zona horaria.
function formatFechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]} ${MESES_CORTOS[Number(m[2]) - 1] ?? m[2]}`;
}

// yyyy-mm-dd... → "10 jul 2026" -- para reseñas sí importa el año (pueden
// ser de hace tiempo), a diferencia de las fechas de ocupación de arriba.
function formatFechaResena(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]} ${MESES_CORTOS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

export default function HotelDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { temaActivo } = useTema();
  const esHalloween = temaActivo?.clave === "halloween";
  const { isFavorito, toggleFavorito, loadingIds } = useFavoritos();
  const [hotel, setHotel] = useState<HotelDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHabitacion, setSelectedHabitacion] =
    useState<HabitacionResponse | null>(null);
  // Fechas ya reservadas por habitación (reservas activas, GET
  // /hoteles/{id}/fechas-ocupadas) — antes el cliente solo veía el estado
  // estático "disponible/ocupada" de cada habitación, sin saber para qué
  // fechas concretas ya estaba reservada.
  const [fechasOcupadas, setFechasOcupadas] = useState<HabitacionFechasOcupadas[]>([]);
  // Reseñas reales de huéspedes (GET /resenas/hotel/{id}) -- antes esta
  // página no mostraba ninguna, aunque el backend ya las tenía listas.
  const [resenas, setResenas] = useState<ResenaResponse[]>([]);
  // Índice de la foto abierta en el lightbox (portada + galería en un solo
  // arreglo navegable) -- null significa cerrado.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Hoteles de la misma ciudad para "también te puede interesar" -- antes
  // esta sección no existía.
  const [similares, setSimilares] = useState<HotelDetailResponse[]>([]);
  // Habitaciones cuyo calendario de ocupación está desplegado (por id).
  const [calendariosAbiertos, setCalendariosAbiertos] = useState<Set<number>>(new Set());
  const toggleCalendario = (idHabitacion: number) =>
    setCalendariosAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(idHabitacion)) next.delete(idHabitacion);
      else next.add(idHabitacion);
      return next;
    });

  useEffect(() => {
    if (!id) return;
    hotelService
      .getById(parseInt(id))
      .then(setHotel)
      .catch(console.error)
      .finally(() => setLoading(false));
    hotelService
      .getFechasOcupadas(parseInt(id))
      .then(setFechasOcupadas)
      .catch(() => setFechasOcupadas([]));
    resenaService
      .getByHotel(parseInt(id))
      .then(setResenas)
      .catch(() => setResenas([]));
    hotelService
      .getSimilares(parseInt(id))
      .then(setSimilares)
      .catch(() => setSimilares([]));
  }, [id]);

  // Antes esta página (y todas las demás) compartían el mismo <title>
  // genérico de index.html — cada hotel real ahora tiene su propio título
  // y descripción para SEO, con datos reales del hotel (nunca inventados).
  useSeoMeta({
    title: hotel ? `${hotel.nombre_hotel} en ${hotel.ciudad}` : "Hotel",
    description: hotel
      ? `Reserva ${hotel.nombre_hotel} en ${hotel.ciudad}, ${hotel.pais} con Alik tours.${
          hotel.calificacion ? ` Calificación ${hotel.calificacion}/5.` : ""
        } Tarifas y disponibilidad real, reserva segura en línea.`
      : undefined,
    path: id ? `/hotel/${id}` : undefined,
  });

  if (loading)
    return (
      <div className="min-h-screen bg-background transition-colors duration-200">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
          <div className="h-5 w-32 bg-muted rounded mb-6" />
          <div className="h-[50vh] bg-muted rounded-2xl mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-40 bg-card border border-border rounded-2xl" />
              <div className="h-96 bg-card border border-border rounded-2xl" />
            </div>
            <div className="h-[400px] bg-card border border-border rounded-2xl" />
          </div>
        </div>
      </div>
    );

  if (!hotel)
    return (
      <div className="min-h-screen bg-background transition-colors duration-200">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Hotel no encontrado
          </h1>
          <Link
            to="/search"
            className="text-primary hover:underline font-medium"
          >
            ← Volver a explorar destinos
          </Link>
        </div>
      </div>
    );

  // Foto real del hotel si el admin ya subió una, si no la imagen
  // genérica por ciudad de siempre (ver HotelCard.tsx, mismo criterio).
  const imagen = (hotel.imagen_url && resolveFotoUrl(hotel.imagen_url)) || getImage(hotel.ciudad ?? "");
  const galeria = getGalleryImages(hotel);
  const habitacionesDisponibles =
    hotel.habitaciones?.filter((h) => h.estado === "disponible") ?? [];
  const precioMin = habitacionesDisponibles.length
    ? Math.min(...habitacionesDisponibles.map((h) => h.precio_noche))
    : null;
  const caracteristicas = hotel.hotel_caracteristicas ?? [];

  // Propaga las fechas/huéspedes que trajo el buscador (SearchBar → HotelCard
  // → acá) hasta Checkout, para que no haya que volver a escribirlas — antes
  // se perdían por completo entre la búsqueda y el pago.
  const checkoutHref = (() => {
    if (!selectedHabitacion) return "#";
    const p = new URLSearchParams({ habitacion: String(selectedHabitacion.id_habitacion) });
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const people = searchParams.get("people");
    if (start) p.set("start", start);
    if (end) p.set("end", end);
    if (people) p.set("people", people);
    return `/checkout/${hotel.id_hotel}?${p.toString()}`;
  })();

  const handleCompartir = async () => {
    const texto = `${hotel.nombre_hotel} — ${hotel.ciudad}, ${hotel.pais}`;
    const url = window.location.href;

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as any).share({ title: hotel.nombre_hotel, text: texto, url });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        // Cae al portapapeles si el share nativo falla por otra razón.
      }
    }

    try {
      await navigator.clipboard.writeText(`${texto}\n${url}`);
      toast.success("Enlace del hotel copiado al portapapeles");
    } catch {
      toast.error("No se pudo compartir este hotel");
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-200 pb-20">
        <Navbar />

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Breadcrumbs Comercial */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link
                to="/search"
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Búsqueda
              </Link>
              <span>/</span>
              <span className="font-medium text-foreground">{hotel.pais}</span>
              <span>/</span>
              <span className="font-medium text-foreground">
                {hotel.ciudad}
              </span>
            </nav>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCompartir}
                className="flex items-center gap-2 text-sm font-medium hover:bg-muted px-3 py-1.5 rounded-md transition-colors"
              >
                <Share className="w-4 h-4" /> Compartir
              </button>
              <button
                type="button"
                onClick={() => toggleFavorito(hotel.id_hotel)}
                disabled={loadingIds.has(hotel.id_hotel)}
                aria-pressed={isFavorito(hotel.id_hotel)}
                className={`flex items-center gap-2 text-sm font-medium hover:bg-muted px-3 py-1.5 rounded-md transition-colors disabled:opacity-60 ${
                  isFavorito(hotel.id_hotel) ? "text-primary" : ""
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorito(hotel.id_hotel) ? "fill-current" : ""}`} />
                {isFavorito(hotel.id_hotel) ? "Guardado" : "Guardar"}
              </button>
            </div>
          </div>

          {/* Título Comercial */}
          <div className="mb-6 relative">
            {/* Un solo acento discreto -- lejos de la galería de fotos
                reales del hotel y de la tarjeta de precio/reserva, para
                no restarle seriedad a esas dos zonas (ver criterio de
                confianza del rediseño). */}
            {esHalloween && (
              <HalloweenAccentDiscreto variante="murcielago" posicion="top-right" />
            )}
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
                Hotel Destacado
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < (hotel.calificacion ?? 0) ? "fill-chart-2 text-chart-2" : "fill-muted text-muted"}`}
                  />
                ))}
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">
              {hotel.nombre_hotel}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="hover:underline cursor-pointer">
                {hotel.direccion || "Ubicación céntrica"}, {hotel.ciudad}
              </span>
              <span>•</span>
              <span className="text-primary font-medium cursor-pointer hover:underline">
                Ver mapa
              </span>
            </div>
          </div>

          {/* Galería de Imágenes (Estilo Bento Grid) -- ahora se puede hacer
              click en cualquier foto para verla ampliada (lightbox), antes
              solo se veían en miniatura. fotosLightbox combina portada +
              galería en un solo arreglo navegable. */}
          <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-2 mb-10 h-[45vh] md:h-[55vh] rounded-2xl overflow-hidden group">
            <div
              className="md:col-span-2 md:row-span-2 relative overflow-hidden h-full cursor-pointer"
              onClick={() => setLightboxIndex(0)}
            >
              <img
                src={imagen}
                alt={hotel.nombre_hotel}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
                }}
              />
            </div>
            {galeria.map((img, idx) => (
              <div
                key={idx}
                className="hidden md:block relative overflow-hidden h-full cursor-pointer"
                onClick={() => setLightboxIndex(idx + 1)}
              >
                <img
                  src={img}
                  alt="Instalaciones"
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* ── Columna Principal (Izquierda) ── */}
            <div className="lg:col-span-2 space-y-10">
              {/* Acerca de */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">
                  Acerca de este alojamiento
                </h2>
                <div className="prose prose-sm md:prose-base dark:prose-invert text-muted-foreground">
                  <p>
                    Ubicado estratégicamente en <strong>{hotel.ciudad}</strong>,{" "}
                    {hotel.nombre_hotel} ofrece una experiencia excepcional que
                    combina comodidad moderna con la calidez del servicio local.
                    Ideal tanto para estancias de negocios como para escapadas
                    de turismo.
                  </p>
                  <p className="mt-4">
                    Nuestros huéspedes destacan la limpieza, la atención del
                    personal y nuestra ubicación privilegiada cerca de los
                    principales puntos de interés. Siéntete como en casa
                    mientras descubres lo mejor de {hotel.pais}.
                  </p>
                </div>
              </section>

              <hr className="border-border" />

              {/* Servicios y Amenidades — tabla con lo que realmente incluye
                  este hotel (hotel.hotel_caracteristicas, dato real, no un
                  badge genérico repetido en cada habitación). */}
              {caracteristicas.filter((hc) => hc.disponible).length > 0 && (
                <section>
                  <h2 className="text-2xl font-semibold mb-6">
                    Qué incluye este hotel
                  </h2>
                  <div className="rounded-2xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs px-5 py-3">
                            Servicio
                          </th>
                          <th className="text-right font-semibold text-muted-foreground uppercase tracking-wider text-xs px-5 py-3">
                            Incluido
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {caracteristicas
                          .filter((hc) => hc.disponible)
                          .map((hc, idx) => {
                            const nombre =
                              hc.caracteristica?.nombre_caracteristica ?? "";
                            const entry = CARACTERISTICA_ICONS[nombre];
                            const Icon = entry?.icon || CheckCircle;
                            const color = entry?.color || "text-primary";

                            return (
                              <tr
                                key={hc.id_caracteristica}
                                className={idx > 0 ? "border-t border-border/60" : ""}
                              >
                                <td className="px-5 py-3.5">
                                  <span className="flex items-center gap-3 font-medium text-foreground/90">
                                    <Icon className={`w-4.5 h-4.5 ${color} shrink-0`} />
                                    {nombre}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold text-xs">
                                    <CheckCircle className="w-4 h-4" />
                                    Sí
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <hr className="border-border" />

              {/* Listado de Habitaciones — DISEÑO OPTIMIZADO */}
              {hotel.habitaciones?.length > 0 && (
                <section id="habitaciones">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold">Disponibilidad</h2>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Selecciona una habitación para proceder con la reserva.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {hotel.habitaciones.map((hab) => {
                      const disponible = hab.estado === "disponible";
                      const seleccionada =
                        selectedHabitacion?.id_habitacion === hab.id_habitacion;

                      return (
                        <motion.div
                          key={hab.id_habitacion}
                          whileHover={
                            disponible && !seleccionada ? { y: -2 } : {}
                          }
                          onClick={() =>
                            disponible && setSelectedHabitacion(hab)
                          }
                          className={`relative flex flex-col md:flex-row border rounded-2xl overflow-hidden transition-all duration-300 bg-card ${
                            !disponible
                              ? "opacity-60 grayscale-[40%] cursor-not-allowed"
                              : seleccionada
                                ? "border-primary ring-2 ring-primary/20 shadow-lg cursor-default"
                                : "border-border hover:border-primary/40 hover:shadow-md cursor-pointer"
                          }`}
                        >
                          {/* Foto de la habitación */}
                          <div className="relative h-40 md:h-auto md:w-48 shrink-0 overflow-hidden bg-muted">
                            <img
                              src={getRoomImage(hab.id_habitacion)}
                              alt={hab.tipo_habitacion?.nombre_tipo ?? "Habitación"}
                              className={`h-full w-full object-cover ${!disponible ? "grayscale" : ""}`}
                            />
                          </div>

                          {/* Info de la Habitación */}
                          <div className="p-5 md:p-6 flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                {hab.tipo_habitacion?.nombre_tipo ??
                                  "Habitación"}
                              </h3>
                              <span
                                className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${ESTADO_STYLES[hab.estado]}`}
                              >
                                {hab.estado}
                              </span>
                            </div>

                            {hab.tipo_habitacion?.descripcion && (
                              <p className="text-sm text-muted-foreground mb-4 max-w-lg">
                                {hab.tipo_habitacion.descripcion}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
                              <span className="flex items-center gap-1.5">
                                <Bed className="w-4 h-4 text-primary" /> Cama
                                doble
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-primary" /> Máx.{" "}
                                {hab.tipo_habitacion?.capacidad_personas} pers.
                              </span>
                            </div>

                            {/* Fechas ya ocupadas — dato real (reservas
                                activas), nunca un calendario inventado. Solo
                                se muestra cuando sí hay rangos futuros. */}
                            {(() => {
                              const rangos = fechasOcupadas.find(
                                (f) => f.id_habitacion === hab.id_habitacion
                              )?.rangos;
                              const abierto = calendariosAbiertos.has(hab.id_habitacion);
                              if (!rangos || rangos.length === 0) return null;
                              return (
                                <div className="mt-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleCalendario(hab.id_habitacion);
                                    }}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive/80 hover:text-destructive transition-colors"
                                  >
                                    <CalendarDays className="w-3.5 h-3.5 text-destructive/70" />
                                    {rangos.length === 1
                                      ? `Ocupada: ${formatFechaCorta(rangos[0].fecha_checkin)}–${formatFechaCorta(rangos[0].fecha_checkout)}`
                                      : `${rangos.length} rangos ocupados`}
                                    {abierto ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  {abierto && (
                                    <div onClick={(e) => e.stopPropagation()} className="mt-3">
                                      <CalendarioOcupacion rangos={rangos} />
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Caja de Precio (Lado derecho en Desktop) */}
                          <div className="bg-muted/30 p-5 md:p-6 flex flex-col justify-center items-start md:items-end md:w-64 border-t md:border-t-0 md:border-l border-border">
                            <p className="text-xs text-muted-foreground font-medium mb-1">
                              Precio por 1 noche
                            </p>
                            <p className="text-2xl font-bold text-primary mb-1">
                              $
                              {Number(hab.precio_noche).toLocaleString("es-CO")}
                            </p>
                            <p className="text-[11px] text-muted-foreground mb-4">
                              Incluye impuestos y cargos
                            </p>

                            <button
                              disabled={!disponible}
                              className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all ${
                                !disponible
                                  ? "bg-muted text-muted-foreground border border-border"
                                  : seleccionada
                                    ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-1 ring-offset-background"
                                    : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                              }`}
                            >
                              {!disponible
                                ? "No disponible"
                                : seleccionada
                                  ? "Seleccionada"
                                  : "Elegir"}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </section>
              )}

              {resenas.length > 0 && (
                <>
                  <hr className="border-border" />

                  {/* Reseñas de huéspedes — dato real (GET
                      /resenas/hotel/{id}), nunca inventado: si el hotel
                      todavía no tiene reseñas, la sección completa no se
                      muestra en vez de simularlas. */}
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div>
                        <h2 className="text-2xl font-semibold">
                          Reseñas de huéspedes
                        </h2>
                        {hotel.calificacion_promedio != null && (
                          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                            <Star className="w-4 h-4 fill-chart-2 text-chart-2" />
                            <span className="font-semibold text-foreground">
                              {hotel.calificacion_promedio.toFixed(1)}
                            </span>
                            · {hotel.total_resenas}{" "}
                            {hotel.total_resenas === 1 ? "reseña" : "reseñas"}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {resenas.slice(0, 6).map((r) => (
                        <div
                          key={r.id_resena}
                          className="p-5 rounded-2xl border border-border bg-card"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <img
                              src={
                                r.foto_url ||
                                `https://ui-avatars.com/api/?background=random&name=${encodeURIComponent(r.nombre_cliente ?? "Huésped")}`
                              }
                              alt=""
                              className="w-10 h-10 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {r.nombre_cliente ?? "Huésped Alik tours"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatFechaResena(r.fecha_creacion)}
                              </p>
                            </div>
                            <div className="ml-auto flex gap-0.5 shrink-0">
                              {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3.5 h-3.5 ${i < r.calificacion ? "fill-chart-2 text-chart-2" : "fill-muted text-muted"}`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <Quote className="w-3.5 h-3.5 inline mr-1.5 text-primary/40 -mt-1" />
                            {r.comentario}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

              <hr className="border-border" />

              {/* Políticas simuladas */}
              <section>
                <h2 className="text-2xl font-semibold mb-6">
                  Reglas del alojamiento
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex gap-4 p-5 rounded-2xl border border-border bg-card">
                    <Clock className="w-6 h-6 text-primary shrink-0" />
                    <div>
                      <h4 className="font-semibold text-foreground">
                        Horarios
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Check-in: 15:00 - 23:00
                        <br />
                        Check-out: Hasta las 12:00
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-5 rounded-2xl border border-border bg-card">
                    <Info className="w-6 h-6 text-primary shrink-0" />
                    <div>
                      <h4 className="font-semibold text-foreground">
                        Políticas
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Se requiere presentar documento de identidad al momento
                        del registro.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* ── Sidebar de Reserva (Sticky) ── */}
            <div className="lg:col-span-1 relative">
              <div className="bg-card rounded-2xl border border-border p-6 shadow-xl sticky top-24 transition-colors">
                {/* Gatillo de Urgencia (FOMO) */}
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-6 flex items-start gap-3">
                  <span className="relative flex h-2.5 w-2.5 mt-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
                  </span>
                  <div className="text-sm text-destructive dark:text-red-400">
                    <span className="font-bold block">¡Muy solicitado!</span>
                    Este hotel se reserva frecuentemente.
                  </div>
                </div>

                {/* Info superior */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold leading-tight mb-2">
                    {hotel.nombre_hotel}
                  </h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Destino</span>
                      <span className="font-medium text-foreground">
                        {hotel.ciudad}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Contacto</span>
                      <span className="font-medium text-foreground">
                        {hotel.telefono}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Caja de Precio Dinámica */}
                <div className="bg-muted/40 rounded-xl p-5 mb-6 border border-border">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-foreground">
                      {selectedHabitacion
                        ? selectedHabitacion.tipo_habitacion?.nombre_tipo
                        : "Selecciona habitación"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
                    <span>
                      1 Noche,{" "}
                      {selectedHabitacion
                        ? selectedHabitacion.tipo_habitacion?.capacidad_personas
                        : "2"}{" "}
                      pers.
                    </span>
                  </div>

                  <div className="border-t border-border pt-4 flex justify-between items-end">
                    <span className="font-bold text-foreground">Total</span>
                    <div className="text-right">
                      <span className="text-2xl font-black text-primary">
                        $
                        {(
                          selectedHabitacion?.precio_noche ??
                          precioMin ??
                          0
                        ).toLocaleString("es-CO")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botón de Checkout */}
                <Link
                  to={checkoutHref}
                  onClick={(e) => {
                    if (!selectedHabitacion) {
                      e.preventDefault();
                      document
                        .getElementById("habitaciones")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className={`flex justify-center items-center w-full py-4 text-base font-bold rounded-xl transition-all ${
                    selectedHabitacion
                      ? "bg-primary text-primary-foreground shadow-md hover:scale-[1.02] hover:shadow-lg"
                      : "bg-primary/50 text-white cursor-pointer"
                  }`}
                >
                  {selectedHabitacion
                    ? "Reservar ahora"
                    : "Ver opciones de habitación"}
                </Link>
                <p className="text-xs text-center text-muted-foreground mt-3 font-medium">
                  No se te cobrará nada todavía
                </p>

                {/* Badges de confianza */}
                <div className="mt-6 pt-6 border-t border-border space-y-4">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <ShieldCheck className="w-5 h-5 text-gold shrink-0" />
                    <span>Transacción segura y cifrada</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CreditCard className="w-5 h-5 text-gold shrink-0" />
                    <span>Aceptamos múltiples métodos de pago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* También te puede interesar -- hoteles reales de la misma
              ciudad (GET /hoteles/{id}/similares), nunca una recomendación
              inventada. Se reutiliza HotelCard.tsx tal cual (mismo pedido
              explícito de reutilizar componentes que ya se aplicó en
              PackageDetail.tsx). */}
          {similares.length > 0 && (
            <section className="mt-14">
              <h2 className="text-2xl font-semibold mb-6">
                También te puede interesar
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {similares.map((h, idx) => (
                  <HotelCard key={h.id_hotel} hotel={h} index={idx} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <ImageLightbox
        images={[imagen, ...galeria]}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
        alt={hotel.nombre_hotel}
      />

      <Footer />
    </>
  );
}
