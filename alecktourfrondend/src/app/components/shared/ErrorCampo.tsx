import { AlertCircle } from "lucide-react";

/** Mensaje de error que va DEBAJO de un campo (enlazado con aria-describedby). */
export default function ErrorCampo({ id, mensaje }: { id: string; mensaje?: string | null }) {
  if (!mensaje) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {mensaje}
    </p>
  );
}
