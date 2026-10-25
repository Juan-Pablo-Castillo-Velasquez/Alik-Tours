import { useEffect } from "react";

interface SeoMetaOptions {
  title: string;
  description?: string;
  /** Ruta relativa, ej. "/hotel/12" — arma la URL canónica y og:url reales. */
  path?: string;
}

const SITE_NAME = "Alik Tours";
// Dominio real donde está desplegado el sitio hoy (Vercel) — el mismo que
// se verificó en Google Search Console. Si más adelante se conecta un
// dominio propio (ej. Alik tours.com), actualizar este valor junto con
// robots.txt, sitemap.xml y las meta tags de index.html.
const SITE_URL = "https://alik-tours.vercel.app";

function setMetaByAttr(attrName: "name" | "property", attrValue: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

// Actualiza <title> y las meta description/OG/canonical de la página actual
// sin ninguna librería nueva (no hay react-helmet instalado, y este entorno
// no puede correr `npm install` para agregar una — ver nota en el commit).
// Antes TODAS las rutas compartían el mismo <title>/meta estático de
// index.html; cada página que llama a este hook pasa a tener su propio
// título y descripción reales, lo cual importa para SEO (cada resultado en
// Google se ve distinto) y para que Search Console indexe contenido único
// en vez de páginas que parecen duplicadas entre sí.
export function useSeoMeta({ title, description, path }: SeoMetaOptions) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;

    setMetaByAttr("property", "og:title", fullTitle);
    setMetaByAttr("name", "twitter:title", fullTitle);

    if (description) {
      setMetaByAttr("name", "description", description);
      setMetaByAttr("property", "og:description", description);
      setMetaByAttr("name", "twitter:description", description);
    }

    if (path) {
      const url = `${SITE_URL}${path}`;
      setCanonical(url);
      setMetaByAttr("property", "og:url", url);
    }
  }, [title, description, path]);
}
