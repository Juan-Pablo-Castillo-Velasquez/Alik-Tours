// Borrador de los formularios de inicio de sesión y registro.
//
// Si la persona cierra el modal (clic afuera, la X, o pasa de "Iniciar
// sesión" a "Crear cuenta") NO pierde lo que ya escribió: al volver a
// abrirlo encuentra sus datos. Se borra solo cuando el ingreso o el registro
// terminan bien.
//
// Seguridad: las contraseñas se guardan SOLO en memoria (una variable de
// este módulo; se pierden al recargar la página) y nunca en sessionStorage
// ni localStorage. Los demás campos van a sessionStorage, que el navegador
// borra al cerrar la pestaña, para sobrevivir también a una recarga.

const CLAVE_LOGIN = "borrador_login";
const CLAVE_REGISTRO = "borrador_registro";
const CAMPOS_SECRETOS = new Set(["password", "confirmPassword"]);

const enMemoria: Record<string, Record<string, unknown>> = {};

function leerSesion(clave: string): Record<string, unknown> {
  try {
    const crudo = sessionStorage.getItem(clave);
    const datos = crudo ? JSON.parse(crudo) : {};
    return datos && typeof datos === "object" ? datos : {};
  } catch {
    return {};
  }
}

function guardar(clave: string, datos: Record<string, unknown>): void {
  enMemoria[clave] = { ...datos };
  const publicos = Object.fromEntries(Object.entries(datos).filter(([k]) => !CAMPOS_SECRETOS.has(k)));
  try {
    sessionStorage.setItem(clave, JSON.stringify(publicos));
  } catch {
    /* sin almacenamiento: queda solo en memoria */
  }
}

function leer<T extends Record<string, unknown>>(clave: string, base: T): T {
  // Solo se aceptan las claves (y tipos) que el formulario conoce.
  const fuente = { ...leerSesion(clave), ...(enMemoria[clave] ?? {}) };
  const resultado = { ...base };
  for (const k of Object.keys(base) as (keyof T)[]) {
    const v = fuente[k as string];
    if (v !== undefined && typeof v === typeof base[k]) resultado[k] = v as T[keyof T];
  }
  return resultado;
}

function borrar(clave: string): void {
  delete enMemoria[clave];
  try {
    sessionStorage.removeItem(clave);
  } catch {
    /* nada que borrar */
  }
}

export const borradorLogin = {
  leer: <T extends Record<string, unknown>>(base: T) => leer(CLAVE_LOGIN, base),
  guardar: (datos: Record<string, unknown>) => guardar(CLAVE_LOGIN, datos),
  borrar: () => borrar(CLAVE_LOGIN),
};

export const borradorRegistro = {
  leer: <T extends Record<string, unknown>>(base: T) => leer(CLAVE_REGISTRO, base),
  guardar: (datos: Record<string, unknown>) => guardar(CLAVE_REGISTRO, datos),
  borrar: () => borrar(CLAVE_REGISTRO),
};
