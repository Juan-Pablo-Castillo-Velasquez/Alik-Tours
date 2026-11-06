// Revisa el sitio publicado: recorre las páginas (sitemap + enlaces internos
// que va encontrando), y reporta páginas 404, imágenes que no cargan,
// peticiones fallidas (>=400) y enlaces externos rotos.
import { chromium } from "playwright";

const SITIO = process.env.SITIO || "https://alik-tours.vercel.app";
const MAX_PAGINAS = 120;
const inicio = ["/", "/packages", "/search", "/benefits", "/corporate", "/travel-info", "/comunidad", "/faq",
  "/contact", "/testimonios", "/terms", "/privacy", "/login", "/register", "/preferences", "/confirmation"];

const visitar = [...inicio];
const vistas = new Set();
const externos = new Map(); // url -> páginas
const problemas = [];
const anotar = (tipo, pagina, detalle) => problemas.push({ tipo, pagina, detalle });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });

while (visitar.length && vistas.size < MAX_PAGINAS) {
  const ruta = visitar.shift();
  if (vistas.has(ruta)) continue;
  vistas.add(ruta);
  const p = await ctx.newPage();
  p.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400 && !/google-analytics|googletagmanager|vercel-insights|_vercel\/(insights|speed)/.test(u))
      anotar("peticion", ruta, `${r.status()} ${u}`);
  });
  p.on("requestfailed", (r) => {
    const u = r.url();
    const err = r.failure()?.errorText || "";
    if (!/ERR_ABORTED/.test(err) && !/google-analytics|googletagmanager/.test(u)) anotar("peticion-fallida", ruta, `${err} ${u}`);
  });
  try {
    const resp = await p.goto(SITIO + ruta, { waitUntil: "networkidle", timeout: 45000 });
    if (!resp || resp.status() >= 400) anotar("pagina", ruta, `HTTP ${resp?.status()}`);
    await p.waitForTimeout(1500);
    // bajar para disparar lazy-load
    await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    });
    await p.waitForTimeout(1500);
    const info = await p.evaluate(() => ({
      es404: !!document.body.innerText.match(/Página no encontrada/i),
      links: [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.href, raw: a.getAttribute("href"), texto: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 40) })),
      imgs: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && i.src).map((i) => i.currentSrc || i.src),
    }));
    if (info.es404) anotar("pagina-404", ruta, "muestra 'Página no encontrada'");
    for (const src of info.imgs) anotar("imagen-rota", ruta, src);
    for (const l of info.links) {
      if (!l.raw || l.raw === "#" || l.raw.startsWith("javascript")) { anotar("enlace-vacio", ruta, `"${l.texto}" -> ${l.raw}`); continue; }
      let u; try { u = new URL(l.href); } catch { anotar("enlace-invalido", ruta, l.raw); continue; }
      if (u.origin === new URL(SITIO).origin) {
        const r2 = u.pathname + (u.search || "");
        if (!vistas.has(r2) && !visitar.includes(r2) && !/\/(admin|profile|checkout)/.test(u.pathname)) visitar.push(r2);
      } else if (/^https?:/.test(u.protocol)) {
        if (!externos.has(u.href)) externos.set(u.href, new Set());
        externos.get(u.href).add(ruta);
      }
    }
  } catch (e) {
    anotar("pagina-error", ruta, String(e).slice(0, 200));
  }
  await p.close();
}

for (const [u, paginas] of externos) {
  let estado = "";
  try {
    const r = await fetch(u, { method: "GET", redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (revisor de enlaces Alik Tours)" }, signal: AbortSignal.timeout(20000) });
    estado = String(r.status);
    if (r.status >= 400 && ![401, 403, 429, 999].includes(r.status)) anotar("externo-roto", [...paginas][0], `${r.status} ${u}`);
  } catch (e) {
    estado = "ERROR " + String(e).slice(0, 80);
    anotar("externo-error", [...paginas][0], `${estado} ${u}`);
  }
  console.log("EXTERNO", estado, u, "en", [...paginas].slice(0, 3).join(","));
}

await b.close();
console.log("PAGINAS_VISITADAS", vistas.size);
console.log([...vistas].join("\n"));
const unicos = new Map();
for (const pr of problemas) { const k = pr.tipo + "|" + pr.detalle; if (!unicos.has(k)) unicos.set(k, { ...pr, paginas: new Set() }); unicos.get(k).paginas.add(pr.pagina); }
console.log("=====PROBLEMAS=====", unicos.size);
for (const v of unicos.values()) console.log(`[${v.tipo}] ${v.detalle}  <- ${[...v.paginas].slice(0, 5).join(", ")}${v.paginas.size > 5 ? ` (+${v.paginas.size - 5})` : ""}`);
