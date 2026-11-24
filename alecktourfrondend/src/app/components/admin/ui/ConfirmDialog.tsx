import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "../../ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo rojo para acciones destructivas (eliminar) */
  destructive?: boolean;
  /** Exige un motivo antes de habilitar el botón de confirmar (ej. rechazar
   * una solicitud de cancelación, cancelar administrativamente una reserva) */
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void | Promise<void>;
}

// Diálogo de confirmación centrado — reemplaza los `window.confirm(...)`
// nativos del navegador que se usaban antes para eliminar reservas, hoteles,
// paquetes, clientes y usuarios. Soporta un campo de motivo obligatorio para
// las acciones administrativas que lo requieren (ej. rechazar una solicitud
// de cancelación), igual al ejemplo del brief: "Motivo: [___] [Volver]
// [Confirmar cancelación]".
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Volver",
  destructive = false,
  requireReason = false,
  reasonLabel = "Motivo",
  reasonPlaceholder = "Explica brevemente el motivo...",
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const canConfirm = !requireReason || reason.trim().length > 0;

  const handleOpenChange = (value: boolean) => {
    if (loading) return;
    onOpenChange(value);
    if (!value) setReason("");
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(requireReason ? reason.trim() : undefined);
      setReason("");
      onOpenChange(false);
    } catch {
      // Se deja abierto para que el admin pueda reintentar; el caller es
      // responsable de mostrar el toast de error correspondiente.
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>

        {requireReason && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">{reasonLabel}</label>
            <textarea maxLength={5000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              className="w-full px-3 py-2 border border-border bg-input-background text-foreground rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none outline-none text-sm placeholder:text-muted-foreground/60 resize-none"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              destructive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-gradient-to-r from-primary to-[#A13B55] text-primary-foreground hover:shadow-lg hover:shadow-primary/20"
            }`}
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
