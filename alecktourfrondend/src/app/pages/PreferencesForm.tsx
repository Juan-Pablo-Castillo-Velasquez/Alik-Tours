import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import BrandLogo from "../components/BrandLogo";
import {
  budgetOptions,
  CampoPreferencia,
  etiquetaPreferencia,
  interestCategories,
  OpcionPreferencia,
  paceOptions,
  transportPrefs,
  travelCompany,
  weatherPrefs,
} from "../components/preferences.data";
import { useAuth } from "../context/AuthContext";
import { useSeoMeta } from "../hooks/useSeoMeta";
import { preferenciasService } from "../services/preferencias.service";

type Respuestas = {
  interests: string[];
  company: string;
  budget: string;
  weather: string;
  pace: string;
  transport: string;
};

type CampoUnico = Exclude<keyof Respuestas, "interests">;

interface Pregunta {
  campo: CampoUnico;
  campoApi: CampoPreferencia;
  titulo: string;
  opciones: OpcionPreferencia[];
  columnas: string;
}

const PASOS: { titulo: string; descripcion: string; preguntas: Pregunta[] }[] = [
  { titulo: "Lo que te gusta", descripcion: "Elige uno o varios intereses", preguntas: [] },
  {
    titulo: "Cómo viajas",
    descripcion: "Compañía, presupuesto y clima",
    preguntas: [
      { campo: "company", campoApi: "compania", titulo: "¿Con quién viajas normalmente?", opciones: travelCompany, columnas: "grid-cols-2 sm:grid-cols-4" },
      { campo: "budget", campoApi: "presupuesto", titulo: "¿Qué presupuesto manejas?", opciones: budgetOptions, columnas: "grid-cols-1 sm:grid-cols-3" },
      { campo: "weather", campoApi: "clima", titulo: "¿Qué clima prefieres?", opciones: weatherPrefs, columnas: "grid-cols-2" },
    ],
  },
  {
    titulo: "Tu ritmo",
    descripcion: "Cómo quieres vivir el viaje",
    preguntas: [
      { campo: "pace", campoApi: "ritmo", titulo: "¿Qué ritmo de viaje te gusta?", opciones: paceOptions, columnas: "grid-cols-2" },
      { campo: "transport", campoApi: "transporte", titulo: "¿Cómo prefieres moverte?", opciones: transportPrefs, columnas: "grid-cols-2" },
    ],
  },
];

/** Qué le falta a un paso para poder seguir (vacío = completo). */
export function faltantesDelPaso(paso: number, r: Respuestas): string[] {
  if (paso === 0) return r.interests.length ? [] : ["Elige al menos un interés"];
  return PASOS[paso].preguntas.filter((p) => !r[p.campo]).map((p) => `Responde: ${p.titulo}`);
}

function Opcion({
  opcion,
  activa,
  onClick,
  multiple,
}: {
  opcion: OpcionPreferencia;
  activa: boolean;
  onClick: () => void;
  multiple?: boolean;
}) {
  const Icono = opcion.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      role={multiple ? undefined : "radio"}
      aria-checked={multiple ? undefined : activa}
      className={`group relative flex h-full flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        activa ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40"
      }`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
          activa ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-primary"
        }`}
      >
        <Icono className="h-5 w-5" />
      </span>
      <span className="text-sm font-bold text-foreground">{opcion.label}</span>
      {opcion.desc && <span className="text-xs text-muted-foreground">{opcion.desc}</span>}
      <span
        className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
          activa ? "border-primary bg-primary text-primary-foreground" : "border-border"
        }`}
        aria-hidden
      >
        {activa && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

export default function PreferencesForm() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useSeoMeta({ title: "Tus preferencias de viaje", description: "Cuéntanos cómo te gusta viajar y te sugerimos hoteles y paquetes.", path: "/preferences" });

  // TabPreferencias manda las preferencias guardadas por location.state al
  // pulsar "Actualizar": el cuestionario arranca con ellas.
  const previas = (location.state as { preferencias?: any } | null)?.preferencias;
  const [paso, setPaso] = useState(0);
  const [direccion, setDireccion] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [intentoSeguir, setIntentoSeguir] = useState(false);
  const [r, setR] = useState<Respuestas>({
    interests: (previas?.intereses as string[]) ?? [],
    company: previas?.compania ?? "",
    budget: previas?.presupuesto ?? "",
    weather: previas?.clima ?? "",
    pace: previas?.ritmo ?? "",
    transport: previas?.transporte ?? "",
  });

  const faltan = faltantesDelPaso(paso, r);
  const ultimo = paso === PASOS.length - 1;

  const alternarInteres = (id: string) =>
    setR((prev) => ({
      ...prev,
      interests: prev.interests.includes(id) ? prev.interests.filter((i) => i !== id) : [...prev.interests, id],
    }));

  function irA(nuevo: number) {
    setDireccion(nuevo > paso ? 1 : -1);
    setIntentoSeguir(false);
    setPaso(nuevo);
  }

  async function seguir() {
    if (faltan.length) {
      setIntentoSeguir(true);
      return;
    }
    if (!ultimo) return irA(paso + 1);
    const idCliente = usuario?.id_cliente;
    if (!idCliente) {
      toast.error("Inicia sesión para guardar tus preferencias.");
      navigate("/login");
      return;
    }
    setGuardando(true);
    try {
      await preferenciasService.savePreferences(idCliente, r);
      toast.success("¡Listo! Ya tenemos sugerencias para ti.");
      navigate("/profile", { state: { tab: "preferencias" } });
    } catch (error: any) {
      toast.error(error?.message || "No pudimos guardar tus preferencias. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  // Resumen en vivo de lo que lleva respondido (panel izquierdo).
  const resumen: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Intereses", valor: r.interests.map((i) => etiquetaPreferencia("intereses", i)).join(", ") },
    { etiqueta: "Compañía", valor: etiquetaPreferencia("compania", r.company) },
    { etiqueta: "Presupuesto", valor: etiquetaPreferencia("presupuesto", r.budget) },
    { etiqueta: "Clima", valor: etiquetaPreferencia("clima", r.weather) },
    { etiqueta: "Ritmo", valor: etiquetaPreferencia("ritmo", r.pace) },
    { etiqueta: "Transporte", valor: etiquetaPreferencia("transporte", r.transport) },
  ].filter((x) => x.valor);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[380px_1fr]">
        {/* Panel de marca y avance */}
        <aside className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[#3b1728] px-6 py-8 text-primary-foreground lg:px-8 lg:py-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--gold)]/20 blur-3xl" aria-hidden />
          <div className="relative flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-2 text-lg font-extrabold">
              <BrandLogo size={40} /> Alik Tours
            </Link>
            <Link
              to="/profile"
              state={{ tab: "preferencias" }}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 lg:hidden"
            >
              <X className="h-3.5 w-3.5" /> Salir
            </Link>
          </div>
          <div className="relative mt-8">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-[var(--gold)]" /> Menos de un minuto
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight">Cuéntanos cómo te gusta viajar</h1>
            <p className="mt-2 text-sm text-white/80">Con tus respuestas te sugerimos hoteles y paquetes que van contigo. Puedes cambiarlas cuando quieras.</p>
          </div>

          <ol className="relative mt-8 space-y-1" aria-label="Pasos del cuestionario">
            {PASOS.map((p, i) => {
              const hecho = i < paso;
              const actual = i === paso;
              return (
                <li key={p.titulo}>
                  <button
                    type="button"
                    onClick={() => (i < paso ? irA(i) : undefined)}
                    disabled={i > paso}
                    aria-current={actual ? "step" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${actual ? "bg-white/15" : hecho ? "hover:bg-white/10" : "opacity-60"}`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        hecho ? "bg-[var(--gold)] text-[var(--gold-foreground)]" : actual ? "bg-white text-primary" : "border border-white/40"
                      }`}
                    >
                      {hecho ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{p.titulo}</span>
                      <span className="block text-xs text-white/70">{p.descripcion}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {resumen.length > 0 && (
            <div className="relative mt-8 hidden rounded-2xl bg-black/20 p-4 lg:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Tu perfil hasta ahora</p>
              <dl className="mt-2 space-y-1.5 text-sm">
                {resumen.map((x) => (
                  <div key={x.etiqueta} className="flex gap-2">
                    <dt className="w-24 shrink-0 text-white/60">{x.etiqueta}</dt>
                    <dd className="font-semibold">{x.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </aside>

        {/* Preguntas */}
        <main className="flex flex-col px-5 py-8 sm:px-10 lg:py-10">
          <div className="mb-6 hidden items-center justify-between lg:flex">
            <Link
              to="/profile"
              state={{ tab: "preferencias" }}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a mi perfil
            </Link>
            <span className="text-sm font-semibold text-muted-foreground">
              Paso {paso + 1} de {PASOS.length}
            </span>
          </div>
          <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} transition={{ duration: 0.35 }} />
          </div>

          <div className="relative flex-1">
            <AnimatePresence mode="wait" custom={direccion}>
              <motion.div
                key={paso}
                custom={direccion}
                initial={{ opacity: 0, x: 24 * direccion }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 * direccion }}
                transition={{ duration: 0.22 }}
                className="space-y-8"
              >
                {paso === 0 ? (
                  <section aria-labelledby="pregunta-intereses">
                    <h2 id="pregunta-intereses" className="text-2xl font-bold">
                      ¿Qué te apasiona cuando viajas?
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">Elige todos los que quieras.</p>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {interestCategories.map((op) => (
                        <Opcion key={op.id} opcion={op} multiple activa={r.interests.includes(op.id)} onClick={() => alternarInteres(op.id)} />
                      ))}
                    </div>
                  </section>
                ) : (
                  PASOS[paso].preguntas.map((p) => (
                    <section key={p.campo} aria-labelledby={`pregunta-${p.campo}`}>
                      <h2 id={`pregunta-${p.campo}`} className="text-lg font-bold">
                        {p.titulo}
                      </h2>
                      <div role="radiogroup" aria-labelledby={`pregunta-${p.campo}`} className={`mt-3 grid gap-3 ${p.columnas}`}>
                        {p.opciones.map((op) => (
                          <Opcion key={op.id} opcion={op} activa={r[p.campo] === op.id} onClick={() => setR((prev) => ({ ...prev, [p.campo]: op.id }))} />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {intentoSeguir && faltan.length > 0 && (
            <ul role="alert" className="mt-6 space-y-1 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {faltan.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border bg-background/95 pb-24 pt-4 backdrop-blur lg:sticky lg:bottom-0 lg:pb-4">
            {paso > 0 ? (
              <button
                type="button"
                onClick={() => irA(paso - 1)}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> Atrás
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={seguir}
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:opacity-60"
            >
              {guardando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : ultimo ? (
                <>
                  <Check className="h-4 w-4" /> Guardar mis preferencias
                </>
              ) : (
                <>
                  Continuar <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
