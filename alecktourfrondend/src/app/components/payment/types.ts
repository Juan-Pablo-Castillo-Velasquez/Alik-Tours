// components/payment/types.ts
// Tipos y helpers puros compartidos por los componentes de pago. Sin JSX,
// sin llamadas a la API — solo formateo y validación de lo que el usuario
// escribe, igual que hacía antes Checkout.tsx pero reutilizable por método.

export interface CardPaymentValue {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
}

export const emptyCardValue: CardPaymentValue = { number: "", name: "", expiry: "", cvv: "" };

export function formatCardNumber(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

export function formatExpiry(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function isExpiryValid(expiry: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) return false;
  const mes = parseInt(match[1], 10);
  const anio = 2000 + parseInt(match[2], 10);
  if (mes < 1 || mes > 12) return false;
  const ahora = new Date();
  const finMes = new Date(anio, mes, 0);
  return finMes >= new Date(ahora.getFullYear(), ahora.getMonth(), 1);
}

export function isCardValueValid(v: CardPaymentValue): boolean {
  return (
    v.number.replace(/\s/g, "").length === 16 &&
    v.name.trim().length > 2 &&
    isExpiryValid(v.expiry) &&
    v.cvv.length >= 3
  );
}

/** Últimos 4 dígitos, lo único que viaja al backend (nunca el número completo). */
export function cardLast4(v: CardPaymentValue): string {
  return v.number.replace(/\s/g, "").slice(-4);
}

export interface PSEPaymentValue {
  banco: string;
  documento: string;
}
export const emptyPSEValue: PSEPaymentValue = { banco: "", documento: "" };
export function isPSEValueValid(v: PSEPaymentValue): boolean {
  return v.banco.trim().length > 0 && /^\d{6,15}$/.test(v.documento.trim());
}

export interface NequiPaymentValue {
  celular: string;
}
export const emptyNequiValue: NequiPaymentValue = { celular: "" };
export function isNequiValueValid(v: NequiPaymentValue): boolean {
  return /^3\d{9}$/.test(v.celular.trim());
}

// Nequi real de Alik Tours al que el cliente transfiere en la simulación
// (ver NequiPayment.tsx / NequiConfirmar.tsx) -- no hay pasarela conectada,
// así que el flujo es "transfiere a este número y confírmalo aquí" como
// hacen de verdad muchos negocios chicos en Colombia sin pasarela.
export const NEQUI_DESTINO = "3228174200";
export function formatNequiDestino(numero: string = NEQUI_DESTINO): string {
  return numero.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");
}

/** Estado visual del pago — coincide con PENDING/PROCESSING/APPROVED/REJECTED del brief.
 * "pendiente_verificacion" es exclusivo de Nequi: el cliente ya dijo que
 * transfirió (ver NequiConfirmar.tsx) pero un asesor/admin todavía no lo
 * confirma -- no es "processing" (que sigue siendo la espera automática de
 * PSE) ni "approved". */
export type PaymentOutcome = "idle" | "processing" | "approved" | "rejected" | "pendiente_verificacion";
