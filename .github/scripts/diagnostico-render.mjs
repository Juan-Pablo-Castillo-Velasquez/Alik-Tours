// Qué peticiones siguen abiertas en /faq, /terms y /privacy.
import { chromium } from "playwright";
const S = "https://alik-tours.vercel.app";
const b = await chromium.launch();
for (const ruta of ["/faq", "/terms", "/privacy", "/contact"]) {
  const p = await b.newPage();
  const abiertas = new Map();
  const conteo = new Map();
  p.on("request", (r) => { abiertas.set(r, r.url()); const k = r.url().split("?")[0]; conteo.set(k, (conteo.get(k) || 0) + 1); });
  p.on("requestfinished", (r) => abiertas.delete(r));
  p.on("requestfailed", (r) => abiertas.delete(r));
  const t0 = Date.now();
  await p.goto(S + ruta, { waitUntil: "load", timeout: 60000 });
  let idle = "no";
  try { await p.waitForLoadState("networkidle", { timeout: 30000 }); idle = `${Date.now() - t0} ms`; } catch {}
  console.log(`PAGINA ${ruta} networkidle=${idle} abiertas=${abiertas.size}`);
  for (const u of new Set(abiertas.values())) console.log("  ABIERTA", u.slice(0, 160));
  for (const [u, n] of conteo) if (n > 3) console.log("  REPETIDA", n, u.slice(0, 160));
  await p.close();
}
await b.close();
