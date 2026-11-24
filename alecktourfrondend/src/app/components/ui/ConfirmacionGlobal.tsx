import { AlertTriangle, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { registrarConfirmacion, type OpcionesConfirmacion } from "../../utils/confirmar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";

type Pendiente = OpcionesConfirmacion & { resolver: (ok: boolean) => void };

/** Diálogo único para confirmar(): centrado, con foco en "Cancelar" y
 * que se cierra con Escape (cuenta como cancelar). */
export default function ConfirmacionGlobal() {
  const [actual, setActual] = useState<Pendiente | null>(null);

  useEffect(() => {
    registrarConfirmacion(setActual);
    return () => registrarConfirmacion(null);
  }, []);

  const cerrar = (ok: boolean) => {
    actual?.resolver(ok);
    setActual(null);
  };
  const Icono = actual?.peligro ? AlertTriangle : HelpCircle;

  return (
    <AlertDialog open={actual != null} onOpenChange={(o) => !o && cerrar(false)}>
      <AlertDialogContent className="max-w-md rounded-2xl border-border bg-card p-6 shadow-2xl">
        <AlertDialogHeader className="items-center text-center sm:items-center sm:text-center">
          <span
            className={`mb-1 flex h-12 w-12 items-center justify-center rounded-full ${
              actual?.peligro ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            }`}
            aria-hidden
          >
            <Icono className="h-6 w-6" />
          </span>
          <AlertDialogTitle className="text-lg font-bold text-foreground">{actual?.titulo}</AlertDialogTitle>
          {actual?.mensaje ? (
            <AlertDialogDescription className="text-sm text-muted-foreground">{actual.mensaje}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">Confirma o cancela la acción.</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2 gap-2 sm:justify-center">
          <AlertDialogCancel autoFocus className="rounded-xl px-5" onClick={() => cerrar(false)}>
            {actual?.cancelar ?? "Cancelar"}
          </AlertDialogCancel>
          <button
            type="button"
            onClick={() => cerrar(true)}
            className={`inline-flex h-9 items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-sm transition-opacity hover:opacity-90 ${
              actual?.peligro ? "bg-destructive text-white" : "bg-primary text-primary-foreground"
            }`}
          >
            {actual?.confirmar ?? "Aceptar"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
