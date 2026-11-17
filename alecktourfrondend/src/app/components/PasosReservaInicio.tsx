import { ArrowRight, CalendarCheck, CreditCard, Search, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router";

// Franja del inicio con el proceso de reserva resumido en 4 pasos y un
// enlace a la guía completa (/como-reservar).
const PASOS = [
  { icono: Search, titulo: "Elige tu plan", texto: "Hotel, paquete o vuelo, con fotos y condiciones claras." },
  { icono: CalendarCheck, titulo: "Fechas y viajeros", texto: "Escoge la salida y llena los datos de cada viajero." },
  { icono: CreditCard, titulo: "Confirma y paga", texto: "Nequi, PayPal o con un asesor. Puedes abonar." },
  { icono: Sparkles, titulo: "Viaja tranquilo", texto: "Comprobantes en tu perfil y un asesor por chat." },
];

export default function PasosReservaInicio() {
  const sinMovimiento = useReducedMotion();
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" aria-labelledby="titulo-pasos-reserva">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Reserva en minutos</p>
            <h2
              id="titulo-pasos-reserva"
              className="mt-1 text-2xl font-bold sm:text-3xl"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Así de fácil es reservar
            </h2>
          </div>
          <Link
            to="/como-reservar"
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
          >
            Ver la guía paso a paso
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </div>

        <ol className="relative mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
            <motion.li
              key={titulo}
              initial={sinMovimiento ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex gap-4 lg:flex-col"
            >
              {/* Conector entre pasos en escritorio */}
              {i < PASOS.length - 1 && (
                <span
                  className="absolute left-14 right-0 top-6 hidden h-px bg-gradient-to-r from-primary/40 to-transparent lg:block"
                  aria-hidden="true"
                />
              )}
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Icono className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--gold)] text-[10px] font-bold text-[var(--gold-foreground)]">
                  {i + 1}
                </span>
              </span>
              <div>
                <h3 className="font-semibold">{titulo}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
