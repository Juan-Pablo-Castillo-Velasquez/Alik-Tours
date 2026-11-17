import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  IdCard,
  Mail,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router";
import Footer from "../components/Footer";
import { PASOS_RESERVA } from "../components/GuiaUso";
import Navbar from "../components/Navbar";
import ScrollToTopButton from "../components/ScrollToTopButton";
import AdornoTarjeta from "../components/temporada/AdornoTarjeta";
import { useSeoMeta } from "../hooks/useSeoMeta";

// Guía paso a paso de cómo reservar. Los pasos son los MISMOS del panel
// "¿Cómo funciona?" (GuiaUso.tsx, PASOS_RESERVA): una sola fuente, así la
// guía nunca contradice lo que muestra el panel flotante.

const ANTES_DE_EMPEZAR = [
  { icono: Mail, titulo: "Un correo al que tengas acceso", texto: "Te enviamos un código para confirmar la cuenta y ahí llegan los avisos de tu reserva." },
  { icono: IdCard, titulo: "Documento de cada viajero", texto: "Nombre y número tal como salen en la cédula o el pasaporte. Para viajes internacionales, revisa la vigencia del pasaporte." },
  { icono: Smartphone, titulo: "Un medio de pago a mano", texto: "Nequi o PayPal para pagar en línea, o eliges pagar con un asesor y él te indica cómo." },
];

const ESTADOS = [
  { icono: Clock, nombre: "Pendiente", texto: "La reserva está creada y guarda tus cupos mientras completas el pago.", color: "text-amber-600 bg-amber-500/10" },
  { icono: BadgeCheck, nombre: "Confirmada", texto: "El pago quedó registrado. Te llega un correo y ya puedes descargar tus comprobantes.", color: "text-emerald-600 bg-emerald-500/10" },
  { icono: CheckCircle2, nombre: "Finalizada", texto: "Terminó el viaje. Es el momento de dejar tu reseña y compartir fotos en la Comunidad.", color: "text-sky-600 bg-sky-500/10" },
  { icono: XCircle, nombre: "Cancelada", texto: "La reserva quedó anulada, por ejemplo cuando un asesor aprueba tu solicitud de cancelación según las condiciones del producto.", color: "text-rose-600 bg-rose-500/10" },
];

const CONSEJOS = [
  "Reserva con tiempo en temporada alta (diciembre, enero, Semana Santa y mitad de año): los cupos se agotan primero.",
  "Revisa qué incluye y qué no incluye cada paquete antes de confirmar.",
  "Si viajan niños o infantes, indícalo: el precio y los cupos cambian.",
  "Puedes abonar una parte y completar el saldo después desde Mis Reservas.",
  "Guarda tus favoritos con el corazón para compararlos con calma.",
];

export default function ComoReservar() {
  useSeoMeta({
    title: "Cómo reservar paso a paso",
    description:
      "Guía para reservar en Alik Tours: crea tu cuenta, elige hotel, paquete o vuelo, confirma y paga en línea o con un asesor.",
    path: "/como-reservar",
  });
  const sinMovimiento = useReducedMotion();
  const aparecer = (retraso = 0) =>
    sinMovimiento
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-60px" },
          transition: { duration: 0.5, delay: retraso, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-clip">
      <Navbar />

      {/* Cabecera */}
      <header className="group relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[color-mix(in_oklab,var(--primary)_70%,black)] text-primary-foreground">
        <AdornoTarjeta tamano="lg" coposSiempre />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pb-20 sm:pt-24">
          <motion.p {...aparecer()} className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-surface)]">
            Guía de reserva
          </motion.p>
          <motion.h1
            {...aparecer(0.05)}
            className="text-4xl font-bold leading-tight sm:text-5xl text-balance"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Reserva tu viaje en {PASOS_RESERVA.length} pasos
          </motion.h1>
          <motion.p {...aparecer(0.1)} className="mx-auto mt-4 max-w-2xl text-base text-primary-foreground/85 sm:text-lg">
            Desde crear tu cuenta hasta tener tus comprobantes en la mano. Si en algún paso te enredas, un asesor te
            acompaña por chat o WhatsApp.
          </motion.p>
          <motion.nav {...aparecer(0.15)} aria-label="Pasos de la guía" className="mt-8 flex flex-wrap justify-center gap-2">
            {PASOS_RESERVA.map((p, i) => (
              <a
                key={p.titulo}
                href={`#paso-${i + 1}`}
                className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                {i + 1}. {p.titulo}
              </a>
            ))}
          </motion.nav>
        </div>
      </header>

      {/* Antes de empezar */}
      <section className="relative z-10 mx-auto -mt-8 max-w-5xl px-4 sm:px-6">
        <motion.div {...aparecer()} className="grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-lg sm:grid-cols-3 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-primary sm:col-span-3">Antes de empezar, ten a mano</p>
          {ANTES_DE_EMPEZAR.map(({ icono: Icono, titulo, texto }) => (
            <div key={titulo} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icono className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">{titulo}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{texto}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Pasos */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <ol className="relative">
          <span className="absolute bottom-6 left-6 top-6 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent sm:left-7" aria-hidden="true" />
          {PASOS_RESERVA.map((paso, i) => {
            const Icono = paso.icono;
            return (
              <motion.li
                key={paso.titulo}
                id={`paso-${i + 1}`}
                {...aparecer(0.03)}
                className="relative scroll-mt-28 pb-10 pl-16 last:pb-0 sm:pl-20"
              >
                <span className="absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 sm:h-14 sm:w-14">
                  <Icono className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                </span>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Paso {i + 1}</p>
                  <h2 className="mt-1 text-xl font-bold sm:text-2xl" style={{ fontFamily: "'Fraunces', serif" }}>
                    {paso.titulo}
                  </h2>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{paso.texto}</p>
                  {paso.enlace && (
                    <Link
                      to={paso.enlace.to}
                      state={paso.enlace.state}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      {paso.enlace.texto}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>
      </section>

      {/* Estados de la reserva */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <motion.h2 {...aparecer()} className="text-2xl font-bold sm:text-3xl" style={{ fontFamily: "'Fraunces', serif" }}>
            ¿Qué significa el estado de tu reserva?
          </motion.h2>
          <p className="mt-2 text-muted-foreground">Lo ves en tu perfil, en Mis Reservas, y te avisamos por correo cada vez que cambia.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ESTADOS.map(({ icono: Icono, nombre, texto, color }, i) => (
              <motion.div key={nombre} {...aparecer(i * 0.06)} className="rounded-2xl border border-border bg-card p-5">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>
                  <Icono className="h-3.5 w-3.5" aria-hidden="true" />
                  {nombre}
                </span>
                <p className="mt-3 text-sm text-muted-foreground">{texto}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Consejos + ayuda */}
      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-5">
        <motion.div {...aparecer()} className="rounded-2xl border border-border bg-card p-6 lg:col-span-3">
          <h2 className="flex items-center gap-2 text-xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Consejos para reservar sin contratiempos
          </h2>
          <ul className="mt-4 space-y-3">
            {CONSEJOS.map((c) => (
              <li key={c} className="flex gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {c}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          {...aparecer(0.08)}
          className="flex flex-col justify-between gap-6 rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[color-mix(in_oklab,var(--gold)_75%,black)] p-6 text-[var(--gold-foreground)] lg:col-span-2"
        >
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>
              ¿Listo para tu próximo viaje?
            </h2>
            <p className="mt-2 text-sm opacity-90">Mira los paquetes disponibles o pregúntale a un asesor lo que necesites.</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <Link
              to="/packages"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--gold-foreground)] px-5 py-3 text-sm font-bold text-[var(--gold)] transition-transform hover:-translate-y-0.5"
            >
              Ver paquetes
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/faq"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-current/30 px-3 py-2.5 text-sm font-semibold hover:bg-black/5"
              >
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
                Preguntas
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-current/30 px-3 py-2.5 text-sm font-semibold hover:bg-black/5"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Contacto
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Cada producto tiene sus propias condiciones de cambio y cancelación; las ves en su ficha antes de confirmar y en los{" "}
          <Link to="/terms" className="underline hover:text-foreground">
            términos y condiciones
          </Link>
          .
        </p>
      </section>

      <Footer />
      <ScrollToTopButton />
    </div>
  );
}
