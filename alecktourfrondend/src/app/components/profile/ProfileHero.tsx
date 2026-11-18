import { BadgeCheck, Compass, MessageCircle, ShieldAlert } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router";
import { resolveFotoUrl } from "../admin/types";
import AdornoTarjeta from "../temporada/AdornoTarjeta";
import { pesos, proximasReservas, saldoPorPagar } from "./perfilUtils";

interface Props {
  usuario: any;
  clienteData: any;
  reservas: any[];
  bloqueado?: boolean;
  onIr: (tab: string) => void;
}

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

// Cabecera del perfil del cliente: quién es, cuánto ha viajado con la
// agencia y qué tiene pendiente, con las dos acciones más útiles a mano.
export default function ProfileHero({ usuario, clienteData, reservas, bloqueado = false, onIr }: Props) {
  const reducir = useReducedMotion();
  const nombre = clienteData?.nombre ?? usuario?.username ?? "viajero";
  const nombreCompleto = clienteData ? `${clienteData.nombre} ${clienteData.apellido}` : usuario?.username;
  const iniciales = (nombreCompleto ?? "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join("");
  const desde = clienteData?.fecha_registro
    ? new Date(clienteData.fecha_registro).toLocaleDateString("es-CO", { month: "long", year: "numeric" })
    : null;
  const verificado = usuario?.verificado !== false;
  const fotoVisible = usuario?.foto_perfil && verificado;

  const viajes = reservas.filter((r) => r.estado === "finalizada").length;
  const proximos = proximasReservas(reservas).length;
  const saldo = saldoPorPagar(reservas);

  const datos = [
    { valor: String(viajes), etiqueta: viajes === 1 ? "Viaje realizado" : "Viajes realizados", ir: "reservas" },
    { valor: String(proximos), etiqueta: proximos === 1 ? "Viaje próximo" : "Viajes próximos", ir: "reservas" },
    { valor: saldo > 0 ? pesos(saldo) : "$0", etiqueta: "Saldo por pagar", ir: "reservas" },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-[color-mix(in_oklab,var(--primary)_85%,black)] to-[color-mix(in_oklab,var(--primary)_55%,black)] text-primary-foreground">
      <div className="group absolute inset-0">
        <AdornoTarjeta tamano="lg" />
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-[var(--gold)]/25 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-8 pt-8 sm:pt-10 lg:flex-row lg:items-end lg:justify-between">
        <motion.div
          initial={reducir ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-4 sm:gap-5"
        >
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white/15 text-xl font-bold ring-4 ring-white/25 sm:h-20 sm:w-20 sm:text-2xl">
              {fotoVisible ? (
                <img src={resolveFotoUrl(usuario.foto_perfil)} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                iniciales
              )}
            </div>
            {verificado && (
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--gold-foreground)] ring-2 ring-[color-mix(in_oklab,var(--primary)_80%,black)]" title="Cuenta verificada">
                <BadgeCheck className="h-4 w-4" aria-label="Cuenta verificada" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{saludo()}</p>
            <h1 className="truncate text-2xl font-bold sm:text-3xl" style={{ fontFamily: "'Fraunces', serif" }}>
              ¡Hola, {nombre}!
            </h1>
            <p className="mt-0.5 text-sm text-white/80">
              {desde ? `Viajas con Alik Tours desde ${desde}` : `@${usuario?.username ?? "viajero"}`}
            </p>
            {!verificado && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-100">
                <ShieldAlert className="h-3.5 w-3.5" /> Verifica tu correo para activar tu cuenta
              </p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={reducir ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-3 lg:items-end"
        >
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {datos.map((d) => (
              <button
                key={d.etiqueta}
                type="button"
                onClick={() => !bloqueado && onIr(d.ir)}
                disabled={bloqueado}
                className="min-w-0 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-left backdrop-blur transition-colors enabled:hover:bg-white/15 sm:min-w-[8.5rem] sm:px-4"
              >
                <span className="block whitespace-nowrap text-lg font-bold tabular-nums sm:text-xl">{d.valor}</span>
                <span className="block text-[10px] font-semibold uppercase leading-tight tracking-wide text-white/70 sm:text-[11px]">
                  {d.etiqueta}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/packages"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-[var(--gold-foreground)] shadow-lg transition-transform hover:-translate-y-0.5"
            >
              <Compass className="h-4 w-4" aria-hidden="true" /> Planear un viaje
            </Link>
            <button
              type="button"
              onClick={() => !bloqueado && onIr("mensajes")}
              disabled={bloqueado}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur transition-colors enabled:hover:bg-white/20 disabled:opacity-60"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Hablar con un asesor
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
