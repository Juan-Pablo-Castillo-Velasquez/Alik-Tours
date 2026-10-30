import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Banner, bannerService, resolveImagenBanner } from "../services/banner.service";

const SESSION_KEY = "alectours_welcome_splash_visto";

// Poster de bienvenida a pantalla completa (sección 7 del brief de
// temática estacional) -- ESTE es "el folleto": el anuncio a pantalla
// completa que ve cualquiera al entrar al sitio, no una sección aparte
// en el Home. Un folleto activo (tipo="folleto", solo imagen + link, el
// texto ya viene dibujado en la imagen -- ver ModuleBanners.tsx) tiene
// prioridad; si no hay ninguno, se cae al banner clásico del carrusel
// (tipo="banner", con título/descripción/botón superpuestos). Sin nada
// activo de ningún tipo, el componente simplemente no renderiza nada.
//
// Carrusel: se muestran TODOS los folletos activos (en el orden definido en
// el panel, Banners y folletos -> flechas de orden), no solo el primero.
// Avanza solo cada AUTO_AVANCE_MS, se pausa con el mouse encima y se puede
// mover con flechas, puntos, teclado (← →) o deslizando en el celular.
const AUTO_AVANCE_MS = 5000;

export default function WelcomeSplash() {
  const [items, setItems] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const [direccion, setDireccion] = useState(1);
  const [pausado, setPausado] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Una sola vez por sesión de navegador (no localStorage: se debe
    // volver a mostrar en una sesión/pestaña nueva, pero nunca dos veces
    // en la misma, sin importar cuántas rutas internas se visiten).
    if (sessionStorage.getItem(SESSION_KEY)) return;

    let activo = true;

    const cargar = async () => {
      try {
        const folletos = await bannerService.getActivos("folleto");
        if (!activo) return;
        if (folletos.length > 0) {
          setItems(folletos);
          setVisible(true);
          return;
        }
        const banners = await bannerService.getActivos("banner");
        if (!activo) return;
        if (banners.length > 0) {
          setItems(banners);
          setVisible(true);
        }
      } catch {
        // Sin banners/folletos o backend no disponible en este momento --
        // nunca se muestra un splash vacío ni bloquea la navegación por esto.
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, []);

  const cerrar = useCallback(() => {
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, "1");
  }, []);

  const total = items.length;
  const ir = useCallback(
    (paso: number) => {
      if (total < 2) return;
      setDireccion(paso);
      setIndex((i) => (i + paso + total) % total);
    },
    [total],
  );

  // Avance automático (pausado mientras el mouse está encima).
  useEffect(() => {
    if (!visible || total < 2 || pausado) return;
    const id = setInterval(() => ir(1), AUTO_AVANCE_MS);
    return () => clearInterval(id);
  }, [visible, total, pausado, ir]);

  // Teclado: ← → para moverse, Esc para cerrar.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") ir(1);
      else if (e.key === "ArrowLeft") ir(-1);
      else if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, ir, cerrar]);

  if (total === 0) return null;
  const banner = items[index % total];
  const esFolleto = banner.tipo === "folleto";

  return (
    // bg-black/90 + blur-md (antes /70 + blur-sm): con overlay más liviano se
    // alcanzaba a notar contenido de la página detrás (títulos/números
    // grandes) a través del blur, sobre todo con banners de alto contraste.
    //
    // Sin animación de entrada con escala/desplazamiento ni Ken Burns en la
    // imagen (antes: 6s de zoom continuo) -- pedido explícito: que se vea
    // como un anuncio/popup típico (aparece, se puede cerrar con la X, listo),
    // no una revelación cinematográfica. Solo queda un fade corto para que
    // no aparezca de golpe.
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={cerrar}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setPausado(true)}
            onMouseLeave={() => setPausado(false)}
            className={`relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 ${
              // Folleto: SIN caja de fondo negro ni altura fija -- eso era lo
              // que generaba las franjas negras cuando la imagen no calzaba
              // exacto con el recuadro (object-contain dejando espacio vacío
              // que el bg-black de abajo rellenaba). Ahora el recuadro se
              // ajusta al tamaño real de la imagen ("flota"), sin ancho
              // forzado -- solo un tope para que no se salga de pantalla.
              esFolleto ? "max-w-[92vw] sm:max-w-2xl" : "w-full max-w-lg sm:max-w-xl md:max-w-2xl"
            }`}
          >
            <button
              onClick={cerrar}
              aria-label="Cerrar"
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <X className="w-5 h-5" />
            </button>

            <AnimatePresence mode="wait" initial={false} custom={direccion}>
            <motion.div
              key={banner.id_banner}
              custom={direccion}
              initial={{ opacity: 0, x: direccion * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direccion * -40 }}
              transition={{ duration: 0.25 }}
              drag={total > 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) ir(1);
                else if (info.offset.x > 60) ir(-1);
              }}
              className={esFolleto ? "relative" : "relative h-[26rem] sm:h-[30rem] md:h-[34rem] bg-black"}
            >
              <img
                src={resolveImagenBanner(banner.imagen_url)}
                alt={banner.titulo}
                className={
                  esFolleto
                    // Sin fondo detrás que rellenar: la altura del recuadro
                    // la define la imagen misma (hasta 85% del alto de
                    // pantalla, más alta que el límite fijo anterior), y el
                    // ancho se ajusta solo -- nunca hay hueco que tape un
                    // color de fondo.
                    ? "block w-auto h-auto max-w-full max-h-[85vh] mx-auto"
                    : "absolute inset-0 w-full h-full object-cover"
                }
              />

              {esFolleto ? (
                // Folleto: sin gradiente ni texto superpuesto -- el folleto ES
                // el anuncio, con el texto ya dibujado en la imagen por quien
                // lo diseñó (ver "Nombre interno", que nunca se muestra, en
                // ModuleBanners.tsx). Si trae link, toda la imagen es clicable
                // con un <a> transparente encima (normal, no <Link>: mismo
                // motivo que abajo, este componente vive fuera del Router).
                banner.link_destino && (
                  <a
                    href={banner.link_destino}
                    onClick={cerrar}
                    aria-label={banner.titulo}
                    className="absolute inset-0"
                  />
                )
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
                    <h2
                      className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2"
                      style={{ fontFamily: "'Fraunces', serif" }}
                    >
                      {banner.titulo}
                    </h2>
                    {banner.descripcion_corta && (
                      <p className="text-white/85 text-sm sm:text-base mb-5 max-w-md">{banner.descripcion_corta}</p>
                    )}
                    <div className="flex items-center gap-4">
                      {/* <a> normal, NO <Link> de react-router: este componente se
                          monta a propósito FUERA de <RouterProvider> (ver main.tsx,
                          es un overlay global sobre cualquier ruta) -- un <Link>
                          ahí revienta toda la app con "Cannot destructure property
                          'basename' of useContext(...) as it is null" en cuanto el
                          banner activo trae botón + link (visto en producción). */}
                      {banner.texto_boton && banner.link_destino && (
                        <a
                          href={banner.link_destino}
                          onClick={cerrar}
                          className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground text-sm sm:text-base font-semibold rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all shadow-lg shadow-primary/30"
                        >
                          {banner.texto_boton}
                        </a>
                      )}
                      <button
                        onClick={cerrar}
                        className="text-white/75 hover:text-white text-sm sm:text-base font-medium transition-colors"
                      >
                        Ahora no
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
            </AnimatePresence>

            {total > 1 && (
              <>
                <button
                  onClick={() => ir(-1)}
                  aria-label="Anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => ir(1)}
                  aria-label="Siguiente"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-sm">
                  {items.map((it, i) => (
                    <button
                      key={it.id_banner}
                      onClick={() => {
                        setDireccion(i > index ? 1 : -1);
                        setIndex(i);
                      }}
                      aria-label={`Ver ${i + 1} de ${total}`}
                      className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/55 hover:bg-white/80"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
