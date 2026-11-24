import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Compass, CreditCard, Loader2, Plane, Search } from "lucide-react";
import EncabezadoTab from "../EncabezadoTab";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ClienteResponse } from "../../../services/cliente.service";
import { tituloReserva } from "../../../utils/reservaPresentacion";
import SearchInput from "../../shared/SearchInput";
import CalendarioViaje from "./CalendarioViaje";
import ModalCancelacion from "./ModalCancelacion";
import ModalResena from "./ModalResena";
import ModalReservaDetalle from "./ModalReservaDetalle";
import ReservaCard from "./ReservaCard";
import { fmt, getEstadoViaje, parseFechaLocal } from "./utils";

interface Props {
  reservas: any[];
  loading: boolean;
  clienteData: ClienteResponse | null;
  // Abre directo el detalle de una reserva (p. ej. desde la campana de
  // notificaciones) en vez de que el cliente la busque en la lista.
  reservaIdInicial?: number | null;
  // "Hablar de esta reserva": Profile.tsx lleva a Mensajes con la reserva
  // preseleccionada. Sin él, el botón no aparece.
  onHablarDeReserva?: (idReserva: number) => void;
}

/** Pestañas de la lista: por lo que la persona quiere hacer, no por el
 * nombre interno del estado. */
export type PestanaReservas = "proximas" | "por_pagar" | "pasadas" | "canceladas" | "todas";

const PESTANAS: { valor: PestanaReservas; etiqueta: string }[] = [
  { valor: "proximas", etiqueta: "Próximas" },
  { valor: "por_pagar", etiqueta: "Por pagar" },
  { valor: "pasadas", etiqueta: "Pasadas" },
  { valor: "canceladas", etiqueta: "Canceladas" },
  { valor: "todas", etiqueta: "Todas" },
];

const POR_PAGINA = 5;

/** Clasifica una reserva en las pestañas (una reserva puede estar en
 * "Próximas" y en "Por pagar" a la vez). */
export function pestanasDe(r: any, hoy: Date): PestanaReservas[] {
  const resultado: PestanaReservas[] = ["todas"];
  if (r.estado === "cancelada") return [...resultado, "canceladas"];
  const terminada = parseFechaLocal(r.fecha_fin).getTime() < hoy.getTime();
  resultado.push(terminada ? "pasadas" : "proximas");
  const activa = r.estado === "confirmada" || r.estado === "pendiente";
  if (activa && Number(r.saldo_pendiente ?? 0) > 0) resultado.push("por_pagar");
  return resultado;
}

export default function TabReservas({ reservas, loading, clienteData, reservaIdInicial = null, onHablarDeReserva }: Props) {
  const [modalReserva, setModalReserva] = useState<any | null>(null);
  const [modalResena, setModalResena] = useState<any | null>(null);
  const [detalleReservaId, setDetalleReservaId] = useState<number | null>(reservaIdInicial);
  const [solicitadas, setSolicitadas] = useState<Record<number, string>>({});
  const [pestana, setPestana] = useState<PestanaReservas | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [verCalendario, setVerCalendario] = useState(false);

  useEffect(() => {
    if (reservaIdInicial != null) setDetalleReservaId(reservaIdInicial);
  }, [reservaIdInicial]);

  const hoy = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Próximo viaje: incluye el que ya empezó pero no ha terminado.
  const proxima = useMemo(
    () =>
      reservas
        .filter((r) => r.estado !== "cancelada" && parseFechaLocal(r.fecha_fin).getTime() >= hoy.getTime())
        .sort((a, b) => parseFechaLocal(a.fecha_inicio).getTime() - parseFechaLocal(b.fecha_inicio).getTime())[0],
    [reservas, hoy],
  );
  const diasRestantes = proxima
    ? Math.ceil((parseFechaLocal(proxima.fecha_inicio).getTime() - hoy.getTime()) / 86400000)
    : null;
  const estadoViajeProxima = proxima ? getEstadoViaje(proxima.fecha_inicio, proxima.fecha_fin, hoy) : null;

  const porPestana = useMemo(() => {
    const mapa: Record<PestanaReservas, any[]> = { proximas: [], por_pagar: [], pasadas: [], canceladas: [], todas: [] };
    for (const r of reservas) for (const p of pestanasDe(r, hoy)) mapa[p].push(r);
    // Próximas y por pagar: lo más cercano primero; el resto, lo más reciente primero.
    const asc = (a: any, b: any) => parseFechaLocal(a.fecha_inicio).getTime() - parseFechaLocal(b.fecha_inicio).getTime();
    mapa.proximas.sort(asc);
    mapa.por_pagar.sort(asc);
    for (const k of ["pasadas", "canceladas", "todas"] as const) mapa[k].sort((a, b) => -asc(a, b));
    return mapa;
  }, [reservas, hoy]);

  // Lo que falta por pagar, sumado: es lo primero que alguien busca aquí.
  const saldoTotal = porPestana.por_pagar.reduce((acc, r) => acc + Number(r.saldo_pendiente ?? 0), 0);

  // Pestaña inicial: lo que viene, si hay; si no, todo.
  const pestanaActiva: PestanaReservas = pestana ?? (porPestana.proximas.length ? "proximas" : "todas");

  const filtradas = useMemo(() => {
    const lista = porPestana[pestanaActiva];
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((r) =>
      [
        String(r.id_reserva),
        `at-${String(r.id_reserva).padStart(6, "0")}`,
        tituloReserva(r),
        r.destino ?? "",
        fmt(r.fecha_inicio),
        fmt(r.fecha_fin),
      ].some((t) => t.toLowerCase().includes(q)),
    );
  }, [porPestana, pestanaActiva, busqueda]);

  useEffect(() => setPage(1), [pestanaActiva, busqueda]);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(page, totalPaginas);
  const visibles = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  return (
    <>
      <AnimatePresence>
        {modalReserva && (
          <ModalCancelacion
            reserva={modalReserva}
            onClose={() => setModalReserva(null)}
            onConfirm={(id: number, motivo: string) => setSolicitadas((prev) => ({ ...prev, [id]: motivo }))}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{modalResena && <ModalResena reserva={modalResena} onClose={() => setModalResena(null)} />}</AnimatePresence>
      <AnimatePresence>
        {detalleReservaId !== null && (() => {
          const r = reservas.find((x) => x.id_reserva === detalleReservaId);
          const cerrar = () => setDetalleReservaId(null);
          return (
            <ModalReservaDetalle
              reservaId={detalleReservaId}
              onClose={cerrar}
              clienteData={clienteData}
              cancelacionSolicitada={!!solicitadas[detalleReservaId]}
              onDejarResena={r ? () => { cerrar(); setModalResena(r); } : undefined}
              onSolicitarCancelacion={r ? () => { cerrar(); setModalReserva(r); } : undefined}
              onHablarDeReserva={onHablarDeReserva ? () => { cerrar(); onHablarDeReserva(detalleReservaId); } : undefined}
            />
          );
        })()}
      </AnimatePresence>

      <EncabezadoTab
        titulo="Mis reservas"
        descripcion="Tus viajes, lo que falta por pagar y tus comprobantes, en un solo lugar."
        accion={
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <Compass className="h-4 w-4" /> Reservar otro viaje
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Cargando tus reservas">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Cargando tus reservas...
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-muted/40" />
          ))}
        </div>
      ) : reservas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Plane className="h-7 w-7 text-primary" />
          </span>
          <h2 className="mt-4 text-lg font-bold">Todavía no tienes reservas</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Cuando reserves un hotel, un paquete o un vuelo aparecerá aquí, con sus pagos y comprobantes.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/search" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Buscar hoteles
            </Link>
            <Link to="/packages" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
              Ver paquetes
            </Link>
            <Link to="/vuelos" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
              Ver vuelos
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {saldoTotal > 0 && pestanaActiva !== "por_pagar" && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.04] px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </span>
              <p className="min-w-0 flex-1 text-sm text-foreground">
                Tienes <b>${Math.round(saldoTotal).toLocaleString("es-CO")}</b> por pagar en{" "}
                {porPestana.por_pagar.length === 1 ? "1 reserva" : `${porPestana.por_pagar.length} reservas`}.
                <span className="block text-xs text-muted-foreground">Págalo antes del viaje para tenerlo todo listo.</span>
              </p>
              <button
                type="button"
                onClick={() => setPestana("por_pagar")}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Ver qué falta
              </button>
            </div>
          )}

          {proxima && diasRestantes !== null && estadoViajeProxima && (
            <section aria-labelledby="titulo-proximo-viaje" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-primary to-primary/80 p-5 text-primary-foreground">
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <span className="text-2xl font-extrabold leading-none">{Math.max(0, diasRestantes)}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    {diasRestantes === 1 ? "día" : "días"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                    {estadoViajeProxima === "en_curso" ? "Estás de viaje" : estadoViajeProxima === "hoy" ? "Tu viaje empieza hoy" : "Tu próximo viaje"}
                  </p>
                  <h2 id="titulo-proximo-viaje" className="truncate text-lg font-bold">
                    {tituloReserva(proxima)}
                  </h2>
                  <p className="text-sm opacity-90">
                    {fmt(proxima.fecha_inicio, { weekday: "short", day: "numeric", month: "short" })} →{" "}
                    {fmt(proxima.fecha_fin, { weekday: "short", day: "numeric", month: "short" })}
                    {proxima.destino ? ` · ${proxima.destino}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDetalleReservaId(proxima.id_reserva)}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-white/90"
                  >
                    Ver detalle
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerCalendario((v) => !v)}
                    aria-expanded={verCalendario}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                  >
                    <CalendarDays className="h-4 w-4" /> {verCalendario ? "Ocultar calendario" : "Ver calendario"}
                    <ChevronDown className={`h-4 w-4 transition-transform ${verCalendario ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {verCalendario && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4">
                      <CalendarioViaje proxima={proxima} diasRestantes={diasRestantes} estadoViaje={estadoViajeProxima} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          <section aria-label="Lista de reservas">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Filtrar reservas"
                className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1 [scrollbar-width:none]"
              >
                {PESTANAS.map(({ valor, etiqueta }) => {
                  const activa = valor === pestanaActiva;
                  const n = porPestana[valor].length;
                  return (
                    <button
                      key={valor}
                      type="button"
                      role="tab"
                      aria-selected={activa}
                      onClick={() => setPestana(valor)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        activa ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {etiqueta}
                      <span
                        className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                          activa ? (valor === "por_pagar" && n > 0 ? "bg-primary text-primary-foreground" : "bg-muted") : "bg-background/60"
                        }`}
                      >
                        {n}
                      </span>
                    </button>
                  );
                })}
              </div>
              {reservas.length >= 3 && (
                <div className="w-full sm:w-60">
                  <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar reserva" ariaLabel="Buscar reserva por código, hotel o destino" />
                </div>
              )}
            </div>

            {filtradas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">
                  {busqueda ? "Ninguna reserva coincide con tu búsqueda" : "No hay reservas en esta pestaña"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda("");
                    setPestana("todas");
                  }}
                  className="mt-3 text-xs font-semibold text-primary hover:underline"
                >
                  Ver todas mis reservas
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {visibles.map((reserva) => (
                      <ReservaCard
                        key={reserva.id_reserva}
                        reserva={reserva}
                        onVerDetalle={() => setDetalleReservaId(reserva.id_reserva)}
                        clienteData={clienteData}
                        solicitudMotivo={solicitadas[reserva.id_reserva]}
                        onSolicitarCancelacion={() => setModalReserva(reserva)}
                        onDejarResena={() => setModalResena(reserva)}
                        onHablarDeReserva={onHablarDeReserva ? () => onHablarDeReserva(reserva.id_reserva) : undefined}
                        hoy={hoy}
                      />
                    ))}
                  </AnimatePresence>
                </div>
                {totalPaginas > 1 && (
                  <nav aria-label="Páginas de reservas" className="mt-5 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={paginaActual === 1}
                      aria-label="Página anterior"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Página {paginaActual} de {totalPaginas}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                      disabled={paginaActual === totalPaginas}
                      aria-label="Página siguiente"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
