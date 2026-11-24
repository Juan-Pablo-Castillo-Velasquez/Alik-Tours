/**
 * Lectura en voz alta con la API de voz del navegador (speechSynthesis).
 * Para personas con baja visión o que prefieren escuchar; quien usa un
 * lector de pantalla (NVDA, JAWS, VoiceOver, TalkBack) ya tiene el suyo.
 *
 * Chrome corta las frases largas, por eso el texto se divide por oraciones
 * y se encola.
 */
export function vozDisponible() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function textoPrincipal(): string {
  const raiz =
    document.querySelector<HTMLElement>("#contenido-principal") ??
    document.querySelector<HTMLElement>("main") ??
    document.body;
  const copia = raiz.cloneNode(true) as HTMLElement;
  copia
    .querySelectorAll("nav, footer, script, style, [aria-hidden='true'], .sr-only, button svg, [data-no-leer]")
    .forEach((n) => n.remove());
  return (copia.innerText || copia.textContent || "").replace(/\s+\n/g, "\n").trim();
}

export function leerEnVoz(idioma: "es" | "en", texto?: string, alTerminar?: () => void) {
  if (!vozDisponible()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const contenido = (texto ?? textoPrincipal()).slice(0, 12000);
  if (!contenido) return false;
  const lang = idioma === "en" ? "en-US" : "es-CO";
  const voces = synth.getVoices();
  const voz =
    voces.find((v) => v.lang === lang) ??
    voces.find((v) => v.lang.toLowerCase().startsWith(idioma)) ??
    null;
  const trozos = contenido.match(/[^.!?\n]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [contenido];
  trozos.forEach((trozo, i) => {
    const u = new SpeechSynthesisUtterance(trozo);
    u.lang = lang;
    if (voz) u.voice = voz;
    u.rate = 1;
    if (i === trozos.length - 1 && alTerminar) u.onend = alTerminar;
    synth.speak(u);
  });
  return true;
}

export function detenerVoz() {
  if (vozDisponible()) window.speechSynthesis.cancel();
}
