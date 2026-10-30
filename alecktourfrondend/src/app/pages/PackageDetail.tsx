import {
  Bus,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Hotel as HotelIcon,
  MapPin,
  Plane,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { Badge } from "../components/ui/badge";
import Footer from "../components/Footer";
import HalloweenAccentDiscreto from "../components/HalloweenAccentDiscreto";
import HotelCard from "../components/HotelCard";
import ImageLightbox from "../components/ui/ImageLightbox";
import Navbar from "../components/Navbar";
import PackageResultCard from "../components/PackageResultCard";
import { resolveFotoUrl } from "../components/admin/types";
import { useTema } from "../context/TemaContext";
import { HotelDetailResponse, hotelService } from "../services/hotel.service";
import {
  PaqueteDetalleResponse,
  PaqueteHotelDetalle,
  PaqueteResponse,
  PaqueteServicioDetalle,
  paqueteService,
} from "../services/paquete.service";
import { resenaService, ResenaResponse } from "../services/resena.service";
import { getCityImage, getDefaultImage } from "../utils/cityImages";

// Fotos reales por ciudad, solo como respaldo cuando ningún hotel del
// paquete tiene foto propia todavía (ver getHotelImage) -- nunca inventamos
// datos, solo elegimos una foto ilustrativa del destino real del paquete.
// Mapa centralizado en utils/cityImages.ts (antes esta página tenía su
// propia copia -- ver el comentario de ese archivo).
const DEFAULT_IMAGE = getDefaultImage({ width: 1400 });

function getImage(ciudad?: string | null) {
  if (!ciudad) return DEFAULT_IMAGE;
  return getCityImage(ciudad, { width: 1400 });
}

// Antes esta página siempre mostraba una foto genérica por ciudad, incluso
// para paquetes cuyo hotel real ya tiene una foto propia y correcta en la
// base de datos (Hotel.imagen_url) -- la ruta /paquetes/{id}/detalle ya
// carga el hotel completo, así que ahora se usa esa foto real primero.
function getHotelImage(hotel?: PaqueteHotelDetalle): string {
  return resolveFotoUrl(hotel?.imagen_url) ?? getImage(hotel?.ciudad);
}

// Agrupa los servicios reales del paquete por día (PaqueteServicio.dia_actividad)
// para armar un itinerario día a día -- antes se mostraban todos en una sola
// lista plana sin ningún orden temporal, indistinguible de un simple listado
// de "servicios de hotel".
function agruparPorDia(servicios: PaqueteServicioDetalle[]) {
  const grupos = new Map<number | null, PaqueteServicioDetalle[]>();
  for (const s of servicios) {
    const key = s.dia_actividad ?? null;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(s);
  }
  return [...grupos.entries()].sort(([a], [b]) => {
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
  });
}

// El usuario reportó que un paquete con solo un hotel y una actividad se
// sentía vacío/incompleto -- varios paquetes demo en efecto no tenían
// ningún tramo de transporte real en la base de datos (ver migración
// 4f7efe4c291c_agregar_transporte_a_paquetes.py, que agrega uno con
// categoría "Transporte" a cada uno de esos paquetes). Estos separan esos
// servicios del resto de la lista para darles su propia sección visible,
// en vez de perderse mezclados entre tours y entradas.
function esTransporte(servicio: PaqueteServicioDetalle): boolean {
  return servicio.categoria?.toLowerCase() === "transporte";
}

// Ícono según el tipo real de transporte (a partir del nombre del
// servicio, ej. "Vuelo Bogotá - San Andrés") -- nunca asumimos un solo
// ícono para todos los tramos, ya que un paquete puede combinar vuelos con
// traslados terrestres.
function getTransporteIcon(nombreServicio: string) {
  const esAereo = /vuelo|aére|aere|avioneta/i.test(nombreServicio);
  return esAereo ? Plane : Bus;
}

// Franja de resumen ("este paquete incluye") justo debajo de la foto
// principal -- antes había que leer las tres secciones completas para
// enterarte de qué trae el paquete. Un solo chip reutilizable para no
// repetir el mismo marcado icono+etiqueta+valor cuatro veces.
function ResumenChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 min-w-0">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

// Ícono dentro de un círculo de marca para el encabezado de cada sección
// del contenido principal -- mismo lenguaje visual que ResumenChip y que
// cada fila de "Transporte incluido", en vez del ícono suelto de antes.
function EncabezadoSeccion({
  icon: Icon,
  titulo,
}: {
  icon: React.ElementType;
  titulo: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">{titulo}</h2>
    </div>
  );
}

export default function PackageDetail() {
  const { id } = useParams();
  const { temaActivo } = useTema();
  const esHalloween = temaActivo?.clave === "halloween";
  const [pkg, setPkg] = useState<PaqueteDetalleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Ficha completa de cada hotel del paquete (con habitaciones, reseñas y
  // características reales) -- PaqueteHotelDetalle solo trae lo básico, y
  // la sección "Hospedaje" reutiliza el mismo HotelCard.tsx de los
  // resultados de búsqueda para que un hotel se vea IGUAL ahí que acá
  // (pedido explícito: "quiero que reutilice componentes"). Se guarda por
  // id_hotel porque el fetch es independiente del orden en que resuelvan.
  const [hotelesDetalle, setHotelesDetalle] = useState<Record<number, HotelDetailResponse>>({});
  // Reseñas reales del hotel principal del paquete (GET /resenas/hotel/{id})
  // -- antes esta página no mostraba ninguna reseña.
  const [resenas, setResenas] = useState<ResenaResponse[]>([]);
  // Paquetes con destino real parecido para "también te puede interesar".
  const [similares, setSimilares] = useState<PaqueteResponse[]>([]);
  // Índice de la foto abierta en el lightbox (portada + galería en un solo
  // arreglo navegable) -- null significa cerrado.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    setHotelesDetalle({});
    paqueteService
      .getDetalle(parseInt(id))
      .then(setPkg)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    paqueteService
      .getSimilares(parseInt(id))
      .then(setSimilares)
      .catch(() => setSimilares([]));
  }, [id]);

  useEffect(() => {
    if (!pkg) return;
    pkg.hoteles.forEach((hotel) => {
      hotelService
        .getById(hotel.id_hotel)
        .then((detalle) =>
          setHotelesDetalle((prev) => ({ ...prev, [hotel.id_hotel]: detalle }))
        )
        .catch(() => {
          // Si un hotel puntual falla, HotelCard sigue mostrando su
          // skeleton de carga en vez de romper el resto de la página.
        });
    });

    // Reseñas del hotel PRINCIPAL del paquete (el primero vinculado, mismo
    // criterio que heroImage/heroHotel más abajo) -- Resena está ligada a
    // un hotel, no a un paquete, así que se reutilizan las mismas reseñas
    // que ya se muestran en la ficha de ese hotel.
    const primerHotel = pkg.hoteles[0];
    if (!primerHotel) {
      setResenas([]);
      return;
    }
    resenaService
      .getByHotel(primerHotel.id_hotel)
      .then(setResenas)
      .catch(() => setResenas([]));
  }, [pkg]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-200">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
          <div className="h-96 md:h-[500px] bg-muted rounded-3xl mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="h-40 bg-card border border-border rounded-2xl" />
              <div className="h-56 bg-card border border-border rounded-2xl" />
            </div>
            <div className="h-72 bg-card border border-border rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !pkg) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-200">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Paquete no encontrado
          </h1>
          <Link to="/packages" className="text-primary hover:underline font-medium">
            ← Volver a explorar paquetes
          </Link>
        </div>
      </div>
    );
  }

  const destinoPrincipal = pkg.destinos[0] ?? pkg.hoteles[0]?.ciudad ?? pkg.nombre_paquete;
  const heroHotel = pkg.hoteles[0];
  // Portada propia del paquete (POST /paquetes/{id}/imagen) tiene prioridad
  // -- antes Paquete no tenía ningún campo de imagen propio y esta ficha
  // siempre usaba la foto del hotel incluido como respaldo (getHotelImage,
  // que se mantiene como segundo respaldo para paquetes sin portada propia
  // todavía).
  const heroImage =
    resolveFotoUrl(pkg.imagen_url) ?? (heroHotel ? getHotelImage(heroHotel) : getImage(pkg.destinos[0]));
  const heroPais = heroHotel?.pais ?? "Colombia";
  // Portada + galería real del paquete, combinadas en un solo arreglo
  // navegable para el lightbox (click para ampliar).
  const fotosLightbox = [heroImage, ...pkg.imagenes.map((img) => resolveFotoUrl(img.url) ?? img.url)];
  const transportes = pkg.servicios.filter(esTransporte);
  const actividades = pkg.servicios.filter((s) => !esTransporte(s));
  const itinerario = agruparPorDia(actividades);

  const rutaLabel =
    pkg.ciudad_salida && pkg.ciudad_destino && pkg.ciudad_salida !== pkg.ciudad_destino
      ? `${pkg.ciudad_salida} → ${pkg.ciudad_destino}`
      : null;

  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      <Navbar />

      {/* Breadcrumb — antes esta página no tenía ninguna forma de saber
          "dónde estás" ni de volver al catálogo salvo el botón atrás del
          navegador. */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground overflow-x-auto whitespace-nowrap">
          <Link to="/packages" className="hover:text-primary transition-colors shrink-0">
            Paquetes
          </Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span className="text-foreground font-semibold truncate">{pkg.nombre_paquete}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Image — ahora la foto real del hotel incluido en el
            paquete (Hotel.imagen_url) en vez de una foto genérica por
            ciudad, la misma que ya se corrigió en el detalle del hotel. */}
        <div className="relative h-96 md:h-[500px] rounded-3xl overflow-hidden mb-4">
          {/* Un solo acento discreto, sobre el scrim oscuro de la foto --
              mismo patrón que HalloweenAccents.tsx en el Hero de Home. */}
          {esHalloween && (
            <HalloweenAccentDiscreto variante="calabaza" posicion="top-left" tamano="lg" />
          )}
          <img
            src={heroImage}
            alt={destinoPrincipal ?? pkg.nombre_paquete}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5" />
              <span className="text-lg">{heroPais}</span>
            </div>
            <Badge
              variant="outline"
              className="bg-white/15 text-white border-white/30 backdrop-blur-sm mb-3"
            >
              Paquete turístico
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{pkg.nombre_paquete}</h1>
            <div className="flex flex-wrap items-center gap-6">
              {pkg.hoteles[0]?.calificacion && (
                <div className="flex items-center gap-2">
                  {Array.from({ length: pkg.hoteles[0].calificacion }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                  ))}
                </div>
              )}
              {pkg.duracion_dias && (
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>{pkg.duracion_dias} {pkg.duracion_dias === 1 ? "día" : "días"}</span>
                </div>
              )}
              {pkg.destinos.length > 0 && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  <span>{pkg.destinos.join(" · ")}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Miniaturas de la galería real del paquete (POST
            /paquetes/{id}/galeria) -- antes no existía ninguna forma de
            subir más de una foto por paquete. Si no hay ninguna, la
            portada sigue siendo clickeable arriba y esta tira no se
            muestra. */}
        {pkg.imagenes.length > 0 && (
          <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
            {pkg.imagenes.map((img, idx) => (
              <button
                key={img.id_imagen}
                type="button"
                onClick={() => setLightboxIndex(idx + 1)}
                className="relative h-20 w-28 shrink-0 rounded-xl overflow-hidden border border-border hover:opacity-90 transition-opacity"
              >
                <img
                  src={resolveFotoUrl(img.url) ?? img.url}
                  alt={`Foto ${idx + 1} de ${pkg.nombre_paquete}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Resumen — "este paquete incluye" de un vistazo, sin tener que
            leer las tres secciones completas para saber qué trae. */}
        <div className="bg-card border border-border rounded-2xl shadow-sm mb-8 flex flex-wrap divide-x divide-border/70">
          {rutaLabel && <ResumenChip icon={MapPin} label="Ruta" value={rutaLabel} />}
          {pkg.duracion_dias > 0 && (
            <ResumenChip
              icon={Clock}
              label="Duración"
              value={`${pkg.duracion_dias} ${pkg.duracion_dias === 1 ? "día" : "días"}`}
            />
          )}
          {pkg.hoteles.length > 0 && (
            <ResumenChip
              icon={HotelIcon}
              label="Hospedaje"
              value={
                pkg.hoteles.length === 1
                  ? pkg.hoteles[0].noches_incluidas
                    ? `${pkg.hoteles[0].noches_incluidas} noches`
                    : pkg.hoteles[0].nombre_hotel
                  : `${pkg.hoteles.length} hoteles`
              }
            />
          )}
          {transportes.length > 0 && (
            <ResumenChip
              icon={Bus}
              label="Transporte"
              value={
                transportes.length === 1
                  ? transportes[0].nombre_servicio
                  : `${transportes.length} tramos`
              }
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {pkg.descripcion && (
              <section className="bg-card border border-border rounded-2xl shadow-sm p-8">
                <h2 className="text-lg font-bold text-foreground mb-3">
                  Descripción del viaje
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {pkg.descripcion}
                </p>
              </section>
            )}

            {/* Itinerario — antes había un checklist plano de "¿Qué
                incluye?" sin ningún orden; ahora se agrupa por día real
                (PaqueteServicio.dia_actividad) para que se sienta como un
                itinerario de viaje, no como el listado de amenidades de un
                hotel. */}
            <section className="bg-card border border-border rounded-2xl shadow-sm p-8">
              <EncabezadoSeccion icon={CalendarDays} titulo="Itinerario del viaje" />
              {itinerario.length > 0 ? (
                <div className="space-y-6">
                  {itinerario.map(([dia, items], idx) => (
                    <div
                      key={dia ?? "sin-dia"}
                      className={`relative pl-7 ${idx < itinerario.length - 1 ? "pb-6 border-l-2 border-primary/15" : ""}`}
                    >
                      <span className="absolute -left-[7px] top-0 w-3.5 h-3.5 rounded-full bg-primary ring-4 ring-primary/10" />
                      <h3 className="text-sm font-bold uppercase tracking-wide text-primary mb-3">
                        {dia != null ? `Día ${dia}` : "Otros servicios incluidos"}
                      </h3>
                      <div className="space-y-3">
                        {items.map((servicio) => (
                          <div key={servicio.id_servicio} className="flex items-start gap-3">
                            <CheckCircle2
                              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${servicio.incluido ? "text-primary" : "text-muted-foreground/50"}`}
                            />
                            <div>
                              <span className="text-foreground font-medium">
                                {servicio.nombre_servicio}
                              </span>
                              {!servicio.incluido && (
                                <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                  Opcional
                                </span>
                              )}
                              {servicio.categoria && (
                                <span className="block text-xs text-muted-foreground">
                                  {servicio.categoria}
                                </span>
                              )}
                              {servicio.descripcion && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {servicio.descripcion}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Aún no hay servicios detallados para este paquete — contáctanos para más información.
                </p>
              )}
            </section>

            {/* Transporte incluido — antes los tramos de transporte (si
                existían) se perdían mezclados en el checklist plano de
                servicios, indistinguibles de un tour o una entrada. Ahora
                tienen su propia sección, igual de visible que Hospedaje. */}
            {transportes.length > 0 && (
              <section className="bg-card border border-border rounded-2xl shadow-sm p-8">
                <EncabezadoSeccion icon={Bus} titulo="Transporte incluido" />
                <div className="space-y-4">
                  {transportes.map((transporte) => {
                    const IconoTransporte = getTransporteIcon(transporte.nombre_servicio);
                    return (
                      <div
                        key={transporte.id_servicio}
                        className="flex items-start gap-4 p-4 rounded-xl bg-muted/40"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <IconoTransporte className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {transporte.nombre_servicio}
                            </span>
                            {transporte.dia_actividad != null && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                Día {transporte.dia_actividad}
                              </span>
                            )}
                            {!transporte.incluido && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                Opcional
                              </span>
                            )}
                          </div>
                          {transporte.descripcion && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {transporte.descripcion}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Accommodation — hoteles reales asociados al paquete. Ahora
                reutiliza el mismo HotelCard.tsx de los resultados de
                búsqueda (con su foto real, calificación de reseñas reales,
                características y precio desde la habitación más barata)
                en vez de una tarjeta propia y más pobre -- así un hotel
                dentro de un paquete se ve y se siente igual que un hotel
                normal, como pidió el usuario. */}
            {pkg.hoteles.length > 0 && (
              <section className="bg-card border border-border rounded-2xl shadow-sm p-8">
                <EncabezadoSeccion icon={HotelIcon} titulo="Hospedaje" />
                <div className="space-y-6">
                  {pkg.hoteles.map((hotel, index) => (
                    <div
                      key={hotel.id_hotel}
                      className={index > 0 ? "pt-6 border-t border-border/60" : ""}
                    >
                      {hotel.noches_incluidas && (
                        <p className="text-xs font-semibold text-primary bg-primary/10 inline-block px-3 py-1 rounded-full mb-3">
                          {hotel.noches_incluidas}{" "}
                          {hotel.noches_incluidas === 1 ? "noche incluida" : "noches incluidas"} en{" "}
                          {hotel.nombre_hotel}
                        </p>
                      )}
                      <HotelCard hotel={hotelesDetalle[hotel.id_hotel]} index={index} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reseñas de huéspedes -- reutiliza las mismas reseñas reales del
                hotel principal del paquete (Resena está ligada a un hotel,
                no a un paquete). Dato real (GET /resenas/hotel/{id}): si el
                hotel todavía no tiene reseñas, la sección completa no se
                muestra en vez de simularlas -- mismo criterio que
                HotelDetail.tsx. */}
            {resenas.length > 0 && (
              <section className="bg-card border border-border rounded-2xl shadow-sm p-8">
                <EncabezadoSeccion icon={Star} titulo="Reseñas de huéspedes" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resenas.slice(0, 6).map((r) => (
                    <div key={r.id_resena} className="p-5 rounded-2xl border border-border bg-muted/30">
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
                            {r.nombre_cliente ?? "Huésped Alik Tours"}
                          </p>
                        </div>
                        <div className="ml-auto flex gap-0.5 shrink-0">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < r.calificacion ? "fill-gold text-gold" : "fill-muted text-muted"}`}
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
            )}

            {/* Personalización — solo se muestra si el paquete de verdad tiene
                actividades opcionales configuradas (Servicio.incluido = false);
                antes enlazaba a una página con datos 100% inventados
                (data/packages.ts) y ahora enlaza a Personalization.tsx, que
                muestra esas actividades opcionales reales agrupadas por
                categoría real. Sin actividades opcionales no tiene sentido
                mostrar el enlace. */}
            {pkg.servicios.some((s) => !s.incluido) && (
              <section className="bg-card border border-border rounded-2xl shadow-sm p-8">
                <EncabezadoSeccion icon={Sparkles} titulo="Personaliza tu experiencia" />
                <p className="text-muted-foreground mb-6">
                  Este paquete tiene actividades opcionales adicionales — revísalas y
                  coordínalas con tu asesor al reservar.
                </p>
                <Link
                  to={`/personalize/${pkg.id_paquete}`}
                  className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-colors font-semibold"
                >
                  Ver opciones de personalización
                </Link>
              </section>
            )}

            {/* Antes de reservar — el equivalente real de "Términos y
                condiciones" / "Políticas de cancelación" de cualquier OTA,
                pero con la política real de Alik Tours (ver
                TermsAndConditions.tsx): acá no hay una cancelación con
                100% de penalidad fija por fecha, es una solicitud que un
                asesor revisa y resuelve caso por caso. */}
            <section className="bg-card border border-border rounded-2xl shadow-sm p-8">
              <EncabezadoSeccion icon={ShieldCheck} titulo="Antes de reservar" />
              <Accordion type="single" collapsible className="-mt-2">
                <AccordionItem value="pago">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary shrink-0" />
                      Pago y confirmación
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    El precio se congela solo cuando el pago queda aprobado — total o el
                    anticipo del 50% que elijas (el saldo se paga después). En línea aceptamos
                    Nequi y PayPal.
                  </AccordionContent>
                </AccordionItem>
                {pkg.condiciones && (
                  <AccordionItem value="condiciones">
                    <AccordionTrigger>
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                        Condiciones de este paquete
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground whitespace-pre-line">
                      {pkg.condiciones}
                    </AccordionContent>
                  </AccordionItem>
                )}
                <AccordionItem value="cancelacion">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-primary shrink-0" />
                      Cancelaciones
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Puedes solicitar la cancelación desde tu perfil después de reservar. Un
                    asesor de Alik Tours revisa cada solicitud y te confirma las condiciones de
                    reembolso según el hotel y el tiempo restante hasta el viaje.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <Link
                to="/terms"
                className="inline-flex items-center gap-1 mt-2 text-sm font-semibold text-primary hover:underline"
              >
                Ver términos y condiciones completos
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </section>
          </div>

          {/* Sidebar - Booking Card */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-2xl shadow-xl p-8 sticky top-24">
              <div className="mb-6">
                <p className="text-muted-foreground mb-2">Precio por persona</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-primary">
                    ${pkg.precio_base.toLocaleString("es-CO")}
                  </span>
                </div>
              </div>

              <div className="space-y-3.5 mb-6 pb-6 border-b border-border">
                {pkg.duracion_dias && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      Duración
                    </span>
                    <span className="font-medium text-foreground">{pkg.duracion_dias} días</span>
                  </div>
                )}
                {pkg.hoteles.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <HotelIcon className="w-4 h-4" />
                      Hospedaje
                    </span>
                    <span className="font-medium text-foreground text-right">
                      {pkg.hoteles.length === 1
                        ? (pkg.hoteles[0].calificacion
                            ? `${pkg.hoteles[0].calificacion} estrellas`
                            : pkg.hoteles[0].nombre_hotel)
                        : `${pkg.hoteles.length} hoteles incluidos`}
                    </span>
                  </div>
                )}
                {transportes.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Bus className="w-4 h-4" />
                      Transporte
                    </span>
                    <span className="font-medium text-foreground text-right">
                      {transportes.length === 1
                        ? transportes[0].nombre_servicio
                        : `${transportes.length} tramos incluidos`}
                    </span>
                  </div>
                )}
                {destinoPrincipal && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      Destino
                    </span>
                    <span className="font-medium text-foreground">{destinoPrincipal}</span>
                  </div>
                )}
              </div>

              {pkg.hoteles.length > 0 ? (
                // El checkout real reserva una habitación específica de un
                // hotel (ver Checkout.tsx: espera un id_hotel + ?habitacion=)
                // -- todavía no existe un checkout a nivel de PAQUETE, así
                // que cada hotel incluido manda a su propio flujo real de
                // elegir habitación y fecha en vez de simular una reserva
                // de "paquete completo" que el backend no soporta.
                <div className="space-y-2 mb-4">
                  {pkg.hoteles.map((hotel) => (
                    <Link
                      key={hotel.id_hotel}
                      to={`/hotel/${hotel.id_hotel}`}
                      className="block w-full py-3.5 px-4 bg-primary text-primary-foreground text-center font-semibold rounded-xl hover:opacity-90 transition-all duration-300"
                    >
                      {pkg.hoteles.length > 1
                        ? `Reservar en ${hotel.nombre_hotel}`
                        : "Ver hotel y reservar"}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="w-full py-4 bg-muted text-muted-foreground text-center font-semibold rounded-xl mb-4">
                  Reserva disponible próximamente
                </div>
              )}

              <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground text-center">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Pago 100% seguro
              </p>
            </div>
          </div>
        </div>

        {/* También te puede interesar -- paquetes con destino real parecido
            (GET /paquetes/{id}/similares), nunca una recomendación
            inventada. Se reutiliza PackageResultCard.tsx tal cual. */}
        {similares.length > 0 && (
          <section className="mt-14">
            <h2 className="text-2xl font-semibold mb-6">
              También te puede interesar
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {similares.map((p, idx) => (
                <PackageResultCard key={p.id_paquete} pkg={p} index={idx} />
              ))}
            </div>
          </section>
        )}
      </div>

      <ImageLightbox
        images={fotosLightbox}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
        alt={pkg.nombre_paquete}
      />

      <Footer />
    </div>
  );
}
