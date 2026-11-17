import { CSSProperties } from "react";
import { useTema } from "../../context/TemaContext";
import { getTemaIcono } from "../../utils/temaIconos";
import { decoracionDeTema } from "./temporadas";

interface Props {
  /** "sm" para tarjetas del listado, "lg" para portadas grandes (detalle). */
  tamano?: "sm" | "lg";
  /** Muestra la insignia "Especial de …" en la esquina inferior derecha. */
  insignia?: boolean;
  /** Los copos caen siempre (portadas) en vez de solo al pasar el cursor. */
  coposSiempre?: boolean;
}

// Adorno de temporada para la FOTO de una tarjeta (paquete, hotel, destino).
// El contenedor debe ser `relative overflow-hidden`, y la tarjeta llevar la
// clase `group` para que los copos aparezcan al pasar el cursor. Sin tema de
// temporada activo no renderiza nada.
//
// Trazos propios (nieve con carámbanos, acebo): no depende de imágenes
// externas ni de licencias de terceros.
const COPOS = [
  { x: "12%", tam: "4px", dur: "3.6s", retraso: "-0.4s", deriva: "14px" },
  { x: "31%", tam: "6px", dur: "4.8s", retraso: "-2.1s", deriva: "-10px" },
  { x: "52%", tam: "3px", dur: "3.1s", retraso: "-1.2s", deriva: "8px" },
  { x: "68%", tam: "5px", dur: "4.2s", retraso: "-3s", deriva: "-16px" },
  { x: "86%", tam: "4px", dur: "3.9s", retraso: "-0.9s", deriva: "12px" },
];

function Acebo({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className}>
      <path
        d="M30 26C22 24 16 18 6 20c3 3 2 6 5 8-4 1-5 4-9 5 8 5 18 3 28-7Z"
        fill="#2f8f5b"
        stroke="#1d6b41"
        strokeWidth="1"
      />
      <path
        d="M34 26c8-2 14-8 24-6-3 3-2 6-5 8 4 1 5 4 9 5-8 5-18 3-28-7Z"
        fill="#37a468"
        stroke="#1d6b41"
        strokeWidth="1"
      />
      <circle cx="29" cy="24" r="5" fill="#d92d3a" />
      <circle cx="36" cy="22" r="5" fill="#e5484d" />
      <circle cx="33" cy="30" r="5" fill="#c81e2d" />
      <circle cx="27.5" cy="22.5" r="1.3" fill="#fff" opacity="0.7" />
      <circle cx="34.5" cy="20.5" r="1.3" fill="#fff" opacity="0.7" />
    </svg>
  );
}

export default function AdornoTarjeta({ tamano = "sm", insignia = false, coposSiempre = false }: Props) {
  const { temaActivo } = useTema();
  const deco = decoracionDeTema(temaActivo);
  if (!deco.efecto) return null;

  const Icono = getTemaIcono(temaActivo?.icono);
  const grande = tamano === "lg";

  return (
    <>
      {deco.nieveAcumulada && (
        <>
          <div
            className={`temporada-nieve-borde ${grande ? "h-9" : "h-5"}`}
            aria-hidden="true"
            data-testid="adorno-nieve"
          >
            <svg viewBox="0 0 400 30" preserveAspectRatio="none" fill="currentColor">
              <path d="M0 0h400v9c-8 5-14 1-20 4-5 3-4 13-9 13s-3-10-9-12c-10-3-16 4-27 2-7-1-8 8-13 8s-4-8-11-9c-12-2-17 5-29 3-6-1-6 9-11 9s-4-9-10-11c-11-3-18 4-30 2-7-1-7 10-12 10s-4-10-11-11c-12-2-16 4-28 3-6-1-7 7-12 7s-4-7-10-9c-11-3-19 5-31 3-7-1-7 9-12 9s-4-9-10-10c-12-2-18 3-29 2-7-1-8 8-13 8s-3-8-10-10c-9-3-15 1-23-4Z" />
            </svg>
          </div>
          <div className="temporada-copos-tarjeta" aria-hidden="true" data-siempre={coposSiempre}>
            {COPOS.map((c, i) => (
              <i
                key={i}
                style={
                  {
                    "--x": c.x,
                    "--tam": c.tam,
                    "--dur": c.dur,
                    "--retraso": c.retraso,
                    "--deriva": c.deriva,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <Acebo
            className={`pointer-events-none absolute z-[6] drop-shadow-md ${
              grande ? "right-4 top-3 w-20" : "right-1.5 top-0.5 w-11"
            }`}
          />
        </>
      )}

      {insignia && (
        <span
          className={`pointer-events-none absolute z-[6] flex items-center gap-1 rounded-full bg-[var(--gold)] font-bold text-[var(--gold-foreground)] shadow-md ${
            grande ? "bottom-4 right-4 px-3.5 py-1.5 text-xs" : "bottom-2.5 right-2.5 px-2 py-0.5 text-[10px]"
          }`}
          data-testid="insignia-temporada"
        >
          <Icono className={grande ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden="true" />
          {deco.etiqueta}
        </span>
      )}
    </>
  );
}
