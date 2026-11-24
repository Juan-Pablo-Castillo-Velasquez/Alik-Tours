import { useSyncExternalStore } from "react";

/**
 * Lectura en voz alta con la API de voz del navegador (speechSynthesis).
 * Para personas con baja visión, dislexia o que prefieren escuchar; quien
 * usa un lector de pantalla (NVDA, JAWS, VoiceOver, TalkBack) ya tiene el
 * suyo y no necesita esto.
 *
 * - Chrome corta las frases largas: el texto se divide por oraciones.
 * - Velocidad y voz elegidas por la persona (se guardan en el navegador).
 * - Pausar / continuar / detener, con un estado al que se suscriben la
 *   barra de lectura y el panel.
 */

export type EstadoVoz = "inactiva" | "leyendo" | "pausada";
export type AjustesVoz = { velocidad: number; voz: string };

const CLAVE = "alik_voz";
const AJUSTES_INICIALES: AjustesVoz = { velocidad: 1, voz: "" };
export const VELOCIDADES = [0.75, 1, 1.25, 1.5, 1.75] as const;

let estado: EstadoVoz = "inactiva";
// Cada lectura nueva sube la generación: los eventos tardíos de una
// lectura cancelada no cambian el estado de la actual.
let generacion = 0;
const oyentes = new Set<(e: EstadoVoz) => void>();

function cambiarEstado(e: EstadoVoz) {
  estado = e;
  oyentes.forEach((f) => f(e));
}

export function suscribirVoz(f: (e: EstadoVoz) => void) {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

export const estadoVoz = () => estado;

/** Estado de la lectura (inactiva, leyendo, pausada) para componentes React. */
export const useEstadoVoz = () => useSyncExternalStore(suscribirVoz, estadoVoz, () => "inactiva" as const);

export function vozDisponible() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function leerAjustesVoz(): AjustesVoz {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) return { ...AJUSTES_INICIALES, ...JSON.parse(crudo) };
  } catch {
    /* sin storage */
  }
  return AJUSTES_INICIALES;
}

export function guardarAjustesVoz(a: AjustesVoz) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(a));
  } catch {
    /* sin storage */
  }
}

/** Voces del navegador para el idioma (las de Google/Microsoft suenan mejor y van primero). */
export function vocesPara(idioma: "es" | "en"): SpeechSynthesisVoice[] {
  if (!vozDisponible()) return [];
  const buenas = /google|microsoft|natural|neural|premium|enhanced/i;
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(idioma))
    .sort((a, b) => Number(buenas.test(b.name)) - Number(buenas.test(a.name)));
}

const SELECTOR_OMITIR =
  "nav, footer, script, style, noscript, [aria-hidden='true'], [hidden], .sr-only, svg, [data-no-leer], [role='dialog'] [role='dialog']";

/** Texto del contenido principal (o del diálogo abierto, si hay uno). */
export function textoPrincipal(): string {
  const dialogo = document.querySelector<HTMLElement>("[role='dialog'][data-state='open'], [role='alertdialog']");
  const raiz =
    dialogo ??
    document.querySelector<HTMLElement>("#contenido-principal") ??
    document.querySelector<HTMLElement>("main") ??
    document.body;
  const copia = raiz.cloneNode(true) as HTMLElement;
  copia.querySelectorAll(SELECTOR_OMITIR).forEach((n) => n.remove());
  // los campos se leen por su etiqueta, no por su valor
  copia.querySelectorAll("input, select, textarea").forEach((n) => n.remove());
  return (copia.innerText || copia.textContent || "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

export function trocear(texto: string): string[] {
  return (
    texto
      .match(/[^.!?\n]+[.!?]*/g)
      ?.map((s) => s.trim())
      .filter((s) => /[\p{L}\p{N}]/u.test(s)) ?? [texto]
  );
}

export function hablar(
  texto: string,
  idioma: "es" | "en",
  opciones: { alTerminar?: () => void; interrumpir?: boolean; anuncio?: boolean } = {},
) {
  if (!vozDisponible() || !texto.trim()) return false;
  const synth = window.speechSynthesis;
  if (opciones.interrumpir !== false) synth.cancel();
  const { velocidad, voz: nombreVoz } = leerAjustesVoz();
  const lang = idioma === "en" ? "en-US" : "es-CO";
  const voces = vocesPara(idioma);
  const voz = voces.find((v) => v.name === nombreVoz) ?? voces.find((v) => v.lang === lang) ?? voces[0] ?? null;
  const trozos = trocear(texto.slice(0, 15000));
  // Un anuncio corto (leer al enfocar) no muestra la barra de lectura.
  const gen = ++generacion;
  const cambiar = (e: EstadoVoz) => {
    if (!opciones.anuncio && gen === generacion) cambiarEstado(e);
  };
  if (opciones.anuncio && estado !== "inactiva") cambiarEstado("inactiva");
  trozos.forEach((trozo, i) => {
    const u = new SpeechSynthesisUtterance(trozo);
    u.lang = voz?.lang ?? lang;
    if (voz) u.voice = voz;
    u.rate = velocidad;
    if (i === 0) u.onstart = () => cambiar("leyendo");
    if (i === trozos.length - 1) {
      u.onend = () => {
        cambiar("inactiva");
        opciones.alTerminar?.();
      };
    }
    u.onerror = () => cambiar("inactiva");
    synth.speak(u);
  });
  cambiar("leyendo");
  return true;
}

/** Lee la página (o lo seleccionado, si hay algo seleccionado). */
export function leerEnVoz(idioma: "es" | "en", texto?: string, alTerminar?: () => void) {
  const seleccion = typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
  return hablar(texto ?? (seleccion || textoPrincipal()), idioma, { alTerminar });
}

export function pausarVoz() {
  if (!vozDisponible() || estado !== "leyendo") return;
  window.speechSynthesis.pause();
  cambiarEstado("pausada");
}

export function continuarVoz() {
  if (!vozDisponible() || estado !== "pausada") return;
  window.speechSynthesis.resume();
  cambiarEstado("leyendo");
}

export function detenerVoz() {
  generacion++;
  if (vozDisponible()) window.speechSynthesis.cancel();
  if (estado !== "inactiva") cambiarEstado("inactiva");
}

/* ── Nombre accesible para "leer al enfocar o tocar" ───────────────────── */

const ROLES: Record<string, { es: string; en: string }> = {
  button: { es: "botón", en: "button" },
  link: { es: "enlace", en: "link" },
  textbox: { es: "campo de texto", en: "text field" },
  combobox: { es: "lista desplegable", en: "combo box" },
  checkbox: { es: "casilla", en: "checkbox" },
  radio: { es: "opción", en: "radio button" },
  switch: { es: "interruptor", en: "switch" },
  tab: { es: "pestaña", en: "tab" },
  menuitem: { es: "opción de menú", en: "menu item" },
  heading: { es: "título", en: "heading" },
  img: { es: "imagen", en: "image" },
  option: { es: "opción", en: "option" },
  slider: { es: "control deslizante", en: "slider" },
  dialog: { es: "ventana", en: "dialog" },
};

export function rolDe(el: Element): string | null {
  const r = el.getAttribute("role");
  if (r) return r;
  const tag = el.tagName.toLowerCase();
  if (tag === "a" && el.hasAttribute("href")) return "link";
  if (tag === "button" || tag === "summary") return "button";
  if (tag === "select") return "combobox";
  if (tag === "textarea") return "textbox";
  if (tag === "img") return "img";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "input") {
    const tipo = (el as HTMLInputElement).type;
    if (tipo === "checkbox") return "checkbox";
    if (tipo === "radio") return "radio";
    if (tipo === "range") return "slider";
    if (["button", "submit", "reset"].includes(tipo)) return "button";
    return "textbox";
  }
  return null;
}

function textoVisible(el: Element) {
  const copia = el.cloneNode(true) as HTMLElement;
  copia.querySelectorAll("[aria-hidden='true'], svg, style, script").forEach((n) => n.remove());
  return (copia.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function nombreAccesible(el: Element): string {
  const etiqueta = el.getAttribute("aria-label");
  if (etiqueta?.trim()) return etiqueta.trim();
  const ids = el.getAttribute("aria-labelledby");
  if (ids) {
    const t = ids
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((n) => textoVisible(n!))
      .join(" ")
      .trim();
    if (t) return t;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    const lbl = el.labels?.[0];
    if (lbl) return textoVisible(lbl);
    if ("placeholder" in el && el.placeholder) return el.placeholder;
  }
  if (el instanceof HTMLImageElement) return el.alt;
  const visible = textoVisible(el);
  if (visible) return visible.slice(0, 300);
  return el.getAttribute("title") ?? "";
}

/** Lo que se dice al enfocar o tocar un elemento: "Pagar, botón", "Correo, campo de texto, vacío"… */
export function describirElemento(el: Element, idioma: "es" | "en"): string {
  const nombre = nombreAccesible(el);
  const rol = rolDe(el);
  const partes: string[] = [];
  if (nombre) partes.push(nombre);
  if (rol && ROLES[rol]) {
    if (rol === "heading") {
      const nivel = el.getAttribute("aria-level") ?? el.tagName.slice(1);
      partes.push(`${ROLES.heading[idioma]} ${/^\d$/.test(nivel) ? nivel : ""}`.trim());
    } else partes.push(ROLES[rol][idioma]);
  }
  const marcado = el.getAttribute("aria-checked") ?? el.getAttribute("aria-pressed") ?? el.getAttribute("aria-selected");
  const esCasilla = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio");
  if (marcado === "true" || (esCasilla && el.checked)) partes.push(idioma === "en" ? "checked" : "marcado");
  else if (marcado === "false" || (esCasilla && !el.checked)) partes.push(idioma === "en" ? "not checked" : "sin marcar");
  const exp = el.getAttribute("aria-expanded");
  if (exp) partes.push(exp === "true" ? (idioma === "en" ? "expanded" : "abierto") : idioma === "en" ? "collapsed" : "cerrado");
  if (el.getAttribute("aria-disabled") === "true" || (el as HTMLButtonElement).disabled)
    partes.push(idioma === "en" ? "unavailable" : "no disponible");
  if (el.getAttribute("aria-invalid") === "true") partes.push(idioma === "en" ? "invalid" : "con error");
  if (el.hasAttribute("required") || el.getAttribute("aria-required") === "true")
    partes.push(idioma === "en" ? "required" : "obligatorio");
  if (rol === "textbox" && "value" in el) {
    const v = (el as HTMLInputElement).value;
    const tipo = (el as HTMLInputElement).type;
    if (tipo === "password") partes.push(v ? (idioma === "en" ? "has text" : "con texto") : idioma === "en" ? "empty" : "vacío");
    else partes.push(v ? v.slice(0, 120) : idioma === "en" ? "empty" : "vacío");
  }
  return partes.join(", ");
}
