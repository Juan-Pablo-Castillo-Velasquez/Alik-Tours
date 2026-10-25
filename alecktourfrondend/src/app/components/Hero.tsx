import { Compass, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { apiGetResenasDestacadas } from "../api/v1/api";
import { useTema } from "../context/TemaContext";
import { HotelDetailResponse, hotelService } from "../services/hotel.service";
import { resolveVideoTema } from "../services/tema.service";
import HalloweenAccents from "./HalloweenAccents";
import SearchBar from "./SearchBar";

// Clip aéreo de playa, libre de derechos (Mixkit — uso comercial y personal
// permitido, sin atribución obligatoria). Si falla la carga, se oculta y
// queda la foto estática de fondo (que siempre está presente debajo).
const HERO_VIDEO_URL = "https://assets.mixkit.co/videos/5371/5371-360.mp4";

export default function Hero() {
  const [videoFailed, setVideoFailed] = useState(false);
  // El video arranca en opacidad 0 hasta que el navegador ya decodificó un
  // primer frame real (onLoadedData) -- antes se animaba a opacidad 1 apenas
  // se montaba el <video>, así que si el clip todavía no había descargado
  // nada se veía un fundido hacia un cuadro vacío que después "saltaba" al
  // primer frame real cuando por fin cargaba.
  const [videoListo, setVideoListo] = useState(false);
  const { temaActivo } = useTema();
  const esHalloween = temaActivo?.clave === "halloween";

  // Si el tema activo tiene su propio video decorativo (subido por el
  // admin, ver ModuleTemas.tsx), se usa ese para el fondo del Hero; si no
  // tiene ninguno, se cae al clip genérico de por defecto -- el Hero
  // nunca se queda sin video de fondo por un tema sin configurar.
  const heroVideoUrl = temaActivo?.video_url
    ? resolveVideoTema(temaActivo.video_url)
    : HERO_VIDEO_URL;
  const heroVideoTipo = heroVideoUrl.toLowerCase().endsWith(".webm")
    ? "video/webm"
    : "video/mp4";

  // Si cambia el video (ej. el admin activa otro tema mientras el sitio
  // está abierto), se le da otra oportunidad de cargar en vez de quedar
  // escondido para siempre por el fallo de un video anterior distinto.
  useEffect(() => {
    setVideoFailed(false);
    setVideoListo(false);
  }, [heroVideoUrl]);

  // Estadísticas reales del catálogo (nunca inventadas): se calculan a
  // partir de los hoteles y reseñas que realmente existen en la base de
  // datos, no de cifras de marketing fijas en el código.
  const [hoteles, setHoteles] = useState<HotelDetailResponse[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [resenasPromedio, setResenasPromedio] = useState<number | null>(null);
  const [resenasTotal, setResenasTotal] = useState<number | null>(null);

  useEffect(() => {
    let activo = true;

    Promise.all([
      hotelService.getAll(0, 100),
      apiGetResenasDestacadas().catch(() => null),
    ])
      .then(([listaHoteles, resenas]) => {
        if (!activo) return;
        setHoteles(listaHoteles);
        if (resenas) {
          setResenasPromedio(resenas.promedio);
          setResenasTotal(resenas.total);
        }
      })
      .catch(() => {
        // Si falla, el bloque de estadísticas simplemente no se muestra
        // (mejor omitir que mostrar un número inventado).
      })
      .finally(() => {
        if (activo) setStatsLoading(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  const totalHoteles = hoteles.length;
  const totalHotelesLabel = totalHoteles >= 100 ? "100+" : String(totalHoteles);

  const totalDestinos = new Set(hoteles.map((h) => h.ciudad).filter(Boolean))
    .size;

  const totalHabitacionesDisponibles = hoteles.reduce(
    (suma, h) =>
      suma +
      (h.habitaciones?.filter(
        (hab) => hab.estado?.toLowerCase() === "disponible",
      ).length ?? 0),
    0,
  );

  // El backend reporta un promedio de respaldo (5.0) cuando aún no hay
  // ninguna reseña real — por eso el promedio solo se muestra si el total
  // de reseñas es mayor a cero, para no aparentar un puntaje real inexistente.
  const hayResenasReales = resenasTotal != null && resenasTotal > 0;

  const stats = [
    { value: totalHotelesLabel, label: "hoteles" },
    { value: String(totalDestinos), label: "destinos" },
    {
      value:
        hayResenasReales && resenasPromedio != null
          ? `${resenasPromedio.toFixed(1)}★`
          : "—",
      label: hayResenasReales
        ? `${resenasTotal} reseña${resenasTotal !== 1 ? "s" : ""}`
        : "reseñas",
    },
    { value: String(totalHabitacionesDisponibles), label: "hab. libres" },
  ];

  return (
    <section className="relative overflow-hidden bg-background transition-colors duration-300">
      {/* Fondo */}
      <div className="absolute inset-0 z-0">
        {/* Clip de fondo: capa opcional encima de la foto, se retira sola si no carga */}
        {!videoFailed && (
          <motion.video
            key={heroVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoFailed(true)}
            onLoadedData={() => setVideoListo(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: videoListo ? 1 : 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          >
            <source src={heroVideoUrl} type={heroVideoTipo} />
          </motion.video>
        )}

        {/* Scrim oscuro sobre la foto/video, no el --background del tema.
            Antes este degradado usaba --background (claro tipo "hueso"),
            pensado para que el Hero se sintiera "adaptable a tu tema" --
            pero un fondo casi blanco encima de una foto le resta
            profundidad y separación real entre texto/buscador y la
            imagen. Un hero con foto de fondo necesita su propio scrim
            oscuro para que el texto siempre sea legible, sin importar si
            el resto del sitio está en modo claro u oscuro -- por eso el
            texto de este bloque pasa a blanco fijo más abajo, en vez de
            los tokens text-foreground/text-muted-foreground de siempre. */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--gold)]/50 to-transparent" />
      </div>

      {/* Acentos decorativos de Halloween (calabaza/murciélagos/telaraña
          en las esquinas) -- solo cuando ese tema de temporada está
          activo, ver TemaContext.tsx. Puramente decorativo y sin
          interacción (pointer-events-none), sombras mínimas. */}
      {esHalloween && <HalloweenAccents />}

      {/* Contenido principal */}
      <div
        className="
                    relative z-10
                    max-w-[1450px]
                    mx-auto
                    px-4 sm:px-6 lg:px-10
                    pt-16 pb-20
                    md:pt-20 md:pb-24
                    grid grid-cols-1
                    lg:grid-cols-[minmax(0,1fr)_760px]
                    gap-10 lg:gap-16
                    items-center
                "
      >
        {/* =========================
                    CONTENIDO IZQUIERDO
                ========================== */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            ease: [0.25, 1, 0.5, 1],
          }}
        >
          {/* Badge — antes usaba bg-background/border-border (tokens de
              tema claro/oscuro); con el scrim oscuro de fondo se vuelve
              vidrio blanco fijo, igual que el resto de este bloque. */}
          <div
            className="
                            inline-flex
                            items-center
                            gap-2
                            mb-5
                            px-3
                            py-1.5
                            rounded-full
                            border
                            border-white/25
                            bg-white/10
                            backdrop-blur-md
                        "
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />

            <span
              className="
                                text-[var(--gold)]
                                text-[10px]
                                font-bold
                                tracking-[0.2em]
                                uppercase
                            "
            >
              Tarifas exclusivas para Colombia
            </span>
          </div>

          {/* Título */}
          <h1
            className="
                            text-white
                            text-4xl
                            sm:text-5xl
                            md:text-[54px]
                            font-normal
                            leading-[1.05]
                            mb-5
                            tracking-tight
                            max-w-xl
                        "
            style={{
              fontFamily: "'Fraunces', serif",
            }}
          >
            Tu próximo viaje
            <br />
            empieza <span className="italic text-[var(--gold)]">aquí.</span>
          </h1>

          {/* Descripción */}
          <p
            className="
                            text-white/75
                            text-sm
                            sm:text-[15px]
                            max-w-md
                            leading-relaxed
                            font-light
                            mb-7
                        "
          >
            Compara vuelos, hoteles y experiencias en un solo lugar. Encuentra
            destinos increíbles con precios transparentes y acompañamiento real.
          </p>

          {/* Botones */}
          <div className="flex flex-wrap gap-3 mb-8">
            <a
              href="/search"
              className="
                                inline-flex
                                items-center
                                gap-2
                                px-5
                                py-3
                                rounded-xl
                                bg-primary
                                text-primary-foreground
                                text-[13px]
                                font-bold
                                hover:-translate-y-0.5
                                transition-transform
                                shadow-sm
                                shadow-black/20
                            "
            >
              <Compass className="w-4 h-4" />
              Explorar destinos
            </a>
          </div>

          {/* Confianza — dato real (conteo real de hoteles del catálogo),
              no una cifra de marketing ni fotos de "viajeros" inventados.
              Antes este bloque no existía en el DOM mientras cargaba y
              "aparecía de golpe" al resolver el fetch -- ahora muestra un
              esqueleto del mismo tamaño mientras carga, para que no haya
              ningún salto de layout ni parpadeo cuando llega el dato real. */}
          <AnimatePresence mode="wait">
            {statsLoading ? (
              <motion.div
                key="confianza-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2.5 animate-pulse"
                aria-hidden="true"
              >
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-2.5 w-32 rounded-full bg-white/15" />
                  <div className="h-2.5 w-24 rounded-full bg-white/10" />
                </div>
              </motion.div>
            ) : (
              totalHoteles > 0 && (
                <motion.div
                  key="confianza-real"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex items-center gap-2.5"
                >
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-[var(--gold)]" />
                  </div>

                  <p className="text-[11px] text-white/70 leading-tight">
                    <b className="text-white">
                      +{totalHotelesLabel} hoteles verificados
                    </b>
                    <br />
                    listos para reservar hoy
                  </p>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </motion.div>

        {/* =========================
                    BUSCADOR
                ========================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            delay: 0.15,
            ease: [0.25, 1, 0.5, 1],
          }}
          className="
                        w-full
                        lg:max-w-[760px]
                        lg:justify-self-end
                    "
        >
          <SearchBar />
        </motion.div>
      </div>

      {/* =========================
                STATS — cifras reales calculadas del catálogo actual
                (hoteles, destinos y reseñas reales), no cifras fijas.
            ========================== */}
      {/* Antes este bloque entero no existía en el DOM mientras
          statsLoading era true, y las 4 tarjetas "aparecían de golpe" con
          su ancho real apenas resolvía el fetch de hoteles/reseñas --
          ahora el contenedor siempre está montado y muestra un esqueleto
          del mismo tamaño mientras carga, así no hay ningún salto de
          layout ni parpadeo cuando llega el dato real. */}
      <div
        className="
                    hidden
                    lg:flex
                    absolute
                    right-4
                    sm:right-6
                    lg:right-8
                    bottom-6
                    gap-3
                    z-10
                "
      >
        <AnimatePresence mode="wait">
          {statsLoading ? (
            <motion.div
              key="stats-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-3 animate-pulse"
              aria-hidden="true"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="min-w-[92px] px-4 py-3.5 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md"
                >
                  <div className="h-5 w-10 rounded bg-white/20 mb-2" />
                  <div className="h-2 w-14 rounded-full bg-white/15" />
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="stats-real"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex gap-3"
            >
              {/* Antes: min-w-[76px]/rounded-[9px]/bg-background -- un radio
                  que no existe en ningún otro lado del sitio (todo lo demás
                  usa rounded-xl/2xl) y un número casi ilegible a text-sm.
                  Mismo criterio de vidrio blanco que el resto del Hero, más
                  aire y un número que realmente se lea desde lejos. */}
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="
                                min-w-[92px]
                                px-4
                                py-3.5
                                rounded-xl
                                border
                                border-white/20
                                bg-white/10
                                backdrop-blur-md
                            "
                >
                  <strong className="block text-white text-xl font-extrabold tabular-nums leading-tight">
                    {s.value}
                  </strong>

                  <span
                    className="
                                    text-white/65
                                    text-[9px]
                                    font-semibold
                                    uppercase
                                    tracking-wide
                                "
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
