// Solo lectura: inventario de datos públicos en producción para la auditoría
// (cuántos paquetes/hoteles/habitaciones y qué campos traen). No escribe nada.
import { chromium } from "playwright";
const B = "https://proyectoalectoursdocker.onrender.com";
const b = await chromium.launch();
const p = await b.newPage();
async function get(u) {
  for (let i = 0; i < 6; i++) {
    const r = await p.goto(B + u, { timeout: 90000 }).catch(() => null);
    try { return JSON.parse(await p.evaluate(() => document.body.innerText)); } catch { await p.waitForTimeout(20000); }
  }
  return null;
}
const rawP = await get("/api/paquetes?limit=100"); console.log("RAWP", JSON.stringify(rawP).slice(0, 300)); const paquetes = Array.isArray(rawP) ? rawP : (rawP?.items ?? []);
console.log("PAQUETES", paquetes.length);
for (const pq of paquetes) {
  const d = await get(`/api/paquetes/${pq.id_paquete}/detalle`);
  console.log(JSON.stringify({ id: pq.id_paquete, activo: pq.activo, dias: pq.duracion_dias, precio: pq.precio_base, salida: pq.ciudad_salida, destino: pq.ciudad_destino, hoteles: d?.hoteles?.map(h => [h.id_hotel, h.noches_incluidas]), servicios: d?.servicios?.map(s => [s.nombre_servicio, s.incluido, s.dia_actividad]), no_incluye: !!pq.no_incluye, condiciones: !!pq.condiciones, fotos: d?.imagenes?.length }));
}
const rawH = await get("/api/hoteles?limit=100"); const hoteles = Array.isArray(rawH) ? rawH : (rawH?.items ?? []);
console.log("HOTELES", hoteles.length);
for (const h of hoteles) {
  console.log(JSON.stringify({ id: h.id_hotel, ciudad: h.ciudad, estrellas: h.calificacion, desc: !!h.descripcion, politicas: !!h.politicas, caracts: (h.hotel_caracteristicas||[]).length, habitaciones: (h.habitaciones||[]).map(x => [x.numero_habitacion, x.tipo_habitacion?.nombre_tipo, x.precio_noche, x.estado]) }));
}
const tipos = await get("/api/hoteles/tipos-habitacion");
console.log("TIPOS", JSON.stringify(tipos));
const servicios = await get("/api/servicios?limit=200");
console.log("SERVICIOS", JSON.stringify((servicios||[]).map(s => [s.id_servicio, s.nombre_servicio, s.precio_base, s.capacidad_maxima])));
const metodos = await get("/api/metodos-pago");
console.log("METODOS", JSON.stringify(metodos));
await b.close();
