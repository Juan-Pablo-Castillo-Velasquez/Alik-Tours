import { CheckCircle2, Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BRAND } from "../../config/brand";
import { MetodoPagoGuardado, metodoPagoGuardadoService } from "../../services/metodoPagoGuardado.service";
import { MetodoPago, pagoService, reservaService, PagoResponse } from "../../services/reserva.service";
import { enlaceWhatsAppAgencia } from "../../utils/whatsapp";
import NequiConfirmar from "./NequiConfirmar";
import NequiPayment from "./NequiPayment";
import PaymentSelector from "./PaymentSelector";
import PaymentStatus from "./PaymentStatus";
import PayPalPayment from "./PayPalPayment";
import { emptyNequiValue, isNequiValueValid, NequiPaymentValue, PaymentOutcome } from "./types";
import { pesos } from "../reserva/ResumenCotizacion";

interface Props {
  idReserva: number;
  total: number;
  totalPagado: number;
  /** Celular del cliente para precargar Nequi. */
  celularCliente?: string | null;
  onPagado?: (pago: PagoResponse) => void;
}

/**
 * Pago de una reserva YA creada (paquetes, saldo pendiente...). Mismo flujo
 * que el checkout de hotel: el monto lo calcula el backend, los pagos en
 * línea son simulados y se dice claramente, y el PIN se verifica contra el
 * método guardado del cliente (o se crea en su primer pago).
 */
export default function PagoDeReserva({ idReserva, total, totalPagado, celularCliente, onPagado }: Props) {
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [guardados, setGuardados] = useState<MetodoPagoGuardado[]>([]);
  const [metodoPago, setMetodoPago] = useState<number | null>(null);
  const [opcion, setOpcion] = useState<"completo" | "parcial">("completo");
  const [nequi, setNequi] = useState<NequiPaymentValue>(emptyNequiValue);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [verPin, setVerPin] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [estado, setEstado] = useState<PaymentOutcome>("idle");
  const [pagoPendiente, setPagoPendiente] = useState<number | null>(null);
  const [comprobante, setComprobante] = useState<{ subiendo: boolean; subido: boolean; error: string | null }>({ subiendo: false, subido: false, error: null });

  const saldo = Math.max(Math.round((total - totalPagado) * 100) / 100, 0);
  const tipoPago: "completo" | "parcial" | "saldo" = totalPagado > 0 ? "saldo" : opcion;
  const monto = tipoPago === "parcial" ? Math.round(total * 0.5 * 100) / 100 : saldo;

  useEffect(() => {
    pagoService.getMetodos().then(setMetodos).catch(() => setMetodos([]));
    metodoPagoGuardadoService.getAll().then(setGuardados).catch(() => setGuardados([]));
  }, []);
  useEffect(() => {
    if (celularCliente) setNequi((v) => (v.celular ? v : { celular: celularCliente }));
  }, [celularCliente]);

  // Mismo criterio que el checkout: en autoservicio solo Nequi o PayPal.
  const permitidos = useMemo(() => metodos.filter((m) => m.codigo === "nequi" || m.codigo === "paypal"), [metodos]);
  useEffect(() => {
    if (!permitidos.length || metodoPago) return;
    const pred = guardados.find((g) => g.predeterminado && (g.tipo === "nequi" || g.tipo === "paypal"));
    setMetodoPago((pred && permitidos.find((m) => m.codigo === pred.tipo)?.id_metodo) || permitidos[0].id_metodo);
  }, [permitidos, guardados, metodoPago]);

  const metodo = permitidos.find((m) => m.id_metodo === metodoPago);
  const codigo = metodo?.codigo;
  const guardado = guardados.find((g) => g.tipo === codigo);
  const datosValidos = !!guardado || codigo === "paypal" || (codigo === "nequi" && isNequiValueValid(nequi));
  const pinValido = guardado ? pin.length >= 4 : pin.length >= 4 && pin === pin2;

  async function pagar() {
    if (!metodo || !datosValidos || !pinValido) return;
    setProcesando(true);
    try {
      if (guardado) {
        const { valido } = await metodoPagoGuardadoService.verificarClave(guardado.id_metodo_guardado, pin);
        if (!valido) {
          toast.error("El PIN de seguridad no es correcto.");
          return;
        }
      } else {
        const nuevo = await metodoPagoGuardadoService.create({
          alias: metodo.nombre_metodo,
          tipo: metodo.codigo,
          ultimos4: codigo === "nequi" ? nequi.celular.slice(-4) : undefined,
          clave: pin,
        });
        setGuardados((g) => [...g, nuevo]);
      }
      const { pago } = await reservaService.pagar(idReserva, {
        id_metodo_pago: metodo.id_metodo,
        tipo_pago: tipoPago,
        ...(guardado
          ? { id_metodo_guardado: guardado.id_metodo_guardado }
          : codigo === "nequi"
            ? { celular: nequi.celular, ultimos4: nequi.celular.slice(-4) }
            : {}),
      });
      if (pago.estado === "procesando") {
        if (codigo === "nequi") {
          setPagoPendiente(pago.id_pago);
          setEstado("processing");
          return;
        }
        setEstado("processing");
        await new Promise((r) => setTimeout(r, 2000));
        const confirmado = await pagoService.confirmar(pago.id_pago);
        setEstado(confirmado.pago.estado === "pagado" ? "approved" : "rejected");
        if (confirmado.pago.estado === "pagado") onPagado?.(confirmado.pago);
        return;
      }
      setEstado(pago.estado === "pagado" ? "approved" : "rejected");
      if (pago.estado === "pagado") onPagado?.(pago);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo procesar el pago");
    } finally {
      setProcesando(false);
    }
  }

  if (saldo <= 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success/10 p-4 text-sm font-semibold text-success">
        <CheckCircle2 className="h-5 w-5" /> Esta reserva ya está pagada en su totalidad.
      </p>
    );
  }

  if (estado !== "idle") {
    if (estado === "processing" && pagoPendiente) {
      return (
        <NequiConfirmar
          amount={monto}
          comprobanteSubiendo={comprobante.subiendo}
          comprobanteSubido={comprobante.subido}
          comprobanteError={comprobante.error}
          onSubirComprobante={async (file: File) => {
            setComprobante({ subiendo: true, subido: false, error: null });
            try {
              await pagoService.subirComprobante(pagoPendiente, file);
              setComprobante({ subiendo: false, subido: true, error: null });
            } catch (e: any) {
              setComprobante({ subiendo: false, subido: false, error: e?.message || "No se pudo subir el comprobante." });
            }
          }}
          onConfirmar={() => setEstado("pendiente_verificacion")}
        />
      );
    }
    return (
      <PaymentStatus
        state={estado as "processing" | "approved" | "rejected" | "pendiente_verificacion"}
        amount={monto}
        onRetry={estado === "rejected" ? () => { setEstado("idle"); setPagoPendiente(null); } : undefined}
      />
    );
  }

  return (
    <div className="space-y-5">
      {totalPagado > 0 ? (
        <div className="rounded-xl border border-border p-4 text-sm">
          <p>Ya pagaste <b>{pesos(totalPagado)}</b>. Falta el saldo de <b className="text-primary">{pesos(saldo)}</b>.</p>
        </div>
      ) : (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold">¿Cuánto pagas hoy?</legend>
          {([
            ["completo", "Pago completo", total, "Liquidas el 100% hoy."],
            ["parcial", "Anticipo del 50%", Math.round(total * 0.5), "Aseguras tu reserva y pagas el saldo antes del viaje."],
          ] as const).map(([valor, titulo, cuanto, ayuda]) => (
            <label key={valor} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${opcion === valor ? "border-primary bg-primary/5" : "border-border"}`}>
              <input type="radio" name="opcion-pago" checked={opcion === valor} onChange={() => setOpcion(valor)} className="mt-1" />
              <span className="flex-1">
                <span className="flex justify-between gap-2 text-sm font-semibold"><span>{titulo}</span><span>{pesos(cuanto)}</span></span>
                <span className="text-xs text-muted-foreground">{ayuda}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div role="note" className="rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-xs text-foreground">
        <b className="mb-0.5 block">Pagos en línea en modo de prueba</b>
        Este sitio todavía no está conectado a una pasarela bancaria: al confirmar no se realiza ningún cobro. Tu
        reserva queda registrada y un asesor te contacta para indicarte cómo pagar.{" "}
        <a href={enlaceWhatsAppAgencia(`Hola ${BRAND.name}, quiero pagar mi reserva #${idReserva}.`)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
          Escríbenos por WhatsApp
        </a>
      </div>

      {permitidos.length === 0 ? (
        <p className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive">Nequi y PayPal no están disponibles en este momento. Contáctanos para completar el pago.</p>
      ) : (
        <>
          <PaymentSelector metodos={permitidos} selectedId={metodoPago} onSelect={(idm) => { setMetodoPago(idm); setPin(""); setPin2(""); }} />
          {guardado ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Usaremos tu {metodo?.nombre_metodo} guardado{guardado.ultimos4 ? ` (•••• ${guardado.ultimos4})` : ""}.</p>
          ) : codigo === "nequi" ? (
            <NequiPayment value={nequi} onChange={setNequi} />
          ) : codigo === "paypal" ? (
            <PayPalPayment amount={monto} />
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1 font-medium"><Lock className="h-3.5 w-3.5" /> {guardado ? "Tu PIN de seguridad" : "Crea un PIN de seguridad"}</span>
              <div className="relative">
                <input type={verPin ? "text" : "password"} inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 pr-10" />
                <button type="button" onClick={() => setVerPin((v) => !v)} aria-label={verPin ? "Ocultar PIN" : "Mostrar PIN"} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                  {verPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            {!guardado && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Repite el PIN</span>
                <input type={verPin ? "text" : "password"} inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5" />
              </label>
            )}
          </div>
          <button
            type="button"
            onClick={pagar}
            disabled={procesando || !datosValidos || !pinValido}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {procesando && <Loader2 className="h-4 w-4 animate-spin" />} Pagar {pesos(monto)}
          </button>
        </>
      )}
    </div>
  );
}
