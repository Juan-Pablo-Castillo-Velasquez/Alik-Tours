// Validación de formularios reutilizable (mismas reglas que el backend).
//
// Cada campo declara sus reglas; `validarFormulario` devuelve un mensaje por
// campo con error (para mostrarlo DEBAJO del campo) y los valores ya
// recortados (sin espacios al inicio ni al final), que son los que se envían.

export interface ReglaCampo {
  etiqueta: string;
  obligatorio?: boolean;
  min?: number;
  max?: number;
  tipo?: "correo" | "telefono" | "documento" | "texto";
}

export type Reglas<K extends string> = Record<K, ReglaCampo>;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Celular colombiano (3xx…, 10 dígitos) o internacional con + (8-15 dígitos).
const TELEFONO = /^(\+\d{8,15}|3\d{9}|\d{7,10})$/;
const DOCUMENTO = /^[A-Za-z0-9]{5,20}$/;

export function limpiarTelefono(valor: string): string {
  return valor.replace(/[\s\-.()]/g, "");
}

export function validarCampo(valor: string, regla: ReglaCampo): string | null {
  const v = valor.trim();
  if (!v) return regla.obligatorio ? `${regla.etiqueta} es obligatorio` : null;
  if (regla.min != null && v.length < regla.min) return `${regla.etiqueta}: mínimo ${regla.min} caracteres`;
  if (regla.max != null && v.length > regla.max) return `${regla.etiqueta}: máximo ${regla.max} caracteres`;
  if (regla.tipo === "correo" && !CORREO.test(v)) return "Escribe un correo válido (ej. nombre@correo.com)";
  if (regla.tipo === "telefono" && !TELEFONO.test(limpiarTelefono(v)))
    return "Escribe un teléfono válido (10 dígitos o con indicativo +57)";
  if (regla.tipo === "documento" && !DOCUMENTO.test(v)) return "Documento inválido: solo letras y números (5 a 20)";
  return null;
}

export function validarFormulario<K extends string>(
  valores: Record<K, string>,
  reglas: Reglas<K>,
): { errores: Partial<Record<K, string>>; limpios: Record<K, string>; valido: boolean } {
  const errores: Partial<Record<K, string>> = {};
  const limpios = {} as Record<K, string>;
  for (const campo of Object.keys(reglas) as K[]) {
    const valor = valores[campo] ?? "";
    limpios[campo] = valor.trim();
    const error = validarCampo(valor, reglas[campo]);
    if (error) errores[campo] = error;
  }
  return { errores, limpios, valido: Object.keys(errores).length === 0 };
}

/** Mensaje claro para un 429 (demasiados envíos) u otro error del servidor. */
export function mensajeErrorEnvio(error: unknown, porDefecto: string): string {
  const texto = error instanceof Error ? error.message : "";
  if (/demasiadas solicitudes/i.test(texto)) return "Enviaste varios formularios seguidos. Espera unos minutos e inténtalo de nuevo.";
  // El resto de errores del servidor llegan en lenguaje técnico (validación
  // de Pydantic, en inglés): a la persona se le muestra un mensaje claro.
  return porDefecto;
}
