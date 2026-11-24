"use client";

import { Check } from "lucide-react";
import { cn } from "./utils";

interface StepProgressStep {
  /** Texto visible del paso. */
  label: string;
  /** true = paso completado (check). Solo se usa en modo progreso (sin onClick). */
  ok?: boolean;
}

interface StepProgressProps {
  steps: StepProgressStep[];
  /**
   * Paso activo (índice base 0). En modo filtro (con onClick) resalta el paso
   * seleccionado; en modo progreso no se usa.
   */
  activeIndex?: number;
  /** Si se entrega, cada paso se vuelve clicable (selector/filtro 1-2-3-4). */
  onStepClick?: (index: number) => void;
  /** Título opcional sobre la barra (ej: "Avance", "Filtrar por"). */
  title?: string;
  /** Muestra el % de pasos completados. Solo aplica en modo progreso. */
  showPercent?: boolean;
  className?: string;
}

/**
 * Paso a paso reutilizable. Dos usos:
 *  1) PROGRESO  — pasa `steps` con `ok` (o sin onClick): muestra checks en los
 *     completados, barra de avance y % opcional. Útil para formularios largos.
 *  2) FILTRO    — pasa `onStepClick` y `activeIndex`: cada paso es un botón
 *     (1-2-3-4) para filtrar/seleccionar. Útil para tablas o secciones.
 */
export default function StepProgress({
  steps,
  activeIndex = 0,
  onStepClick,
  title,
  showPercent = true,
  className,
}: StepProgressProps) {
  const esFiltro = typeof onStepClick === "function";
  const completados = steps.filter((s) => s.ok).length;
  const pct = steps.length > 0 ? Math.round((completados / steps.length) * 100) : 0;

  return (
    <div className={cn("bg-card rounded-xl border border-border p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        {title ? (
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
        ) : (
          <span />
        )}
        {!esFiltro && showPercent && (
          <span className="text-[11px] font-bold text-primary">{pct}% completo</span>
        )}
      </div>

      {!esFiltro && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-[#A13B55] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {steps.map((paso, i) => {
          const activo = esFiltro && activeIndex === i;
          const completado = !esFiltro && !!paso.ok;
          return (
            <div
              key={paso.label}
              onClick={esFiltro ? () => onStepClick(i) : undefined}
              className={cn(
                "flex items-center gap-1.5 text-[11px] font-medium transition-colors duration-300",
                esFiltro
                  ? cn(
                      "cursor-pointer rounded-lg px-2 py-1.5 border select-none",
                      activo
                        ? "border-primary/40 bg-primary/5 text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    )
                  : completado
                    ? "text-foreground"
                    : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300",
                  esFiltro
                    ? cn("bg-muted text-muted-foreground", activo && "bg-primary text-primary-foreground")
                    : completado
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {esFiltro ? (
                  <span>{i + 1}</span>
                ) : completado ? (
                  <Check className="w-2.5 h-2.5" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </span>
              <span className="truncate">{paso.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
