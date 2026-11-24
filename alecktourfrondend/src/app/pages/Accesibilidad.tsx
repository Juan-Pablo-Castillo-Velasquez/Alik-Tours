import { Accessibility, Keyboard, MessageSquareText, MonitorSmartphone, Volume2 } from "lucide-react";
import { Link } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useAccesibilidad } from "../context/AccesibilidadContext";
import { useSeoMeta } from "../hooks/useSeoMeta";
import { useIdioma } from "../i18n";

const CONTENIDO = {
  es: {
    titulo: "Accesibilidad",
    intro:
      "Queremos que cualquier persona pueda buscar, reservar y gestionar su viaje con nosotros, incluidas las personas ciegas o con baja visión, y quienes navegan solo con teclado o con un lector de pantalla.",
    abrir: "Abrir opciones de accesibilidad",
    secciones: [
      {
        icono: Volume2,
        titulo: "Lectores de pantalla",
        texto:
          "Las páginas tienen encabezados ordenados, regiones (navegación, contenido, pie), textos alternativos en las imágenes, etiquetas en todos los campos y avisos que se anuncian solos. Probamos con NVDA, VoiceOver y TalkBack. El idioma de la página cambia con el selector para que la pronunciación sea la correcta.",
      },
      {
        icono: Keyboard,
        titulo: "Teclado",
        texto:
          "Todo se puede usar con Tab, Enter, Espacio, flechas y Escape. El primer Tab muestra «Saltar al contenido principal». Alt + A abre las opciones de accesibilidad. Los modales mantienen el foco dentro y lo devuelven al cerrarse.",
      },
      {
        icono: Accessibility,
        titulo: "Opciones de la página",
        texto:
          "Tamaño del texto, alto contraste, subrayado de enlaces, reducción de animaciones, fuente fácil de leer, foco resaltado, cursor grande y lectura en voz alta. Se guardan en tu navegador.",
      },
      {
        icono: MonitorSmartphone,
        titulo: "Cualquier pantalla",
        texto:
          "El sitio se adapta del celular al computador y admite zoom del navegador hasta 200 % sin perder contenido. Respetamos la preferencia de «reducir movimiento» de tu sistema.",
      },
    ],
    estandar:
      "Nuestro objetivo es cumplir las Pautas de Accesibilidad para el Contenido Web (WCAG) 2.1, nivel AA. Es un trabajo continuo: si encuentras una barrera, nos ayuda mucho saberlo.",
    reportar: "Reportar un problema de accesibilidad",
    reportarTexto: "Radícalo como petición o queja y te respondemos dentro del plazo legal, o escríbenos por el formulario de contacto.",
    pqr: "Ir a PQR",
    contacto: "Contacto",
  },
  en: {
    titulo: "Accessibility",
    intro:
      "We want everyone to be able to search, book and manage their trip with us, including blind and low-vision people, and anyone browsing only with a keyboard or a screen reader.",
    abrir: "Open accessibility options",
    secciones: [
      {
        icono: Volume2,
        titulo: "Screen readers",
        texto:
          "Pages have ordered headings, landmarks (navigation, content, footer), alt text on images, labels on every field and notifications that announce themselves. We test with NVDA, VoiceOver and TalkBack. The page language follows the language selector so pronunciation is right.",
      },
      {
        icono: Keyboard,
        titulo: "Keyboard",
        texto:
          "Everything works with Tab, Enter, Space, arrows and Escape. The first Tab shows “Skip to main content”. Alt + A opens the accessibility options. Dialogs keep focus inside and return it when they close.",
      },
      {
        icono: Accessibility,
        titulo: "Page options",
        texto:
          "Text size, high contrast, underlined links, reduced motion, easy-to-read font, highlighted focus, large cursor and read aloud. They are saved in your browser.",
      },
      {
        icono: MonitorSmartphone,
        titulo: "Any screen",
        texto:
          "The site adapts from phone to desktop and supports browser zoom up to 200% without losing content. We respect your system's “reduce motion” setting.",
      },
    ],
    estandar:
      "Our goal is to meet the Web Content Accessibility Guidelines (WCAG) 2.1, level AA. It's ongoing work: if you find a barrier, please let us know.",
    reportar: "Report an accessibility issue",
    reportarTexto: "File it as a request or complaint and we'll reply within the legal deadline, or write to us through the contact form.",
    pqr: "Go to PQR",
    contacto: "Contact",
  },
};

export default function Accesibilidad() {
  const { idioma } = useIdioma();
  const { setPanelAbierto } = useAccesibilidad();
  const c = CONTENIDO[idioma];
  useSeoMeta({ title: c.titulo, description: c.intro, path: "/accesibilidad" });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main id="contenido-principal" tabIndex={-1} className="outline-none">
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
              <Accessibility className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">{c.titulo}</h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">{c.intro}</p>
            <button
              type="button"
              onClick={() => setPanelAbierto(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Accessibility className="h-4 w-4" aria-hidden /> {c.abrir}
            </button>
          </div>
        </section>
        <section className="mx-auto grid max-w-4xl gap-4 px-4 py-12 sm:grid-cols-2">
          {c.secciones.map((s) => (
            <article key={s.titulo} className="rounded-2xl border border-border bg-card p-6">
              <s.icono className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="mt-3 text-lg font-semibold">{s.titulo}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.texto}</p>
            </article>
          ))}
        </section>
        <section className="mx-auto max-w-4xl px-4 pb-16">
          <p className="rounded-2xl border border-border bg-muted/40 p-5 text-sm text-foreground">{c.estandar}</p>
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MessageSquareText className="h-5 w-5 text-primary" aria-hidden /> {c.reportar}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{c.reportarTexto}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/pqr" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                {c.pqr}
              </Link>
              <Link to="/contact" className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                {c.contacto}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
