import { Download, FileText } from "lucide-react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useSeoMeta } from "../hooks/useSeoMeta";
import { BRAND } from "../config/brand";
import { TERMINOS_ES_BORRADOR, TERMINOS_FECHA, TERMINOS_SECCIONES, TERMINOS_VERSION } from "../content/terminos";
import { descargarTerminosPdf } from "../utils/descargarTerminosPdf";

// El contenido vive en content/terminos.ts (fuente única, compartida con
// el modal del registro y con la evidencia de aceptación).
export default function TermsAndConditions() {
  useSeoMeta({
    title: "Términos y Condiciones",
    description: `Términos y condiciones de ${BRAND.name} (RNT ${BRAND.rnt}): reservas, pagos, cancelaciones, retracto y datos personales.`,
    path: "/terms",
  });

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-2">Términos y Condiciones</h1>
          <p className="text-muted-foreground text-sm">
            {BRAND.name} · RNT {BRAND.rnt} · Versión {TERMINOS_VERSION} · {TERMINOS_FECHA}
          </p>
          {TERMINOS_ES_BORRADOR && (
            <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-foreground">
              Borrador pendiente de revisión jurídica. Los datos marcados como «Pendiente» los completará la agencia.
            </p>
          )}
          <button
            onClick={descargarTerminosPdf}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar en PDF
          </button>
        </div>

        <nav aria-label="Contenido" className="mb-8 rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contenido</p>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {TERMINOS_SECCIONES.map((s, i) => (
              <li key={s.titulo}>
                <a href={`#seccion-${i + 1}`} className="text-primary hover:underline">
                  {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-6">
          {TERMINOS_SECCIONES.map((s, i) => (
            <section key={s.titulo} id={`seccion-${i + 1}`} className="bg-card border border-border rounded-2xl p-6 scroll-mt-24">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{s.titulo}</h2>
              </div>
              <div className="space-y-2.5 sm:pl-12">
                {s.parrafos.map((p, j) => (
                  <p key={j} className="text-sm text-muted-foreground leading-relaxed break-words">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="text-sm text-muted-foreground mt-8">
          ¿Buscas cómo tratamos tus datos personales?{" "}
          <Link to="/privacy" className="text-primary font-medium hover:underline">
            Consulta nuestra Política de Privacidad
          </Link>
          .
        </p>
      </div>

      <Footer />
    </div>
  );
}
