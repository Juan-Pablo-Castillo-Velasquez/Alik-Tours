// components/payment/PSEPayment.tsx
// Flujo simulado de PSE: banco + documento. No depende de CardPayment,
// NequiPayment ni PayPalPayment.
import { PSEPaymentValue } from "./types";

const BANCOS = [
  "Bancolombia", "Davivienda", "Banco de Bogotá", "BBVA Colombia",
  "Banco de Occidente", "Banco Popular", "Banco Caja Social", "Scotiabank Colpatria",
  "Banco Agrario", "Banco AV Villas",
];

export default function PSEPayment({
  value,
  onChange,
}: {
  value: PSEPaymentValue;
  onChange: (value: PSEPaymentValue) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label htmlFor="pse-banco" className="block text-xs font-medium text-muted-foreground mb-1.5">Selecciona tu banco</label>
        <select
          id="pse-banco"
          value={value.banco}
          onChange={(e) => onChange({ ...value, banco: e.target.value })}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
        >
          <option value="">Elige un banco…</option>
          {BANCOS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="pse-documento" className="block text-xs font-medium text-muted-foreground mb-1.5">Número de documento</label>
        <input
          id="pse-documento"
          type="text"
          inputMode="numeric"
          placeholder="1000111222"
          value={value.documento}
          onChange={(e) => onChange({ ...value, documento: e.target.value.replace(/\D/g, "").slice(0, 15) })}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm font-mono focus:ring-2 focus:ring-primary/40 focus:outline-none"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Al confirmar, te llevaríamos al portal de tu banco (simulado en este entorno). Documento 0000000000 simula un rechazo.
      </p>
    </div>
  );
}
