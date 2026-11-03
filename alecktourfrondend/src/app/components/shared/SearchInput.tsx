import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** Nombre accesible del buscador; por defecto, el placeholder. */
  ariaLabel?: string;
}

export default function SearchInput({ value, onChange, placeholder = "Buscar...", className = "", ariaLabel }: Props) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
      <input
        type="search"
        // Accesibilidad (bootcamp, semana 3): sin label ni aria-label, el
        // buscador no tenía nombre para un lector de pantalla.
        aria-label={ariaLabel ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-2 text-sm bg-muted/30 border border-border text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/50"
      />
    </div>
  );
}
