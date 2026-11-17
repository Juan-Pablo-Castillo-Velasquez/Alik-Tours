import {
  AlertCircle,
  CheckCircle,
  Loader2,
  MessageSquare,
  SendHorizonal,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import ErrorCampo from "../../shared/ErrorCampo";

// Mismos límites que el backend (solicitud_cancelacion_schema/route).
const DETALLE_MIN = 10;
const DETALLE_MAX = 1000;
import { MOTIVOS } from "./constants";
import { solicitudCancelacionService } from "../../../services/solicitudCancelacion.service";
import { ModalOverlay } from "../../ui/ModalBackdrop";

interface Props {
  reserva: any;
  onClose: () => void;
  onConfirm: (id: number, motivo: string) => void;
}

export default function ModalCancelacion({ reserva, onClose, onConfirm }: Props) {
  const [motivo, setMotivo] = useState("");
  const [motivoCustom, setMotivoCustom] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [errorDetalle, setErrorDetalle] = useState("");
  const motivoFinal = motivo === "Otro motivo" ? motivoCustom : motivo;

  // Antes esto era un mock (setTimeout falso) que nunca llamaba al backend
  // — la solicitud se veía "enviada" en pantalla pero jamás se insertaba
  // en la tabla solicitudes_cancelacion, así que nunca le llegaba al admin.
  // Ahora sí llama a POST /reservas/{id}/solicitud-cancelacion de verdad;
  // el mensaje de éxito solo se muestra tras una respuesta real del
  // servidor, y un error real (ej. ya existe una solicitud pendiente para
  // esta reserva) se muestra en vez de fingir que se envió.
  const detalleCorto = motivo === "Otro motivo" && motivoCustom.trim().length < DETALLE_MIN;
  const handleEnviar = async () => {
    if (!motivoFinal.trim() || enviando) return;
    if (detalleCorto) {
      setErrorDetalle(`Explica el motivo en al menos ${DETALLE_MIN} caracteres`);
      return;
    }
    setEnviando(true);
    setError("");
    try {
      await solicitudCancelacionService.crear(reserva.id_reserva, {
        motivo,
        motivo_detalle: motivo === "Otro motivo" ? motivoCustom.trim() : undefined,
      });
      setEnviando(false);
      setEnviado(true);
      setTimeout(() => {
        onConfirm(reserva.id_reserva, motivoFinal);
        onClose();
      }, 1800);
    } catch (err: any) {
      setEnviando(false);
      setError(err?.message || "No se pudo enviar la solicitud. Intenta de nuevo.");
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
        <div className="bg-destructive p-6 text-destructive-foreground">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-tight">
                Solicitar cancelación
              </h3>
              <p className="text-destructive-foreground/80 text-xs">
                Reserva asignada #{reserva.id_reserva}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {!enviado ? (
            <>
              <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-5 text-xs text-warning">
                <p className="font-bold mb-0.5">⚠️ Información importante</p>
                <p className="leading-relaxed">
                  Tu solicitud será evaluada bajo las políticas de la agencia.
                  Se enviará un correo con la resolución.
                </p>
              </div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Selecciona el motivo
              </label>
              <div className="space-y-2 mb-4">
                {MOTIVOS.map((m) => (
                  <label
                    key={m}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all text-sm
                    ${motivo === m ? "border-primary bg-primary/5 text-foreground font-medium" : "border-border hover:bg-muted/50 text-muted-foreground"}`}
                  >
                    <input
                      type="radio"
                      name="motivo"
                      value={m}
                      checked={motivo === m}
                      onChange={() => setMotivo(m)}
                      className="accent-primary"
                    />
                    <span>{m}</span>
                  </label>
                ))}
              </div>
              <AnimatePresence>
                {motivo === "Otro motivo" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <label htmlFor="cancelacion-detalle" className="mb-1 block text-xs font-medium text-foreground">
                      Cuéntanos el motivo <span className="text-destructive" aria-hidden>*</span>
                    </label>
                    <textarea
                      id="cancelacion-detalle"
                      value={motivoCustom}
                      onChange={(e) => { setMotivoCustom(e.target.value); setErrorDetalle(""); }}
                      placeholder="Por favor, detalla los motivos del cambio..."
                      rows={3}
                      maxLength={DETALLE_MAX}
                      aria-invalid={!!errorDetalle}
                      aria-describedby="cancelacion-detalle-ayuda"
                      className="w-full border border-border bg-muted/30 text-foreground rounded-lg p-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none"
                    />
                    <div id="cancelacion-detalle-ayuda" className="mt-1 flex justify-between gap-2">
                      <ErrorCampo id="cancelacion-detalle-error" mensaje={errorDetalle} />
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {motivoCustom.trim().length}/{DETALLE_MAX} · mínimo {DETALLE_MIN}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {error && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4 text-xs text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-border text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted hover:text-foreground transition-all"
                >
                  Volver
                </button>
                <button
                  onClick={handleEnviar}
                  disabled={!motivoFinal.trim() || enviando}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {enviando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <SendHorizonal className="w-4 h-4" />
                      Enviar Solicitud
                    </>
                  )}
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
                ¡Solicitud recibida correctamente!
              </h4>
              <p className="text-muted-foreground text-xs px-4">
                Hemos registrado tu caso. Te contactaremos vía correo
                electrónico a la brevedad.
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}