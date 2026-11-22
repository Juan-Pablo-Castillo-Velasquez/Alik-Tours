/** Marca visible del contenido de ejemplo (publicaciones y reseñas cargadas
 * para una demostración, ver backend/app/services/contenido_ejemplo.py):
 * deja claro que no es la opinión de un cliente real. */
export default function EtiquetaEjemplo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 ${className}`}
      title="Contenido de ejemplo para demostración: no es la opinión de un cliente real."
    >
      Ejemplo
    </span>
  );
}

/** Aviso para las páginas que muestran contenido de ejemplo. */
export function AvisoContenidoEjemplo() {
  return (
    <p
      role="note"
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
    >
      Lo marcado como <strong>Ejemplo</strong> es contenido de demostración: no son opiniones de clientes reales y no
      cuenta en la calificación de Alik Tours.
    </p>
  );
}
