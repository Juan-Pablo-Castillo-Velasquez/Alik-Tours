import { Check, Globe } from "lucide-react";
import { IDIOMAS, useIdioma } from "../i18n";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./ui/dropdown-menu";

/** Botón de idioma de la barra superior (ES / EN). */
export default function SelectorIdioma({ className = "" }: { className?: string }) {
  const { idioma, setIdioma, t } = useIdioma();
  const actual = IDIOMAS.find((i) => i.codigo === idioma)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold text-foreground transition-colors hover:bg-accent ${className}`}
        aria-label={`${actual.corto} · ${t("nav.idioma")}: ${actual.nombre}`}
      >
        <Globe className="h-4 w-4" aria-hidden />
        {actual.corto}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[120] min-w-40">
        <DropdownMenuLabel>{t("nav.idioma")}</DropdownMenuLabel>
        {IDIOMAS.map((i) => (
          <DropdownMenuItem key={i.codigo} lang={i.codigo} onSelect={() => setIdioma(i.codigo)} className="justify-between">
            {i.nombre}
            {i.codigo === idioma && <Check className="h-4 w-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
