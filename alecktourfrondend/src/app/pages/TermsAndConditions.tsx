import { FileText, ShieldCheck, CreditCard, XCircle, AlertTriangle, Scale, Mail } from "lucide-react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useSeoMeta } from "../hooks/useSeoMeta";

const SECCIONES = [
  {
    icon: FileText,
    titulo: "1. Aceptación de los términos",
    parrafos: [
      "Al crear una cuenta, navegar el catálogo de hoteles y paquetes, o realizar una reserva en Alik tours, aceptas estos Términos y Condiciones en su totalidad. Si no estás de acuerdo con alguna parte, te pedimos no usar la plataforma.",
    ],
  },
  {
    icon: ShieldCheck,
    titulo: "2. Cuenta de usuario",
    parrafos: [
      "Para reservar necesitas crear una cuenta con datos reales: nombre, apellido, cédula, correo, celular, dirección, ciudad, país y fecha de nacimiento. Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta.",
      "Verificamos tu correo electrónico antes de habilitar el inicio de sesión, para reducir el riesgo de cuentas falsas o registradas por error.",
    ],
  },
  {
    icon: CreditCard,
    titulo: "3. Reservas y pagos",
    parrafos: [
      "Los precios mostrados corresponden a la tarifa vigente de cada habitación o paquete al momento de la reserva y pueden cambiar sin previo aviso hasta que el pago sea confirmado. Una reserva no queda garantizada hasta que el pago (total o el anticipo elegido) sea aprobado.",
      "Aceptamos pagos con tarjeta de crédito o débito, PSE, Nequi y PayPal. Si eliges pagar solo un anticipo, el saldo restante queda pendiente en tu perfil para liquidarse antes de tu viaje.",
      "Si guardas un método de pago en tu billetera para usarlo en futuras reservas, únicamente conservamos un alias, el tipo de método y los últimos 4 dígitos cuando aplica — nunca el número completo de tarjeta, y el PIN de confirmación se almacena cifrado, nunca en texto plano.",
    ],
  },
  {
    icon: XCircle,
    titulo: "4. Cancelaciones",
    parrafos: [
      "Puedes solicitar la cancelación de una reserva confirmada o pendiente desde tu perfil, indicando el motivo. Esa solicitud queda pendiente hasta que un asesor de AlekTours la revise y apruebe o rechace; te avisaremos la resolución por los mismos canales de contacto registrados en tu cuenta.",
      "Las condiciones de reembolso (si aplica) dependen de las políticas particulares de cada hotel o paquete y del tiempo restante hasta la fecha de viaje, y se te informarán al resolver tu solicitud.",
    ],
  },
  {
    icon: AlertTriangle,
    titulo: "5. Uso aceptable",
    parrafos: [
      "No está permitido usar la plataforma para fines fraudulentos, suplantar la identidad de otra persona, intentar vulnerar la seguridad del sitio, ni registrar reservas con datos falsos. AlekTours puede suspender cuentas que incumplan esta política.",
    ],
  },
  {
    icon: Scale,
    titulo: "6. Responsabilidad y ley aplicable",
    parrafos: [
      "AlekTours actúa como intermediario entre viajeros y los hoteles/proveedores de cada paquete; la prestación final del servicio de hospedaje corresponde al hotel correspondiente, sujeta a su propia disponibilidad y condiciones.",
      "Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia se resolverá conforme a la legislación colombiana vigente.",
    ],
  },
  {
    icon: Mail,
    titulo: "7. Cambios y contacto",
    parrafos: [
      "Podemos actualizar estos Términos y Condiciones cuando cambien nuestros servicios o la normativa aplicable; publicaremos la versión vigente en esta misma página.",
      "Si tienes dudas, puedes escribirnos desde nuestro formulario de contacto o por WhatsApp — el enlace está disponible en cualquier página del sitio.",
    ],
  },
];

export default function TermsAndConditions() {
  useSeoMeta({
    title: "Términos y Condiciones",
    description: "Términos y condiciones de uso de Alik tours: cuenta, reservas, pagos, cancelaciones y responsabilidad.",
    path: "/terms",
  });

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-2">
            Términos y Condiciones
          </h1>
          <p className="text-muted-foreground text-sm">
            Última actualización: vigente desde la publicación de esta página.
          </p>
        </div>

        <div className="space-y-8">
          {SECCIONES.map((s) => (
            <section key={s.titulo} className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <s.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{s.titulo}</h2>
              </div>
              <div className="space-y-2.5 pl-12">
                {s.parrafos.map((p, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="text-xs text-muted-foreground/70 mt-10 leading-relaxed">
          Este documento describe en lenguaje claro cómo funciona AlekTours hoy. Antes de tratarlo como
          contrato definitivo frente a terceros, te recomendamos que lo revise un abogado para adaptarlo a
          la normativa específica de tu operación (registro mercantil, protección al consumidor, etc.).
        </p>

        <p className="text-sm text-muted-foreground mt-6">
          ¿Buscas cómo tratamos tus datos personales?{" "}
          <Link to="/privacy" className="text-primary font-medium hover:underline">
            Consulta nuestra Política de Privacidad
          </Link>.
        </p>
      </div>

      <Footer />
    </div>
  );
}
