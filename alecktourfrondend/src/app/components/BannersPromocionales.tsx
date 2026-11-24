import { ArrowRight, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BRAND } from "../config/brand";
import { Banner, bannerService, resolveImagenBanner } from "../services/banner.service";
import AdornoTarjeta from "./temporada/AdornoTarjeta";

const SITIO = BRAND.siteUrl.replace(/^https?:\/\//, "");

const AUTO_AVANCE_MS = 6000;

// Carrusel de banners publicitarios (sección 7 del plan de mejora) — a
// diferencia de OffersHighlight.tsx (que sí tiene datos reales de hoteles),
// este contenido es 100% administrado a mano desde ModuleBanners.tsx, así
// que si el admin no ha creado ninguno la sección simplemente no se
// renderiza (mismo criterio que el resto del home: nunca un bloque vacío).
export default function BannersPromocionales() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let activo = true;
    bannerService
      .getActivos("banner") // nunca folletos (esos solo van en el splash de bienvenida, ver WelcomeSplash.tsx)
      .then((data) => { if (activo) setBanners(data); })
      .catch((err) => console.error("Error cargando banners:", err))
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % banners.length), AUTO_AVANCE_MS);
    return () => clearInterval(id);
  }, [banners.length]);

  if (loading || banners.length === 0) return null;

  const banner = banners[index % banners.length];
  const anterior = () => setIndex((i) => (i - 1 + banners.length) % banners.length);
  const siguiente = () => setIndex((i) => (i + 1) % banners.length);

  // Cada banner es una pieza publicitaria completa: lleva la marca y la
  // dirección del sitio (para que la imagen "venda" la web aunque se
  // comparta como captura), el mensaje y un botón claro hacia la sección
  // que promociona.
  const Contenido = (
    <>
      <img
        src={resolveImagenBanner(banner.imagen_url)}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <AdornoTarjeta tamano="lg" />

      <div className="absolute left-6 top-6 sm:left-10 sm:top-8 flex items-center gap-2.5 text-white">
        <img
          src={BRAND.logo}
          alt=""
          className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white object-cover ring-2 ring-white/70"
        />
        <div className="leading-tight">
          <p className="text-sm sm:text-base font-extrabold tracking-tight">{BRAND.name}</p>
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.18em] text-[var(--gold-surface)]">
            {BRAND.slogan}
          </p>
        </div>
      </div>

      <div className="absolute bottom-16 left-6 right-6 sm:bottom-12 sm:left-10 sm:right-auto sm:max-w-xl text-white">
        <h3
          className="text-2xl sm:text-4xl font-bold leading-tight mb-2 text-balance"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {banner.titulo}
        </h3>
        {banner.descripcion_corta && (
          <p className="text-white/85 text-sm sm:text-base mb-4">{banner.descripcion_corta}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {banner.texto_boton && (
            <span className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[var(--gold)] text-[var(--gold-foreground)] text-sm font-bold rounded-xl shadow-lg">
              {banner.texto_boton}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </span>
          )}
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-white/80">
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            {SITIO}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="relative h-80 sm:h-96 lg:h-[26rem] rounded-2xl overflow-hidden shadow-lg">
        <AnimatePresence mode="wait">
          <motion.div
            key={banner.id_banner}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            {banner.link_destino ? (
              <Link to={banner.link_destino} className="group block relative w-full h-full">
                {Contenido}
              </Link>
            ) : (
              <div className="relative w-full h-full">{Contenido}</div>
            )}
          </motion.div>
        </AnimatePresence>

        {banners.length > 1 && (
          <>
            <button
              onClick={anterior}
              aria-label="Banner anterior"
              className="absolute right-14 bottom-3 sm:right-auto sm:bottom-auto sm:left-3 sm:top-1/2 sm:-translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={siguiente}
              aria-label="Siguiente banner"
              className="absolute right-3 bottom-3 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-6 left-6 sm:bottom-3 sm:left-1/2 sm:-translate-x-1/2 flex items-center gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id_banner}
                  onClick={() => setIndex(i)}
                  aria-label={`Ir al banner ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === index % banners.length ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
