// Solo lectura: verifica el despliegue (API y migración) y toma capturas de
// las páginas públicas nuevas en escritorio y celular, con errores de consola.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
const B = "https://proyectoalectoursdocker.onrender.com";
const W = "https://alik-tours.vercel.app";
mkdirSync("capturas", { recursive: true });
const b = await chromium.launch();
const p = await b.newPage();
let ok = false;
for (let i = 0; i < 24 && !ok; i++) {
  const r = await p.goto(`${B}/openapi.json`, { timeout: 90000 }).catch(() => null);
  try {
    const j = JSON.parse(await p.evaluate(() => document.body.innerText));
    ok = !!j.components?.schemas?.HotelResponse?.properties?.hora_checkin && !!j.paths?.["/api/vuelos"];
    console.log("intento", i, "status", r?.status(), "ficha hotel + vuelos:", ok);
  } catch { console.log("intento", i, "status", r?.status(), "(sin JSON)"); }
  if (!ok) await p.waitForTimeout(30000);
}
for (const u of ["/health", "/api/hoteles/1", "/api/paquetes/1/detalle"]) {
  const r = await p.goto(B + u, { timeout: 60000 }).catch(() => null);
  console.log("GET", r?.status(), u, "|", r ? (await p.evaluate(() => document.body.innerText)).slice(0, 120).replace(/\s+/g, " ") : "");
}
await p.close();
const paginas = [["paquete", "/package/1"], ["hotel", "/hotel/2"], ["paquetes", "/packages"], ["reservar-sin-login", "/package/1/reservar"]];
for (const [modo, opts] of [["escritorio", { viewport: { width: 1366, height: 900 } }], ["celular", devices["iPhone 13"]]]) {
  const ctx = await b.newContext(opts);
  for (const [nombre, ruta] of paginas) {
    const pg = await ctx.newPage();
    const errores = [];
    pg.on("pageerror", (e) => errores.push(e.message));
    pg.on("console", (m) => m.type() === "error" && errores.push(m.text()));
    await pg.goto(W + ruta, { timeout: 90000, waitUntil: "networkidle" }).catch((e) => errores.push(String(e)));
    await pg.waitForTimeout(2500);
    await pg.screenshot({ path: `capturas/${modo}-${nombre}.png`, fullPage: true }).catch(() => {});
    const texto = (await pg.evaluate(() => document.body.innerText).catch(() => "")).replace(/\s+/g, " ");
    console.log(`[${modo}] ${ruta} errores=${errores.length}`, errores.slice(0, 3).join(" | ").slice(0, 300));
    console.log(`   texto: ${texto.slice(0, 200)}`);
    for (const clave of ["Reservar este paquete", "Servicios e instalaciones", "Políticas del hotel", "Alojamiento"]) {
      if (texto.includes(clave)) console.log(`   contiene: ${clave}`);
    }
    await pg.close();
  }
  await ctx.close();
}
await b.close();
