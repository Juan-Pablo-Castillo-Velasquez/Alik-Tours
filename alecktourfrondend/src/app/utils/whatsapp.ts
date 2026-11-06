import { BRAND } from "../config/brand";

/**
 * Número listo para wa.me: solo dígitos y con indicativo de país.
 * Los celulares de clientes se guardan casi siempre sin indicativo
 * ("3001234567"); wa.me/3001234567 abre un chat inexistente, así que a un
 * celular colombiano de 10 dígitos (empieza por 3) se le antepone el 57.
 * Devuelve null si no hay un número utilizable.
 */
export function numeroWhatsApp(numero: string | null | undefined): string | null {
  const digitos = (numero ?? "").replace(/\D/g, "");
  if (digitos.length === 10 && digitos.startsWith("3")) return `57${digitos}`;
  if (digitos.length < 10) return null;
  return digitos;
}

/** Enlace a un chat de WhatsApp, con mensaje inicial opcional. */
export function enlaceWhatsApp(numero: string | null | undefined, mensaje?: string): string | null {
  const n = numeroWhatsApp(numero);
  if (!n) return null;
  return mensaje ? `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}` : `https://wa.me/${n}`;
}

/** Chat de WhatsApp con la agencia (el teléfono oficial de BRAND). */
export function enlaceWhatsAppAgencia(mensaje = `Hola ${BRAND.name}, quiero información sobre un viaje.`): string {
  return enlaceWhatsApp(BRAND.telefono, mensaje) as string;
}
