import { FileText, Loader2, Lock, Plane, Receipt, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ReservaDetail, reservaService } from "../../services/reserva.service";
import { hora, rutaOferta } from "../../services/vuelo.service";
import { pesos } from "../reserva/ResumenCotizacion";
import { inputCls } from "./types";

const ETIQUETA_TIPO: Record<string, string> = { hotel: "Hotel", paquete: "Paquete", vuelo: "Vuelo" };
const ETIQUETA_VUELO: Record<string, string> = {
  incluido: "Vuelo incluido",
  opcional: "Vuelo agregado",
  independiente: "Vuelo",
  cotizacion_pendiente: "Vuelo pendiente de cotización",
  cotizado: "Vuelo cotizado",
};

/**
 * Bloque comercial del detalle de una reserva en el panel: desglose
 * congelado, viajeros (con documento completo: solo staff), vuelo,
 * salida, solicitudes, notas internas y — si el cliente pidió cotizar el
 * vuelo — el formulario para confirmar esa tarifa. Las reservas anteriores
 * al desglose no muestran nada nuevo.
 */
export default function DetalleComercialReserva({ idReserva, onCambio }: { idReserva: number; onCambio?: () => void }) {
  const [d, setD] = useState<ReservaDetail | null>(null);
  const [notas, setNotas] = useState("");
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  const [cot, setCot] = useState({ precio: "", descripcion: "" });
  const [cotizando, setCotizando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    reservaService.getDetail(idReserva).then((r) => {
      if (cancelado) return;
      setD(r);
      setNotas(r.notas_internas ?? "");
    }).catch(() => {});
    return () => { cancelado = true; };
  }, [idReserva]);

  if (!d) return null;
  const tieneDesglose = (d.conceptos?.length ?? 0) > 0;

  async function guardarNotas() {
    setGuardandoNotas(true);
    try {
      const r = await reservaService.actualizarNotasInternas(idReserva, notas.trim() || null);
      setD((prev) => (prev ? { ...prev, notas_internas: r.notas_internas } : prev));
      toast.success("Notas internas guardadas");
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron guardar las notas");
    } finally {
      setGuardandoNotas(false);
    }
  }

  async function confirmarCotizacion() {
    setCotizando(true);
    try {
      const r = await reservaService.confirmarCotizacionVuelo(idReserva, { precio_total: Number(cot.precio), descripcion: cot.descripcion.trim() });
      setD(r);
      toast.success("Cotización del vuelo registrada y avisada al cliente");
      onCambio?.();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo registrar la cotización");
    } finally {
      setCotizando(false);
    }
  }

  const caja = "rounded-xl border border-border bg-card p-3";
  const titulo = "mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-3">
      {(d.tipo_producto || d.adultos != null) && (
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {d.tipo_producto && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{ETIQUETA_TIPO[d.tipo_producto]}</span>}
          {d.adultos != null && <span className="rounded-full bg-muted px-2 py-0.5">{d.adultos} adulto(s){d.ninos ? ` · ${d.ninos} niño(s)` : ""}{d.infantes ? ` · ${d.infantes} infante(s)` : ""}</span>}
          {d.estado_vuelo && ETIQUETA_VUELO[d.estado_vuelo] && <span className="rounded-full bg-muted px-2 py-0.5">{ETIQUETA_VUELO[d.estado_vuelo]}</span>}
          {d.salida && <span className="rounded-full bg-muted px-2 py-0.5">Salida {d.salida.fecha_salida}</span>}
        </div>
      )}

      {tieneDesglose && (
        <div className={caja}>
          <p className={titulo}><Receipt className="h-3.5 w-3.5" /> Desglose congelado</p>
          <ul className="divide-y divide-border text-xs">
            {d.conceptos!.map((c, i) => (
              <li key={i} className="flex justify-between gap-2 py-1.5">
                <span>{c.descripcion}{c.incluido && <b className="ml-1 text-success">· incluido</b>}{!c.incluido && c.cantidad > 1 && c.precio_unitario > 0 && <span className="block text-muted-foreground">{c.cantidad} × {pesos(c.precio_unitario)}</span>}</span>
                <span className="shrink-0 font-semibold">{c.tipo === "vuelo_cotizacion" ? "Por cotizar" : pesos(c.subtotal)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex justify-between border-t border-border pt-1.5 text-sm font-bold"><span>Total</span><span>{pesos(Number(d.precio_total ?? 0))}</span></p>
          <p className="mt-1 text-[10px] text-muted-foreground">No cambia aunque se modifique el precio del producto.</p>
        </div>
      )}

      {d.estado_vuelo === "cotizacion_pendiente" && (
        <div className={`${caja} border-warning/40`}>
          <p className={titulo}><Plane className="h-3.5 w-3.5" /> Confirmar cotización del vuelo</p>
          <p className="mb-2 text-xs text-muted-foreground">Se suma al total como un concepto nuevo, queda en el historial y se avisa al cliente. Solo se hace una vez.</p>
          <div className="grid gap-2">
            <input type="number" min={1} step={1000} value={cot.precio} onChange={(e) => setCot({ ...cot, precio: e.target.value })} placeholder="Precio total del vuelo (COP)" aria-label="Precio del vuelo" className={inputCls} />
            <input value={cot.descripcion} onChange={(e) => setCot({ ...cot, descripcion: e.target.value })} maxLength={200} placeholder="Ej: Avianca BOG-CTG ida y regreso, 2 adultos" aria-label="Descripción del vuelo" className={inputCls} />
            <button type="button" onClick={confirmarCotizacion} disabled={cotizando || !(Number(cot.precio) > 0) || cot.descripcion.trim().length < 3} className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {cotizando && <Loader2 className="h-4 w-4 animate-spin" />} Registrar cotización
            </button>
          </div>
        </div>
      )}

      {d.oferta_vuelo && (
        <div className={caja}>
          <p className={titulo}><Plane className="h-3.5 w-3.5" /> Vuelo</p>
          <p className="text-sm font-semibold">{rutaOferta(d.oferta_vuelo)}</p>
          <p className="text-xs text-muted-foreground">
            {d.oferta_vuelo.aerolinea || "Aerolínea por confirmar"}{d.oferta_vuelo.numero_vuelo ? ` ${d.oferta_vuelo.numero_vuelo}` : ""} · Ida {d.oferta_vuelo.fecha_salida}{hora(d.oferta_vuelo.hora_salida) ? ` ${hora(d.oferta_vuelo.hora_salida)}` : ""}
            {d.oferta_vuelo.fecha_regreso ? ` · Regreso ${d.oferta_vuelo.fecha_regreso}${hora(d.oferta_vuelo.hora_regreso) ? ` ${hora(d.oferta_vuelo.hora_regreso)}` : ""}` : ""}
          </p>
        </div>
      )}

      {(d.viajeros?.length ?? 0) > 0 && (
        <div className={caja}>
          <p className={titulo}><Users className="h-3.5 w-3.5" /> Viajeros ({d.viajeros!.length})</p>
          <ul className="space-y-1 text-xs">
            {d.viajeros!.map((v) => (
              <li key={v.id_viajero} className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{v.nombres} {v.apellidos}{v.es_titular && <span className="ml-1 text-primary">(titular)</span>}</span>
                <span className="text-muted-foreground">
                  {v.tipo === "adulto" ? "Adulto" : v.tipo === "nino" ? "Niño" : "Infante"}
                  {v.fecha_nacimiento ? ` · ${v.fecha_nacimiento}` : ""}
                  {v.numero_documento ? ` · ${v.tipo_documento ?? ""} ${v.numero_documento}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.solicitudes_especiales && (
        <div className={caja}>
          <p className={titulo}><FileText className="h-3.5 w-3.5" /> Solicitudes del cliente</p>
          <p className="whitespace-pre-line text-xs">{d.solicitudes_especiales}</p>
        </div>
      )}

      <div className={caja}>
        <p className={titulo}><Lock className="h-3.5 w-3.5" /> Notas internas (el cliente no las ve)</p>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={4000} className={inputCls} aria-label="Notas internas" />
        <button type="button" onClick={guardarNotas} disabled={guardandoNotas || notas === (d.notas_internas ?? "")} className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
          {guardandoNotas ? "Guardando..." : "Guardar notas"}
        </button>
      </div>
    </div>
  );
}
