import { ChevronRight, MapPin, MessageCircle, Plane, Share2, Users } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef } from "react";
import { toast } from "sonner";
import ComprobantePDF from "../ComprobantePDF";
import { ClienteResponse } from "../../../services/cliente.service";
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
  /** Lleva a la pestaña Mensajes con esta reserva ya preseleccionada en el
   * composer -- para no obligar al cliente a explicar de cero de qué
   * reserva habla. Opcional: si Profile.tsx no lo pasa, el botón simplemente
   * no aparece. */
  onHablarDeReserva?: () => void;
  /** fecha de referencia "hoy" (medianoche local), viene del padre */
  hoy: Date;
}

const ReservaCard = forwardRef<HTMLDivElement, Props>(function ReservaCard(
  {
    reserva,
    onVerDetalle,
    clienteData,
    solicitudMotivo,
    onSolicitarCancelacion,
    onDejarResena,
    onHablarDeReserva,
    hoy,
  },
  ref,
) {
  const estadoMostrar = solicitudMotivo
    ? "cancelacion_solicitada"
    : reserva.estado;
  const config = estadoConfig[estadoMostrar] ?? estadoConfig.pendiente;
  const Icon = config.icon;
  const noches = nights(reserva.fecha_inicio, reserva.fecha_fin);
  const yaSolicitada =
    !!solicitudMotivo ||
    reserva.estado === "cancelacion_solicitada" ||
    reserva.estado === "cancelada";

  // Estado real del viaje según fechas (independiente del campo `estado`
  // del backend, que puede no actualizarse automáticamente al pasar el tiempo).
  const estadoViaje = getEstadoViaje(
    reserva.fecha_inicio,
    reserva.fecha_fin,
    hoy,
  );
  const puedeCancelar = !yaSolicitada && estadoViaje === "futuro";
  const puedeResenar = estadoViaje === "finalizado";

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="bg-card text-card-foreground border border-border rounded-xl shadow-sm overflow-hidden transition-colors duration-200"
    >
      <div className="p-4 sm:p-5">
        {/* Header de la Tarjeta */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
              <Plane className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {reserva.nombre_paquete ||
                  (reserva.hotel_nombre
                    ? `Estadía en ${reserva.hotel_nombre}`
                    : reserva.id_paquete
                      ? `Paquete #${reserva.id_paquete}`
                      : `Reserva #${reserva.id_reserva}`)}
              </h3>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
                <span>Reserva #ID-{reserva.id_reserva}</span>
                {reserva.destino && (
                  <span className="inline-flex items-center gap-0.5">
                    <span className="text-muted-foreground/50">·</span>
                    <MapPin className="w-3 h-3" />
                    {reserva.destino}
                  </span>
                )}
                <span className="text-muted-foreground/50">·</span>
                <span>Registro: {fmt(reserva.fecha_reserva)}</span>
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 self-start sm:self-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${config.bg} ${config.color}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {config.label}
          </span>
        </div>

        {/* Chips informativos */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          <div className="bg-muted/40 border border-border/40 rounded-lg p-2.5">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Fecha Ida
            </span>
            <span className="text-xs font-semibold text-foreground">
              {fmt(reserva.fecha_inicio)}
            </span>
          </div>
          <div className="bg-muted/40 border border-border/40 rounded-lg p-2.5">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Fecha Regreso
            </span>
            <span className="text-xs font-semibold text-foreground">
              {fmt(reserva.fecha_fin)}
            </span>
          </div>
          <div className="bg-muted/40 border border-border/40 rounded-lg p-2.5">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Estancia
            </span>
            <span className="text-xs font-semibold text-foreground">
              {noches} {noches === 1 ? "Noche" : "Noches"}
            </span>
          </div>
          <div className="bg-muted/40 border border-border/40 rounded-lg p-2.5">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Personas
            </span>
            <span className="text-xs font-semibold text-foreground flex items-center gap-1">
              <Users className="w-3 h-3 text-primary shrink-0" />
              {reserva.numero_personas ?? "—"}
            </span>
          </div>
          <div className="bg-muted/40 border border-border/40 rounded-lg p-2.5">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Importe Total
            </span>
            <span className="text-xs font-bold text-primary">
              ${Number(reserva.precio_total ?? 0).toLocaleString("es-CO")} COP
            </span>
          </div>
        </div>

        {/* Saldo tras el anticipo del 50%: el backend ya acepta pagarlo
            (tipo_pago "saldo"); mientras tanto el cliente lo coordina con
            su asesor, que lo registra desde el panel. */}
        {reserva.estado === "confirmada" && Number(reserva.saldo_pendiente ?? 0) > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 mb-4">
            <span className="text-xs text-foreground">
              Pagado ${Number(reserva.total_pagado ?? 0).toLocaleString("es-CO")} · <strong>Saldo pendiente ${Number(reserva.saldo_pendiente).toLocaleString("es-CO")} COP</strong>
            </span>
            {onHablarDeReserva && (
              <button
                onClick={onHablarDeReserva}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Coordinar pago del saldo
              </button>
            )}
          </div>
        )}

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center justify-between border-t border-border/60 pt-4 gap-2">
          <div className="flex items-center gap-2">
            {clienteData &&
              (reserva.estado === "confirmada" ||
                reserva.estado === "pendiente") && (
                <ComprobantePDF
                  reservaId={reserva.id_reserva}
                  clienteData={clienteData}
                />
              )}

            {puedeCancelar && (
              <button
                onClick={onSolicitarCancelacion}
                className="px-3 py-1.5 border border-destructive/30 text-destructive text-xs font-medium rounded-lg hover:bg-destructive/5 transition-all cursor-pointer"
              >
                Solicitar Cancelación
              </button>
            )}

            {puedeResenar && (
              <button
                onClick={onDejarResena}
                className="px-3 py-1.5 border border-primary/30 text-primary text-xs font-medium rounded-lg hover:bg-primary/5 transition-all cursor-pointer"
              >
                Dejar reseña
              </button>
            )}

            {onHablarDeReserva && (
              <button
                onClick={onHablarDeReserva}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground text-xs font-medium rounded-lg hover:bg-muted hover:text-foreground transition-all cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Hablar de esta reserva
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                const resultado = await compartirReserva(reserva);
                if (resultado === "copiado") toast.success("Resumen de la reserva copiado al portapapeles");
                if (resultado === "error") toast.error("No se pudo compartir la reserva");
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartir</span>
            </button>

            <button
              onClick={onVerDetalle}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1.5 cursor-pointer"
            >
              <span>Ver especificaciones</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default ReservaCard;