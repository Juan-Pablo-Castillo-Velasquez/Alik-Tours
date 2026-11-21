import { ArrowLeft, Check } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { resolveFotoUrl } from "../admin/types";

interface Props {
  volverA: string;
  volverTexto: string;
  etiqueta: string;
  titulo: string;
  subtitulo?: ReactNode;
  imagen?: string | null;
  /** Datos cortos que se muestran como píldoras (fechas, duración, aerolínea...). */
  datos?: ReactNode[];
  pasos?: string[];
  paso?: number;
}

/**
 * Encabezado común de los flujos de reserva: foto del producto, qué se está
 * reservando y el avance por pasos con una línea de progreso.
 */
export default function CabeceraReserva({ volverA, volverTexto, etiqueta, titulo, subtitulo, imagen, datos = [], pasos, paso = 0 }: Props) {
  const progreso = pasos && pasos.length > 1 ? (Math.min(paso, pasos.length - 1) / (pasos.length - 1)) * 100 : 0;
  return (
    <div className="mb-6">
      <Link to={volverA} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {volverTexto}
      </Link>
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary to-[#3b1728] text-white shadow-xl shadow-primary/10"
      >
        {imagen && (
          <img src={resolveFotoUrl(imagen)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" aria-hidden />
        <div className="relative px-6 py-7 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">{etiqueta}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-white/85">{subtitulo}</p>}
          {datos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {datos.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>

        {pasos && pasos.length > 1 && (
          <nav aria-label="Pasos de la reserva" className="relative border-t border-white/15 bg-black/25 px-6 py-4 backdrop-blur sm:px-8">
            <div className="relative">
              <div className="absolute left-4 right-4 top-4 h-0.5 rounded bg-white/20" aria-hidden>
                <motion.div
                  className="h-full rounded bg-[var(--gold)]"
                  initial={false}
                  animate={{ width: `${progreso}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
              <ol className="relative flex justify-between">
                {pasos.map((p, i) => {
                  const hecho = i < paso;
                  const actual = i === paso;
                  return (
                    <li key={p} className="flex flex-col items-center gap-1.5" aria-current={actual ? "step" : undefined}>
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                          hecho
                            ? "bg-[var(--gold)] text-[var(--gold-foreground)]"
                            : actual
                              ? "scale-110 bg-white text-primary ring-4 ring-white/25"
                              : "bg-white/15 text-white/70"
                        }`}
                      >
                        {hecho ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <span className={`text-[11px] font-semibold sm:text-xs ${actual ? "text-white" : "text-white/70"}`}>{p}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </nav>
        )}
      </motion.header>
    </div>
  );
}
