// Diagnóstico de solo lectura del backend publicado en Render.
import { chromium } from "playwright";
const B = "https://proyectoalectoursdocker.onrender.com";
const b = await chromium.launch();
const p = await b.newPage();
for (let i = 0; i < 6; i++) {
  const r = await p.goto(`${B}/health`, { timeout: 90000 }).catch((e) => ({ status: () => "ERR " + e.message.slice(0, 80) }));
  console.log("health intento", i, typeof r.status === "function" ? r.status() : r);
  if (r.status && r.status() === 200) break;
  await p.waitForTimeout(15000);
}
console.log("HEALTH", (await p.content()).replace(/<[^>]+>/g, "").slice(0, 200));
const api = await p.goto(`${B}/openapi.json`, { timeout: 90000 });
console.log("openapi status", api?.status());
let rutas = [];
try {
  const j = JSON.parse(await p.evaluate(() => document.body.innerText));
  rutas = Object.keys(j.paths || {});
  console.log("VERSION_APP", j.info?.version, "RUTAS", rutas.length);
} catch (e) { console.log("openapi no JSON", (await p.content()).slice(0, 300)); }
for (const r of ["/api/comunidad/videos/{id_video}/comentarios", "/api/resenas/mias", "/api/resenas/admin/todas", "/api/comunidad/publicaciones", "/api/resenas/destacadas"])
  console.log("RUTA", rutas.includes(r) ? "SI " : "NO ", r);
for (const u of ["/api/resenas/destacadas", "/api/resenas?skip=0&limit=3", "/api/promociones/seleccion-casa", "/api/hoteles/destinos-sugeridos?q=&limit=8", "/api/hoteles/?skip=0&limit=2", "/api/comunidad/videos", "/api/temas/activo"]) {
  const r = await p.goto(B + u, { timeout: 60000 }).catch(() => null);
  const t = r ? (await p.evaluate(() => document.body.innerText)).slice(0, 160).replace(/\s+/g, " ") : "";
  console.log("GET", r?.status(), u, "|", t);
}
await b.close();
