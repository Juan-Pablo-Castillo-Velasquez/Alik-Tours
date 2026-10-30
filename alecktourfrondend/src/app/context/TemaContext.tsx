import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Tema, temaService } from "../services/tema.service";

interface TemaContextType {
  temaActivo: Tema | null;
  /** Llamar después de crear/editar/activar/eliminar un tema desde
   * ModuleTemas.tsx para que el sitio en vivo (navbar, botones, footer)
   * refleje el cambio sin necesitar un refresh completo de la página. */
  refrescarTemaActivo: () => Promise<void>;
}

const TemaContext = createContext<TemaContextType | null>(null);

const STYLE_TAG_ID = "tema-temporada-runtime";
const ATTR = "data-tema-temporada";

function hexToRgb(hex: string): string {
  const limpio = hex.replace("#", "");
  const r = parseInt(limpio.substring(0, 2), 16);
  const g = parseInt(limpio.substring(2, 4), 16);
  const b = parseInt(limpio.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// El <meta name="theme-color"> (index.html) es lo que Android/PWA/algunos
// navegadores usan para colorear la barra de título del sistema -- antes
// quedaba fijo en un teal (#0F766E) que no existe en ninguna parte de la
// paleta real. En vez de duplicar a mano la lógica de claro/oscuro/tema
// de temporada (que ya vive resuelta en la cascada de CSS, ver
// theme.css y el <style id="tema-temporada-runtime"> de más abajo), se
// lee directamente el --primary YA COMPUTADO de <html> -- así queda
// correcto sin importar qué lo cambió (activar un tema, o alternar
// claro/oscuro en ThemeToggle.tsx, que llama a esta misma función).
export function sincronizarThemeColorMeta(): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const primario = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  if (primario) meta.setAttribute("content", primario);
}

// Favicon de temporada: por ahora solo Halloween tiene una variante
// propia (ver public/favicon-halloween.png, mismo badge del navbar pero
// con el ícono "ghost" -- el mismo que ya usa este tema en icono, ver
// tema_schema.py) -- agregar otra temporada es agregar otro `if` acá y
// su archivo en /public, no un sistema nuevo. Fuera de esa temporada
// activa, siempre se restauran los íconos por defecto (el badge real del
// navbar, ver Navbar.tsx) -- nunca se queda pegado en un ícono viejo.
function aplicarFaviconTemporada(tema: Tema | null): void {
  const svgLink = document.getElementById("favicon-svg") as HTMLLinkElement | null;
  const pngLink = document.getElementById("favicon-png") as HTMLLinkElement | null;
  if (!svgLink || !pngLink) return;

  if (tema?.clave === "halloween") {
    svgLink.type = "image/png";
    svgLink.href = "/favicon-halloween.png";
    pngLink.href = "/favicon-halloween.png";
  } else {
    svgLink.type = "image/png";
    svgLink.href = "/icon-192.png";
    pngLink.href = "/favicon.png";
  }
}

// Recolorea TODO el sitio (navbar, botones, footer, hero, sidebar admin)
// según el tema de temporada activo, sin tocar layout ni fondos/textos
// base -- ver theme.css ("TOKENS DERIVADOS PARA TEMAS DE TEMPORADA") para
// por qué basta con redefinir --primary/--gold/-rgb. Usa el mismo patrón
// [data-x] + .dark[data-x] que ya usa el propio :root/.dark del proyecto
// para claro/oscuro, así que respeta el modo claro/oscuro del visitante
// (ver ThemeToggle.tsx, que alterna la clase .dark en <html>).
function aplicarTemaEnDOM(tema: Tema | null): void {
  const root = document.documentElement;

  // El tema "Marca" (predeterminado) no necesita ningún override: los
  // valores base de theme.css YA son sus colores -- sin tema activo, o
  // si el activo es el predeterminado, el sitio queda exactamente igual
  // que hoy (conservando el color actual, como se pidió).
  aplicarFaviconTemporada(tema);

  if (!tema || tema.es_predeterminado) {
    root.removeAttribute(ATTR);
    document.getElementById(STYLE_TAG_ID)?.remove();
    // Recién ahora que el atributo/estilo de override ya se quitó del DOM
    // -- si se leyera --primary computado ANTES de este punto, se leería
    // el valor de la temporada que se acaba de desactivar, no el real.
    sincronizarThemeColorMeta();
    return;
  }

  root.setAttribute(ATTR, tema.clave);

  let styleTag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = STYLE_TAG_ID;
    document.head.appendChild(styleTag);
  }

  const selector = `[${ATTR}="${tema.clave}"]`;
  styleTag.textContent = `
${selector} {
  --primary: ${tema.color_primario_claro};
  --primary-rgb: ${hexToRgb(tema.color_primario_claro)};
  --gold: ${tema.color_secundario_claro};
  --gold-rgb: ${hexToRgb(tema.color_secundario_claro)};
  --gold-surface: ${tema.color_secundario_oscuro};
  --gold-surface-rgb: ${hexToRgb(tema.color_secundario_oscuro)};
}
.dark${selector} {
  --primary: ${tema.color_primario_oscuro};
  --primary-rgb: ${hexToRgb(tema.color_primario_oscuro)};
  --gold: ${tema.color_secundario_oscuro};
  --gold-rgb: ${hexToRgb(tema.color_secundario_oscuro)};
}

/* Antes esto también reteñía el FONDO de .navbar-surface con más
   opacidad de --primary-rgb -- se quitó (ver theme.css, sección 13):
   con el Hero ahora oscurecido (scrim sobre la foto), un navbar del
   mismo morado/granate de temporada se leía pegado al fondo en vez de
   como una barra propia. La señal de "hay una temporada activa" queda
   en la franja superior (más gruesa y con más brillo acá) y en el
   badge del logo (Navbar.tsx), no en toda la superficie del navbar. */
${selector} .navbar-surface::before {
  height: 5px;
  box-shadow: 0 2px 12px rgba(var(--primary-rgb), 0.55);
}
`.trim();

  sincronizarThemeColorMeta();
}

// Último tema activo conocido, guardado en este navegador. Permite pintar
// el primer render ya con los colores de la temporada sin esperar a la
// red: antes TemaProvider no mostraba NADA (pantalla "TemaCargando" a
// pantalla completa) hasta que respondía GET /api/temas/activo, y con el
// backend en arranque en frío (Render free) eso dejaba el sitio entero
// bloqueado decenas de segundos. Ahora la página se muestra de inmediato
// y el tema real se confirma/actualiza en cuanto responde el API.
const TEMA_CACHE_KEY = "alik:tema-activo";

function leerTemaGuardado(): Tema | null {
  try {
    const raw = localStorage.getItem(TEMA_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Tema) : null;
  } catch {
    return null;
  }
}

function guardarTema(tema: Tema | null): void {
  try {
    if (tema) localStorage.setItem(TEMA_CACHE_KEY, JSON.stringify(tema));
    else localStorage.removeItem(TEMA_CACHE_KEY);
  } catch {
    /* almacenamiento no disponible (modo privado): solo se pierde el atajo */
  }
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [temaActivo, setTemaActivo] = useState<Tema | null>(() => {
    const guardado = leerTemaGuardado();
    // Se aplica de forma síncrona, antes del primer pintado de la app.
    aplicarTemaEnDOM(guardado);
    return guardado;
  });

  const refrescarTemaActivo = useCallback(async () => {
    try {
      const tema = await temaService.getActivo();
      setTemaActivo(tema);
      aplicarTemaEnDOM(tema);
      guardarTema(tema);
    } catch {
      // Sin ningún tema configurado todavía, o backend no disponible en
      // este momento -- el sitio se queda con los colores que ya tiene,
      // nunca se rompe ni se bloquea por esto.
    }
  }, []);

  useEffect(() => {
    refrescarTemaActivo();
  }, [refrescarTemaActivo]);

  return (
    <TemaContext.Provider value={{ temaActivo, refrescarTemaActivo }}>
      {children}
    </TemaContext.Provider>
  );
}

export function useTema(): TemaContextType {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error("useTema debe usarse dentro de <TemaProvider>");
  return ctx;
}
