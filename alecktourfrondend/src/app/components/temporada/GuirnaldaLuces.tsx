import { CSSProperties } from "react";
import { useTema } from "../../context/TemaContext";
import { decoracionDeTema } from "./temporadas";

// Tira de luces que cuelga del borde inferior del navbar (el <nav> es
// sticky, así que acompaña el scroll en todas las páginas). Los focos
// titilan solo con opacity. Se monta DENTRO del navbar: position absolute
// top:100%, sin ocupar espacio ni mover el contenido.
const FOCOS = ["var(--gold)", "#e5484d", "#3fb27f", "#4c9ffe"];
const TRAMOS = 28;

export default function GuirnaldaLuces() {
  const { temaActivo } = useTema();
  if (!decoracionDeTema(temaActivo).guirnalda) return null;

  return (
    <div className="temporada-guirnalda" aria-hidden="true" data-testid="guirnalda-temporada">
      {Array.from({ length: TRAMOS }, (_, i) => (
        <div key={i} className="temporada-guirnalda__tramo">
          <svg viewBox="0 0 60 16" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M0 1Q30 18 60 1" vectorEffect="non-scaling-stroke" />
          </svg>
          <span
            className="temporada-guirnalda__foco"
            style={{ "--foco": FOCOS[i % FOCOS.length], "--retraso": `${(i % 4) * -0.6}s` } as CSSProperties}
          />
        </div>
      ))}
    </div>
  );
}
