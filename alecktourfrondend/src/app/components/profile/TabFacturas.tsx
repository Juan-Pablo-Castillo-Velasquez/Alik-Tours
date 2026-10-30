import { Download, FileText, Receipt } from "lucide-react";
import { useMemo, useState } from "react";
import { ClienteResponse } from "../../services/cliente.service";
import { PagoResponse } from "../../services/reserva.service";
import { ReservaResponse } from "../../data/reservaTypes";
import { generarFacturaPdf } from "../../utils/generarFacturaPdf";
import DateRangeFilter, { dentroDeRango } from "../shared/DateRangeFilter";
import SearchInput from "../shared/SearchInput";

interface Props {
  reservas: ReservaResponse[];
  clienteData: ClienteResponse | null;
}

interface FilaComprobante {
  pago: PagoResponse;
  reserva: ReservaResponse;
}

function formatFecha(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

// Comprobantes de pago del cliente: junta los pagos aprobados (con
// número de comprobante) de TODAS sus reservas. Usa los mismos filtros
// compartidos que "Mis reservas" y el panel de pagos (SearchInput +
// DateRangeFilter) y el mismo generador de PDF que el panel
// (generarFacturaPdf). Estos documentos son comprobantes de pago, no
// facturas electrónicas de venta DIAN.
export default function TabFacturas({ reservas, clienteData }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [rango, setRango] = useState({ desde: "", hasta: "" });

  const comprobantes = useMemo<FilaComprobante[]>(() => {
    return reservas
      .flatMap((reserva) =>
        (reserva.pagos ?? []).filter((pago) => pago.numero_factura).map((pago) => ({ pago, reserva })),
      )
      .sort((a, b) => new Date(b.pago.fecha_pago).getTime() - new Date(a.pago.fecha_pago).getTime());
  }, [reservas]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return comprobantes.filter(({ pago, reserva }) => {
      if (!dentroDeRango(pago.fecha_pago, rango.desde, rango.hasta)) return false;
      if (!q) return true;
      const concepto = `${reserva.nombre_paquete ?? ""} ${reserva.hotel_nombre ?? ""} ${reserva.destino ?? ""}`;
      return (
        (pago.numero_factura ?? "").toLowerCase().includes(q) ||
        String(reserva.id_reserva).includes(q) ||
        concepto.toLowerCase().includes(q)
      );
    });
  }, [comprobantes, busqueda, rango]);

  const hayFiltros = busqueda.trim() !== "" || rango.desde !== "" || rango.hasta !== "";

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Comprobantes de pago</h1>
        <p className="text-muted-foreground mt-1">
          Tus pagos aprobados. Son comprobantes de pago, no facturas electrónicas de venta.
        </p>
      </div>

      <div className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {filtrados.length} {filtrados.length === 1 ? "comprobante" : "comprobantes"}
          </h2>
        </div>

        {comprobantes.length > 0 && (
          <div className="space-y-3 mb-5">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por número, reserva o destino..." />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DateRangeFilter desde={rango.desde} hasta={rango.hasta} onChange={setRango} label="Fecha de pago" />
              {hayFiltros && (
                <button
                  onClick={() => {
                    setBusqueda("");
                    setRango({ desde: "", hasta: "" });
                  }}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">
              {comprobantes.length === 0 ? "Todavía no tienes comprobantes" : "Ningún comprobante coincide con los filtros"}
            </p>
            {comprobantes.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Aparecerán aquí apenas se apruebe el pago de alguna de tus reservas.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtrados.map(({ pago, reserva }) => {
              const concepto =
                reserva.nombre_paquete ?? reserva.hotel_nombre ?? reserva.destino ?? `Reserva #${reserva.id_reserva}`;
              return (
                <div
                  key={pago.id_pago}
                  className="flex items-center justify-between gap-3 bg-background border border-border/50 rounded-2xl p-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{pago.numero_factura}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {concepto} · {formatFecha(pago.fecha_pago)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-foreground tabular-nums hidden sm:block">
                      ${pago.monto.toLocaleString("es-CO")}
                    </span>
                    <button
                      onClick={() => generarFacturaPdf(pago, reserva, clienteData ?? undefined)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground text-xs font-medium rounded-lg hover:bg-muted hover:text-foreground transition-all"
                      title="Descargar comprobante de pago en PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
