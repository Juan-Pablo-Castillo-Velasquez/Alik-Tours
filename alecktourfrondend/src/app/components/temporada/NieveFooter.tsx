import { Pause, Play } from "lucide-react";
import { useTema } from "../../context/TemaContext";
import { decoracionDeTema } from "./temporadas";
import { useAnimacionTemporada } from "./useAnimacionTemporada";

// Borde de nieve acumulada en la parte superior del footer (solo temas con
// nieve). El footer debe ser `relative overflow-hidden`.
export function NieveFooter() {
  const { temaActivo } = useTema();
  if (!decoracionDeTema(temaActivo).nieveAcumulada) return null;
  return (
    <div
      className="pointer-events-none !absolute inset-x-0 top-0 h-8 sm:h-10"
      style={{ color: "var(--temporada-nieve)" }}
      aria-hidden="true"
      data-testid="nieve-footer"
    >
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="block h-full w-full" fill="currentColor">
        <path d="M0 0h1200v14c-60 16-120 4-190 12-80 9-130 14-210 4-70-9-120-2-190 6-80 9-140 8-220-2-70-9-130-4-200 4-70 8-130 4-190-8Z" />
      </svg>
    </div>
  );
}

// Botón del footer para pausar o reanudar la animación de temporada. Solo
// aparece cuando el tema activo trae algo animado.
export function BotonAnimacionTemporada() {
  const { temaActivo } = useTema();
  const { activa, alternar } = useAnimacionTemporada();
  if (!decoracionDeTema(temaActivo).efecto) return null;
  const Icono = activa ? Pause : Play;
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={!activa}
      className="footer-link inline-flex items-center gap-1.5"
    >
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      {activa ? "Pausar animación de temporada" : "Reanudar animación de temporada"}
    </button>
  );
}
