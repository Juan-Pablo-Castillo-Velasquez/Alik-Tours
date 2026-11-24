import { Accessibility } from "lucide-react";
import { useAccesibilidad } from "../../context/AccesibilidadContext";
import { useT } from "../../i18n";

export default function BotonAccesibilidad({ className = "" }: { className?: string }) {
  const { setPanelAbierto, activas } = useAccesibilidad();
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => setPanelAbierto(true)}
      aria-label={t("a11y.abrir")}
      aria-haspopup="dialog"
      title={`${t("a11y.titulo")} (Alt + A)`}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent ${className}`}
    >
      <Accessibility className="h-[18px] w-[18px]" aria-hidden />
      {activas > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--gold,#b8912e)] px-1 text-[10px] font-bold text-white">
          {activas}
        </span>
      )}
    </button>
  );
}
