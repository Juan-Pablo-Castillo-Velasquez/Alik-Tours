// Página a la que hay que volver después de iniciar sesión.
//
// Antes, quien elegía una habitación sin haber iniciado sesión iba a
// /login y, al entrar, terminaba en su perfil: perdía el hotel, la
// habitación y las fechas que había elegido. Ahora el checkout guarda su
// dirección aquí y el inicio de sesión lo devuelve a ella.
const CLAVE = "alik_volver_tras_login";

/** Ruta de "a dónde volver" para /login?volver=... (solo rutas internas). */
export function rutaLoginConVuelta(destino: string): string {
  return `/login?volver=${encodeURIComponent(destino)}`;
}

export function guardarVuelta(destino: string | null | undefined): void {
  // Solo rutas internas: nunca redirigir a otro sitio (open redirect).
  if (!destino || !destino.startsWith("/") || destino.startsWith("//")) return;
  try {
    sessionStorage.setItem(CLAVE, destino);
  } catch {
    /* sin almacenamiento: se vuelve al perfil, como antes */
  }
}

/** Devuelve la ruta guardada (una sola vez) o null. */
export function tomarVuelta(): string | null {
  try {
    const destino = sessionStorage.getItem(CLAVE);
    sessionStorage.removeItem(CLAVE);
    return destino && destino.startsWith("/") && !destino.startsWith("//") ? destino : null;
  } catch {
    return null;
  }
}
