import {
  Building2,
  CreditCard,
  HeadphonesIcon,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { motion } from "motion/react";

const perks = [
  {
    icon: CreditCard,
    title: "Paga en cuotas, sin intereses",
    desc: "Hasta 12 cuotas con tu tarjeta. El plan que mejor se acomode a tu bolsillo, no al revés.",
  },
  {
    icon: HeadphonesIcon,
    title: "Asesoría humana, siempre",
    desc: "Un asesor Alik Tours te acompaña antes, durante y después del viaje. Sin bots que no resuelven.",
  },
  {
    icon: ShieldCheck,
    title: "Compra protegida",
    desc: "Cambios, cancelaciones y reembolsos claros desde el primer momento. Sin letra pequeña.",
  },
];

// Métodos de pago realmente aceptados (mismo dato ya publicado en
// TravelInfo.tsx y faq.tsx) — se muestran como texto/insignia, no como
// logos de marca, para no reproducir marcas registradas de terceros.
const metodosPago = [
  { icon: CreditCard, label: "Visa" },
  { icon: CreditCard, label: "Mastercard" },
  { icon: CreditCard, label: "American Express" },
  { icon: Building2, label: "PSE / Transferencia" },
];

export default function Benefits() {
  return (
    // Antes esta franja era un bloque plano bg-muted/30 sin acento propio:
    // al lado del Hero (foto oscura, con textura) se sentía como un vacío
    // en blanco. El degradado superior suaviza la transición y las tarjetas
    // con borde le dan al contenido su propio espacio en vez de flotar
    // sobre el fondo — todo sigue usando los tokens del theme, así que
    // funciona igual en modo claro y oscuro.
    <section className="relative bg-background transition-colors duration-300 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/[0.07] to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="h-px w-8 bg-[var(--chart-2)]" />
            <span className="text-primary text-xs font-bold uppercase tracking-[0.2em]">
              Beneficios Alik Tours
            </span>
            <span className="h-px w-8 bg-[var(--chart-2)]" />
          </div>
          <h2
            className="text-3xl md:text-4xl text-foreground font-medium"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Viajar seguro, pagar <span className="text-primary italic">fácil</span>.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {perks.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-start bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div
                className="
                                    w-14 h-14 
                                    rounded-2xl 
                                    flex items-center justify-center 
                                    mb-5
                                    bg-gradient-to-br from-primary to-primary/80
                                    shadow-lg shadow-primary/30
                                "
              >
                <p.icon className="w-6 h-6 text-primary-foreground" strokeWidth={1.75} />
              </div>

              <h3 className="text-foreground font-semibold text-lg mb-2">
                {p.title}
              </h3>

              <p className="text-muted-foreground leading-relaxed text-[15px]">
                {p.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* MÉTODOS DE PAGO — información comercial real (Visa/Mastercard/Amex/PSE
            ya son los métodos que el sitio publica en Info de viaje y Preguntas
            frecuentes), no una lista inventada. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Métodos de pago aceptados</p>
              <p className="text-xs text-muted-foreground">Paga en 1 sola cuota o hasta en 12, sin intereses.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {metodosPago.map((m) => (
              <span
                key={m.label}
                className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground/80"
              >
                <m.icon className="w-3.5 h-3.5 text-primary" />
                {m.label}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
