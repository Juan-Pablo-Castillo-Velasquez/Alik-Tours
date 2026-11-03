// components/payment/CardPayment.tsx
// Datos de tarjeta (crédito/débito). Componente controlado y aislado —
// Checkout solo le pasa value/onChange, nunca conoce sus internals.
import { Shield } from "lucide-react";
import { CardPaymentValue, formatCardNumber, formatExpiry } from "./types";

export default function CardPayment({
  value,
  onChange,
  brand,
}: {
  value: CardPaymentValue;
  onChange: (value: CardPaymentValue) => void;
  brand?: string;
}) {
  return (
    <div>
      <div
        className="relative w-full max-w-sm mx-auto sm:mx-0 mb-6 rounded-2xl p-5 text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, var(--primary) 0%, #2E2E2E 100%)" }}
      >
        <div className="flex justify-between items-start mb-8">
          <div className="w-10 h-7 rounded bg-white/20" />
          <span className="text-xs font-semibold tracking-widest opacity-80">{brand}</span>
        </div>
        <p className="text-lg tracking-[0.2em] font-mono mb-4">{value.number || "•••• •••• •••• ••••"}</p>
        <div className="flex justify-between text-xs opacity-90">
          <span className="uppercase truncate max-w-[60%]">{value.name || "NOMBRE DEL TITULAR"}</span>
          <span>{value.expiry || "MM/YY"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label htmlFor="tarjeta-numero" className="block text-xs font-medium text-muted-foreground mb-1.5">Número de tarjeta</label>
          <input
            id="tarjeta-numero"
            type="text"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            value={value.number}
            onChange={(e) => onChange({ ...value, number: formatCardNumber(e.target.value) })}
            maxLength={19}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm font-mono focus:ring-2 focus:ring-primary/40 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="tarjeta-titular" className="block text-xs font-medium text-muted-foreground mb-1.5">Nombre del titular</label>
          <input
            id="tarjeta-titular"
            type="text"
            placeholder="Como aparece en la tarjeta"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value.toUpperCase() })}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="tarjeta-vencimiento" className="block text-xs font-medium text-muted-foreground mb-1.5">Vencimiento</label>
            <input
            id="tarjeta-vencimiento"
              type="text"
              inputMode="numeric"
              placeholder="MM/YY"
              value={value.expiry}
              onChange={(e) => onChange({ ...value, expiry: formatExpiry(e.target.value) })}
              maxLength={5}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="tarjeta-cvv" className="block text-xs font-medium text-muted-foreground mb-1.5">CVV</label>
            <input
            id="tarjeta-cvv"
              type="password"
              inputMode="numeric"
              placeholder="•••"
              value={value.cvv}
              onChange={(e) => onChange({ ...value, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              maxLength={4}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
            />
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-4 flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-success shrink-0" />
        Datos de prueba: no se procesa ni se guarda ningún cobro real. Una tarjeta terminada en 0002 simula un rechazo.
      </p>
    </div>
  );
}
