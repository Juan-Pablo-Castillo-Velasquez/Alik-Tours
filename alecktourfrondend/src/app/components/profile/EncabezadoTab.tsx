import type { ReactNode } from "react";

/** Encabezado común de cada sección del perfil del cliente: mismo tamaño,
 * misma jerarquía y la acción principal a la derecha. Antes cada pestaña
 * tenía el suyo (títulos de text-xl a text-4xl, unos con mayúsculas). */
export default function EncabezadoTab({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {accion}
    </header>
  );
}

/** Tarjeta base de las secciones del perfil. */
export function PanelPerfil({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6 ${className}`}>{children}</section>;
}

/** Estado vacío común: ícono, título, texto y una acción. */
export function VacioPerfil({
  icono: Icono,
  titulo,
  texto,
  accion,
}: {
  icono: React.ElementType;
  titulo: string;
  texto?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icono className="h-6 w-6" />
      </span>
      <p className="mt-4 font-semibold text-foreground">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}
