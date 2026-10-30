import { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected: boolean;
  icon?: ReactNode;
  count?: number;
};

// Chip de filtro con los mismos estados en todo el sitio: normal, hover,
// foco de teclado, seleccionado (color de marca, --primary) y deshabilitado.
export default function FilterChip({ selected, icon, count, children, className = "", ...rest }: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...rest}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors duration-150 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background
        disabled:opacity-50 disabled:cursor-not-allowed
        ${selected
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}
        ${className}`}
    >
      {icon}
      <span>{children}</span>
      {count != null && (
        <span
          className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ml-0.5 ${selected ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
