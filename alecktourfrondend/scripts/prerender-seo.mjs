// Genera una copia estática de dist/index.html por cada ruta pública y
// estática del sitio (las mismas de public/sitemap.xml), con su propio
// <link rel="canonical"> (y og:url a juego) ya escrito en el HTML crudo.
//
// Por qué existe esto: la app es un SPA 100% client-side -- un solo
// index.html servido para todas las rutas vía el rewrite de vercel.json
// ({ "source": "/(.*)", "destination": "/index.html" }). useSeoMeta.ts
// corrige el <title>/meta/canonical con JavaScript después de que React
// monta, pero cualquier rastreador que no ejecute ese JS (o que lea el
// HTML crudo antes de renderizarlo, como Ahrefs Site Audit por defecto)
// ve SIEMPRE el canonical de "/" sin importar qué ruta haya pedido --
// confirmado con el Site Audit de Ahrefs: 9 de 10 URLs del sitemap
// salieron "No" en "Is indexable page", todas con Canonical URL = "/".
// Google mismo lo desaconseja en su propia documentación:
// "asegúrate de que JavaScript no cambie el elemento del link canonical"
// (developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
//
// Con este script, Vercel sirve dist/<ruta>/index.html para /<ruta> antes
// de llegar siquiera a evaluar ese rewrite -- Vercel le da precedencia al
// filesystem sobre los rewrites por diseño ("precedence is given to the
// filesystem prior to rewrites being applied", vercel.com/docs/project-
// configuration/vercel-json#rewrites) -- así que no hace falta tocar
// vercel.json. No cambia nada para un usuario real: el HTML de abajo
// (root-fallback, bundle de React, etc.) es idéntico, React sigue
// hidratando exactamente igual.
//
// Las 3 rutas que ya tienen su propio título/descripción reales vía
// useSeoMeta (Packages, TermsAndConditions, PrivacyPolicy) los replican
// acá tal cual -- mismo texto, mismo formato "<title> | Alik Tours" que
// useSeoMeta.ts ya construye en el navegador -- no se inventa copy nuevo,
// solo se adelanta al HTML crudo lo que el JS ya iba a poner. Las demás
// rutas del sitemap (todavía sin useSeoMeta propio) se dejan con el
// título/descripción por defecto que ya trae dist/index.html -- acá solo
// se corrige el canonical/og:url, que es el bug real que se encontró.
//
// Si agregas useSeoMeta() a una página nueva, agrega también su entrada
// acá (mismo title/description) para que el HTML crudo no quede
// desactualizado respecto a lo que el hook pone en el navegador.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, "..", "dist");
const SITE_URL = "https://alik-tours.vercel.app";
const SITE_NAME = "Alik Tours";

// path -> { title, description } | null
// null = todavía sin copy propio -- solo se corrige canonical/og:url.
const ROUTES = {
  "/search": null,
  "/packages": {
    title: "Paquetes de viaje",
    description:
      "Explora los paquetes de viaje de Alik Tours: hotel, actividades y traslados combinados en un solo precio por persona.",
  },
  "/benefits": null,
  "/corporate": null,
  "/travel-info": null,
  "/faq": null,
  "/contact": null,
  "/testimonios": null,
  "/terms": {
    title: "Términos y Condiciones",
    description:
      "Términos y condiciones de uso de Alik Tours: cuenta, reservas, pagos, cancelaciones y responsabilidad.",
  },
  "/privacy": {
    title: "Política de Privacidad",
    description:
      "Cómo Alik Tours recolecta, usa y protege tus datos personales, incluyendo el uso de almacenamiento local del navegador.",
  },
};

function setTagAttr(html, tagMatcher, attr, value) {
  return html.replace(tagMatcher, (tag) => {
    const attrRegex = new RegExp(`${attr}="[^"]*"`);
    if (!attrRegex.test(tag)) {
      console.warn(`prerender-seo: no encontré el atributo ${attr} en una etiqueta esperada, la dejo igual:\n${tag}`);
      return tag;
    }
    return tag.replace(attrRegex, `${attr}="${value}"`);
  });
}

function buildHtmlForRoute(baseHtml, path, meta) {
  let html = baseHtml;
  const url = `${SITE_URL}${path}`;

  html = setTagAttr(html, /<link rel="canonical"[^>]*>/, "href", url);
  html = setTagAttr(html, /<meta property="og:url"[^>]*>/, "content", url);

  if (meta) {
    const fullTitle = `${meta.title} | ${SITE_NAME}`;
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${fullTitle}</title>`);
    html = setTagAttr(html, /<meta\s+name="description"[^>]*>/, "content", meta.description);
    html = setTagAttr(html, /<meta property="og:title"[^>]*>/, "content", fullTitle);
    html = setTagAttr(html, /<meta\s+property="og:description"[^>]*>/, "content", meta.description);
    html = setTagAttr(html, /<meta name="twitter:title"[^>]*>/, "content", fullTitle);
    html = setTagAttr(html, /<meta\s+name="twitter:description"[^>]*>/, "content", meta.description);
  }

  return html;
}

function main() {
  const indexPath = join(DIST_DIR, "index.html");
  if (!existsSync(indexPath)) {
    console.error(`prerender-seo: no existe ${indexPath} -- ¿corriste esto después de "vite build"?`);
    process.exit(1);
  }
  const baseHtml = readFileSync(indexPath, "utf-8");

  for (const [path, meta] of Object.entries(ROUTES)) {
    const html = buildHtmlForRoute(baseHtml, path, meta);
    const outDir = join(DIST_DIR, path.replace(/^\//, ""));
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, "index.html");
    writeFileSync(outFile, html, "utf-8");
    console.log(`prerender-seo: ${path} -> dist${path}/index.html${meta ? " (title + description propios)" : ""}`);
  }
}

main();
