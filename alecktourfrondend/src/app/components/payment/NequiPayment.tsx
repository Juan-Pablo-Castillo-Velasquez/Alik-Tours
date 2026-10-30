// components/payment/NequiPayment.tsx
// Flujo simulado de Nequi: el cliente transfiere de verdad (o simula que
// lo hace) al Nequi real de Alik Tours (ver NEQUI_DESTINO) y después lo
// confirma en NequiConfirmar.tsx -- no depende de CardPayment, PSEPayment
// ni PayPalPayment.
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatNequiDestino, NEQUI_DESTINO, NequiPaymentValue } from "./types";

export default function NequiPayment({
  value,
  onChange,
}: {
  value: NequiPaymentValue;
  onChange: (value: NequiPaymentValue) => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiarNumero = async () => {
    try {
      await navigator.clipboard.writeText(NEQUI_DESTINO);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin permiso de clipboard (poco común) -- el número ya está visible
      // en pantalla para copiarlo a mano, no hace falta un fallback más.
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4 space-y-2.5">
        <p className="text-sm font-medium text-foreground">Transfiere el total de tu reserva a este Nequi:</p>
        <div className="flex items-center justify-between gap-3 bg-card rounded-lg border border-border px-3 py-2.5">
          <span className="font-mono font-semibold text-foreground tracking-wide">{formatNequiDestino()}</span>
          <button
            type="button"
            onClick={copiarNumero}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Abre tu app Nequi, envía el valor total y luego confírmalo aquí. Una vez que confirmes, se crea tu reserva.
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tu número de celular Nequi (desde el que enviaste)</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="3001234567"
          value={value.celular}
          onChange={(e) => onChange({ celular: e.target.value.replace(/\D/g, "").slice(0, 10) })}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm font-mono focus:ring-2 focus:ring-primary/40 focus:outline-none"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Simulado en este entorno (no se conecta a Nequi de verdad). Un celular terminado en 0000 simula un rechazo.
      </p>
    </div>
  );
}
