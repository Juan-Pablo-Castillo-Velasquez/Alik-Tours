import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plane,
  Search,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ClienteResponse } from "../../../services/cliente.service";
import CalendarioViaje from "./CalendarioViaje";
import { FiltroEstado } from "./constants";
import FiltroBar from "./FiltroBar";
import MetricasResumen from "./MetricasResumen";
import ModalCancelacion from "./ModalCancelacion";
import ModalResena from "./ModalResena";
import ModalReservaDetalle from "./ModalReservaDetalle";
import ReservaCard from "./ReservaCard";
import SectionHeader from "./SectionHeader";
import { fmt, getEstadoViaje, parseFechaLocal } from "./utils";

interface Props {
  reservas: any[];
  loading: boolean;
  clienteData: ClienteResponse | null;
  // Permite abrir directo el detalle de una reserva específica al entrar a
  // esta pestaña (p.ej. desde la campana de notificaciones) en vez de que
  // el cliente tenga que buscarla manualmente en la lista.
  reservaIdInicial?: number | null;
  // "Hablar de esta reserva" en ReservaCard -- lo implementa Profile.tsx
  // llevando al cliente a la pestaña Mensajes con esta reserva
  // preseleccionada. Opcional: sin él, el botón de ReservaCard no aparece.
  onHablarDeReserva?: (idReserva: number) => void;
}

export default function TabReservas({
  reservas,
  loading,
  clienteData,
  reservaIdInicial = null,
  onHablarDeReserva,
}: Props) {
  const [modalReserva, setModalReserva] = useState<any | null>(null);
  const [modalResena, setModalResena] = useState<any | null>(null);
  const [detalleReservaId, setDetalleReservaId] = useState<number | null>(reservaIdInicial);

  useEffect(() => {
    if (reservaIdInicial != null) setDetalleReservaId(reservaIdInicial);
  }, [reservaIdInicial]);
  const [solicitadas, setSolicitadas] = useState<Record<number, string>>({});
  const [filtro, setFiltro] = useState<FiltroEstado>("todas");
  const [busqueda, setBusqueda] = useState("");
  // Por defecto 2 para no saturar la vista con demasiadas tarjetas de una vez.
  const [pageSize, setPageSize] = useState(2);
  const [page, setPage] = useState(1);
  // Vista "calendario" (cronograma del próximo viaje) vs. "historial" (lista
  // completa de reservas) — separadas en dos pantallas con un botón para
  // pasar de una a otra, en vez de todo apilado en un solo scroll largo.
  const [vista, setVista] = useState<"calendario" | "historial">("calendario");

  const handleCancelacionConfirmada = (id: number, motivo: string) =>
    setSolicitadas((prev) => ({ ...prev, [id]: motivo }));

  const hoy = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // "proxima" ahora incluye viajes que ya empezaron pero no han terminado
  // (antes se descartaban en cuanto pasaba el check-in).
  const proxima = useMemo(
    () =>
      reservas
        .filter(
          (r) =>
            r.estado !== "cancelada" &&
            parseFechaLocal(r.fecha_fin).getTime() >= hoy.getTime(),
        )
        .sort(
          (a, b) =>
            parseFechaLocal(a.fecha_inicio).getTime() -
            parseFechaLocal(b.fecha_inicio).getTime(),
        )[0],
    [reservas, hoy],
  );

  const diasRestantes = proxima
    ? Math.ceil(
        (parseFechaLocal(proxima.fecha_inicio).getTime() - hoy.getTime()) /
          86400000,
      )
    : null;

  const estadoViajeProxima = proxima
    ? getEstadoViaje(proxima.fecha_inicio, proxima.fecha_fin, hoy)
    : null;
  console.log("fecha_inicio raw:", proxima?.fecha_inicio, "| hoy:", hoy);

  const counts: Record<FiltroEstado, number> = useMemo(
    () => ({
      todas: reservas.length,
      confirmada: reservas.filter((r) => r.estado === "confirmada").length,
      pendiente: reservas.filter((r) => r.estado === "pendiente").length,
      finalizada: reservas.filter((r) => r.estado === "finalizada").length,
      cancelada: reservas.filter((r) => r.estado === "cancelada").length,
    }),
    [reservas],
  );

  const reservasFiltradas = useMemo(() => {
    let lista =
      filtro === "todas"
        ? reservas
        : reservas.filter((r) => r.estado === filtro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        (r) =>
          String(r.id_reserva).includes(q) ||
          String(r.id_paquete).includes(q) ||
          fmt(r.fecha_inicio).toLowerCase().includes(q) ||
          fmt(r.fecha_fin).toLowerCase().includes(q),
      );
    }
    return lista;
  }, [reservas, filtro, busqueda]);

  // Paginación del historial (estilo Despegar: secciones fijas en vez de una
  // lista larga). Se reinicia a la página 1 cada vez que cambia el filtro,
  // la búsqueda o el tamaño de página, para no quedar "varado" en una página
  // vacía después de reducir el resultado.
  const totalPaginas = Math.max(1, Math.ceil(reservasFiltradas.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [filtro, busqueda, pageSize]);

  const paginaActual = Math.min(page, totalPaginas);
  const reservasPagina = useMemo(
    () =>
      reservasFiltradas.slice(
        (paginaActual - 1) * pageSize,
        paginaActual * pageSize,
      ),
    [reservasFiltradas, paginaActual, pageSize],
  );

  // Contenido del historial, extraído para poder mostrarlo tanto en la vista
  // "historial" del toggle como en el caso sin viaje próximo (sin calendario
  // que mostrar, no tiene sentido ofrecer un botón para "volver" a él).
  const historialContent = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <SectionHeader
          title="Historial de Reservas"
          subtitle={`${counts.todas} solicitud${counts.todas !== 1 ? "es" : ""} registrada${counts.todas !== 1 ? "as" : ""}`}
          icon={Calendar}
        />

        {reservasFiltradas.length > 0 && (
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
            Ver por
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Con pocas reservas, el buscador y los filtros son ruido:
          solo se muestran cuando aportan valor real de filtrado. */}
      {reservas.length >= 3 && (
        <FiltroBar
          filtro={filtro}
          setFiltro={setFiltro}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          counts={counts}
        />
      )}

      {reservasFiltradas.length === 0 ? (
        <div className="bg-card text-card-foreground border border-border rounded-xl p-8 text-center">
          <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-semibold text-muted-foreground">
            No se encontraron resultados coincidentes
          </p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Prueba reajustando los criterios de búsqueda o filtros.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {reservasPagina.map((reserva) => (
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
            <div className="flex items-center justify-center gap-1.5 mt-5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={paginaActual === 1}
                aria-label="Página anterior"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === paginaActual ? "page" : undefined}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                    n === paginaActual
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {n}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaActual === totalPaginas}
                aria-label="Página siguiente"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <>
      <AnimatePresence>
        {modalReserva && (
          <ModalCancelacion
            reserva={modalReserva}
            onClose={() => setModalReserva(null)}
            onConfirm={handleCancelacionConfirmada}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalResena && (
          <ModalResena
            reserva={modalResena}
            onClose={() => setModalResena(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detalleReservaId !== null && (
          <ModalReservaDetalle
            reservaId={detalleReservaId}
            onClose={() => setDetalleReservaId(null)}
          />
        )}
      </AnimatePresence>

      {/* Header General */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
          Mis Reservas
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Revisa tus viajes, paga tus saldos y descarga tus comprobantes
        </p>
      </div>

      {loading ? (
        <div className="bg-card text-card-foreground border border-border rounded-xl p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Sincronizando tus itinerarios...
          </p>
        </div>
      ) : reservas.length === 0 ? (
        <div className="bg-card text-card-foreground border border-border rounded-xl p-12 text-center shadow-sm">
          <Plane className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground tracking-tight">
            Aún no registras reservas
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
            Tus paquetes adquiridos aparecerán reflejados en esta sección para
            su gestión.
          </p>
          <Link
            to="/search"
            className="inline-block px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-95 transition-all shadow-sm"
          >
            Explorar Catálogo
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <MetricasResumen counts={counts} />

          {proxima && diasRestantes !== null && estadoViajeProxima ? (
            vista === "calendario" ? (
              <section>
                <SectionHeader
                  title="Cuenta regresiva"
                  subtitle="Así se ve el calendario de tu próximo viaje"
                  icon={Plane}
                />
                <CalendarioViaje
                  proxima={proxima}
                  diasRestantes={diasRestantes}
                  estadoViaje={estadoViajeProxima}
                />

                <button
                  type="button"
                  onClick={() => setVista("historial")}
                  className="w-full mt-5 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-95 transition-all shadow-sm"
                >
                  Ver historial de reservas
                  <ArrowRight className="w-4 h-4" />
                </button>
              </section>
            ) : (
              <section>
                <button
                  type="button"
                  onClick={() => setVista("calendario")}
                  className="flex items-center gap-2 mb-4 text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al calendario
                </button>

                {historialContent}
              </section>
            )
          ) : (
            <section>{historialContent}</section>
          )}
        </div>
      )}
    </>
  );
}
