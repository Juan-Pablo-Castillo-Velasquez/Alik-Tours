import { ArrowUpRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  /** Clases tailwind del degradado del ícono, ej: "from-primary to-[#A13B55]" */
  gradient?: string;
  sub?: ReactNode;
  subColor?: string;
  onClick?: () => void;
}

// KPI card reutilizable — generaliza el patrón que ya usaba ModuleDashboard
// (icono con degradado + valor grande + etiqueta + dato secundario) para que
// cualquier módulo nuevo (Cancelaciones, Empresas, Pagos...) muestre sus
// propios números reales con la misma presentación, sin copiar el markup.
export default function StatCard({
  label,
  value,
  icon: Icon,
  gradient = "from-primary to-[#A13B55]",
  sub,
  subColor = "text-muted-foreground",
  onClick,
}: StatCardProps) {
  const Comp = (onClick ? "button" : "div") as any;

  // Horizontal y compacta (como los totales de Reservas): el número se lee
  // de un vistazo y la tabla, que es lo importante, sube en la pantalla.
  return (
    <Comp
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={`group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-[box-shadow,border-color,transform] ${
        onClick
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          : ""
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm ring-4 ring-black/[0.03]`}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-2xl font-bold leading-tight tracking-tight text-foreground tabular-nums">{value}</p>
        <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
        {sub && <p className={`mt-0.5 truncate text-xs font-medium ${subColor}`}>{sub}</p>}
      </div>
      {onClick && (
        <ArrowUpRight
          className="h-4 w-4 shrink-0 self-start text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden="true"
        />
      )}
    </Comp>
  );
}
