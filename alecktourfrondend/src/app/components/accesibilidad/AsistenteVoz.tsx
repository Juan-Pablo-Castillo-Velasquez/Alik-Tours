import { Gauge, Pause, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccesibilidad } from "../../context/AccesibilidadContext";
import { useIdioma } from "../../i18n";
import {
  VELOCIDADES,
  continuarVoz,
  describirElemento,
  detenerVoz,
  estadoVoz,
  guardarAjustesVoz,
  hablar,
  leerAjustesVoz,
  leerEnVoz,
  pausarVoz,
  useEstadoVoz,
  vozDisponible,
} from "./lecturaVoz";


const INTERACTIVOS =
  "a[href], button, input, select, textarea, summary, [role='button'], [role='link'], [role='tab'], [role='switch'], [role='checkbox'], [role='radio'], [role='menuitem'], [role='option'], [role='combobox'], [tabindex]:not([tabindex='-1'])";

/**
 * Lectura en voz alta en todo el sitio:
 * - Atajos: Alt + L (leer), Alt + P (pausar / continuar), Alt + S (detener).
 * - "Leer al enfocar o tocar": anuncia cada control al que se llega con el
 *   teclado y lo que se toca con el dedo o el ratón.
 * - Barra flotante con pausa, velocidad y detener mientras se lee.
 */
export default function AsistenteVoz() {
  const { prefs } = useAccesibilidad();
  const { idioma, t } = useIdioma();
  const estado = useEstadoVoz();
  const [velocidad, setVelocidad] = useState(() => leerAjustesVoz().velocidad);

  useEffect(() => {
    if (!vozDisponible()) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === "l") {
        e.preventDefault();
        leerEnVoz(idioma);
      } else if (k === "p") {
        e.preventDefault();
        if (estadoVoz() === "leyendo") pausarVoz();
        else continuarVoz();
      } else if (k === "s") {
        e.preventDefault();
        detenerVoz();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idioma]);

  useEffect(() => {
    if (!prefs.leerAlEnfocar || !vozDisponible()) return;
    let ultimo: Element | null = null;
    const decir = (el: Element | null) => {
      if (!el || el === ultimo || el.closest("[data-no-leer]")) return;
      ultimo = el;
      const texto = describirElemento(el, idioma);
      if (texto) hablar(texto, idioma, { anuncio: true });
    };
    const onFocus = (e: FocusEvent) => decir(e.target as Element);
    const onTocar = (e: PointerEvent) => {
      const objetivo = e.target as Element | null;
      if (!objetivo || objetivo.closest("[data-barra-lectura]")) return;
      const interactivo = objetivo.closest(INTERACTIVOS);
      if (interactivo) return decir(interactivo);
      // un texto: lee el párrafo o título tocado
      const bloque = objetivo.closest("p, h1, h2, h3, h4, h5, h6, li, td, th, label, figcaption, blockquote, dd, dt");
      if (bloque && bloque !== ultimo) {
        ultimo = bloque;
        const txt = (bloque.textContent ?? "").replace(/\s+/g, " ").trim();
        if (txt) hablar(/^H\d$/.test(bloque.tagName) ? describirElemento(bloque, idioma) : txt, idioma, { anuncio: true });
      }
    };
    const reiniciar = () => {
      ultimo = null;
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("pointerdown", onTocar);
    document.addEventListener("focusout", reiniciar);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("pointerdown", onTocar);
      document.removeEventListener("focusout", reiniciar);
    };
  }, [prefs.leerAlEnfocar, idioma]);

  useEffect(() => () => detenerVoz(), []);

  if (estado === "inactiva") return null;

  const cambiarVelocidad = (paso: 1 | -1) => {
    const i = VELOCIDADES.indexOf(velocidad as (typeof VELOCIDADES)[number]);
    const nueva = VELOCIDADES[Math.min(VELOCIDADES.length - 1, Math.max(0, (i === -1 ? 1 : i) + paso))];
    setVelocidad(nueva);
    guardarAjustesVoz({ ...leerAjustesVoz(), velocidad: nueva });
  };

  const boton =
    "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors hover:bg-background/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background";

  return (
    <div
      role="region"
      aria-label={t("a11y.barraLectura")}
      data-barra-lectura
      data-no-leer
      className="fixed bottom-6 left-1/2 z-[95] flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground p-1.5 text-background shadow-2xl"
    >
      <span className="sr-only" aria-live="polite">
        {estado === "pausada" ? t("a11y.pausada") : t("a11y.leyendo")}
      </span>
      <span className="hidden pl-3 pr-1 text-xs font-semibold opacity-80 sm:inline" aria-hidden>
        {estado === "pausada" ? t("a11y.pausada") : t("a11y.leyendo")}
      </span>
      {estado === "leyendo" ? (
        <button type="button" className={boton} onClick={pausarVoz} aria-label={t("a11y.pausar")} title="Alt + P">
          <Pause className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <button type="button" className={boton} onClick={continuarVoz} aria-label={t("a11y.continuar")} title="Alt + P">
          <Play className="h-4 w-4" aria-hidden />
        </button>
      )}
      <button type="button" className={boton} onClick={() => cambiarVelocidad(-1)} aria-label={t("a11y.masLenta")}>
        −
      </button>
      <span className="flex items-center gap-1 px-1 text-xs tabular-nums" aria-label={`${t("a11y.velocidad")} ${velocidad}×`}>
        <Gauge className="h-3.5 w-3.5" aria-hidden />
        {velocidad}×
      </span>
      <button type="button" className={boton} onClick={() => cambiarVelocidad(1)} aria-label={t("a11y.masRapida")}>
        +
      </button>
      <button type="button" className={boton} onClick={detenerVoz} aria-label={t("a11y.detener")} title="Alt + S">
        <Square className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{t("a11y.detener")}</span>
      </button>
    </div>
  );
}
