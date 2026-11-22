/**
 * Borrador de una reserva en curso, guardado en el navegador (localStorage).
 *
 * Si la persona recarga, cierra la pestaña o vuelve otro día al mismo
 * checkout, retoma donde iba: sus datos de viajero, fechas, huéspedes,
 * modalidad y paso. NUNCA se guardan datos de pago (tarjeta, PIN, cuentas):
 * solo lo que ya ve en pantalla y que no da acceso a nada.
 *
 * Todo va en try/catch: en modo privado o con el almacenamiento lleno el
 * navegador lanza errores, y el checkout debe seguir funcionando sin borrador.
 */

export interface BorradorCheckoutHotel {
  nombres: string;
  apellidos: string;
  correo: string;
  celular: string;
  cedula: string;
  ciudad: string;
  direccion: string;
  adultos: number;
  ninos: number;
  fechaInicio: string;
  fechaFin: string;
  modalidad: "full" | "partial";
  paso: number;
}

interface Guardado<T> {
  v: 1;
  guardadoEn: number;
  datos: T;
}

const PREFIJO = "alik_borrador_reserva:";
/** Un borrador viejo ya no sirve (precios y cupos cambian). */
export const VIGENCIA_BORRADOR_MS = 3 * 24 * 60 * 60 * 1000;

export function claveBorradorHotel(idHotel: string | number, idHabitacion: string | number | null) {
  return `${PREFIJO}hotel:${idHotel}:${idHabitacion ?? "sin-habitacion"}`;
}

export function leerBorrador<T>(clave: string, ahora = Date.now()): { datos: T; guardadoEn: number } | null {
  try {
    const crudo = window.localStorage.getItem(clave);
    if (!crudo) return null;
    const g = JSON.parse(crudo) as Guardado<T>;
    if (g?.v !== 1 || typeof g.guardadoEn !== "number" || !g.datos) {
      window.localStorage.removeItem(clave);
      return null;
    }
    if (ahora - g.guardadoEn > VIGENCIA_BORRADOR_MS) {
      window.localStorage.removeItem(clave);
      return null;
    }
    return { datos: g.datos, guardadoEn: g.guardadoEn };
  } catch {
    return null;
  }
}

export function guardarBorrador<T>(clave: string, datos: T, ahora = Date.now()) {
  try {
    const g: Guardado<T> = { v: 1, guardadoEn: ahora, datos };
    window.localStorage.setItem(clave, JSON.stringify(g));
  } catch {
    /* sin almacenamiento disponible: se sigue sin borrador */
  }
}

export function borrarBorrador(clave: string) {
  try {
    window.localStorage.removeItem(clave);
  } catch {
    /* nada que hacer */
  }
}

/** "hace 5 min", "hace 2 h", "ayer" para el aviso de borrador recuperado. */
export function haceCuanto(guardadoEn: number, ahora = Date.now()) {
  const min = Math.max(0, Math.round((ahora - guardadoEn) / 60000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return h < 48 ? "ayer" : `hace ${Math.round(h / 24)} días`;
}
