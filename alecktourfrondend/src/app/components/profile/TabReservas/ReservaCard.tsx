import { BedDouble, CalendarDays, ChevronRight, CreditCard, MapPin, MessageCircle, Moon, Package, Plane, Share2, Star, Users, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ClienteResponse } from "../../../services/cliente.service";
import { codigoReserva, ETIQUETA_TIPO, porcentajePagado, tipoReserva, tituloReserva } from "../../../utils/reservaPresentacion";
import { resolveFotoUrl } from "../../admin/types";
import ComprobantePDF from "../ComprobantePDF";
import { estadoConfig } from "./constants";
import { compartirReserva, fmt, getEstadoViaje, nights } from "./utils";

interface Props {
  reserva: any;
  onVerDetalle: () => void;
  clienteData: ClienteResponse | null;
  /** motivo ya enviado en esta sesión (si lo hay) — viene del estado `solicitadas` del padre */
  solicitudMotivo?: string;
  onSolicitarCancelacion: () => void;
  onDejarResena: () => void;
  /** Lleva a la pestaña Mensajes con esta reserva ya preseleccionada.
   * Opcional: si Profile.tsx no lo pasa, el botón no aparece. */
  onHablarDeReserva?: () => void;
  /** fecha de referencia "hoy" (medianoche local), viene del padre */
  hoy: Date;
}

const ICONO_TIPO = { hotel: BedDouble, paquete: Package, vuelo: Plane };

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

/** Tarjeta de una reserva en Mis reservas: foto, qué es, cuándo, cuánto va
 * pagado y las acciones que tienen sentido según el estado del viaje. */
const ReservaCard = forwardRef<HTMLDivElement, Props>(function ReservaCard(
  { reserva, onVerDetalle, clienteData, solicitudMotivo, onSolicitarCancelacion, onDejarResena, onHablarDeReserva, hoy },
  ref,
) {
  const [sinFoto, setSinFoto] = useState(false);
  const estadoMostrar = solicitudMotivo ? "cancelacion_solicitada" : reserva.estado;
  const config = estadoConfig[estadoMostrar] ?? estadoConfig.pendiente;
  const IconoEstado = config.icon;
  const tipo = tipoReserva(reserva);
  const IconoTipo = ICONO_TIPO[tipo];
  const noches = nights(reserva.fecha_inicio, reserva.fecha_fin);
  const yaSolicitada = !!solicitudMotivo || reserva.estado === "cancelacion_solicitada" || reserva.estado === "cancelada";

  // Estado real del viaje según fechas (el campo `estado` del backend puede
  // no actualizarse solo al pasar el tiempo).
  const estadoViaje = getEstadoViaje(reserva.fecha_inicio, reserva.fecha_fin, hoy);
  const puedeCancelar = !yaSolicitada && estadoViaje === "futuro";
  const puedeResenar = estadoViaje === "finalizado" && reserva.estado !== "cancelada";
  const activa = reserva.estado === "confirmada" || reserva.estado === "pendiente";

  const total = Number(reserva.precio_total ?? 0);
  const pagado = Number(reserva.total_pagado ?? 0);
  const saldo = Number(reserva.saldo_pendiente ?? 0);
  const porcentaje = porcentajePagado(total, pagado);
  const debe = activa && saldo > 0;
  const foto = !sinFoto && reserva.imagen_url ? resolveFotoUrl(reserva.imagen_url) : undefined;
  const titulo = tituloReserva(reserva);

  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      aria-label={`${titulo}, ${config.label}`}
      className={`group overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md ${
        debe ? "border-primary/30" : "border-border"
      } ${reserva.estado === "cancelada" ? "opacity-80" : ""}`}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Foto (o degradado con el ícono del producto si no hay) */}
        <button
          type="button"
          onClick={onVerDetalle}
          aria-label={`Ver detalle de ${titulo}`}
          className="relative h-36 w-full shrink-0 overflow-hidden bg-gradient-to-br from-primary/80 to-primary sm:h-auto sm:w-52"
        >
          {foto ? (
            <img
              src={foto}
              alt=""
              loading="lazy"
              onError={() => setSinFoto(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <IconoTipo className="h-10 w-10 text-white/70" />
            </span>
          )}
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <IconoTipo className="h-3 w-3" /> {ETIQUETA_TIPO[tipo]}
          </span>
          {estadoViaje === "en_curso" && activa && (
            <span className="absolute bottom-2 left-2 rounded-full bg-[var(--gold)] px-2.5 py-1 text-[11px] font-bold text-[var(--gold-foreground)]">
              Viajando ahora
            </span>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-bold leading-snug text-foreground">{titulo}</h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-mono font-semibold text-foreground/80">{codigoReserva(reserva.id_reserva)}</span>
                {reserva.destino && (
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" /> {reserva.destino}
                  </span>
                )}
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${config.bg} ${config.color}`}>
              <IconoEstado className="h-3.5 w-3.5" /> {config.label}
            </span>
          </div>

          <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <div className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" />
              <dt className="sr-only">Fechas</dt>
              <dd className="font-medium">
                {fmt(reserva.fecha_inicio, { day: "numeric", month: "short" })} → {fmt(reserva.fecha_fin)}
              </dd>
            </div>
            {tipo !== "vuelo" && (
              <div className="inline-flex items-center gap-1.5">
                <Moon className="h-4 w-4 text-primary" />
                <dt className="sr-only">Noches</dt>
                <dd>
                  {noches} {noches === 1 ? "noche" : "noches"}
                </dd>
              </div>
            )}
            <div className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              <dt className="sr-only">Viajeros</dt>
              <dd>
                {reserva.numero_personas ?? "—"} {reserva.numero_personas === 1 ? "viajero" : "viajeros"}
              </dd>
            </div>
          </dl>

          {/* Recorrido de la reserva: dónde está y qué sigue */}
          {reserva.estado !== "cancelada" && reserva.estado !== "cancelacion_solicitada" && (
            <ol className="flex items-center gap-1.5 text-[11px] font-medium" aria-label="Estado del viaje">
              {[
                { texto: "Reservada", hecho: true },
                {
                  texto: saldo <= 0 ? "Pagada" : debe ? "Pago pendiente" : "Pago parcial",
                  hecho: saldo <= 0,
                },
                {
                  texto: estadoViaje === "en_curso" ? "En viaje" : estadoViaje === "finalizado" ? "Viajada" : "Viaje",
                  hecho: estadoViaje === "finalizado",
                  actual: estadoViaje === "en_curso" || estadoViaje === "hoy",
                },
              ].map((paso, i) => (
                <li key={paso.texto} className="flex items-center gap-1.5">
                  {i > 0 && <span className={`h-px w-5 ${paso.hecho ? "bg-primary/50" : "bg-border"}`} aria-hidden="true" />}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                      paso.hecho
                        ? "bg-primary/10 text-primary"
                        : paso.actual
                          ? "bg-[var(--gold)]/15 text-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${paso.hecho ? "bg-primary" : paso.actual ? "bg-[var(--gold)]" : "bg-muted-foreground/40"}`}
                      aria-hidden="true"
                    />
                    {paso.texto}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {/* Pago: barra de avance y botón si queda saldo. En una reserva ya
              cerrada solo se informa lo pagado (la barra a medias confundía). */}
          {reserva.estado !== "cancelada" && total > 0 && !activa && (
            <p className="text-xs text-muted-foreground">
              Total pagado <b className="text-foreground">{pesos(pagado)}</b>
            </p>
          )}
          {activa && total > 0 && (
            <div className={`rounded-xl px-3 py-2.5 ${debe ? "bg-primary/5" : "bg-muted/40"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  Pagado <b className="text-foreground">{pesos(pagado)}</b> de {pesos(total)}
                </span>
                {debe ? (
                  <span className="font-semibold text-primary">Saldo {pesos(saldo)}</span>
                ) : (
                  porcentaje >= 100 && <span className="font-semibold text-success">Pagada</span>
                )}
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-label="Avance del pago"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={porcentaje}
              >
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${porcentaje}%` }} />
              </div>
            </div>
          )}

          {solicitudMotivo && (
            <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-foreground">
              Pediste cancelar esta reserva ({solicitudMotivo}). Un asesor te confirma la respuesta.
            </p>
          )}

          {/* Acciones */}
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            {debe && (
              <Link
                to={`/pagar/${reserva.id_reserva}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                <CreditCard className="h-3.5 w-3.5" /> {pagado > 0 ? "Pagar saldo" : "Pagar"}
              </Link>
            )}
            <button
              type="button"
              onClick={onVerDetalle}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Ver detalle <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {clienteData && activa && <ComprobantePDF compacto reservaId={reserva.id_reserva} clienteData={clienteData} />}
            {puedeResenar && (
              <button
                type="button"
                onClick={onDejarResena}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--gold)]/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[var(--gold)]/10"
              >
                <Star className="h-3.5 w-3.5 text-[var(--gold)]" /> Dejar reseña
              </button>
            )}
            {onHablarDeReserva && (
              <button
                type="button"
                onClick={onHablarDeReserva}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Hablar de esta reserva
              </button>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={async () => {
                const resultado = await compartirReserva(reserva);
                if (resultado === "copiado") toast.success("Resumen de la reserva copiado al portapapeles");
                if (resultado === "error") toast.error("No se pudo compartir la reserva");
              }}
              aria-label="Compartir reserva"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
            {puedeCancelar && (
              <button
                type="button"
                onClick={onSolicitarCancelacion}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5"
              >
                <XCircle className="h-3.5 w-3.5" /> Solicitar cancelación
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
});

export default ReservaCard;
