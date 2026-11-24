/**
 * Contador «123/2000» bajo un campo de texto largo. Cambia de color al
 * acercarse al límite y lo anuncia a los lectores de pantalla solo en ese
 * momento (no en cada tecla).
 */
export default function ContadorCaracteres({
  valor,
  max,
  className = "",
}: {
  valor: string | null | undefined;
  max: number;
  className?: string;
}) {
  const n = (valor ?? "").length;
  const cerca = n >= max * 0.9;
  const lleno = n >= max;
  return (
    <div className={`mt-1 flex justify-end text-xs tabular-nums ${className}`}>
      <span className={lleno ? "font-semibold text-destructive" : cerca ? "text-warning" : "text-muted-foreground"}>
        {n.toLocaleString("es-CO")}/{max.toLocaleString("es-CO")}
      </span>
      <span className="sr-only" aria-live="polite">
        {lleno ? "Llegaste al límite de caracteres." : cerca ? `Te quedan ${max - n} caracteres.` : ""}
      </span>
    </div>
  );
}
