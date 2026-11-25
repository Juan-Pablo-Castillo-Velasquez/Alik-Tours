import type { ComponentType } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

export interface QuickAction {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

// Accesos rápidos del header del admin (nueva reserva, registrar hotel,
// etc.) — antes vivían escondidos detrás de un botón "+ Acción rápida" que
// había que abrir para ver cuáles eran; ahora cada uno es su propio botón
// visible en el header, con su nombre siempre a la vista desde 1600 px (no solo
// al pasar el mouse). Por debajo de 1600 px el botón queda solo con
// el ícono, para no desbordar el header, pero el nombre se sigue viendo al
// pasar el mouse (Tooltip, mismo criterio que ya usa AdminSidebar.tsx). El
// grupo completo se oculta por debajo de `sm` (igual que el buscador/
// breadcrumb se ocultan por debajo de `md`) para no desbordar en celular.
export default function QuickActions({ actions }: QuickActionsProps) {
  if (!actions.length) return null;

  return (
    <div className="hidden sm:flex items-center gap-1.5">
      {actions.map((a) => (
        <Tooltip key={a.label}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={a.onClick}
              aria-label={a.label}
              className="flex items-center gap-1.5 px-2.5 min-[1600px]:px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <a.icon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden min-[1600px]:inline whitespace-nowrap">{a.label}</span>
            </button>
          </TooltipTrigger>
          {/* Por debajo de `lg` el botón no muestra el nombre, así que el
              tooltip sigue siendo la única forma de verlo -- de `lg` en
              adelante el nombre ya está en el botón, el tooltip no molesta. */}
          <TooltipContent side="bottom">{a.label}</TooltipContent>
        </Tooltip>
      ))}

      {/* Separador sutil para distinguir el grupo de accesos rápidos del
          resto de íconos del header (campana, tema, cuenta). */}
      <div className="w-px h-6 bg-white/20 mx-1" />
    </div>
  );
}
