import { MotionConfig } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Preferencias de accesibilidad de la persona (se guardan en este
 * navegador). Cada opción es una clase en <html> que styles/accesibilidad.css
 * convierte en estilos, así afecta a todo el sitio sin tocar cada página.
 */
export interface PreferenciasA11y {
  texto: 0 | 1 | 2; // normal, grande (112,5 %), muy grande (125 %)
  contraste: boolean;
  enlaces: boolean;
  movimiento: boolean;
  lectura: boolean;
  foco: boolean;
  cursor: boolean;
}

const INICIAL: PreferenciasA11y = {
  texto: 0,
  contraste: false,
  enlaces: false,
  movimiento: false,
  lectura: false,
  foco: false,
  cursor: false,
};
const CLAVE = "alik_accesibilidad";

function leer(): PreferenciasA11y {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) return { ...INICIAL, ...JSON.parse(crudo) };
  } catch {
    /* sin storage o JSON roto */
  }
  return INICIAL;
}

type Contexto = {
  prefs: PreferenciasA11y;
  cambiar: <K extends keyof PreferenciasA11y>(k: K, v: PreferenciasA11y[K]) => void;
  restablecer: () => void;
  panelAbierto: boolean;
  setPanelAbierto: (v: boolean) => void;
  activas: number;
};

const Ctx = createContext<Contexto | null>(null);

export function AccesibilidadProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<PreferenciasA11y>(leer);
  const [panelAbierto, setPanelAbierto] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("a11y-texto-1", prefs.texto === 1);
    html.classList.toggle("a11y-texto-2", prefs.texto === 2);
    html.classList.toggle("a11y-contraste", prefs.contraste);
    html.classList.toggle("a11y-enlaces", prefs.enlaces);
    html.classList.toggle("a11y-movimiento", prefs.movimiento);
    html.classList.toggle("a11y-lectura", prefs.lectura);
    html.classList.toggle("a11y-foco", prefs.foco);
    html.classList.toggle("a11y-cursor", prefs.cursor);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(prefs));
    } catch {
      /* sin storage */
    }
  }, [prefs]);

  // Alt + A abre el panel desde cualquier página.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setPanelAbierto(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cambiar = useCallback(<K extends keyof PreferenciasA11y>(k: K, v: PreferenciasA11y[K]) => {
    setPrefs((p) => ({ ...p, [k]: v }));
  }, []);
  const restablecer = useCallback(() => setPrefs(INICIAL), []);
  const activas = Object.entries(prefs).filter(([k, v]) => (k === "texto" ? v !== 0 : v === true)).length;

  const valor = useMemo(
    () => ({ prefs, cambiar, restablecer, panelAbierto, setPanelAbierto, activas }),
    [prefs, cambiar, restablecer, panelAbierto, activas],
  );
  return (
    <Ctx.Provider value={valor}>
      {/* "Reducir animaciones" también apaga las animaciones de motion/react. */}
      <MotionConfig reducedMotion={prefs.movimiento ? "always" : "user"}>{children}</MotionConfig>
    </Ctx.Provider>
  );
}

export function useAccesibilidad() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAccesibilidad fuera de AccesibilidadProvider");
  return c;
}
