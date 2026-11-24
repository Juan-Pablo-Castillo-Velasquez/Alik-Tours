// Video de demostración de AlikTours: recorrido grabado con rótulos, voz y
// subtítulos. Basado en la plantilla "Demos en video de tu aplicación,
// grabados con código" (SENA · CGMLTI). Ver demo/README.md.
//
// Sin voz:  node guion.mjs
// Con voz:  VOZ_CMD="espeak-ng -v es-419 -s 150 --stdin -w" node guion.mjs
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:5173";
const NOMBRE = process.env.NOMBRE ?? "aliktours";
const RITMO = Number(process.env.RITMO ?? 1); // 0.5 = el doble de rápido
const CLAVE = process.env.CLAVE_DEMO ?? "Demo2026!";
const VOZ_CMD = process.env.VOZ_CMD ? process.env.VOZ_CMD.split(" ") : null;
const dirVoz = path.join(".run", "voz");
const dirVideo = path.join(".run", "video");
mkdirSync(dirVoz, { recursive: true });
mkdirSync(dirVideo, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dormir = (ms) => sleep(ms * RITMO);

// Fechas del viaje del recorrido: dentro de un mes, tres noches.
const enDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const ENTRADA = enDias(27);
const SALIDA = enDias(30);

// ── 1. Pronunciación fija: el texto se reescribe solo para el oído ──
const PARA_VOZ = [
  [/\bAlik Tours\b/g, "Álik Turs"],
  [/\bNequi\b/g, "Néqui"],
  [/\bPDF\b/g, "pe de efe"],
  [/\bSENA\b/g, "Sena"],
  [/«|»/g, ""],
];

// ── 2. Voz con caché: el mismo texto nunca se genera dos veces ──
function locutar(texto) {
  const dicho = PARA_VOZ.reduce((t, [re, por]) => t.replace(re, por), texto);
  const clave = createHash("sha1").update(VOZ_CMD.join(" ") + dicho).digest("hex").slice(0, 16);
  const wav = path.join(dirVoz, `${clave}.wav`);
  if (!existsSync(wav)) execFileSync(VOZ_CMD[0], [...VOZ_CMD.slice(1), wav], { input: dicho });
  const seg = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]);
  return { wav, ms: Number(seg) * 1000 };
}

// ── 3. Rótulo en pantalla: sobrevive a la navegación y queda encima de los diálogos ──
const INIT = () => {
  // El recorrido no muestra la bienvenida de la primera visita ni el aviso
  // de cookies (se ven una sola vez por visitante y no son parte del flujo).
  try {
    sessionStorage.setItem("alectours_welcome_splash_visto", "1");
    localStorage.setItem("cookie_consent_ack", "1");
  } catch {}
  const subir = () => {
    const el = document.getElementById("__rotulo");
    if (!el?.showPopover) return;
    if (el.matches(":popover-open")) el.hidePopover();
    el.showPopover();
  };
  const pintar = () => {
    let t = null;
    try {
      t = localStorage.getItem("__rotulo");
    } catch {
      return;
    }
    let el = document.getElementById("__rotulo");
    if (!t) return el?.remove();
    if (!el) {
      el = document.createElement("div");
      el.id = "__rotulo";
      el.popover = "manual";
      el.style.cssText =
        "position:fixed;top:auto;left:50%;right:auto;bottom:24px;transform:translateX(-50%);" +
        "margin:0;border:0;max-width:640px;padding:12px 18px;border-radius:12px;" +
        "background:#3d0d1c;color:#fff;font:600 17px/1.35 system-ui,sans-serif;pointer-events:none;" +
        "box-shadow:0 8px 24px rgba(0,0,0,.25);text-align:center";
      document.documentElement.appendChild(el);
    }
    el.textContent = t;
    subir();
  };
  new MutationObserver((cambios) => {
    if (cambios.some((c) => c.target.tagName === "DIALOG")) subir();
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ["open"] });
  window.__pintar = pintar;
  document.addEventListener("DOMContentLoaded", pintar);
};

// Cada rótulo dura lo que tome leerlo (70 ms por letra, mínimo 2,5 s) o su audio, lo que sea mayor.
let inicio = 0;
let previo = { en: 0, ms: 0 };
const rotulos = [];
async function rotulo(page, texto) {
  const voz = VOZ_CMD ? locutar(texto) : null;
  const falta = previo.en + previo.ms * (VOZ_CMD ? 1 : RITMO) - Date.now();
  if (falta > 0) await sleep(falta);
  previo = { en: Date.now(), ms: Math.max(2500, texto.length * 70, (voz?.ms ?? 0) + 500) };
  rotulos.push({ t: Date.now() - inicio, texto, wav: voz?.wav });
  await page.evaluate((t) => {
    localStorage.setItem("__rotulo", t);
    window.__pintar?.();
  }, texto);
}
// Espera a que termine de leerse el rótulo actual.
async function esperarRotulo() {
  const falta = previo.en + previo.ms * (VOZ_CMD ? 1 : RITMO) - Date.now();
  if (falta > 0) await sleep(falta);
}

// ── 4. Resaltar antes de hacer clic: el ojo sigue el borde dorado ──
async function resaltar(loc) {
  const el = loc.first();
  // Las listas animadas pueden volver a pintarse justo en ese instante:
  // se reintenta una vez con el elemento nuevo.
  for (let intento = 0; intento < 3; intento++) {
    try {
      await el.scrollIntoViewIfNeeded();
      await el.evaluate((n) => {
        n.style.outline = "3px solid #e8b931";
        n.style.outlineOffset = "3px";
      });
      break;
    } catch (e) {
      if (intento === 2 || !/not attached|detached/i.test(e.message)) throw e;
      await sleep(300);
    }
  }
  await dormir(800);
}
async function quitarResalte(loc) {
  await loc
    .first()
    .evaluate((n) => (n.style.outline = ""), null, { timeout: 500 })
    .catch(() => {});
}
async function click(loc) {
  await resaltar(loc);
  await loc.first().click();
  await quitarResalte(loc);
  await dormir(600);
}
async function escribir(loc, texto) {
  await resaltar(loc);
  await loc.first().fill("");
  await loc.first().pressSequentially(texto, { delay: 45 * RITMO });
  await quitarResalte(loc);
}
async function bajar(page, px) {
  await page.mouse.wheel(0, px);
  await dormir(900);
}

// ── 5. Portada ──
const MARCA = { corto: "Alik Tours", completo: "Agencia de viajes en línea", color: "#6e1832" };
async function portada(page) {
  await page.setContent(`<body style="margin:0;height:100vh;display:grid;place-items:center;
    background:${MARCA.color};color:#fff;font-family:system-ui,sans-serif;text-align:center">
    <div><h1 style="font-size:76px;margin:0 0 10px;letter-spacing:-1px">${MARCA.corto}</h1>
    <p style="font-size:30px;margin:0;opacity:.95">${MARCA.completo}</p>
    <p style="font-size:20px;margin:44px 0 0;opacity:.8">Recorrido con datos de ejemplo</p></div></body>`);
  const texto = `${MARCA.corto}: ${MARCA.completo.toLowerCase()}. Recorrido con datos de ejemplo.`;
  const voz = VOZ_CMD ? locutar(texto) : null;
  rotulos.push({ t: Date.now() - inicio, texto, wav: voz?.wav });
  await sleep(Math.max(3500, (voz?.ms ?? 0) + 800));
}

// ── 6. Escenas ──
async function iniciarSesion(page, correo) {
  const dialogo = page.getByRole("dialog");
  await escribir(dialogo.getByLabel("Correo electrónico"), correo);
  await dialogo.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await click(dialogo.getByRole("button", { name: "Iniciar sesión" }));
}

async function escenaBuscar(page) {
  await page.goto(`${BASE}/`);
  await rotulo(page, "Cualquier persona entra y explora los destinos, sin crear una cuenta.");
  await dormir(1500);
  await bajar(page, 650);
  await bajar(page, 650);
  await esperarRotulo();

  await rotulo(page, "Busca hoteles para tres noches, para dos personas.");
  await page.goto(`${BASE}/search?start=${ENTRADA}&end=${SALIDA}&people=2`);
  await dormir(1200);
  await rotulo(page, "Filtra por ciudad: Cartagena.");
  await click(page.locator("label").filter({ has: page.locator('input[name="ciudad"]') }).filter({ hasText: "Cartagena" }));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await esperarRotulo();

  const tarjeta = page.locator("article").filter({ hasText: "Casa Murallas" });
  await rotulo(page, "Cada hotel muestra sus servicios, horarios, disponibilidad y el total de la estadía.");
  await resaltar(tarjeta);
  await esperarRotulo();
  await quitarResalte(tarjeta);
  await click(tarjeta.getByRole("link", { name: /Ver habitaciones/ }));

  await rotulo(page, "En la ficha del hotel elige la habitación.");
  await page.locator("#habitaciones").scrollIntoViewIfNeeded();
  await dormir(800);
  await click(page.getByRole("button", { name: /^Elegir habitación/ }));
  await esperarRotulo();
  await rotulo(page, "Y pasa a reservar.");
  await click(page.getByRole("link", { name: "Reservar ahora" }));
}

async function escenaReservar(page) {
  await rotulo(page, "Para reservar, entra con su cuenta.");
  await page.getByRole("dialog").getByLabel("Correo electrónico").waitFor();
  await iniciarSesion(page, "valentina.rios@correo-demo.co");
  // Al entrar vuelve a la reserva que estaba haciendo.
  await page.getByRole("navigation", { name: "Pasos de la reserva" }).waitFor({ timeout: 15000 });
  await esperarRotulo();

  await rotulo(page, "Sus datos ya vienen de su perfil. Solo revisa y continúa.");
  await dormir(1500);
  await click(page.getByRole("button", { name: /^Continuar/ }));
  await rotulo(page, "Confirma las fechas y el número de huéspedes.");
  await dormir(1500);
  await click(page.getByRole("button", { name: /^Continuar/ }));

  await rotulo(page, "Revisa la reserva completa antes de pagar: fechas, habitación y precio.");
  await dormir(1200);
  await bajar(page, 350);
  await esperarRotulo();
  await click(page.getByRole("button", { name: /Ir al pago/ }));

  await rotulo(page, "Puede pagar todo o separar con un abono, con Nequi, PayPal o un asesor.");
  await dormir(1500);
  await bajar(page, 300);
  await esperarRotulo();
}

async function escenaPerfil(page) {
  await rotulo(page, "En su perfil ve sus reservas y en qué va cada una.");
  await page.goto(`${BASE}/profile`);
  await dormir(1200);
  await click(page.getByRole("button", { name: /^Mis reservas/ }).first());
  await dormir(1000);
  await esperarRotulo();
  await rotulo(page, "Cada reserva muestra si está pagada y el estado del viaje.");
  await resaltar(page.locator("article").first());
  await esperarRotulo();
}

async function escenaComunidad(page) {
  await rotulo(page, "En la comunidad, los viajeros cuentan su viaje con fotos.");
  await click(page.getByRole("link", { name: "Comunidad" }).first());
  await dormir(1200);
  await esperarRotulo();
  await rotulo(page, "Filtra las historias por destino.");
  await click(page.getByRole("navigation", { name: "Filtrar por destino" }).getByRole("button", { name: /^Cartagena/ }));
  await esperarRotulo();
  const viaje = page.getByRole("link", { name: /Reservar este viaje/ }).first();
  await rotulo(page, "Y desde cada historia reserva el mismo viaje.");
  await resaltar(viaje);
  await esperarRotulo();
  await quitarResalte(viaje);
  // Sale de la cuenta para la escena siguiente.
  await page.evaluate(() => {
    const r = localStorage.getItem("__rotulo");
    localStorage.clear();
    if (r) localStorage.setItem("__rotulo", r);
  });
}

async function escenaAdmin(page) {
  await rotulo(page, "Desde la administración se gestiona la agencia.");
  await page.goto(`${BASE}/`);
  await dormir(800);
  await click(page.getByRole("button", { name: "Iniciar sesión" }).first());
  await iniciarSesion(page, "admin@correo-demo.co");
  await page.getByRole("button", { name: /^Comunidad/ }).first().waitFor({ timeout: 20000 });
  await dormir(1500);
  await esperarRotulo();
  await rotulo(page, "Hoteles, paquetes, vuelos, reservas y pagos, en un solo panel.");
  await dormir(2500);
  await esperarRotulo();
  await rotulo(page, "Y cada historia de la comunidad se revisa antes de publicarse.");
  await click(page.getByRole("button", { name: /^Comunidad/ }).first());
  await dormir(2000);
  await esperarRotulo();
}

// ── 7. Grabación ──
const navegador = await chromium.launch({
  channel: process.env.CANAL || undefined, // p. ej. CANAL=chrome
  headless: process.env.VER !== "1",
  args: ["--lang=es-CO"],
  env: { ...process.env, LANG: "es_CO.UTF-8", LC_ALL: "es_CO.UTF-8", LANGUAGE: "es_CO:es" },
});
const contexto = await navegador.newContext({
  viewport: { width: 1280, height: 720 },
  locale: "es-CO",
  timezoneId: "America/Bogota",
  acceptDownloads: true,
  recordVideo: { dir: dirVideo, size: { width: 1280, height: 720 } },
});
await contexto.addInitScript(INIT);
const page = await contexto.newPage();
inicio = Date.now();

try {
  await portada(page);
  await escenaBuscar(page);
  await escenaReservar(page);
  await escenaPerfil(page);
  await escenaComunidad(page);
  await escenaAdmin(page);
  await rotulo(page, "Alik Tours: viajar para vivir. Fin de la demostración.");
  await esperarRotulo();
} catch (e) {
  await page.screenshot({ path: path.join(dirVideo, "fallo.png") }).catch(() => {});
  console.error("El recorrido se detuvo:", e.message.split("\n")[0]);
  process.exitCode = 1;
}

const crudo = await page.video().path();
await contexto.close();
await navegador.close();

// ── 8. Subtítulos .vtt y voz pegada al video ──
const fin = Date.now() - inicio;
const hora = (ms) => new Date(ms).toISOString().slice(11, 23);
const cues = rotulos.map((r, i) => `${i + 1}\n${hora(r.t)} --> ${hora(rotulos[i + 1]?.t ?? fin)}\n${r.texto}\n`);
const destino = path.join(dirVideo, NOMBRE);
writeFileSync(`${destino}.vtt`, `WEBVTT\n\n${cues.join("\n")}`);

const conVoz = rotulos.filter((r) => r.wav);
if (conVoz.length) {
  const entradas = conVoz.flatMap((r) => ["-i", r.wav]);
  const filtros = conVoz.map((r, i) => `[${i + 1}:a]adelay=${r.t}|${r.t}[a${i}]`);
  const mezcla = `${conVoz.map((_, i) => `[a${i}]`).join("")}amix=inputs=${conVoz.length}:normalize=0[voz]`;
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", crudo, ...entradas,
    "-filter_complex", [...filtros, mezcla].join(";"),
    "-map", "0:v", "-map", "[voz]", "-c:v", "copy", "-c:a", "libopus", "-b:a", "64k", `${destino}.webm`,
  ]); // prettier-ignore
} else {
  copyFileSync(crudo, `${destino}.webm`);
}
console.log(`Video: ${destino}.webm\nSubtítulos: ${destino}.vtt`);
