import { Check } from "lucide-react";

export interface PasoFormulario {
  id: string;
  titulo: string;
  /** Mensaje de lo que falta en este paso (null = completo). */
  pendiente?: string | null;
}

interface Props {
  pasos: PasoFormulario[];
  actual: number;
  onIr: (indice: number) => void;
}

/**
 * Barra de pasos para formularios largos del panel (ofertas aéreas,
 * paquetes...). Se puede saltar a cualquier paso; los que tienen algo
 * pendiente se marcan para que el admin sepa qué le falta antes de guardar.
 */
export default function PasosFormulario({ pasos, actual, onIr }: Props) {
  return (
    <nav aria-label="Pasos del formulario" className="-mx-1 mb-4 overflow-x-auto">
      <ol className="flex min-w-max gap-1 px-1">
        {pasos.map((p, i) => {
          const activo = i === actual;
          const ok = !p.pendiente;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onIr(i)}
                aria-current={activo ? "step" : undefined}
                title={p.pendiente ?? undefined}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activo
                    ? "border-primary bg-primary text-primary-foreground"
                    : ok
                      ? "border-border text-foreground hover:border-primary/50"
                      : "border-warning/50 text-warning hover:border-warning"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                    activo ? "bg-primary-foreground/20" : ok ? "bg-success/15 text-success" : "bg-warning/15"
                  }`}
                >
                  {ok && !activo ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {p.titulo}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
