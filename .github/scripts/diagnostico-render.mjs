// Verifica (solo lectura) que el backend en Render tenga el código y la migración nuevos.
import { chromium } from "playwright";
const B = "https://proyectoalectoursdocker.onrender.com";
const b = await chromium.launch();
const p = await b.newPage();
let ok = false;
for (let i = 0; i < 20 && !ok; i++) {
  const r = await p.goto(`${B}/openapi.json`, { timeout: 90000 }).catch(() => null);
  try {
    const j = JSON.parse(await p.evaluate(() => document.body.innerText));
    ok = !!j.components?.schemas?.HabitacionResponse?.properties?.servicios && !!j.paths?.["/api/hoteles/habitaciones/{habitacion_id}/imagenes/{id_imagen}"]?.patch;
    console.log("intento", i, "status", r?.status(), "ficha completa (servicios + PATCH foto):", ok);
  } catch { console.log("intento", i, "status", r?.status(), "(sin JSON)"); }
  if (!ok) await p.waitForTimeout(30000);
}
for (const u of ["/health", "/api/resenas/destacadas", "/api/promociones/seleccion-casa", "/api/paquetes?limit=2", "/api/hoteles?limit=1"]) {
  const r = await p.goto(B + u, { timeout: 60000 }).catch(() => null);
  console.log("GET", r?.status(), u, "|", r ? (await p.evaluate(() => document.body.innerText)).slice(0, 100).replace(/\s+/g, " ") : "");
}
await b.close();
