import { CheckCircle } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

// Mismos límites que ResenaCreate en el backend (resena_route.py).
const COMENTARIO_MIN = 10;
const COMENTARIO_MAX = 1000;
import { resenaService } from "../../../services/resena.service";
import { ModalOverlay } from "../../ui/ModalBackdrop";

interface Props {
  reserva: any;
  onClose: () => void;
}

export default function ModalResena({ reserva, onClose }: Props) {
  const [calificacion, setCalificacion] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnviar = async () => {
    if (calificacion === 0 || comentario.trim().length < COMENTARIO_MIN || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await resenaService.crear({
        id_reserva: reserva.id_reserva,
        calificacion,
        comentario: comentario.trim(),
      });
      setEnviado(true);
      setTimeout(onClose, 1800);
    } catch (err: any) {
      setError(
        String(err?.message ?? "").includes("409")
          ? "Ya dejaste una reseña para esta reserva."
          : "No pudimos guardar tu reseña. Intenta de nuevo.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <ModalOverlay onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative bg-card text-card-foreground border border-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden transition-colors duration-200"
      >
        <div className="bg-primary p-6 text-primary-foreground">
          <h3 className="font-bold text-lg tracking-tight">
            Cuéntanos cómo te fue
          </h3>
          <p className="text-primary-foreground/80 text-xs">
            Reserva #{reserva.id_reserva}
          </p>
        </div>
        <div className="p-6">
          {!enviado ? (
            <>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Calificación
              </label>
              <div className="flex gap-2 mb-5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCalificacion(n)}
                    className={`w-9 h-9 rounded-lg border text-sm font-bold transition-all cursor-pointer
                      ${calificacion >= n ? "bg-[var(--chart-2)] border-[var(--chart-2)] text-[#513b12]" : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    ★
                  </button>
                ))}
              </div>

              <label htmlFor="resena-comentario" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Tu comentario <span className="text-destructive" aria-hidden>*</span>
              </label>
              <textarea
                id="resena-comentario"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Cuéntanos qué te gustó, qué mejorarías, o cualquier detalle de tu estadía..."
                rows={4}
                maxLength={COMENTARIO_MAX}
                aria-describedby="resena-comentario-ayuda"
                className="w-full border border-border bg-muted/30 text-foreground rounded-lg p-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none"
              />
              <p id="resena-comentario-ayuda" className={`mt-1 mb-4 text-right text-[11px] ${comentario.trim().length > 0 && comentario.trim().length < COMENTARIO_MIN ? "text-destructive" : "text-muted-foreground"}`}>
                {comentario.trim().length}/{COMENTARIO_MAX} · mínimo {COMENTARIO_MIN} caracteres
              </p>

              {error && (
                <p className="text-xs text-destructive mb-3">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-border text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted hover:text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEnviar}
                  disabled={
                    calificacion === 0 ||
                    comentario.trim().length < COMENTARIO_MIN ||
                    enviando
                  }
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enviando ? "Enviando..." : "Publicar reseña"}
                </button>
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center"
            >
              <div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-success" />
              </div>
              <h4 className="text-base font-bold text-foreground mb-1">
                ¡Gracias por tu reseña!
              </h4>
              <p className="text-muted-foreground text-xs px-4">
                Ya está publicada en la página del hotel.
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}