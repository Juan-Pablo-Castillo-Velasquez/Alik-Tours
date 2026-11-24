import { CalendarClock, FileText, MessageSquareText, Scale, ShieldCheck, Star } from "lucide-react";
import { AvisoVersionLegal } from "../components/AvisoVersionLegal";
import { Link } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { BRAND } from "../config/brand";
import { POLITICA_PQR, POLITICA_PQR_FECHA, PLAZOS_PQR } from "../content/politicaPqr";
import { useAuth } from "../context/AuthContext";
import { useSeoMeta } from "../hooks/useSeoMeta";
import { rutaLoginConVuelta } from "../utils/volverTrasLogin";

const DESTINO = "/profile?tab=pqr";

export default function Pqr() {
  const { isAuthenticated } = useAuth();
  useSeoMeta({
    title: "Peticiones, quejas y reclamos (PQR)",
    description: `Radica una petición, queja, reclamo, sugerencia o felicitación a ${BRAND.name}. Te respondemos por escrito dentro del plazo legal en días hábiles.`,
    path: "/pqr",
  });
  const radicar = isAuthenticated ? DESTINO : rutaLoginConVuelta(DESTINO);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Navbar />
      <main id="contenido-principal" tabIndex={-1} className="outline-none">

      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:py-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-primary">Atención al cliente</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-5xl">
              Peticiones, quejas y reclamos
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
              Si algo de tu viaje no salió como esperabas, o necesitas pedirnos algo, radícalo aquí. Recibes un número
              de radicado, ves en todo momento cuánto falta para la respuesta y te contestamos por escrito.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to={radicar}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                <MessageSquareText className="h-4 w-4" /> Radicar una solicitud
              </Link>
              <a
                href="#politica"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <FileText className="h-4 w-4" /> Leer la política
              </a>
            </div>
            {!isAuthenticated && (
              <p className="mt-3 text-xs text-muted-foreground">
                Te pedimos iniciar sesión para identificarte y avisarte por correo. ¿Prefieres hablar con alguien? Llama
                al {BRAND.telefono} y un asesor la radica por ti.
              </p>
            )}
          </div>

          <ol className="grid gap-3">
            {[
              { icono: FileText, t: "Radicas", d: "Eliges el tipo, cuentas qué pasó y, si es un reclamo, qué esperas que hagamos." },
              { icono: CalendarClock, t: "Corre el plazo", d: "Te damos el radicado y la fecha límite. Si falta un dato, te lo pedimos y el plazo se pausa." },
              { icono: Scale, t: "Te respondemos de fondo", d: "En tu perfil y por correo. En un reclamo te decimos si accedemos o no, y por qué." },
              { icono: Star, t: "Calificas", d: "Nos dices cómo fue la atención para seguir mejorando." },
            ].map((paso, i) => (
              <li key={paso.t} className="flex gap-4 rounded-2xl border border-border bg-background p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <paso.icono className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {i + 1}. {paso.t}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{paso.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Plazos de respuesta</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          En días hábiles: de lunes a viernes, sin festivos. Se cuentan desde el día hábil siguiente a la radicación.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Tipo
                </th>
                <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">
                  Cuándo usarlo
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Plazo
                </th>
                <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">
                  Norma
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PLAZOS_PQR.map((p) => (
                <tr key={p.tipo}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{p.tipo}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">{p.que}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{p.que}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">
                    {p.dias} días hábiles
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{p.norma}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Si no alcanzamos a responder, te avisamos antes del vencimiento con el motivo y la nueva fecha, que nunca
            supera el doble del plazo inicial. Si no quedas conforme, puedes acudir a la Superintendencia de Industria y
            Comercio con tu número de radicado.
          </p>
        </div>
      </section>

      <section id="politica" className="mx-auto max-w-3xl scroll-mt-24 px-4 pb-16">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Política de atención de PQR</h2>
<AvisoVersionLegal />
        <p className="mt-1 text-sm text-muted-foreground">
          {BRAND.name} · Versión del {POLITICA_PQR_FECHA} · Borrador pendiente de revisión jurídica
        </p>

        <nav aria-label="Contenido de la política" className="mt-6 rounded-2xl border border-border bg-card p-5">
          <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {POLITICA_PQR.map((s) => (
              <li key={s.id}>
                <a href={`#pqr-${s.id}`} className="text-primary hover:underline">
                  {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-6 space-y-4">
          {POLITICA_PQR.map((s) => (
            <section key={s.id} id={`pqr-${s.id}`} className="scroll-mt-24 rounded-2xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">{s.titulo}</h3>
              <div className="mt-3 space-y-2.5">
                {s.parrafos.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
                {s.lista && (
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-primary">
                    {s.lista.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Consulta también los{" "}
          <Link to="/terms" className="font-medium text-primary hover:underline">
            Términos y Condiciones
          </Link>{" "}
          y la{" "}
          <Link to="/privacy" className="font-medium text-primary hover:underline">
            Política de Privacidad
          </Link>
          .
        </p>
      </section>

      </main>
      <Footer />
    </div>
  );
}
