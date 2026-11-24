// Deja listos, por la API real, los datos que necesita el recorrido.
// Corre con: node sembrar.mjs   (contra una base de PRUEBA, nunca la real)
//
// Cuentas de ejemplo (personas inventadas, nada de datos reales):
//   cliente  valentina.rios@correo-demo.co  /  Demo2026!
//   admin    admin@correo-demo.co           /  Demo2026!
const API = process.env.API ?? "http://localhost:8000";
const CLAVE = process.env.CLAVE_DEMO ?? "Demo2026!";

async function entrar(correo) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: correo, password: CLAVE }),
  });
  if (!r.ok) throw new Error(`login ${correo}: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

async function llamar(token, metodo, ruta, datos) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: datos ? JSON.stringify(datos) : undefined,
  });
  if (!r.ok) throw new Error(`${metodo} ${ruta}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

// 1. Contenido de ejemplo de la comunidad y reseñas (sale con la etiqueta "Ejemplo").
const admin = await entrar("admin@correo-demo.co");
const resumen = await llamar(admin, "POST", "/api/comunidad/admin/contenido-ejemplo");
console.log(`Comunidad: ${resumen.publicaciones} historias y ${resumen.resenas} reseñas de ejemplo.`);

// 2. La cliente necesita un método de pago guardado (el perfil lo pide).
const cliente = await entrar("valentina.rios@correo-demo.co");
const metodos = await llamar(cliente, "GET", "/api/metodos-pago-guardados");
if (!metodos.length) {
  await llamar(cliente, "POST", "/api/metodos-pago-guardados", { alias: "Nequi personal", tipo: "nequi", clave: "1234" });
}
console.log("Datos de ejemplo listos.");
