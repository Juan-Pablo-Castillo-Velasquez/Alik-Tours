// components/payment/PaymentStatus.tsx
// Estado visual del pago (PROCESSING / APPROVED / REJECTED / PENDIENTE_VERIFICACION),
// reutilizable sin importar el método elegido.
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { motion } from "motion/react";

export default function PaymentStatus({
  state,
  amount,
  onRetry,
}: {
  state: "processing" | "approved" | "rejected" | "pendiente_verificacion";
  amount: number;
  onRetry?: () => void;
}) {
  if (state === "pendiente_verificacion") {
    // Exclusivo de Nequi: el cliente ya confirmó que transfirió (ver
    // NequiConfirmar.tsx) pero todavía falta que un asesor/admin revise el
    // comprobante y confirme de verdad (ver confirmar_pago en el backend).
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-primary/25 bg-primary/[0.04] p-8 text-center">
        <Clock className="w-8 h-8 text-primary mx-auto mb-4" />
        <p className="font-medium text-foreground">Pago pendiente de verificación</p>
        <p className="text-xs text-muted-foreground mt-1">
          Registramos tu reserva por ${amount.toLocaleString("es-CO")}. Un asesor revisará tu comprobante y se pondrá en contacto contigo para confirmarla.
        </p>
      </motion.div>
    );
  }

  if (state === "processing") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-8 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
        <p className="font-medium text-foreground">Procesando tu pago…</p>
        <p className="text-xs text-muted-foreground mt-1">
          Esperando confirmación por ${amount.toLocaleString("es-CO")}. No cierres esta ventana.
        </p>
      </motion.div>
    );
  }

  if (state === "approved") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl border border-success/20 bg-success/5 p-8 text-center">
        <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-4" />
        <p className="font-medium text-foreground">Pago aprobado</p>
        <p className="text-xs text-muted-foreground mt-1">
          Pago de prueba: no se realizó ningún cobro real. Redirigiendo a la confirmación de tu reserva…
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <XCircle className="w-8 h-8 text-destructive mx-auto mb-4" />
      <p className="font-medium text-foreground">Pago rechazado</p>
      <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" /> Tu reserva sigue pendiente. Revisa los datos o elige otro método.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-95 transition-all"
        >
          Reintentar
        </button>
      )}
    </motion.div>
  );
}
