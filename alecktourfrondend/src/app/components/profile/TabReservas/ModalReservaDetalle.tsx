import {
  ArrowRight,
  BedDouble,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  History,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  PenSquare,
  Phone,
  Plane,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { codigoReserva, tituloReserva } from "../../../utils/reservaPresentacion";
import {
  ReservaDetail,
  reservaDetailService,
  reservaService,
} from "../../../services/reserva.service";
import { estadoConfig } from "./constants";
import { compartirReserva, fmt, getEstadoViaje, nights, parseFechaLocal } from "./utils";
import { ModalOverlay } from "../../ui/ModalBackdrop";
import { resolveFotoUrl } from "../../admin/types";
import { descargarIcs } from "../../../utils/calendarioViaje";
import ComprobantePDF from "../ComprobantePDF";
import type { ClienteResponse } from "../../../services/cliente.service";

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
  id_hotel?: number | null;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  telefono?: string | null;
  hora_checkin?: string | null;
  hora_checkout?: string | null;
  imagen_hotel?: string | null;
  politica_cancelacion?: string | null;
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
  /** Datos del cliente: habilitan descargar el comprobante en PDF. */
  clienteData?: ClienteResponse | null;
  /** Acciones de la tarjeta de la reserva, para hacerlas desde el detalle. */
  onDejarResena?: () => void;
  onSolicitarCancelacion?: () => void;
  onHablarDeReserva?: () => void;
  /** Ya se pidió cancelar esta reserva en esta sesión. */
  cancelacionSolicitada?: boolean;
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
    <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="h-4 w-4 text-primary" />
      {children}
    </h4>
  );
}

function Tarjeta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${className}`}>
      {children}
    </div>
  );
}

const ESTADO_PAGO: Record<string, { texto: string; clase: string }> = {
  pagado: { texto: "Aprobado", clase: "bg-success/10 text-success" },
  aprobado: { texto: "Aprobado", clase: "bg-success/10 text-success" },
  pendiente: { texto: "En revisión", clase: "bg-warning/10 text-warning" },
  pendiente_verificacion: { texto: "En revisión", clase: "bg-warning/10 text-warning" },
  rechazado: { texto: "Rechazado", clase: "bg-destructive/10 text-destructive" },
  fallido: { texto: "No se completó", clase: "bg-destructive/10 text-destructive" },
  reembolsado: { texto: "Reembolsado", clase: "bg-muted text-muted-foreground" },
};

// Cómo se cuenta cada cambio de estado al cliente (sin términos internos).
const HITO: Record<string, string> = {
  pendiente: "Reserva creada",
  confirmada: "Reserva confirmada",
  cancelacion_solicitada: "Pediste cancelar",
  cancelada: "Reserva cancelada",
  finalizada: "Viaje finalizado",
};

const hhmm = (h?: string | null) => (h ? h.slice(0, 5) : null);
const fechaLarga = (iso: string) =>
  parseFechaLocal(iso).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

export default function ModalReservaDetalle({
  reservaId,
  onClose,
  clienteData,
  onDejarResena,
  onSolicitarCancelacion,
  onHablarDeReserva,
  cancelacionSolicitada = false,
}: Props) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ReservaDetail | null>(null);
  const [habitaciones, setHabitaciones] = useState<HabitacionDetalle[]>([]);
  const [servicios, setServicios] = useState<ServicioDetalle[]>([]);
  const [historial, setHistorial] = useState<HistorialDetalle[]>([]);
  const [copiado, setCopiado] = useState(false);

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

  // Esc cierra.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onClose]);

  const codigo = codigoReserva(reservaId);
  const config = detalle ? (estadoConfig[detalle.estado] ?? estadoConfig.pendiente) : null;
  const hab = habitaciones[0];
  const hotelPaquete = detalle?.paquete?.hotel;
  const tipo: "hotel" | "paquete" | "vuelo" =
    (detalle?.tipo_producto as "hotel" | "paquete" | "vuelo" | null) ??
    (detalle?.paquete ? "paquete" : hab ? "hotel" : "hotel");
  const IconoTipo = tipo === "paquete" ? Package : tipo === "vuelo" ? Plane : BedDouble;
  const etiquetaTipo = tipo === "paquete" ? "Paquete" : tipo === "vuelo" ? "Vuelo" : "Hotel";

  const titulo =
    detalle?.paquete?.nombre_paquete ??
    hab?.nombre_hotel ??
    (detalle ? tituloReserva({ ...(detalle as any), id_reserva: reservaId }) : `Reserva ${codigo}`);
  const ciudad = hab?.ciudad ?? hotelPaquete?.ciudad ?? null;
  const pais = hab?.pais ?? hotelPaquete?.pais ?? null;
  const imagen = resolveFotoUrl(hab?.imagen_hotel ?? (detalle as any)?.imagen_url ?? null);

  // Dinero
  const totalReserva = Number(detalle?.precio_total ?? 0);
  const totalPagado =
    detalle?.total_pagado != null
      ? Number(detalle.total_pagado)
      : (detalle?.pagos ?? []).filter((p) => p.estado === "pagado").reduce((acc, p) => acc + Number(p.monto ?? 0), 0);
  const saldo = Math.max(0, totalReserva - totalPagado);
  const porcentaje = totalReserva > 0 ? Math.min(100, Math.round((totalPagado / totalReserva) * 100)) : 0;

  // Tiempo
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const noches = detalle ? nights(detalle.fecha_inicio, detalle.fecha_fin) : 0;
  const estadoViaje = detalle ? getEstadoViaje(detalle.fecha_inicio, detalle.fecha_fin, hoy) : "futuro";
  const diasParaViaje = detalle
    ? Math.round((parseFechaLocal(detalle.fecha_inicio).getTime() - hoy.getTime()) / 86_400_000)
    : 0;
  const cancelada = detalle?.estado === "cancelada";
  const activa = detalle?.estado === "confirmada" || detalle?.estado === "pendiente";
  const debe = activa && saldo > 0;
  const puedeResenar = !!onDejarResena && estadoViaje === "finalizado" && !cancelada;
  const puedeCancelar =
    !!onSolicitarCancelacion && !cancelacionSolicitada && activa && estadoViaje === "futuro";

  const cuandoViaja = cancelada
    ? null
    : estadoViaje === "finalizado"
      ? "Viaje realizado"
      : estadoViaje === "en_curso"
        ? "Estás de viaje"
        : diasParaViaje === 0
          ? "Tu viaje es hoy"
          : diasParaViaje === 1
            ? "Tu viaje es mañana"
            : `Faltan ${diasParaViaje} días`;

  const direccionCompleta = [hab?.direccion, ciudad, pais].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [hab?.nombre_hotel ?? hotelPaquete?.nombre_hotel, direccionCompleta].filter(Boolean).join(" "),
  )}`;

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      toast.error("No se pudo copiar el código");
    }
  };
  const handleCompartir = async () => {
    if (!detalle) return;
    const r = await compartirReserva({ ...detalle, id_reserva: reservaId, hotel_nombre: hab?.nombre_hotel });
    if (r === "copiado") toast.success("Resumen de la reserva copiado");
    if (r === "error") toast.error("No se pudo compartir la reserva");
  };
  const agregarCalendario = () => {
    if (!detalle) return;
    descargarIcs({
      codigo,
      titulo: `Viaje: ${titulo}`,
      fechaInicio: detalle.fecha_inicio,
      fechaFin: detalle.fecha_fin,
      lugar: direccionCompleta || ciudad,
      descripcion: hab?.hora_checkin ? `Entrada desde las ${hhmm(hab.hora_checkin)}` : null,
    });
  };

  // ── "Lo que sigue": lo más útil para la persona en este momento ──
  const siguiente = (() => {
    if (!detalle) return null;
    if (cancelada)
      return {
        icono: History,
        titulo: "Esta reserva fue cancelada",
        texto: "Si quieres volver a viajar, te ayudamos a armar un plan nuevo.",
        acciones: [{ texto: "Explorar destinos", to: "/packages", primaria: true }],
      };
    if (debe)
      return {
        icono: Wallet,
        titulo: `Te falta pagar ${money(saldo)}`,
        texto: "Completa el pago antes del viaje para tenerlo todo listo.",
        acciones: [{ texto: totalPagado > 0 ? "Pagar saldo" : "Pagar reserva", to: `/pagar/${reservaId}`, primaria: true }],
      };
    if (estadoViaje === "finalizado")
      return {
        icono: Star,
        titulo: ciudad ? `¿Cómo te fue en ${ciudad}?` : "¿Cómo te fue en tu viaje?",
        texto: "Tu opinión ayuda a otros viajeros a decidir. Cuéntala con fotos en la comunidad.",
        acciones: [
          ...(puedeResenar ? [{ texto: "Dejar reseña", onClick: onDejarResena, primaria: true }] : []),
          { texto: "Contar mi viaje", to: "/comunidad", primaria: !puedeResenar },
        ],
      };
    if (estadoViaje === "en_curso" || estadoViaje === "hoy")
      return {
        icono: Sparkles,
        titulo: "¡Disfruta tu viaje!",
        texto: hab?.hora_checkout
          ? `La salida es el ${fechaLarga(detalle.fecha_fin)} hasta las ${hhmm(hab.hora_checkout)}. Si necesitas algo, tu asesor está a un mensaje.`
          : "Si necesitas algo durante el viaje, tu asesor está a un mensaje.",
        acciones: [
          ...(onHablarDeReserva ? [{ texto: "Escribir a mi asesor", onClick: onHablarDeReserva, primaria: true }] : []),
          ...(direccionCompleta ? [{ texto: "Cómo llegar", href: mapsUrl, primaria: !onHablarDeReserva }] : []),
        ],
      };
    return {
      icono: CheckCircle2,
      titulo: "Todo listo para tu viaje",
      texto: hab?.hora_checkin
        ? `Puedes llegar desde las ${hhmm(hab.hora_checkin)} del ${fechaLarga(detalle.fecha_inicio)}. Lleva tu documento de identidad.`
        : `Tu viaje empieza el ${fechaLarga(detalle.fecha_inicio)}. Lleva tu documento de identidad.`,
      acciones: [
        { texto: "Agregar al calendario", onClick: agregarCalendario, primaria: true },
        ...(direccionCompleta ? [{ texto: "Cómo llegar", href: mapsUrl, primaria: false }] : []),
      ],
    };
  })();

  const botonAccion = (a: { texto: string; to?: string; href?: string; onClick?: () => void; primaria?: boolean }) => {
    const cls = `inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
      a.primaria
        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:opacity-90"
        : "border border-border bg-card text-foreground hover:bg-muted"
    }`;
    if (a.to)
      return (
        <Link key={a.texto} to={a.to} onClick={onClose} className={cls}>
          {a.texto}
        </Link>
      );
    if (a.href)
      return (
        <a key={a.texto} href={a.href} target="_blank" rel="noopener noreferrer" className={cls}>
          {a.texto}
        </a>
      );
    return (
      <button key={a.texto} type="button" onClick={a.onClick} className={cls}>
        {a.texto}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <ModalOverlay onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalle-reserva"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className="relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-background text-foreground shadow-2xl sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl"
      >
        {/* ===== Portada ===== */}
        <header className="relative shrink-0 overflow-hidden bg-primary text-white">
          {imagen && (
            <img src={imagen} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
          <div className="relative flex items-center justify-between gap-2 p-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <IconoTipo className="h-3.5 w-3.5" /> {etiquetaTipo}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCompartir}
                disabled={!detalle}
                aria-label="Compartir reserva"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/25 disabled:opacity-40"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/25"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="relative px-5 pb-5 pt-10 sm:pt-16">
            <h3
              id="titulo-detalle-reserva"
              className="text-2xl leading-tight sm:text-3xl"
              style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}
            >
              {titulo}
            </h3>
            {(ciudad || hab?.nombre_tipo) && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
                <MapPin className="h-3.5 w-3.5" />
                {[ciudad, pais].filter(Boolean).join(", ")}
                {hab?.nombre_tipo && <span className="text-white/60">· Habitación {hab.nombre_tipo}</span>}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {config && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">
                  <config.icon className="h-3.5 w-3.5" />
                  {config.label}
                </span>
              )}
              {cuandoViaja && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                  <Clock className="h-3.5 w-3.5" /> {cuandoViaja}
                </span>
              )}
              <button
                type="button"
                onClick={copiarCodigo}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-mono text-xs font-semibold backdrop-blur transition hover:bg-white/25"
                aria-label={`Copiar el código de la reserva ${codigo}`}
              >
                {codigo} {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </header>

        {/* ===== Contenido ===== */}
        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {cargando ? (
            <div className="py-14 text-center">
              <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando tu reserva…</p>
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : detalle ? (
            <>
              {/* Lo que sigue */}
              {siguiente && (
                <section
                  className={`rounded-2xl p-4 ${
                    cancelada ? "bg-muted" : debe ? "border border-primary/30 bg-primary/[0.06]" : "bg-primary/[0.06]"
                  }`}
                  aria-label="Lo que sigue"
                >
                  <div className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <siguiente.icono className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{siguiente.titulo}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{siguiente.texto}</p>
                    </div>
                  </div>
                  {siguiente.acciones.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 sm:pl-[52px]">{siguiente.acciones.map(botonAccion)}</div>
                  )}
                </section>
              )}

              {/* Itinerario */}
              <section>
                <SectionTitle icon={CalendarPlus}>{tipo === "vuelo" ? "Tu viaje" : "Tu estadía"}</SectionTitle>
                <Tarjeta className="p-0">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{tipo === "vuelo" ? "Ida" : "Entrada"}</p>
                      <p className="text-2xl font-bold leading-tight tabular-nums">
                        {parseFechaLocal(detalle.fecha_inicio).getDate()}{" "}
                        <span className="text-base font-semibold">
                          {parseFechaLocal(detalle.fecha_inicio).toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
                        </span>
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {parseFechaLocal(detalle.fecha_inicio).toLocaleDateString("es-CO", { weekday: "long" })}
                      </p>
                      {hab?.hora_checkin && <p className="mt-1 text-xs font-medium">Desde las {hhmm(hab.hora_checkin)}</p>}
                    </div>
                    <div className="flex flex-col items-center px-1 text-center">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                        {tipo === "vuelo"
                          ? `${noches} ${noches === 1 ? "día" : "días"}`
                          : `${noches} ${noches === 1 ? "noche" : "noches"}`}
                      </span>
                      <span className="mt-2 h-px w-12 bg-border" aria-hidden="true" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{tipo === "vuelo" ? "Regreso" : "Salida"}</p>
                      <p className="text-2xl font-bold leading-tight tabular-nums">
                        {parseFechaLocal(detalle.fecha_fin).getDate()}{" "}
                        <span className="text-base font-semibold">
                          {parseFechaLocal(detalle.fecha_fin).toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
                        </span>
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {parseFechaLocal(detalle.fecha_fin).toLocaleDateString("es-CO", { weekday: "long" })}
                      </p>
                      {hab?.hora_checkout && <p className="mt-1 text-xs font-medium">Hasta las {hhmm(hab.hora_checkout)}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {detalle.adultos != null
                        ? [
                            `${detalle.adultos} ${detalle.adultos === 1 ? "adulto" : "adultos"}`,
                            detalle.ninos ? `${detalle.ninos} ${detalle.ninos === 1 ? "niño" : "niños"}` : null,
                            detalle.infantes ? `${detalle.infantes} ${detalle.infantes === 1 ? "bebé" : "bebés"}` : null,
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : `${detalle.numero_personas} ${detalle.numero_personas === 1 ? "viajero" : "viajeros"}`}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" /> Reservada el {fmt(detalle.fecha_reserva)}
                    </span>
                  </div>
                </Tarjeta>
              </section>

              {/* Alojamiento */}
              {(hab || hotelPaquete) && (
                <section>
                  <SectionTitle icon={BedDouble}>Dónde te quedas</SectionTitle>
                  <Tarjeta>
                    <div className="flex gap-3">
                      {hab?.imagen_hotel && (
                        <img
                          src={resolveFotoUrl(hab.imagen_hotel)}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-xl bg-muted object-cover"
                          onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{hab?.nombre_hotel ?? hotelPaquete?.nombre_hotel}</p>
                        {hab && (
                          <p className="text-sm text-muted-foreground">
                            {hab.nombre_tipo} · Habitación {hab.numero_habitacion}
                            {habitaciones.length > 1 ? ` y ${habitaciones.length - 1} más` : ""}
                          </p>
                        )}
                        {direccionCompleta && <p className="mt-1 text-xs text-muted-foreground">{direccionCompleta}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {direccionCompleta && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/70"
                        >
                          <Navigation className="h-3.5 w-3.5 text-primary" /> Cómo llegar
                        </a>
                      )}
                      {hab?.telefono && (
                        <a
                          href={`tel:${hab.telefono.replace(/\s/g, "")}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/70"
                        >
                          <Phone className="h-3.5 w-3.5 text-primary" /> Llamar al hotel
                        </a>
                      )}
                      {hab?.id_hotel && (
                        <Link
                          to={`/hotel/${hab.id_hotel}`}
                          onClick={onClose}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/70"
                        >
                          Ver el hotel <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                    {detalle.paquete?.descripcion && (
                      <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                        {detalle.paquete.descripcion}
                      </p>
                    )}
                  </Tarjeta>
                </section>
              )}

              {/* Pago */}
              {totalReserva > 0 && (
                <section>
                  <SectionTitle icon={CreditCard}>Pago</SectionTitle>
                  <Tarjeta>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Total de la reserva</p>
                        <p className="text-2xl font-extrabold tracking-tight">{money(totalReserva)}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          saldo > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                        }`}
                      >
                        {saldo > 0 ? `${porcentaje}% pagado` : "Pagada"}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${saldo > 0 ? "bg-primary" : "bg-success"}`}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Pagado</dt>
                        <dd className="font-semibold text-success">{money(totalPagado)}</dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-xs text-muted-foreground">Saldo</dt>
                        <dd className={`font-semibold ${saldo > 0 ? "text-warning" : "text-foreground"}`}>{money(saldo)}</dd>
                      </div>
                    </dl>
                    {hab && noches > 0 && (
                      <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                        Tarifa de la habitación: <b className="text-foreground">{money(hab.precio_noche)}</b> por noche ×{" "}
                        {`${noches} ${noches === 1 ? "noche" : "noches"}`}
                      </p>
                    )}

                    {(detalle.pagos?.length ?? 0) > 0 && (
                      <ul className="mt-3 space-y-2 border-t border-border pt-3">
                        {detalle.pagos!.map((p) => {
                          const e = ESTADO_PAGO[p.estado] ?? { texto: p.estado, clase: "bg-muted text-muted-foreground" };
                          return (
                            <li key={p.id_pago} className="flex items-center justify-between gap-3 text-sm">
                              <span className="min-w-0">
                                <span className="font-medium">{p.metodo_pago?.nombre_metodo ?? "Pago"}</span>
                                <span className="block text-xs text-muted-foreground">{fmt(p.fecha_pago)}</span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.clase}`}>{e.texto}</span>
                                <span className="font-semibold tabular-nums">{money(p.monto)}</span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {clienteData && !cancelada && (
                      <div className="mt-3 border-t border-border pt-3">
                        <ComprobantePDF compacto reservaId={reservaId} clienteData={clienteData} />
                      </div>
                    )}
                  </Tarjeta>
                </section>
              )}

              {/* Qué incluye */}
              {((detalle.conceptos?.length ?? 0) > 0 || servicios.length > 0) && (
                <section>
                  <SectionTitle icon={Sparkles}>Qué incluye</SectionTitle>
                  <ul className="divide-y divide-border rounded-2xl border border-border bg-card text-sm">
                    {(detalle.conceptos ?? []).map((c, i) => (
                      <li key={`c${i}`} className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span>
                          {c.descripcion}
                          {!c.incluido && c.cantidad > 1 && c.precio_unitario > 0 && (
                            <span className="block text-xs text-muted-foreground">
                              {c.cantidad} × {money(c.precio_unitario)}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-medium">
                          {c.incluido ? (
                            <span className="text-success">Incluido</span>
                          ) : c.tipo === "vuelo_cotizacion" ? (
                            "Por cotizar"
                          ) : (
                            money(c.subtotal)
                          )}
                        </span>
                      </li>
                    ))}
                    {servicios.map((s) => (
                      <li key={`s${s.id_servicio}`} className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span>
                          {s.nombre_servicio}
                          {(s.nombre_categoria || s.fecha_servicio) && (
                            <span className="block text-xs text-muted-foreground">
                              {[s.nombre_categoria, s.fecha_servicio ? fmt(s.fecha_servicio) : null].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                        {s.precio_acordado != null && <span className="shrink-0 font-medium">{money(s.precio_acordado)}</span>}
                      </li>
                    ))}
                  </ul>
                  {detalle.estado_vuelo === "cotizacion_pendiente" && (
                    <p className="mt-2 text-xs text-warning">El vuelo está por cotizar: la agencia te enviará la tarifa.</p>
                  )}
                </section>
              )}

              {/* Viajeros */}
              {(detalle.viajeros?.length ?? 0) > 0 && (
                <section>
                  <SectionTitle icon={Users}>Viajeros</SectionTitle>
                  <ul className="space-y-2">
                    {detalle.viajeros!.map((v) => (
                      <li key={v.id_viajero} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {`${v.nombres?.[0] ?? ""}${v.apellidos?.[0] ?? ""}`.toUpperCase()}
                        </span>
                        <span className="min-w-0 text-sm">
                          <span className="font-medium">
                            {v.nombres} {v.apellidos}
                          </span>
                          {v.es_titular && <span className="ml-1.5 text-xs text-primary">Titular</span>}
                          <span className="block text-xs text-muted-foreground">
                            {v.tipo === "adulto" ? "Adulto" : v.tipo === "nino" ? "Niño" : "Bebé"}
                            {v.numero_documento ? ` · ${v.tipo_documento ?? ""} ${v.numero_documento}` : ""}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {detalle.solicitudes_especiales && (
                <section>
                  <SectionTitle icon={PenSquare}>Lo que pediste</SectionTitle>
                  <p className="whitespace-pre-line rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    {detalle.solicitudes_especiales}
                  </p>
                </section>
              )}

              {/* Asesor */}
              {detalle.empleado && (
                <section>
                  <SectionTitle icon={MessageCircle}>Tu asesor</SectionTitle>
                  <Tarjeta className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {`${detalle.empleado.nombre?.[0] ?? ""}${detalle.empleado.apellido?.[0] ?? ""}`.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {detalle.empleado.nombre} {detalle.empleado.apellido}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[detalle.empleado.celular, detalle.empleado.correo_electronico].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Tarjeta>
                </section>
              )}

              {/* Políticas */}
              {hab?.politica_cancelacion && (
                <details className="group rounded-2xl border border-border bg-card px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Política de cancelación del hotel
                    </span>
                    <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                    {hab.politica_cancelacion}
                  </p>
                </details>
              )}

              {/* Historial */}
              {historial.length > 0 && (
                <section>
                  <SectionTitle icon={History}>Historial</SectionTitle>
                  <ol className="relative ml-2 space-y-3 border-l border-border pl-4">
                    {historial.map((h) => (
                      <li key={h.id_historial} className="relative text-sm">
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                        <p className="font-medium">
                          {HITO[h.estado_nuevo ?? ""] ?? "Actualización de la reserva"}
                          <span className="font-normal text-muted-foreground"> · {fmt(h.fecha_cambio)}</span>
                        </p>
                        {/* Las notas solo se muestran si las escribió una persona del equipo
                            (las automáticas traen detalles internos). */}
                        {h.comentarios && h.nombre_empleado && h.nombre_empleado !== "Sistema" && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {h.comentarios} — {h.nombre_empleado}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          ) : null}
        </div>

        {/* ===== Acciones fijas ===== */}
        {detalle && !cargando && (onHablarDeReserva || puedeCancelar) && (
          <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {onHablarDeReserva && (
              <button
                type="button"
                onClick={onHablarDeReserva}
                className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted sm:flex-none"
              >
                <MessageCircle className="h-4 w-4 text-primary" /> Hablar de esta reserva
              </button>
            )}
            {puedeCancelar && (
              <button
                type="button"
                onClick={onSolicitarCancelacion}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-destructive sm:ml-auto sm:text-sm"
              >
                Solicitar cancelación
              </button>
            )}
          </footer>
        )}
      </motion.div>
    </div>
  );
}
