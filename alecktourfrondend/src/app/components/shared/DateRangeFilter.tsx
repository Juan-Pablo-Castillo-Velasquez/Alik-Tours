import DateInput from "./DateInput";

interface Props {
  desde: string;
  hasta: string;
  onChange: (rango: { desde: string; hasta: string }) => void;
  label?: string;
}

const inputCls =
  "px-3 py-2 text-sm bg-muted/30 border border-border text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";

/** Filtro "desde / hasta" compartido (comprobantes del cliente y pagos del panel). */
export default function DateRangeFilter({ desde, hasta, onChange, label = "Fecha" }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium">{label}:</span>
      <DateInput
        aria-label={`${label} desde`}
        value={desde}
        max={hasta || undefined}
        onValueChange={(v) => onChange({ desde: v, hasta })}
        className={inputCls}
      />
      <span>a</span>
      <DateInput
        aria-label={`${label} hasta`}
        value={hasta}
        min={desde || undefined}
        onValueChange={(v) => onChange({ desde, hasta: v })}
        className={inputCls}
      />
    </div>
  );
}

/** true si la fecha ISO (o datetime) cae dentro del rango (extremos incluidos). */
export function dentroDeRango(fechaIso: string | null | undefined, desde: string, hasta: string): boolean {
  if (!desde && !hasta) return true;
  if (!fechaIso) return false;
  const dia = fechaIso.slice(0, 10);
  if (desde && dia < desde) return false;
  if (hasta && dia > hasta) return false;
  return true;
}
