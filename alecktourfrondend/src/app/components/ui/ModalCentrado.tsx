import type { ElementType, ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

/**
 * Modal centrado del sitio: encabezado con ícono, cuerpo con scroll y pie
 * fijo. Se cierra con Escape o con la X, atrapa el foco y lo devuelve al
 * cerrar (Radix). Úsalo en vez de paneles en la esquina.
 */
export default function ModalCentrado({
  abierto,
  onCambio,
  titulo,
  descripcion,
  icono: Icono,
  ancho = "sm:max-w-lg",
  pie,
  children,
}: {
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
  titulo: ReactNode;
  descripcion?: ReactNode;
  icono?: ElementType;
  ancho?: string;
  pie?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        className={`flex max-h-[90vh] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl ${ancho}`}
      >
        <header className="flex items-start gap-3 border-b border-border px-6 py-5 pr-12">
          {Icono && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
              <Icono className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">{titulo}</DialogTitle>
            {descripcion ? (
              <DialogDescription className="mt-0.5 text-sm text-muted-foreground">{descripcion}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{typeof titulo === "string" ? titulo : ""}</DialogDescription>
            )}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {pie && <footer className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">{pie}</footer>}
      </DialogContent>
    </Dialog>
  );
}
