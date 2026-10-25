import { motion } from "motion/react";
import { useTemaGaleria } from "../hooks/useTemaGaleria";

type Variante = "telarana" | "murcielago" | "calabaza" | "foto";
type Posicion = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface Props {
  variante: Variante;
  posicion?: Posicion;
  /** Tamaño del motivo -- las secciones grandes (portadas, banners) usan
   * "lg", las tarjetas/paneles más chicos "sm". */
  tamano?: "sm" | "lg";
}

const POSICION_CLASES: Record<Posicion, string> = {
  "top-left": "-top-3 -left-3",
  "top-right": "-top-3 -right-3",
  "bottom-left": "-bottom-3 -left-3",
  "bottom-right": "-bottom-3 -right-3",
};

// Mismos trazos que HalloweenAccents.tsx (geometría propia, sin depender
// de ningún ícono de terceros) pero pensados para usarse UNO A LA VEZ en
// una tarjeta o el header de una sección -- no los 3 juntos como en el
// Hero. Cada sección elige un solo `variante` distinto para que la
// temporada se sienta variada en vez de repetir siempre la misma
// telaraña (pedido explícito: "no limitarse a un solo ícono repetido en
// todos lados").
function Telarana({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M0 0L120 0M0 0L120 40M0 0L120 80M0 0L120 120M0 0L80 120M0 0L40 120M0 0L0 120" />
      <path d="M30 0A30 30 0 0 1 0 30" />
      <path d="M60 0A60 60 0 0 1 0 60" />
      <path d="M90 0A90 90 0 0 1 0 90" />
    </svg>
  );
}

function Murcielago({ className }: { className: string }) {
  return (
    <motion.svg
      viewBox="0 0 64 32"
      className={className}
      fill="currentColor"
      animate={{ y: [0, -6, 0], x: [0, 5, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
    >
      <path d="M32 10c-2-4-8-8-14-6 3 1 5 3 6 5-6-2-12 0-16 5 5-1 9 0 11 2-5 1-9 4-11 8 5-3 10-4 14-3-2 3-2 6-1 9 2-4 5-7 11-9 6 2 9 5 11 9 1-3 1-6-1-9 4-1 9 0 14 3-2-4-6-7-11-8 2-2 6-3 11-2-4-5-10-7-16-5 1-2 3-4 6-5-6-2-12 2-14 6Z" />
    </motion.svg>
  );
}

function Calabaza({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 30c0-10 5-16 12-16s12 6 12 16-5 20-12 20-12-10-12-20Z" />
      <path d="M26 16c2-6 4-9 6-9M38 16c-2-6-4-9-6-9" strokeLinecap="round" />
      <path d="M26 20v26M32 14v36M38 20v26" strokeWidth="1.5" opacity="0.6" />
      <rect x="29" y="4" width="6" height="8" rx="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Una sola foto real de la galería de Cloudinary de la temporada (ver
// useTemaGaleria.ts), en un marco tipo polaroid con una leve rotación --
// para que la decoración no dependa solo de SVG dibujados a mano, y el
// sitio se sienta "vivo" con imágenes reales cuando alguien las suba
// directo a Cloudinary. Si todavía no hay ninguna imagen en la carpeta de
// esta temporada, no renderiza nada (nunca deja un marco vacío).
function FotoPolaroid({
  className,
  posicion,
  imagenes,
}: {
  className: string;
  posicion: Posicion;
  imagenes: string[];
}) {
  if (imagenes.length === 0) return null;
  // Determinístico (no random en cada render) para que no "parpadee"
  // entre fotos distintas al re-renderizar el componente.
  const foto = imagenes[0];
  const rotacion = posicion.includes("left") ? "-rotate-6" : "rotate-6";

  return (
    <div className={`${className} ${rotacion} bg-white p-1.5 pb-4 rounded-sm shadow-lg`}>
      <img
        src={foto}
        alt=""
        aria-hidden="true"
        className="w-full h-full object-cover rounded-[1px]"
        loading="lazy"
      />
    </div>
  );
}

// Palabras clave para reconocer el motivo en el nombre real del archivo
// subido a Cloudinary (Alik tours/temporadas/<clave>/) -- ej. subir
// "calabaza-recorte.png" hace que el motivo "calabaza" use esa imagen
// real en vez del SVG. Sin coincidencia (o sin Cloudinary configurado, o
// carpeta vacía todavía) se cae al SVG de siempre: nunca rompe nada ni
// deja un hueco, mismo criterio que ya usa la variante "foto".
const PALABRAS_CLAVE: Record<"telarana" | "murcielago" | "calabaza", string[]> = {
  // Cloudinary limpia automáticamente los acentos/ñ de los nombres de
  // archivo al subirlos, así que basta con las formas sin tilde.
  telarana: ["telarana", "spiderweb", "cobweb"],
  murcielago: ["murcielago", "bat"],
  calabaza: ["calabaza", "pumpkin"],
};

function buscarImagenPorMotivo(
  imagenes: string[],
  variante: "telarana" | "murcielago" | "calabaza"
): string | null {
  const palabras = PALABRAS_CLAVE[variante];
  const match = imagenes.find((url) => {
    const nombre = url.toLowerCase();
    return palabras.some((palabra) => nombre.includes(palabra));
  });
  return match ?? null;
}

// Decoración de temporada para UNA sección o tarjeta -- a diferencia de
// HalloweenAccents.tsx (pensado para cubrir todo el Hero con 3 motivos a
// la vez), este componente muestra un único motivo discreto, para
// respetar el criterio de "máximo un elemento decorativo por tarjeta o
// sección" del resto del sitio. El padre debe tener position:relative y
// overflow-hidden (u overflow visible si se prefiere que sobresalga un
// poco del borde, como las esquinas del Hero) para que se vea bien.
export default function HalloweenAccentDiscreto({
  variante,
  posicion = "top-right",
  tamano = "sm",
}: Props) {
  const { imagenes } = useTemaGaleria();
  const posicionClase = POSICION_CLASES[posicion];
  const tamanoClase = tamano === "lg" ? "w-20 h-20 sm:w-24 sm:h-24" : "w-12 h-12 sm:w-14 sm:h-14";

  if (variante === "foto") {
    return (
      <div className="absolute inset-0 z-[6] overflow-visible pointer-events-none" aria-hidden="true">
        <FotoPolaroid
          posicion={posicion}
          imagenes={imagenes}
          className={`absolute ${posicionClase} w-16 h-20 sm:w-20 sm:h-24`}
        />
      </div>
    );
  }

  const imagenReal = buscarImagenPorMotivo(imagenes, variante);

  return (
    <div className="absolute inset-0 z-[6] overflow-hidden pointer-events-none" aria-hidden="true">
      {imagenReal ? (
        <img
          src={imagenReal}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className={`absolute ${posicionClase} ${tamanoClase} object-contain drop-shadow-lg`}
        />
      ) : (
        <>
          {variante === "telarana" && (
            <Telarana className={`absolute ${posicionClase} ${tamanoClase} text-primary/15`} />
          )}
          {variante === "murcielago" && (
            <Murcielago className={`absolute ${posicionClase} ${tamanoClase} text-primary/25`} />
          )}
          {variante === "calabaza" && (
            <Calabaza className={`absolute ${posicionClase} ${tamanoClase} text-primary/15`} />
          )}
        </>
      )}
    </div>
  );
}
