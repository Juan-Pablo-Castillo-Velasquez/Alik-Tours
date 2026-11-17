import { useTema } from "../../context/TemaContext";
import { decoracionDeTema } from "./temporadas";

// Muñeco de nieve que se asoma sobre la nieve del footer (solo escritorio,
// solo temas con nieve). Trazos propios; saluda moviendo el brazo.
export default function MunecoNieve() {
  const { temaActivo } = useTema();
  if (!decoracionDeTema(temaActivo).nieveAcumulada) return null;
  return (
    <div
      className="pointer-events-none absolute -top-[72px] right-[7%] z-20 hidden w-24 md:block"
      aria-hidden="true"
      data-testid="muneco-nieve"
    >
      <svg viewBox="0 0 100 110" className="block h-auto w-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.25)]">
        {/* brazo que saluda */}
        <g className="temporada-saludo" style={{ transformOrigin: "72px 62px" }}>
          <path d="M72 62 92 42m-6 6 6 1m-10-5 1-6" stroke="#6b4a2e" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
        <path d="M28 62 10 52m6 3-2 6" stroke="#6b4a2e" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* cuerpo */}
        <circle cx="50" cy="84" r="26" fill="#ffffff" />
        <circle cx="50" cy="44" r="19" fill="#ffffff" />
        <path d="M30 92c10 6 30 6 40 0" stroke="#dbe7f3" strokeWidth="5" fill="none" strokeLinecap="round" />
        {/* bufanda */}
        <path d="M33 56c10 5 24 5 34 0l1 6c-11 5-25 5-36 0Z" fill="#c81e2d" />
        <path d="M60 60l4 16 6-2-3-14Z" fill="#a51623" />
        {/* gorro */}
        <path d="M32 32c2-12 12-20 26-16 8 2 12 8 12 14Z" fill="#c81e2d" />
        <rect x="29" y="28" width="43" height="7" rx="3.5" fill="#ffffff" stroke="#e7eef6" />
        <circle cx="66" cy="16" r="5" fill="#ffffff" />
        {/* cara */}
        <circle cx="43" cy="42" r="2.4" fill="#2b2b2b" />
        <circle cx="57" cy="42" r="2.4" fill="#2b2b2b" />
        <path d="M50 47l14 3-14 2Z" fill="#f08a24" />
        <path d="M42 53c5 3 11 3 16 0" stroke="#2b2b2b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {/* botones */}
        <circle cx="50" cy="74" r="2.5" fill="#2b2b2b" />
        <circle cx="50" cy="84" r="2.5" fill="#2b2b2b" />
      </svg>
    </div>
  );
}
