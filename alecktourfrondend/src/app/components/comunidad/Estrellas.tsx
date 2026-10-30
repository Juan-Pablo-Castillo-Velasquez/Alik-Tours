import { Star } from "lucide-react";

interface Props {
  valor: number;
  onChange?: (v: number) => void;
  size?: number;
}

/** Calificación de 1 a 5. Con onChange es un selector accesible; sin él, solo lectura. */
export default function Estrellas({ valor, onChange, size = 16 }: Props) {
  if (!onChange) {
    return (
      <span className="inline-flex gap-0.5" aria-label={`${valor} de 5 estrellas`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            style={{ width: size, height: size }}
            className={n <= valor ? "fill-[var(--gold,#D9B25B)] text-[var(--gold,#D9B25B)]" : "text-muted-foreground/30"}
          />
        ))}
      </span>
    );
  }
  return (
    <div className="inline-flex gap-1" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={valor === n}
          aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
          onClick={() => onChange(valor === n ? 0 : n)}
          className="p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Star
            style={{ width: size, height: size }}
            className={n <= valor ? "fill-[var(--gold,#D9B25B)] text-[var(--gold,#D9B25B)]" : "text-muted-foreground/40 hover:text-[var(--gold,#D9B25B)]"}
          />
        </button>
      ))}
    </div>
  );
}
