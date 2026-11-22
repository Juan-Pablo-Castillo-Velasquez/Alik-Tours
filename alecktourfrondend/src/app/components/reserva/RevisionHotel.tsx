import { BedDouble, CalendarDays, CreditCard, Mail, MapPin, Moon, Pencil, Phone, ShieldCheck, Star, UserRound, Users } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { resolveFotoUrl } from "../admin/types";

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

function partesFecha(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return {
    dia: d.toLocaleDateString("es-CO", { day: "2-digit" }),
    mes: d.toLocaleDateString("es-CO", { month: "short" }).replace(".", ""),
    semana: d.toLocaleDateString("es-CO", { weekday: "long" }),
    anio: d.getFullYear(),
  };
}

function Bloque({
  titulo,
  icono: Icono,
  onEditar,
  children,
  indice,
}: {
  titulo: string;
  icono: typeof BedDouble;
  onEditar?: () => void;
  children: ReactNode;
  indice: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * indice, duration: 0.25 }}
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icono className="h-4 w-4" />
          </span>
          {titulo}
        </h3>
        {onEditar && (
          <button
            type="button"
            onClick={onEditar}
            aria-label={`Editar ${titulo.toLowerCase()}`}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <Pencil className="h-3 w-3" /> Editar
          </button>
        )}
      </div>
      {children}
    </motion.div>
  );
}

interface Props {
  hotel: {
    nombre_hotel: string;
    ciudad?: string | null;
    pais?: string | null;
    imagen_url?: string | null;
    calificacion?: number | null;
    direccion?: string | null;
    telefono?: string | null;
    correo_electronico?: string | null;
  };
  habitacion: { numero_habitacion?: string | number | null; tipo_habitacion?: { nombre_tipo?: string | null } | null };
  fechaInicio: string;
  fechaFin: string;
  noches: number;
  adultos: number;
  ninos: number;
  viajero: { nombres: string; apellidos: string; cedula: string; correo: string; celular: string; ciudad: string };
  precioNoche: number;
  total: number;
  aPagar: number;
  modalidad: "full" | "partial" | string;
  metodo?: string | null;
  onEditar: (paso: 1 | 2 | 4) => void;
}

/** Paso 3 del checkout de hotel: la reserva como un "pase" de viaje, con
 * fechas grandes, el viajero y el desglose del precio. */
export default function RevisionHotel({
  hotel,
  habitacion,
  fechaInicio,
  fechaFin,
  noches,
  adultos,
  ninos,
  viajero,
  precioNoche,
  total,
  aPagar,
  modalidad,
  metodo,
  onEditar,
}: Props) {
  const entrada = partesFecha(fechaInicio);
  const salida = partesFecha(fechaFin);
  const iniciales = `${viajero.nombres.trim()[0] ?? ""}${viajero.apellidos.trim()[0] ?? ""}`.toUpperCase() || "?";
  const contacto = [
    hotel.direccion && { icono: MapPin, texto: hotel.direccion },
    hotel.telefono && { icono: Phone, texto: hotel.telefono, href: `tel:${hotel.telefono}` },
    hotel.correo_electronico && { icono: Mail, texto: hotel.correo_electronico, href: `mailto:${hotel.correo_electronico}` },
  ].filter(Boolean) as { icono: typeof MapPin; texto: string; href?: string }[];
  const tipoHabitacion = habitacion.tipo_habitacion?.nombre_tipo ?? "Habitación";
  const huespedes = `${adultos} ${adultos === 1 ? "adulto" : "adultos"}${ninos ? `, ${ninos} ${ninos === 1 ? "niño" : "niños"}` : ""}`;

  return (
    <div className="space-y-4">
      {/* Pase de la estadía */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-md"
      >
        <div className="relative flex items-end gap-4 bg-gradient-to-br from-primary to-[#3b1728] p-5 text-white">
          {hotel.imagen_url && (
            <img src={resolveFotoUrl(hotel.imagen_url)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />
          <div className="relative min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">Tu estadía</p>
            <p className="mt-0.5 truncate text-xl font-extrabold">{hotel.nombre_hotel}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/85">
              {(hotel.ciudad || hotel.pais) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {[hotel.ciudad, hotel.pais].filter(Boolean).join(", ")}
                </span>
              )}
              {!!hotel.calificacion && (
                <span className="inline-flex items-center gap-0.5" aria-label={`${hotel.calificacion} estrellas`}>
                  {Array.from({ length: Math.min(5, Math.round(hotel.calificacion)) }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-[var(--gold)] text-[var(--gold)]" />
                  ))}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onEditar(2)}
            className="relative inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold backdrop-blur transition hover:bg-white/25"
          >
            <Pencil className="h-3 w-3" /> Cambiar fechas
          </button>
        </div>

        {/* Entrada → salida, como un tiquete */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Entrada</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold leading-none text-foreground">{entrada.dia}</span>
              <span className="text-sm font-semibold capitalize text-foreground">{entrada.mes}</span>
            </p>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">
              {entrada.semana} · {entrada.anio}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 px-2 text-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              <Moon className="h-3.5 w-3.5" /> {noches} {noches === 1 ? "noche" : "noches"}
            </span>
            <span className="h-px w-16 border-t border-dashed border-border sm:w-24" aria-hidden />
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Salida</p>
            <p className="mt-1 flex items-baseline justify-end gap-1.5">
              <span className="text-3xl font-extrabold leading-none text-foreground">{salida.dia}</span>
              <span className="text-sm font-semibold capitalize text-foreground">{salida.mes}</span>
            </p>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">
              {salida.semana} · {salida.anio}
            </p>
          </div>
        </div>

        <div className="relative border-t border-dashed border-border px-5 py-3">
          <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full border border-border bg-background" aria-hidden />
          <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full border border-border bg-background" aria-hidden />
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 font-medium">
              <BedDouble className="h-3.5 w-3.5 text-primary" /> {tipoHabitacion}
              {habitacion.numero_habitacion ? ` · #${habitacion.numero_habitacion}` : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 font-medium">
              <Users className="h-3.5 w-3.5 text-primary" /> {huespedes}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 font-medium">
              <CalendarDays className="h-3.5 w-3.5 text-primary" /> {pesos(precioNoche)} por noche
            </span>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        <Bloque titulo="Viajero principal" icono={UserRound} onEditar={() => onEditar(1)} indice={1}>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--gold)] text-base font-bold text-white">
              {iniciales}
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold capitalize text-foreground">
                {viajero.nombres} {viajero.apellidos}
              </p>
              <p className="text-xs text-muted-foreground">C.C. {viajero.cedula}</p>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            <li className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0 text-primary" /> <span className="truncate text-foreground">{viajero.correo}</span>
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0 text-primary" /> <span className="text-foreground">{viajero.celular}</span>
            </li>
            {viajero.ciudad && (
              <li className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" /> <span className="text-foreground">{viajero.ciudad}</span>
              </li>
            )}
          </ul>
        </Bloque>

        <Bloque titulo="Contacto del hotel" icono={Phone} indice={2}>
          {contacto.length ? (
            <ul className="space-y-2 text-xs">
              {contacto.map(({ icono: I, texto, href }) => (
                <li key={texto} className="flex items-start gap-2">
                  <I className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {href ? (
                    <a href={href} className="break-all text-foreground hover:text-primary hover:underline">
                      {texto}
                    </a>
                  ) : (
                    <span className="text-foreground">{texto}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Un asesor te confirma los datos de contacto del hotel con tu reserva.</p>
          )}
          {contacto.length > 0 && contacto.length < 3 && (
            <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
              Los demás datos de contacto te los confirma tu asesor.
            </p>
          )}
        </Bloque>
      </div>

      {/* Desglose del precio */}
      <Bloque titulo="Precio y pago" icono={CreditCard} onEditar={() => onEditar(4)} indice={3}>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>
              {pesos(precioNoche)} × {noches} {noches === 1 ? "noche" : "noches"}
            </dt>
            <dd className="text-foreground">{pesos(total)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>Modalidad</dt>
            <dd className="font-medium text-foreground">{modalidad === "full" ? "Pago completo" : "Anticipo del 50 %"}</dd>
          </div>
          {metodo && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Método</dt>
              <dd className="font-medium text-foreground">{metodo}</dd>
            </div>
          )}
        </dl>
        <div className="mt-3 flex items-end justify-between rounded-xl bg-primary/5 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{modalidad === "full" ? "Total a pagar" : "Pagas ahora"}</p>
            {modalidad !== "full" && <p className="text-[11px] text-muted-foreground">El saldo ({pesos(total - aPagar)}) lo pagas después desde Mis reservas</p>}
          </div>
          <p className="text-2xl font-extrabold text-primary">{pesos(aPagar)}</p>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" /> El precio lo calcula el sistema con la tarifa vigente de la habitación.
        </p>
      </Bloque>
    </div>
  );
}
