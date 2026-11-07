import {
  Bed,
  Calendar,
  CalendarCheck,
  Clock,
  Compass,
  CreditCard,
  History,
  Hotel,
  Loader2,
  MapPin,
  Package,
  Share2,
  Sparkles,
  Star,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ReservaDetail,
  reservaDetailService,
  reservaService,
} from "../../../services/reserva.service";
import { estadoConfig } from "./constants";
import { compartirReserva, fmt, nights, parseFechaLocal } from "./utils";
import { ModalOverlay } from "../../ui/ModalBackdrop";

interface HabitacionDetalle {
  id_habitacion: number;
  numero_habitacion: string;
  nombre_tipo: string;
  nombre_hotel: string;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  precio_acordado: number | null;
  precio_noche: number;
  estado: string;
}

interface ServicioDetalle {
  id_servicio: number;
  nombre_servicio: string;
  descripcion: string | null;
  duracion_horas: number | null;
  nombre_categoria: string | null;
  fecha_servicio: string | null;
  numero_personas: number | null;
  precio_acordado: number | null;
}

interface HistorialDetalle {
  id_historial: number;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  fecha_cambio: string;
  comentarios: string | null;
  nombre_empleado: string | null;
}

interface Props {
  reservaId: number;
  onClose: () => void;
}

const money = (valor: number | null | undefined) =>
  `$${Number(valor ?? 0).toLocaleString("es-CO")} COP`;

// Encabezado de sección reutilizable del modal.
function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <h4 className="flex items-center gap-2 font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground/90 mb-2">
      <span className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </span>
      {children}
    </h4>
  );
}

function Tarjeta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-muted/30 border border-border/50 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

export default function ModalReservaDetalle({ reservaId, onClose }: Props) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ReservaDetail | null>(null);
  const [habitaciones, setHabitaciones] = useState<HabitacionDetalle[]>([]);
  const [servicios, setServicios] = useState<ServicioDetalle[]>([]);
  const [historial, setHistorial] = useState<HistorialDetalle[]>([]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);

    Promise.all([
      reservaService.getById(reservaId),
      reservaDetailService.getHabitaciones(reservaId),
      reservaDetailService.getServicios(reservaId),
      reservaDetailService.getHistorial(reservaId),
    ])
      .then(([reservaDetalle, hab, serv, hist]) => {
        if (cancelado) return;
        setDetalle(reservaDetalle as unknown as ReservaDetail);
        setHabitaciones(hab as HabitacionDetalle[]);
        setServicios(serv as ServicioDetalle[]);
        setHistorial(hist as HistorialDetalle[]);
      })
      .catch(() => {
        if (!cancelado) setError("No pudimos cargar el detalle de esta reserva.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [reservaId]);

  const config = detalle ? (estadoConfig[detalle.estado] ?? estadoConfig.pendiente) : null;
  const EstadoIcon = config?.icon;

  const tituloHeader =
    detalle?.paquete?.nombre_paquete ??
    (habitaciones[0]?.nombre_hotel ? `Estadía en ${habitaciones[0].nombre_hotel}` : `Reserva #${reservaId}`);

  const totalReserva = Number(detalle?.precio_total ?? 0);
  const totalPagado = (detalle?.pagos ?? [])
    .filter((p) => p.estado === "pagado")
    .reduce((acc, p) => acc + Number(p.monto ?? 0), 0);
  const saldoPendiente = Math.max(0, totalReserva - totalPagado);
  const porcentajePagado = totalReserva > 0 ? Math.min(100, Math.round((totalPagado / totalReserva) * 100)) : 0;

  // Valor base estimado para detectar descuento: precio por persona × personas.
  const precioPorPersona = Number(detalle?.paquete?.precio_por_persona ?? 0);
  const baseEstimada =
    precioPorPersona > 0 && detalle?.numero_personas
      ? precioPorPersona * detalle.numero_personas
      : 0;
  const ahorro = baseEstimada > totalReserva ? baseEstimada - totalReserva : 0;

  const noches = detalle ? nights(detalle.fecha_inicio, detalle.fecha_fin) : 0;
  const hotel = detalle?.paquete?.hotel;

  const handleCompartir = async () => {
    if (!detalle) return;
    const resultado = await compartirReserva(detalle);
    if (resultado === "copiado") toast.success("Resumen de la reserva copiado al portapapeles");
    if (resultado === "error") toast.error("No se pudo compartir la reserva");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <ModalOverlay onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative bg-card text-card-foreground border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-hidden flex flex-col transition-colors duration-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-primary to-[#A13B55] p-6 text-primary-foreground shrink-0 relative overflow-hidden">
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              onClick={handleCompartir}
              disabled={!detalle}
              aria-label="Compartir reserva"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 pr-24">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg tracking-tight leading-tight truncate">
                {tituloHeader}
              </h3>
              <p className="text-primary-foreground/80 text-xs mt-0.5">
                Reserva #ID-{reservaId}
              </p>
            </div>
          </div>

          {/* Badge de estado + canal de origen */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {config && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/15 border border-white/20`}
              >
                {EstadoIcon && <EstadoIcon className="w-3.5 h-3.5" />}
                {config.label}
              </span>
            )}
            {detalle?.canal_origen && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-white/10">
                <Clock className="w-3 h-3" />
                {detalle.canal_origen}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {cargando ? (
            <div className="py-14 text-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Cargando especificaciones...</p>
            </div>
          ) : error ? (
            <p className="text-sm text-destructive text-center py-8">{error}</p>
          ) : (
            <>
              {/* Timeline de fechas y estancia */}
              {detalle && (
                <section>
                  <SectionTitle icon={Calendar}>Fechas y estancia</SectionTitle>
                  <Tarjeta>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-center flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                          Check-in
                        </p>
                        <p className="text-sm font-bold text-foreground mt-0.5">
                          {parseFechaLocal(detalle.fecha_inicio).getDate()}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {parseFechaLocal(detalle.fecha_inicio).toLocaleDateString("es-CO", { month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-1 px-2">
                        <div className="h-px flex-1 bg-border" />
                        <CalendarCheck className="w-4 h-4 text-primary shrink-0" />
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                          Check-out
                        </p>
                        <p className="text-sm font-bold text-foreground mt-0.5">
                          {parseFechaLocal(detalle.fecha_fin).getDate()}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {parseFechaLocal(detalle.fecha_fin).toLocaleDateString("es-CO", { month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {detalle.numero_personas} pasajero{detalle.numero_personas !== 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Bed className="w-3.5 h-3.5" />
                        {noches} noche{noches !== 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 ml-auto">
                        <Clock className="w-3.5 h-3.5" />
                        Reservado el {fmt(detalle.fecha_reserva)}
                      </span>
                    </div>
                  </Tarjeta>
                </section>
              )}

              {/* Resumen financiero con enfoque comercial */}
              {totalReserva > 0 && (
                <section>
                  <SectionTitle icon={Wallet}>Resumen de pago</SectionTitle>
                  <div className="bg-gradient-to-br from-primary/15 via-card to-card border border-primary/30 rounded-xl p-4">
                    <div className="text-center mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                        Total de tu reserva
                      </p>
                      <p className="text-3xl font-extrabold text-primary mt-1 leading-none tracking-tight">
                        {money(totalReserva)}
                      </p>
                      {baseEstimada > 0 && totalReserva < baseEstimada && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          <span className="line-through mr-1">{money(baseEstimada)}</span>
                          <span className="text-success font-bold">
                            Ahorras {money(baseEstimada - totalReserva)}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-card border border-border/60 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Pagado</p>
                        <p className="text-sm font-bold text-success mt-0.5">{money(totalPagado)}</p>
                      </div>
                      <div className="bg-card border border-border/60 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Saldo</p>
                        <p className={`text-sm font-bold mt-0.5 ${saldoPendiente > 0 ? "text-warning" : "text-success"}`}>
                          {money(saldoPendiente)}
                        </p>
                      </div>
                    </div>

                    <div className="h-1.5 rounded-full bg-border/60 overflow-hidden mt-3">
                      <div
                        className={`h-full rounded-full transition-all ${saldoPendiente > 0 ? "bg-primary" : "bg-success"}`}
                        style={{ width: `${porcentajePagado}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground/80 mt-1.5">
                      {saldoPendiente > 0
                        ? `${porcentajePagado}% pagado — queda un saldo por cubrir`
                        : "Reserva pagada en su totalidad"}
                    </p>
                  </div>
                </section>
              )}

              {/* Desglose congelado al reservar (lo que se cobra). */}
              {(detalle?.conceptos?.length ?? 0) > 0 && (
                <section>
                  <SectionTitle icon={Wallet}>Qué estás pagando</SectionTitle>
                  <ul className="divide-y divide-border rounded-xl border border-border text-xs">
                    {detalle!.conceptos!.map((c, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
                        <span>
                          {c.descripcion}
                          {c.incluido && <span className="ml-1 font-semibold text-success">· Incluido</span>}
                          {!c.incluido && c.cantidad > 1 && c.precio_unitario > 0 && (
                            <span className="block text-muted-foreground">{c.cantidad} × {money(c.precio_unitario)}</span>
                          )}
                        </span>
                        <span className="shrink-0 font-semibold">{c.tipo === "vuelo_cotizacion" ? "Por cotizar" : money(c.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                  {detalle?.estado_vuelo === "cotizacion_pendiente" && (
                    <p className="mt-2 text-[11px] text-warning">El vuelo está pendiente de cotización: la agencia te enviará la tarifa.</p>
                  )}
                </section>
              )}

              {(detalle?.viajeros?.length ?? 0) > 0 && (
                <section>
                  <SectionTitle icon={Wallet}>Viajeros</SectionTitle>
                  <ul className="space-y-1 text-xs">
                    {detalle!.viajeros!.map((v) => (
                      <li key={v.id_viajero} className="flex justify-between gap-2">
                        <span>{v.nombres} {v.apellidos}{v.es_titular ? " (titular)" : ""}</span>
                        <span className="text-muted-foreground">{v.tipo === "adulto" ? "Adulto" : v.tipo === "nino" ? "Niño" : "Infante"}{v.numero_documento ? ` · ${v.tipo_documento ?? ""} ${v.numero_documento}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {detalle?.solicitudes_especiales && (
                <section>
                  <SectionTitle icon={Wallet}>Tus solicitudes especiales</SectionTitle>
                  <p className="whitespace-pre-line text-xs text-muted-foreground">{detalle.solicitudes_especiales}</p>
                </section>
              )}

              {/* Promoción / descuento aplicado */}
              {ahorro > 0 && (
                <section>
                  <SectionTitle icon={Sparkles}>Promoción aplicada</SectionTitle>
                  <div className="bg-muted/30 border border-dashed border-primary/50 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-foreground">Beneficio aprovechado</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Descuento de{" "}
                        <span className="font-bold text-success">{money(ahorro)}</span>{" "}
                        sobre el valor inicial por persona
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-[11px] font-bold">
                      <Sparkles className="w-3 h-3" />
                      OFERTA
                    </span>
                  </div>
                </section>
              )}

              {/* Paquete */}
              {detalle?.paquete && (
                <section>
                  <SectionTitle icon={Package}>Paquete contratado</SectionTitle>
                  <Tarjeta>
                    <p className="text-sm font-semibold text-foreground">{detalle.paquete.nombre_paquete}</p>
                    {detalle.paquete.descripcion && (
                      <p className="text-xs text-muted-foreground mt-0.5">{detalle.paquete.descripcion}</p>
                    )}
                    {hotel && (
                      <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Hotel className="w-3.5 h-3.5 text-primary" />
                          {hotel.nombre_hotel}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {hotel.ciudad}, {hotel.pais}
                        </span>
                        {hotel.calificacion > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${i < Math.round(hotel.calificacion ?? 0) ? "text-gold fill-gold" : "text-muted-foreground/30"}`}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                    {precioPorPersona > 0 && (
                      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
                        Precio por persona:{" "}
                        <span className="font-bold text-foreground">{money(precioPorPersona)}</span>
                      </p>
                    )}
                  </Tarjeta>
                </section>
              )}

              {/* Asesor asignado */}
              {detalle?.empleado && (
                <section>
                  <SectionTitle icon={Users}>Tu asesor asignado</SectionTitle>
                  <Tarjeta>
                    <p className="text-sm font-semibold text-foreground">
                      {detalle.empleado.nombre} {detalle.empleado.apellido}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[detalle.empleado.correo_electronico, detalle.empleado.celular].filter(Boolean).join(" · ")}
                    </p>
                  </Tarjeta>
                </section>
              )}

              {/* Hospedaje */}
              {habitaciones.length > 0 && (
                <section>
                  <SectionTitle icon={Bed}>Alojamiento</SectionTitle>
                  <div className="space-y-2">
                    {habitaciones.map((h) => (
                      <div
                        key={h.id_habitacion}
                        className="bg-muted/30 border border-border/50 rounded-xl p-4 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                            {h.nombre_hotel}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {h.nombre_tipo} · Hab. {h.numero_habitacion}
                            {h.fecha_checkin && h.fecha_checkout && (
                              <> · {fmt(h.fecha_checkin)} – {fmt(h.fecha_checkout)}</>
                            )}
                          </p>
                        </div>
                        <p className="text-xs font-bold text-primary shrink-0">{money(h.precio_acordado ?? h.precio_noche)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Servicios */}
              {servicios.length > 0 && (
                <section>
                  <SectionTitle icon={Compass}>Servicios incluidos</SectionTitle>
                  <div className="space-y-2">
                    {servicios.map((s) => (
                      <div
                        key={s.id_servicio}
                        className="bg-muted/30 border border-border/50 rounded-xl p-4 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">{s.nombre_servicio}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[s.nombre_categoria, s.fecha_servicio ? fmt(s.fecha_servicio) : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        {s.precio_acordado != null && (
                          <p className="text-xs font-bold text-primary shrink-0">{money(s.precio_acordado)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Pagos */}
              {detalle?.pagos && detalle.pagos.length > 0 && (
                <section>
                  <SectionTitle icon={CreditCard}>Pagos realizados</SectionTitle>
                  <div className="space-y-2">
                    {detalle.pagos.map((p) => (
                      <div
                        key={p.id_pago}
                        className="bg-muted/30 border border-border/50 rounded-xl p-4 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {p.metodo_pago?.nombre_metodo ?? "Método no especificado"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmt(p.fecha_pago)} · {p.estado}
                          </p>
                        </div>
                        <p className="text-xs font-bold text-primary shrink-0">{money(p.monto)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Historial */}
              {historial.length > 0 && (
                <section>
                  <SectionTitle icon={History}>Historial de estado</SectionTitle>
                  <div className="space-y-2">
                    {historial.map((h) => (
                      <div key={h.id_historial} className="flex gap-3 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <p className="text-foreground font-medium">
                            {h.estado_anterior ? `${h.estado_anterior} → ${h.estado_nuevo}` : h.estado_nuevo}
                            <span className="text-muted-foreground font-normal"> · {fmt(h.fecha_cambio)}</span>
                          </p>
                          {h.comentarios && <p className="text-muted-foreground mt-0.5">{h.comentarios}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
