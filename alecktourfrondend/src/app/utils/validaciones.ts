// Mismas reglas que valida el backend (backend/app/schemas/validadores.py).

/** Quita espacios, guiones, puntos y paréntesis; "+57 300..." -> "300...". */
export function normalizarCelular(valor: string): string {
  const limpio = valor.replace(/[\s\-.()]/g, "");
  if (/^\+573\d{9}$/.test(limpio)) return limpio.slice(3);
  return limpio;
}

/** Móvil colombiano (10 dígitos que empiezan por 3) o internacional con +. */
export function esCelularValido(valor: string): boolean {
  const v = normalizarCelular(valor);
  return /^3\d{9}$/.test(v) || /^\+\d{8,15}$/.test(v);
}

export const MENSAJE_CELULAR =
  "Ingresa un celular válido: 10 dígitos que empiecen por 3 (ej. 3001234567) o un número internacional con + y código de país";
