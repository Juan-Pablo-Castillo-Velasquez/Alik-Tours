import { Download, FileText, Receipt } from "lucide-react";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import { useMemo, useState } from "react";
import { ClienteResponse } from "../../services/cliente.service";
import { PagoResponse } from "../../services/reserva.service";
import { ReservaResponse } from "../../data/reservaTypes";
import { generarFacturaPdf } from "../../utils/generarFacturaPdf";
import DateRangeFilter, { dentroDeRango } from "../shared/DateRangeFilter";
import SearchInput from "../shared/SearchInput";
import EncabezadoTab, { PanelPerfil, VacioPerfil } from "./EncabezadoTab";
import { codigoReserva } from "../../utils/reservaPresentacion";

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

  const pagFacturas = usePagination(filtrados, 8);
  const hayFiltros = busqueda.trim() !== "" || rango.desde !== "" || rango.hasta !== "";

  const totalPagado = comprobantes.reduce((acc, c) => acc + Number(c.pago.monto ?? 0), 0);

  return (
    <div className="w-full">
      <EncabezadoTab
        titulo="Comprobantes"
        descripcion="Los comprobantes de tus pagos aprobados, listos para descargar en PDF. Son comprobantes de pago, no facturas electrónicas de venta."
      />

      {comprobantes.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total pagado</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums">${Math.round(totalPagado).toLocaleString("es-CO")}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Último pago</p>
            <p className="mt-0.5 text-2xl font-bold">{formatFecha(comprobantes[0].pago.fecha_pago)}</p>
          </div>
        </div>
      )}

      <PanelPerfil>
        {comprobantes.length > 0 && (
          <div className="mb-5 space-y-3">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por número, reserva o destino..." />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DateRangeFilter desde={rango.desde} hasta={rango.hasta} onChange={setRango} label="Fecha de pago" />
              {hayFiltros && (
                <button
                  onClick={() => {
                    setBusqueda("");
                    setRango({ desde: "", hasta: "" });
                  }}
                  className="cursor-pointer text-xs font-medium text-primary hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {filtrados.length === 0 ? (
          <VacioPerfil
            icono={FileText}
            titulo={comprobantes.length === 0 ? "Todavía no tienes comprobantes" : "Ningún comprobante coincide con los filtros"}
            texto={
              comprobantes.length === 0
                ? "Aparecerán aquí apenas se apruebe el pago de alguna de tus reservas."
                : "Prueba con otra palabra o quita el rango de fechas."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {pagFacturas.slice.map(({ pago, reserva }) => {
                const concepto =
                  reserva.nombre_paquete ?? reserva.hotel_nombre ?? reserva.destino ?? `Reserva #${reserva.id_reserva}`;
                return (
                  <li key={pago.id_pago} className="flex flex-wrap items-center gap-3 bg-background px-4 py-3.5 sm:flex-nowrap">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Receipt className="h-4 w-4 text-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{concepto}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pago.numero_factura} · {codigoReserva(reserva.id_reserva)} · {formatFecha(pago.fecha_pago)}
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      ${Number(pago.monto).toLocaleString("es-CO")}
                    </span>
                    <button
                      onClick={() => generarFacturaPdf(pago, reserva, clienteData ?? undefined)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted"
                      aria-label={`Descargar el comprobante ${pago.numero_factura} en PDF`}
                    >
                      <Download className="h-3.5 w-3.5 text-primary" />
                      PDF
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pagination
              page={pagFacturas.page}
              pageCount={pagFacturas.pageCount}
              onPageChange={pagFacturas.setPage}
              total={filtrados.length}
              pageSize={8}
              etiqueta="comprobantes"
              className="mt-4"
            />
          </>
        )}
      </PanelPerfil>
    </div>
  );
}
