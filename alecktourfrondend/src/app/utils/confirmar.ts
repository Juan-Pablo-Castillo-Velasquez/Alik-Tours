/**
 * Confirmación con el diseño del sitio, en lugar de window.confirm:
 *
 *   if (!(await confirmar({ titulo: "¿Borrar la reseña?", confirmar: "Borrar", peligro: true }))) return;
 *
 * La pinta <ConfirmacionGlobal /> (montada una vez en RootLayout).
 */
export interface OpcionesConfirmacion {
  titulo: string;
  mensaje?: string;
  confirmar?: string;
  cancelar?: string;
  peligro?: boolean;
}

type Pendiente = OpcionesConfirmacion & { resolver: (ok: boolean) => void };
type Oyente = (p: Pendiente | null) => void;

let oyente: Oyente | null = null;
let fallbackNativo = true;

export function registrarConfirmacion(fn: Oyente | null) {
  oyente = fn;
  fallbackNativo = fn === null;
}

export function confirmar(opciones: OpcionesConfirmacion): Promise<boolean> {
  if (fallbackNativo || !oyente) {
    // Sin el componente montado (por ejemplo en una prueba aislada).
    return Promise.resolve(window.confirm([opciones.titulo, opciones.mensaje].filter(Boolean).join("\n\n")));
  }
  return new Promise((resolver) => oyente?.({ ...opciones, resolver }));
}
