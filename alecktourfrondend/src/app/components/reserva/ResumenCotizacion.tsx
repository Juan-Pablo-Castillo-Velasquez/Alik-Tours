import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { Concepto, Cotizacion } from "../../data/reservaTypes";

export function pesos(n: number) {
  const signo = n < 0 ? "−" : "";
  return `${signo}$${Math.abs(Math.round(n)).toLocaleString("es-CO")}`;
}

function etiquetaCantidad(c: Concepto) {
  if (c.incluido) return "Incluido";
  if (c.cantidad > 1 && c.precio_unitario > 0) return `${c.cantidad} × ${pesos(c.precio_unitario)}`;
  return null;
}

interface Props {
  cotizacion: Cotizacion | null;
  cargando?: boolean;
  error?: string | null;
  /** Título opcional (ej. "Resumen de tu reserva"). */
  titulo?: string;
  compacto?: boolean;
}

/**
 * Desglose comercial que devuelve el backend (POST /reservas/cotizar): cada
 * concepto, lo incluido en $0, advertencias (impuestos, cotización) y el
 * total. Es exactamente lo que se cobra: el navegador no calcula precios.
 */
export default function ResumenCotizacion({ cotizacion, cargando, error, titulo = "Resumen de precio", compacto }: Props) {
  return (
    <section aria-live="polite" className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{titulo}</h3>
        {cargando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Calculando" />}
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      ) : !cotizacion ? (
        <p className="text-sm text-muted-foreground">{cargando ? "Calculando..." : "Completa tus opciones para ver el precio."}</p>
      ) : (
        <>
          <ul className={`divide-y divide-border ${cargando ? "opacity-60" : ""}`}>
            {cotizacion.conceptos.map((c, i) => {
              const cant = etiquetaCantidad(c);
              return (
                <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className={`text-foreground ${compacto ? "text-xs" : ""}`}>{c.descripcion}</p>
                    {cant && (
                      <p className={`text-[11px] ${c.incluido ? "flex items-center gap-1 font-semibold text-success" : "text-muted-foreground"}`}>
                        {c.incluido && <CheckCircle2 className="h-3 w-3" />} {cant}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 font-semibold ${c.subtotal < 0 ? "text-success" : c.incluido ? "text-muted-foreground" : "text-foreground"}`}>
                    {c.tipo === "vuelo_cotizacion" ? "Por cotizar" : pesos(c.subtotal)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold text-foreground">Total a pagar</span>
            <span className="text-2xl font-bold text-primary">{pesos(cotizacion.total)}</span>
          </div>
          <p className="mt-0.5 text-right text-[11px] text-muted-foreground">Pesos colombianos (COP)</p>
          {cotizacion.advertencias.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {cotizacion.advertencias.map((a) => (
                <li key={a} className="flex items-start gap-2 rounded-lg bg-warning/10 p-2 text-xs text-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> {a}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
