import EstrellasTitilantes from "./EstrellasTitilantes";
import TrineoNavidad from "./TrineoNavidad";

// Acentos navideños para la portada (Hero) cuando el tema activo trae
// nieve: ramas de pino en las esquinas superiores, esferas que se mecen y
// un par de copos grandes girando despacio. Equivalente navideño de
// HalloweenAccents.tsx; trazos propios y aria-hidden (decoración pura).
function Rama({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} fill="none" strokeLinecap="round">
      <path d="M0 6C60 10 120 30 190 96" stroke="#1d5c3a" strokeWidth="4" />
      <g stroke="#2f8f5b" strokeWidth="3">
        <path d="M20 8l-6 22M20 8l14 18M44 13l-8 24M44 13l14 20M68 22l-9 25M68 22l13 22M92 34l-10 25M92 34l12 23M116 48l-11 24M116 48l11 24M140 64l-12 22M140 64l10 24M164 80l-12 20M164 80l8 22" />
      </g>
      <g stroke="#48b47c" strokeWidth="2" opacity="0.8">
        <path d="M32 10l-4 16M56 17l-5 18M80 28l-6 18M104 41l-7 18M128 56l-8 17M152 72l-8 16" />
      </g>
    </svg>
  );
}

function Esfera({ color, className, retraso }: { color: string; className: string; retraso: string }) {
  return (
    <div className={`absolute temporada-mecer ${className}`} style={{ animationDelay: retraso }}>
      <svg viewBox="0 0 40 90" className="h-full w-full">
        <path d="M20 0v46" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
        <rect x="15" y="44" width="10" height="7" rx="2" fill="#d8b45a" />
        <circle cx="20" cy="68" r="18" fill={color} />
        <path d="M4 64c10 6 22 6 32 0" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" fill="none" />
        <circle cx="13" cy="60" r="4" fill="#fff" opacity="0.45" />
      </svg>
    </div>
  );
}

function CopoGrande({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`absolute temporada-girar-lento ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M24 3v42M5.8 13.5l36.4 21M5.8 34.5l36.4-21" />
      <path d="M24 10l-5-5M24 10l5-5M24 38l-5 5M24 38l5 5M11.9 17l-6.8-1.8M11.9 17l-1.8-6.8M36.1 31l6.8 1.8M36.1 31l1.8 6.8M11.9 31l-6.8 1.8M11.9 31l-1.8 6.8M36.1 17l6.8-1.8M36.1 17l1.8-6.8" />
    </svg>
  );
}

export default function AcentosNavidad() {
  return (
    <div
      className="absolute inset-0 z-[6] overflow-hidden pointer-events-none"
      aria-hidden="true"
      data-testid="acentos-navidad"
    >
      <EstrellasTitilantes />
      <TrineoNavidad />
      <Rama className="absolute -left-2 -top-1 w-40 sm:w-56 opacity-90" />
      <Rama className="absolute -right-2 -top-1 w-40 sm:w-56 opacity-90 -scale-x-100" />

      <Esfera color="#d92d3a" className="left-[9%] top-0 h-20 w-9 sm:h-24 sm:w-11" retraso="0s" />
      <Esfera color="var(--gold)" className="left-[17%] top-0 hidden h-16 w-7 sm:block" retraso="-1.6s" />
      <Esfera color="#2f8f5b" className="right-[10%] top-0 h-20 w-9 sm:h-24 sm:w-11" retraso="-0.8s" />
      <Esfera color="#d92d3a" className="right-[18%] top-0 hidden h-16 w-7 sm:block" retraso="-2.4s" />

      <CopoGrande className="right-[6%] top-[38%] hidden h-16 w-16 text-white/25 md:block" />
      <CopoGrande className="left-[4%] bottom-[18%] h-10 w-10 text-white/20" />
    </div>
  );
}
