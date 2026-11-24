import { CSSProperties, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useTema } from "../../context/TemaContext";
import { decoracionDeTema, EfectoTemporada, rutaPermiteAmbiente } from "./temporadas";
import { useAnimacionTemporada } from "./useAnimacionTemporada";

// Capa fija DETRÁS del contenido con lo que "cae" en cada temporada: nieve
// en Navidad, confeti en Fin de año, corazones en Amor y Amistad, etc.
// Es decoración pura (aria-hidden, sin eventos de puntero) y no se monta
// en el panel admin ni en los pasos de pago.

// Generador determinista: mismas posiciones en cada render, sin Math.random
// (evita que las partículas salten de sitio cuando React vuelve a pintar).
function aleatorio(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const COLORES: Record<EfectoTemporada, string[]> = {
  nieve: ["var(--temporada-copo)"],
  corazones: ["#e5484d", "#f2788f", "var(--primary)"],
  confeti: ["var(--gold)", "var(--primary)", "#4c9ffe", "#3fb27f", "#f2788f"],
  hojas: ["#d9822b", "#b5541c", "#e0a526"],
  petalos: ["#f6c1d0", "#fbe3ea", "#f29bb4"],
  destellos: ["var(--gold)", "#ffffff"],
};

function Forma({ efecto, variante, color }: { efecto: EfectoTemporada; variante: number; color: string }) {
  switch (efecto) {
    case "nieve":
      // 1 de cada 3 es un copo de seis brazos; el resto, motas redondas.
      return variante % 3 === 0 ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--temporada-copo-linea)" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" />
          <path d="M12 5.5 9.8 3.6M12 5.5l2.2-1.9M12 18.5l-2.2 1.9M12 18.5l2.2 1.9" />
        </svg>
      ) : (
        <svg viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="4.6" fill={color} stroke="var(--temporada-copo-borde)" strokeWidth="1" />
        </svg>
      );
    case "corazones":
      return (
        <svg viewBox="0 0 24 24" fill={color}>
          <path d="M12 21s-7.5-4.7-9.6-9.4C.9 8 2.8 4.5 6.3 4.5c2.2 0 3.7 1.2 5.7 3.4 2-2.2 3.5-3.4 5.7-3.4 3.5 0 5.4 3.5 3.9 7.1C19.5 16.3 12 21 12 21Z" />
        </svg>
      );
    case "confeti":
      return variante % 2 === 0 ? (
        <svg viewBox="0 0 12 12">
          <rect x="2" y="4" width="8" height="4" rx="1" fill={color} />
        </svg>
      ) : (
        <svg viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="3.2" fill={color} />
        </svg>
      );
    case "hojas":
      return (
        <svg viewBox="0 0 24 24" fill={color}>
          <path d="M12 2c5 3 8 7 8 12a8 8 0 0 1-16 0c0-5 3-9 8-12Z" />
          <path d="M12 6v15" stroke="rgba(0,0,0,0.25)" strokeWidth="1" fill="none" />
        </svg>
      );
    case "petalos":
      return (
        <svg viewBox="0 0 24 24" fill={color}>
          <path d="M12 3c4 4 6 8 6 11a6 6 0 0 1-12 0c0-3 2-7 6-11Z" />
        </svg>
      );
    case "destellos":
      return (
        <svg viewBox="0 0 24 24" fill={color}>
          <path d="M12 1.5 14 10l8.5 2-8.5 2-2 8.5-2-8.5-8.5-2L10 10Z" />
        </svg>
      );
  }
}

function usePantallaAngosta(): boolean {
  const [angosta, setAngosta] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const alRedimensionar = () => setAngosta(window.innerWidth < 768);
    window.addEventListener("resize", alRedimensionar);
    return () => window.removeEventListener("resize", alRedimensionar);
  }, []);
  return angosta;
}

export default function AmbienteTemporada() {
  const { temaActivo } = useTema();
  const { pathname } = useLocation();
  const { activa, reducida } = useAnimacionTemporada();
  const angosta = usePantallaAngosta();
  const { efecto } = decoracionDeTema(temaActivo);

  // El resto de adornos animados (guirnalda, tarjetas) leen este atributo
  // desde CSS para detenerse cuando el visitante pausa la animación.
  useEffect(() => {
    document.documentElement.setAttribute("data-animacion-temporada", activa ? "on" : "off");
  }, [activa]);

  // Menos partículas y más tenues que antes: es ambiente, no protagonista.
  const cantidad = angosta ? 12 : 28;
  const particulas = useMemo(() => {
    if (!efecto) return [];
    const r = aleatorio(20261225);
    const colores = COLORES[efecto];
    // La nieve cae lento y recto; el confeti y las hojas giran más.
    const gira = efecto === "nieve" ? 60 : 320;
    return Array.from({ length: cantidad }, (_, i) => {
      const tam = efecto === "nieve" ? 5 + r() * 11 : 9 + r() * 10;
      const dur = 12 + r() * 14;
      return {
        id: i,
        color: colores[i % colores.length],
        estilo: {
          "--x": `${(r() * 100).toFixed(2)}%`,
          "--tam": `${tam.toFixed(1)}px`,
          "--op": (0.4 + r() * 0.35).toFixed(2),
          "--dur": `${dur.toFixed(1)}s`,
          // Retraso negativo: la pantalla arranca ya "nevada", no vacía.
          "--retraso": `${(-r() * dur).toFixed(1)}s`,
          "--vaiven": `${(2.5 + r() * 3).toFixed(1)}s`,
          "--amp": `${(8 + r() * 22).toFixed(0)}px`,
          "--giro": `${(r() * gira).toFixed(0)}deg`,
        } as CSSProperties,
      };
    });
  }, [efecto, cantidad]);

  if (!efecto || !activa || reducida || !rutaPermiteAmbiente(pathname)) return null;

  return (
    <div className="temporada-ambiente" aria-hidden="true" data-testid="ambiente-temporada" data-efecto={efecto}>
      {particulas.map((p) => (
        <div key={p.id} className="temporada-particula" style={p.estilo}>
          <span>
            <Forma efecto={efecto} variante={p.id} color={p.color} />
          </span>
        </div>
      ))}
    </div>
  );
}
