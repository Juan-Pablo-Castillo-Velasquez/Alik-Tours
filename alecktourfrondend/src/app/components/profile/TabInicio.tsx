import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Heart,
  MapPin,
  MessageCircle,
  Moon,
  Plane,
  Receipt,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import { useFavoritos } from "../../context/FavoritosContext";
import { PaqueteResponse, paqueteService } from "../../services/paquete.service";
import { preferenciasService } from "../../services/preferencias.service";
import { getCityImage, getDefaultImage } from "../../utils/cityImages";
import { enlaceWhatsAppAgencia } from "../../utils/whatsapp";
import { resolveFotoUrl } from "../admin/types";
import { IconoWhatsApp } from "../BotonWhatsApp";
import StatusBadge from "../admin/ui/StatusBadge";
import { diasHasta, nombreReserva, pesos, proximasReservas } from "./perfilUtils";
import { fmt, nights } from "./TabReservas/utils";

interface Props {
  reservas: any[];
  clienteData: any;
  tienePreferencias: boolean;
  idCliente?: number | null;
  noLeidosMensajes: number;
  onIr: (tab: string) => void;
  onVerReserva: (id: number) => void;
  onHablarDeReserva: (id: number) => void;
}

function Bloque({ children, retraso = 0, className = "" }: { children: ReactNode; retraso?: number; className?: string }) {
  const reducir = useReducedMotion();
  return (
    <motion.section
      initial={reducir ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: retraso, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function Encabezado({ titulo, sub, accion }: { titulo: string; sub?: string; accion?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          {titulo}
        </h2>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
      {accion}
    </div>
  );
}

function ProximoViaje({
  reserva,
  otros,
  onVerReserva,
  onHablarDeReserva,
  onIr,
}: {
  reserva: any;
  otros: number;
  onVerReserva: (id: number) => void;
  onHablarDeReserva: (id: number) => void;
  onIr: (tab: string) => void;
}) {
  const dias = diasHasta(reserva.fecha_inicio);
  const enCurso = dias <= 0;
  const total = Number(reserva.precio_total ?? 0);
  const pagado = Number(reserva.total_pagado ?? 0);
  const saldo = Number(reserva.saldo_pendiente ?? 0);
  const pctPagado = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;
  const imagen = reserva.destino ? getCityImage(reserva.destino, { width: 900 }) : getDefaultImage({ width: 900 });

  return (
    <div className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg">
      <div className="grid md:grid-cols-5">
        <div className="relative h-48 overflow-hidden bg-muted md:col-span-2 md:h-auto">
          <img
            src={imagen}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)] px-3 py-1 text-xs font-bold text-[var(--gold-foreground)] shadow">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {dias > 1 ? `Faltan ${dias} días` : dias === 1 ? "¡Sales mañana!" : enCurso && dias === 0 ? "¡Es hoy!" : "Viaje en curso"}
            </span>
            {reserva.destino && (
              <p className="mt-2 flex items-center gap-1 text-sm font-medium text-white/90">
                <MapPin className="h-4 w-4" aria-hidden="true" /> {reserva.destino}
              </p>
            )}
          </div>
        </div>

        <div className="p-5 sm:p-6 md:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl font-bold leading-tight text-foreground sm:text-2xl" style={{ fontFamily: "'Fraunces', serif" }}>
                {nombreReserva(reserva)}
              </h3>
            </div>
            <StatusBadge status={reserva.estado} className="shrink-0" />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icono: Calendar, valor: fmt(reserva.fecha_inicio, { day: "numeric", month: "short" }), etiqueta: "Salida" },
              { icono: Moon, valor: String(nights(reserva.fecha_inicio, reserva.fecha_fin)), etiqueta: "Noches" },
              { icono: Users, valor: String(reserva.numero_personas), etiqueta: reserva.numero_personas === 1 ? "Viajero" : "Viajeros" },
            ].map(({ icono: Icono, valor, etiqueta }) => (
              <div key={etiqueta} className="rounded-xl bg-muted/60 px-3 py-2.5">
                <Icono className="h-4 w-4 text-primary" aria-hidden="true" />
                <p className="mt-1 text-sm font-bold text-foreground">{valor}</p>
                <p className="text-[11px] text-muted-foreground">{etiqueta}</p>
              </div>
            ))}
          </div>

          {total > 0 && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">
                  Pagado <b className="text-foreground">{pesos(pagado)}</b> de {pesos(total)}
                </span>
                <span className="font-semibold text-foreground">{pctPagado}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--gold)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${pctPagado}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {saldo > 0 && (
              <Link
                to={`/pagar/${reserva.id_reserva}`}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                {pagado > 0 ? `Pagar saldo de ${pesos(saldo)}` : `Pagar ${pesos(saldo)}`}
              </Link>
            )}
            <button
              type="button"
              onClick={() => onVerReserva(reserva.id_reserva)}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Ver detalle
            </button>
            <button
              type="button"
              onClick={() => onHablarDeReserva(reserva.id_reserva)}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary hover:underline"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Preguntar por este viaje
            </button>
          </div>
          {otros > 0 && (
            <button type="button" onClick={() => onIr("reservas")} className="mt-3 text-xs font-semibold text-muted-foreground hover:text-primary">
              Tienes {otros} viaje{otros === 1 ? "" : "s"} más programado{otros === 1 ? "" : "s"} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TabInicio({
  reservas,
  clienteData,
  tienePreferencias,
  idCliente,
  noLeidosMensajes,
  onIr,
  onVerReserva,
  onHablarDeReserva,
}: Props) {
  const { idsFavoritos } = useFavoritos();
  const proximas = proximasReservas(reservas);
  const proxima = proximas[0];

  // ---------- Pendientes reales ----------
  type Pendiente = { icono: typeof Wallet; texto: string; detalle: string; accion: string; ir: () => void; href?: string };
  const pendientes: Pendiente[] = [];
  for (const r of proximas) {
    const saldo = Number(r.saldo_pendiente ?? 0);
    if (saldo > 0) {
      pendientes.push({
        icono: Wallet,
        texto: `Completa el pago de ${nombreReserva(r)}`,
        detalle: `Saldo pendiente ${pesos(saldo)} · sale el ${fmt(r.fecha_inicio, { day: "numeric", month: "long" })}`,
        accion: "Pagar",
        ir: () => {},
        href: `/pagar/${r.id_reserva}`,
      });
    }
  }
  if (noLeidosMensajes > 0) {
    pendientes.push({
      icono: MessageCircle,
      texto: `Tienes ${noLeidosMensajes} mensaje${noLeidosMensajes === 1 ? "" : "s"} nuevo${noLeidosMensajes === 1 ? "" : "s"}`,
      detalle: "Respuestas de tu asesor de Alik Tours",
      accion: "Leer",
      ir: () => onIr("mensajes"),
    });
  }
  const faltanDatos = clienteData && (!clienteData.celular || !clienteData.ciudad || !clienteData.fecha_nacimiento);
  if (faltanDatos) {
    pendientes.push({
      icono: UserRound,
      texto: "Completa tus datos personales",
      detalle: "Teléfono, ciudad y fecha de nacimiento agilizan tus reservas",
      accion: "Completar",
      ir: () => onIr("cuenta"),
    });
  }
  if (!tienePreferencias) {
    pendientes.push({
      icono: SlidersHorizontal,
      texto: "Cuéntanos qué tipo de viajes te gustan",
      detalle: "Así te recomendamos destinos a tu medida",
      accion: "Empezar",
      ir: () => onIr("preferencias"),
    });
  }

  // ---------- Recomendaciones (catálogo real) ----------
  const [recomendados, setRecomendados] = useState<PaqueteResponse[] | null>(null);
  useEffect(() => {
    let vigente = true;
    const reservados = new Set(reservas.map((r) => r.id_paquete).filter(Boolean));
    Promise.all([
      paqueteService.getAll(0, 24).catch(() => [] as PaqueteResponse[]),
      tienePreferencias && idCliente ? preferenciasService.getSugerencias(idCliente, 6).catch(() => []) : Promise.resolve([]),
    ]).then(([paquetes, sugeridos]) => {
      if (!vigente) return;
      const activos = paquetes.filter((p) => p.activo && !reservados.has(p.id_paquete));
      const orden = new Map(sugeridos.map((s, i) => [s.id_paquete, i]));
      activos.sort((a, b) => (orden.get(a.id_paquete) ?? 99) - (orden.get(b.id_paquete) ?? 99));
      setRecomendados(activos.slice(0, 3));
    });
    return () => {
      vigente = false;
    };
  }, [idCliente, tienePreferencias, reservas]);

  const accesos = [
    { icono: Calendar, titulo: "Mis reservas", sub: `${reservas.length} en total`, tab: "reservas" },
    { icono: Receipt, titulo: "Comprobantes", sub: "Pagos y facturas", tab: "facturas" },
    { icono: Heart, titulo: "Favoritos", sub: `${idsFavoritos.size} guardado${idsFavoritos.size === 1 ? "" : "s"}`, tab: "favoritos" },
    { icono: Wallet, titulo: "Métodos de pago", sub: "Tus medios guardados", tab: "metodos-pago" },
  ];

  return (
    <div className="space-y-8">
      {/* Próximo viaje */}
      <Bloque>
        {proxima ? (
          <ProximoViaje
            reserva={proxima}
            otros={proximas.length - 1}
            onVerReserva={onVerReserva}
            onHablarDeReserva={onHablarDeReserva}
            onIr={onIr}
          />
        ) : (
          <div className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground sm:p-8">
            <Plane className="absolute -bottom-6 -right-4 h-40 w-40 -rotate-12 text-white/10" aria-hidden="true" />
            <h3 className="text-2xl font-bold sm:text-3xl" style={{ fontFamily: "'Fraunces', serif" }}>
              ¿A dónde te gustaría ir?
            </h3>
            <p className="relative mt-2 max-w-md text-sm text-primary-foreground/80">
              Todavía no tienes viajes programados. Mira los paquetes con vuelo y hotel incluidos o pídele ideas a un asesor.
            </p>
            <div className="relative mt-5 flex flex-wrap gap-2">
              <Link
                to="/packages"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-primary transition-transform hover:-translate-y-0.5"
              >
                Ver paquetes <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/como-reservar"
                className="inline-flex items-center gap-2 rounded-xl border border-white/35 px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-white/10"
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" /> Cómo reservar
              </Link>
            </div>
          </div>
        )}
      </Bloque>

      <div className="grid gap-6 xl:grid-cols-5">
        {/* Pendientes */}
        <Bloque retraso={0.06} className="xl:col-span-3">
          <Encabezado titulo="Lo que tienes pendiente" />
          {pendientes.length === 0 ? (
            <p className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-4 text-sm font-medium text-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" /> ¡Todo al día! No tienes nada pendiente.
            </p>
          ) : (
            <ul className="space-y-2">
              {pendientes.map((p) => {
                const contenido = (
                  <>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <p.icono className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{p.texto}</span>
                      <span className="block text-xs text-muted-foreground">{p.detalle}</span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      {p.accion}
                    </span>
                  </>
                );
                const clases = "group flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-shadow hover:shadow-md";
                return (
                  <li key={p.texto}>
                    {p.href ? (
                      <Link to={p.href} className={clases}>
                        {contenido}
                      </Link>
                    ) : (
                      <button type="button" onClick={p.ir} className={clases}>
                        {contenido}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Bloque>

        {/* Accesos */}
        <Bloque retraso={0.1} className="xl:col-span-2">
          <Encabezado titulo="Accesos rápidos" />
          <div className="grid grid-cols-2 gap-2">
            {accesos.map(({ icono: Icono, titulo, sub, tab }) => (
              <button
                key={tab}
                type="button"
                onClick={() => onIr(tab)}
                className="group rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-3 block text-sm font-semibold text-foreground">{titulo}</span>
                <span className="block text-xs text-muted-foreground">{sub}</span>
              </button>
            ))}
          </div>
        </Bloque>
      </div>

      {/* Recomendados */}
      <Bloque retraso={0.14}>
        <Encabezado
          titulo="Viajes que te pueden gustar"
          sub={tienePreferencias ? "Elegidos según tus preferencias" : "Paquetes con vuelo y hotel incluidos"}
          accion={
            <Link to="/packages" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex">
              Ver todos <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          }
        />
        {recomendados === null ? (
          <div className="grid gap-4 sm:grid-cols-3" aria-label="Cargando recomendaciones">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : recomendados.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Pronto tendremos nuevos paquetes para ti.
          </p>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
            {recomendados.map((p) => {
              const ciudad = p.destino_ciudad ?? p.ciudad_destino ?? null;
              const img = resolveFotoUrl(p.imagen_url) ?? (ciudad ? getCityImage(ciudad, { width: 600 }) : getDefaultImage({ width: 600 }));
              return (
                <Link
                  key={p.id_paquete}
                  to={`/package/${p.id_paquete}`}
                  className="group w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg sm:w-auto"
                >
                  <div className="relative h-36 overflow-hidden bg-muted">
                    <img loading="lazy" decoding="async" src={img} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      {p.duracion_dias} día{p.duracion_dias === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-1 font-semibold text-foreground group-hover:text-primary">{p.nombre_paquete}</p>
                    {ciudad && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {ciudad}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Desde <b className="text-base text-foreground">{pesos(Number(p.precio_base))}</b>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Bloque>

      {/* Ayuda */}
      <Bloque retraso={0.18}>
        <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-primary/10 via-card to-[var(--gold)]/10 p-5 ring-1 ring-border sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-foreground">¿Necesitas ayuda con tu viaje?</p>
              <p className="text-sm text-muted-foreground">Un asesor te acompaña antes, durante y después del viaje.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={enlaceWhatsAppAgencia()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              <IconoWhatsApp className="h-4 w-4" /> WhatsApp
            </a>
            <Link to="/como-reservar" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
              <BookOpen className="h-4 w-4" aria-hidden="true" /> Guía de reserva
            </Link>
          </div>
        </div>
      </Bloque>
    </div>
  );
}
