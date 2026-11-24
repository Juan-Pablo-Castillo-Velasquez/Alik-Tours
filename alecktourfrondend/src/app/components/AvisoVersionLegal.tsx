import { Languages } from "lucide-react";
import { useIdioma } from "../i18n";

/**
 * En inglés, los documentos legales se muestran en su versión original en
 * español (la que tiene validez). Este aviso lo explica y marca el texto
 * con lang="es" para que los lectores de pantalla lo pronuncien bien.
 */
export function AvisoVersionLegal({ className = "" }: { className?: string }) {
  const { idioma } = useIdioma();
  if (idioma !== "en") return null;
  return (
    <p
      lang="en"
      translate="no"
      className={`mt-3 flex items-start gap-2 rounded-xl border border-border bg-muted/60 px-4 py-2.5 text-sm text-foreground ${className}`}
    >
      <Languages className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span>
        This legal document is shown in Spanish, which is the binding version under Colombian law. Headings and buttons
        are translated; if you need help understanding any section, contact us and an advisor will explain it.
      </span>
    </p>
  );
}
