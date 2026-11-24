/**
 * Traductor de toda la página (español → inglés) en tiempo de ejecución.
 *
 * Los componentes nuevos usan t("clave"); el resto del sitio (admin,
 * perfil, reservas, avisos del servidor…) tiene sus textos en español
 * escritos directamente. En vez de reescribir cientos de archivos, este
 * módulo observa el DOM y reemplaza cada texto que esté en el diccionario
 * generado a partir del código fuente (dom/en.json):
 *
 * - Nodos de texto y los atributos placeholder, title, aria-label, alt y
 *   aria-description (lo que oyen los lectores de pantalla).
 * - Coincidencia exacta (ignorando espacios) y plantillas con {0}, {1}…
 * - Guarda el original para volver a español sin recargar.
 * - No toca lo que el usuario escribe (inputs, textarea, contenteditable),
 *   ni lo marcado con translate="no" o data-no-traducir.
 * - Si React cambia el texto, el observador lo vuelve a traducir.
 */

export type Diccionario = { exactos: Record<string, string>; plantillas: [string, string][] };

const ATRIBUTOS = ["placeholder", "title", "aria-label", "alt", "aria-description", "aria-roledescription"] as const;
const OMITIR = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "svg"]);

type Hueco = { indice: number; sufijo: boolean };
type Plantilla = { re: RegExp; huecos: Hueco[]; destino: string };

export function normalizar(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function escaparRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Convierte "Hola {0}, tienes {1} reserva{2}" en una expresión regular.
 * - Un {n} pegado a una palabra (reserva{2}) es un plural: 0 a 3 letras.
 * - Un {n} al final o pegado a otro {n} puede venir vacío.
 * - El resto captura de 1 a 80 caracteres.
 * Las plantillas con muy poco texto fijo se descartan: atraparían
 * cualquier frase (p. ej. "{0} niño{1}").
 */
export function compilarPlantillas(lista: [string, string][]): Plantilla[] {
  const res: (Plantilla & { largo: number })[] = [];
  for (const [origen, destino] of lista) {
    const base = normalizar(origen);
    const literal = base.replace(/\{\d\}/g, "");
    if ((literal.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ]/g) ?? []).length < 3) continue;
    const partes = base.split(/(\{\d\})/);
    const huecos: Hueco[] = [];
    let fuente = "";
    partes.forEach((p, i) => {
      const m = /^\{(\d)\}$/.exec(p);
      if (!m) {
        fuente += escaparRe(p);
        return;
      }
      const previo = partes[i - 1] ?? "";
      const sufijo = /[A-Za-zÁÉÍÓÚáéíóúñÑ]$/.test(previo);
      const vacioOk = i === partes.length - 2 && partes[i + 1] === "" ? true : previo === "" && i > 1;
      huecos.push({ indice: Number(m[1]), sufijo });
      const alInicio = i === 1 && partes[0] === "";
      const abierto = alInicio || (i === partes.length - 2 && partes[partes.length - 1] === ""); // al inicio o al final
      const palabrasFijas = normalizar(literal).split(" ").filter((w) => /[A-Za-zÁÉÍÓÚáéíóúñÑ]{2}/.test(w)).length;
      if (sufijo) fuente += "([a-záéíóúñ]{0,3})(?![A-Za-záéíóúñ])"; // el plural termina la palabra
      else if (alInicio && palabrasFijas < 2) fuente += "([\\d.,$%+\\-–\\s]{1,20})"; // "{0} reservas": un número
      else if (abierto) {
        // nombres (hotel, destino…): pocas palabras, más si la frase fija es larga
        const max = palabrasFijas >= 3 ? 8 : 5;
        const nombre = `\\S+(?:\\s+\\S+){0,${max - 1}}?`;
        fuente += vacioOk ? `((?:${nombre})?)` : `(${nombre})`;
      }
      else fuente += vacioOk ? "(.{0,80}?)" : "(.{1,80}?)";
    });
    res.push({ re: new RegExp(`^${fuente}$`), huecos, destino, largo: literal.length });
  }
  return res.sort((a, b) => b.largo - a.largo).map(({ re, huecos, destino }) => ({ re, huecos, destino }));
}

/* ── Fechas escritas con toLocaleDateString("es-CO") ───────────────────── */

const MESES: Record<string, string> = {
  enero: "January", febrero: "February", marzo: "March", abril: "April", mayo: "May", junio: "June",
  julio: "July", agosto: "August", septiembre: "September", setiembre: "September", octubre: "October",
  noviembre: "November", diciembre: "December",
  ene: "Jan", feb: "Feb", mar: "Mar", abr: "Apr", may: "May", jun: "Jun", jul: "Jul", ago: "Aug",
  sept: "Sep", sep: "Sep", oct: "Oct", nov: "Nov", dic: "Dec",
};
const DIAS: Record<string, string> = {
  lunes: "Monday", martes: "Tuesday", miércoles: "Wednesday", jueves: "Thursday", viernes: "Friday",
  sábado: "Saturday", domingo: "Sunday",
  lun: "Mon", mar: "Tue", mié: "Wed", jue: "Thu", vie: "Fri", sáb: "Sat", dom: "Sun",
};
const PAL_MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join("|");
const PAL_DIA = Object.keys(DIAS).sort((a, b) => b.length - a.length).join("|");
// [día, ] 21 [de] dic[.] [[de] 2026] [, 10:30 a. m.]
const RE_FECHA = new RegExp(
  `^(?:(${PAL_DIA})\\.?,?\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(${PAL_MES})\\.?(?:,?\\s+(?:de\\s+)?(\\d{4}))?(?:,?\\s+(\\d{1,2}:\\d{2})\\s*(a\\.?\\s*m\\.?|p\\.?\\s*m\\.?)?)?$`,
  "i",
);
const RE_MES_ANIO = new RegExp(`^(${PAL_MES})\\s+de\\s+(\\d{4})$`, "i");

export function traducirFecha(texto: string): string | null {
  const t = normalizar(texto);
  const guion = /^[–-]\s*\d/.test(t) ? "– " : "";
  const limpio = t.replace(/^[–-]\s*/, "");
  let m = RE_FECHA.exec(limpio);
  if (m) {
    const [, dia, num, mes, anio, hora, ampm] = m;
    let r = `${dia ? `${DIAS[dia.toLowerCase()]}, ` : ""}${MESES[mes.toLowerCase()]} ${num}${anio ? `, ${anio}` : ""}`;
    if (hora) r += `, ${hora}${ampm ? (/^a/i.test(ampm) ? " AM" : " PM") : ""}`;
    return guion + r;
  }
  m = RE_MES_ANIO.exec(limpio);
  if (m) return guion + `${MESES[m[1].toLowerCase()]} ${m[2]}`;
  return null;
}

export function crearTraductor(dic: Diccionario) {
  const exactos = new Map(Object.entries(dic.exactos).map(([k, v]) => [normalizar(k), v]));
  const plantillas = compilarPlantillas(dic.plantillas);

  function nucleo(limpio: string, profundidad: number): string | undefined {
    const res = exactos.get(limpio);
    if (res !== undefined) return res;
    const f = traducirFecha(limpio);
    if (f) return f;
    // "Texto:" o "Texto *" cuando el diccionario tiene "Texto"
    const m = /^(.*?)\s*([:*…]|\.\.\.)$/.exec(limpio);
    if (m && exactos.has(m[1].trim())) return exactos.get(m[1].trim())! + (m[2] === "*" ? " *" : m[2]);
    if (profundidad > 1) return undefined;
    const porPlantilla = conPlantillas(limpio, profundidad);
    if (porPlantilla !== undefined) return porPlantilla;
    // "Texto · otro texto": traduce cada parte por separado
    if (limpio.includes(" · ")) {
      const partes = limpio.split(" · ");
      const trad = partes.map((p) => nucleo(p, profundidad + 1));
      if (trad.some((x) => x !== undefined)) return partes.map((p, i) => trad[i] ?? p).join(" · ");
    }
    return undefined;
  }

  function conPlantillas(limpio: string, profundidad: number): string | undefined {
    let res: string | undefined;
    for (const p of plantillas) {
      const g = p.re.exec(limpio);
      if (!g) continue;
      const valores = new Map<number, { v: string; sufijo: boolean }>();
      p.huecos.forEach((h, i) => valores.set(h.indice, { v: g[i + 1] ?? "", sufijo: h.sufijo }));
      res = p.destino.replace(/(.?)\{(\d)\}/g, (_, antes: string, n: string) => {
        const val = valores.get(Number(n));
        if (!val) return antes;
        if (val.sufijo) return antes + (/[A-Za-z]/.test(antes) && val.v ? "s" : "");
        const anidado = val.v.trim() ? nucleo(normalizar(val.v), profundidad + 1) : undefined;
        if (anidado === undefined) return antes + val.v;
        const ini = /^\s*/.exec(val.v)![0];
        const fin = /\s*$/.exec(val.v)![0];
        return antes + ini + anidado + fin;
      });
      return res.replace(/\s+([,.:;])/g, "$1").replace(/\s{2,}/g, " ");
    }
    return undefined;
  }

  return function traducirTexto(texto: string): string | null {
    const limpio = normalizar(texto);
    if (!limpio || limpio.length > 600 || !/[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]/.test(limpio)) return null;
    const res = nucleo(limpio, 0);
    if (res === undefined) return null;
    // conserva los espacios de los bordes (separan textos vecinos en JSX)
    const inicio = /^\s*/.exec(texto)![0];
    const fin = /\s*$/.exec(texto)![0];
    return inicio + res + fin;
  };
}

function omitido(el: Element | null): boolean {
  for (let n = el; n; n = n.parentElement) {
    if (OMITIR.has(n.tagName) || OMITIR.has(n.nodeName)) return true;
    if (n.getAttribute("translate") === "no" || n.hasAttribute("data-no-traducir")) return true;
    if ((n as HTMLElement).isContentEditable) return true;
  }
  return false;
}

type EstadoTexto = { original: string; traducido: string };

export class TraductorDom {
  private textos = new Map<Text, EstadoTexto>();
  private attrs = new Map<Element, Map<string, EstadoTexto>>();
  private observador: MutationObserver | null = null;
  private tituloOriginal: string | null = null;
  private tituloTraducido: string | null = null;

  constructor(private traducir: (s: string) => string | null) {}

  iniciar(raiz: HTMLElement = document.body) {
    this.recorrer(raiz);
    this.titulo();
    this.observador = new MutationObserver((muts) => this.alMutar(muts));
    this.observador.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATRIBUTOS],
    });
  }

  detener() {
    this.observador?.disconnect();
    this.observador = null;
    for (const [nodo, e] of this.textos) {
      if (nodo.nodeValue === e.traducido) nodo.nodeValue = e.original;
    }
    for (const [el, mapa] of this.attrs) {
      for (const [a, e] of mapa) if (el.getAttribute(a) === e.traducido) el.setAttribute(a, e.original);
    }
    if (this.tituloOriginal !== null && document.title === this.tituloTraducido) document.title = this.tituloOriginal;
    this.textos.clear();
    this.attrs.clear();
  }

  private alMutar(muts: MutationRecord[]) {
    for (const m of muts) {
      if (m.type === "childList") {
        if (m.target.nodeName === "TITLE") this.titulo();
        m.addedNodes.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) this.texto(n as Text);
          else if (n.nodeType === Node.ELEMENT_NODE) this.recorrer(n as HTMLElement);
        });
      } else if (m.type === "characterData") {
        if (m.target.parentNode?.nodeName === "TITLE") this.titulo();
        else this.texto(m.target as Text);
      } else if (m.type === "attributes" && m.attributeName) {
        this.atributo(m.target as Element, m.attributeName);
      }
    }
    if (this.textos.size > 4000) this.limpiar();
  }

  private limpiar() {
    for (const n of this.textos.keys()) if (!n.isConnected) this.textos.delete(n);
    for (const el of this.attrs.keys()) if (!el.isConnected) this.attrs.delete(el);
  }

  private recorrer(raiz: Element) {
    if (raiz.nodeName === "HEAD" || omitido(raiz)) return;
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) =>
        n.nodeType === Node.ELEMENT_NODE &&
        (OMITIR.has(n.nodeName) ||
          (n as Element).getAttribute("translate") === "no" ||
          (n as Element).hasAttribute("data-no-traducir"))
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    let n: Node | null = w.currentNode;
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) this.texto(n as Text, true);
      else for (const a of ATRIBUTOS) if ((n as Element).hasAttribute(a)) this.atributo(n as Element, a, true);
      n = w.nextNode();
    }
  }

  private texto(nodo: Text, yaRevisado = false) {
    const valor = nodo.nodeValue ?? "";
    const previo = this.textos.get(nodo);
    if (previo && valor === previo.traducido) return; // cambio nuestro
    if (!yaRevisado && omitido(nodo.parentElement)) return;
    const t = this.traducir(valor);
    if (t === null || t === valor) {
      this.textos.delete(nodo);
      return;
    }
    this.textos.set(nodo, { original: valor, traducido: t });
    nodo.nodeValue = t;
  }

  private atributo(el: Element, a: string, yaRevisado = false) {
    const valor = el.getAttribute(a);
    if (valor === null) return;
    const mapa = this.attrs.get(el);
    if (mapa?.get(a)?.traducido === valor) return;
    if (!yaRevisado && omitido(el.parentElement)) return;
    const t = this.traducir(valor);
    if (t === null || t === valor) return;
    const m = mapa ?? new Map<string, EstadoTexto>();
    m.set(a, { original: valor, traducido: t });
    this.attrs.set(el, m);
    el.setAttribute(a, t);
  }

  private titulo() {
    const actual = document.title;
    if (actual === this.tituloTraducido) return;
    // títulos tipo "Mis reservas | Alik Tours"
    const partes = actual.split(/(\s[|·—-]\s)/);
    const trad = partes.map((p, i) => (i % 2 ? p : (this.traducir(p) ?? p))).join("");
    this.tituloOriginal = actual;
    this.tituloTraducido = trad;
    if (trad !== actual) document.title = trad;
  }
}

let activo: TraductorDom | null = null;
let carga: Promise<Diccionario> | null = null;

/** Activa o desactiva la traducción global. El diccionario se descarga solo al elegir inglés. */
export async function aplicarIdiomaDom(idioma: "es" | "en") {
  if (idioma === "es") {
    activo?.detener();
    activo = null;
    return;
  }
  if (activo) return;
  carga ??= import("./en.json").then((m) => (m.default ?? m) as unknown as Diccionario);
  const dic = await carga;
  if (activo) return;
  activo = new TraductorDom(crearTraductor(dic));
  activo.iniciar();
}
