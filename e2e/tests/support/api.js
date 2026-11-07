// Preparación de datos POR API para los E2E (semana 7).
//
// Regla del grupo: por la interfaz solo se hace lo que el test prueba. Todo
// lo demás (cuentas, hoteles) se crea aquí, con valores únicos por corrida,
// así dos tests (o dos corridas en paralelo) nunca chocan.
import { expect } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8000';
// Mailpit atrapa los correos del backend en local y en el CI (nunca salen
// a Internet). De ahí se lee el código de verificación de 6 dígitos.
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

// Admin que siembran las migraciones (a7c3e9f21b04) en la BD de pruebas.
const ADMIN = {
  correo: process.env.E2E_ADMIN_EMAIL ?? 'admin@alektours.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'Admin1234!',
};

export const PASSWORD_E2E = 'ClaveE2e123';

// Archivo donde auth.setup.js guarda la sesión de cliente reutilizable.
export const SESION_CLIENTE = 'playwright/.auth/cliente.json';

let contador = 0;
/** Texto único por corrida y por test: "prefijo-<tiempo>-<n>". */
export function unico(prefijo) {
  contador += 1;
  return `${prefijo}-${Date.now().toString(36)}-${contador}-${Math.floor(Math.random() * 1e4)}`;
}

/** Correo único. No se usa .test: el validador de correos del backend
 *  (email-validator) rechaza los dominios reservados. Mailpit atrapa todo. */
export function correoUnico(prefijo = 'e2e') {
  return `${unico(prefijo).toLowerCase()}@e2e.alektours.com`;
}

/** Cédula única de 10 dígitos. */
export function cedulaUnica() {
  return String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 90) + 10);
}

async function postJson(request, ruta, datos, token) {
  const respuesta = await request.post(`${API_URL}${ruta}`, {
    data: datos,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  expect(respuesta.ok(), `${ruta} respondió ${respuesta.status()}: ${await respuesta.text()}`).toBeTruthy();
  return respuesta.json();
}

/** Registra una cuenta SIN verificar (como si no hubiera abierto el correo). */
export async function registrarCuenta(request, { correo = correoUnico(), password = PASSWORD_E2E } = {}) {
  const r = await postJson(request, '/auth/register', { username: correo, correo_electronico: correo, password });
  return { correo, password, idUsuario: r.user_id, tokenProvisional: r.access_token };
}

/** Espera el correo de verificación en Mailpit y devuelve su código. */
export async function codigoDeVerificacion(request, correo) {
  let codigo = null;
  await expect
    .poll(
      async () => {
        const busqueda = await request.get(`${MAILPIT_URL}/api/v1/search`, { params: { query: `to:${correo}` } });
        const { messages = [] } = await busqueda.json();
        if (!messages.length) return null;
        const mensaje = await (await request.get(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json();
        codigo = /\b(\d{6})\b/.exec(mensaje.Text ?? '')?.[1] ?? null;
        return codigo;
      },
      { message: `No llegó a Mailpit el correo de verificación de ${correo}`, timeout: 15_000 },
    )
    .not.toBeNull();
  return codigo;
}

/** Cuenta verificada (registro + código del correo), con su sesión. */
export async function crearClienteVerificado(request, opciones = {}) {
  const cuenta = await registrarCuenta(request, opciones);
  const codigo = await codigoDeVerificacion(request, cuenta.correo);
  const sesion = await postJson(request, '/auth/verify-email-code', { correo_electronico: cuenta.correo, codigo });
  return { ...cuenta, sesion };
}

export async function tokenAdmin(request) {
  const r = await postJson(request, '/auth/login', { username: ADMIN.correo, password: ADMIN.password });
  return r.access_token;
}

/** Crea un hotel con una habitación disponible. Devuelve el hotel creado. */
export async function crearHotel(request, token, datos) {
  const tipos = await (await request.get(`${API_URL}/api/hoteles/tipos-habitacion`)).json();
  return postJson(
    request,
    '/api/hoteles/',
    {
      pais: 'Colombia',
      calificacion: 4,
      habitaciones: [{ id_tipo_habitacion: tipos[0].id_tipo_habitacion, numero_habitacion: '101', precio_noche: 320000 }],
      ...datos,
    },
    token,
  );
}

export async function borrarHotel(request, token, idHotel) {
  // Primero sus habitaciones (un hotel con habitaciones no se puede borrar: 409).
  const habitaciones = await (await request.get(`${API_URL}/api/hoteles/${idHotel}/habitaciones`)).json();
  for (const h of habitaciones) {
    await request.delete(`${API_URL}/api/hoteles/habitaciones/${h.id_habitacion}`, { headers: { Authorization: `Bearer ${token}` } });
  }
  await request.delete(`${API_URL}/api/hoteles/${idHotel}`, { headers: { Authorization: `Bearer ${token}` } });
}

/** Perfil de cliente con esa cédula, a nombre de una cuenta nueva verificada. */
export async function crearClienteConCedula(request, cedula) {
  const cuenta = await crearClienteVerificado(request);
  await postJson(
    request,
    '/api/clientes',
    { nombre: 'Ocupa', apellido: 'Cédula', cedula, correo: cuenta.correo, celular: '3001234567' },
    cuenta.sesion.access_token,
  );
  return cuenta;
}

// --- Ecosistema de reservas (vuelos y paquetes) ---

/** Login del admin sembrado: respuesta completa (token, roles...). */
export async function sesionAdmin(request) {
  return postJson(request, '/auth/login', { username: ADMIN.correo, password: ADMIN.password });
}

/** Deja al navegador con esa sesión, igual que el login real (AuthContext). */
export async function abrirSesionEnNavegador(page, sesion, extra = {}) {
  await page.goto('/');
  await page.evaluate(
    ([s, e]) => {
      localStorage.setItem('token', s.access_token);
      localStorage.setItem(
        'usuario',
        JSON.stringify({ username: s.username, user_id: s.user_id, id_cliente: s.id_cliente, roles: s.roles, verificado: true, activo: true, ...e }),
      );
    },
    [sesion, extra],
  );
}

/** Cliente verificado CON perfil de cliente (necesario para reservar). */
export async function crearClienteConPerfil(request) {
  const cuenta = await crearClienteVerificado(request);
  const cliente = await postJson(
    request,
    '/api/clientes',
    { nombre: 'Viajera', apellido: 'Prueba', cedula: cedulaUnica(), correo: cuenta.correo, celular: '3001234567' },
    cuenta.sesion.access_token,
  );
  return { ...cuenta, cliente };
}

/** Fecha ISO a N días de hoy. */
export function enDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function crearOfertaVuelo(request, token, datos = {}) {
  return postJson(
    request,
    '/api/vuelos',
    {
      titulo: unico('Vuelo E2E'),
      origen_ciudad: 'Bogotá',
      origen_iata: 'BOG',
      destino_ciudad: 'Cartagena',
      destino_iata: 'CTG',
      fecha_salida: enDias(40),
      fecha_regreso: enDias(43),
      precio_adulto: 450000,
      estado: 'publicada',
      cupos: 20,
      ...datos,
    },
    token,
  );
}

export async function crearPaquete(request, token, datos = {}) {
  return postJson(
    request,
    '/api/paquetes',
    { nombre_paquete: unico('Paquete E2E'), duracion_dias: 4, noches: 3, precio_base: 1000000, ...datos },
    token,
  );
}

export async function obtenerReserva(request, token, idReserva) {
  const r = await request.get(`${API_URL}/api/reservas/${idReserva}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(r.ok()).toBeTruthy();
  return r.json();
}
