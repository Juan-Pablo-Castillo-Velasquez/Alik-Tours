import { Database, Cookie, Lock, Share2, UserCog, Mail } from "lucide-react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useSeoMeta } from "../hooks/useSeoMeta";

export default function PrivacyPolicy() {
  useSeoMeta({
    title: "Política de Privacidad",
    description: "Cómo Alik Tours recolecta, usa y protege tus datos personales, incluyendo el uso de almacenamiento local del navegador.",
    path: "/privacy",
  });

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-2">
            Política de Privacidad
          </h1>
          <p className="text-muted-foreground text-sm">
            Última actualización: vigente desde la publicación de esta página.
          </p>
        </div>

        <div className="space-y-8">
          <section className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Database className="w-4.5 h-4.5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">1. Qué datos recolectamos</h2>
            </div>
            <div className="space-y-2.5 pl-12 text-sm text-muted-foreground leading-relaxed">
              <p>Cuando creas una cuenta y reservas con nosotros, guardamos: nombre, apellido, cédula, correo electrónico, celular, dirección, ciudad, país y fecha de nacimiento.</p>
              <p>Si subes una foto de perfil, la almacenamos para mostrarla en tu cuenta y en el panel de administración cuando corresponda.</p>
              <p>Si guardas un método de pago para futuras reservas, conservamos únicamente un alias, el tipo de método y los últimos 4 dígitos cuando aplica — nunca el número completo de tarjeta ni tu PIN en texto plano.</p>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <UserCog className="w-4.5 h-4.5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">2. Para qué usamos tus datos</h2>
            </div>
            <div className="space-y-2.5 pl-12 text-sm text-muted-foreground leading-relaxed">
              <p>Usamos tu información para crear y gestionar tu cuenta, procesar tus reservas y pagos, contactarte sobre el estado de una reserva o una solicitud de cancelación, y para que un asesor pueda atenderte si escribes por el formulario de contacto o WhatsApp.</p>
              <p>No vendemos tus datos personales a terceros.</p>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Cookie className="w-4.5 h-4.5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">3. Cookies y almacenamiento local</h2>
            </div>
            <div className="space-y-2.5 pl-12 text-sm text-muted-foreground leading-relaxed">
              <p>Alik Tours usa el almacenamiento local de tu navegador (localStorage), no cookies de terceros para publicidad. Concretamente guardamos:</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>Tu sesión (token de acceso) para que no tengas que iniciar sesión en cada página.</li>
                <li>Los datos básicos de tu cuenta (usuario, nombre, roles) para mostrarlos sin pedirlos de nuevo al servidor.</li>
                <li>Tu preferencia de tema claro/oscuro en el panel de administración, si lo usas.</li>
              </ul>
              <p>Todo esto es esencial para que la plataforma funcione — sin ello no podrías mantener la sesión iniciada. Puedes borrar esta información en cualquier momento desde la configuración de tu navegador o cerrando sesión.</p>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Lock className="w-4.5 h-4.5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">4. Cómo protegemos tu información</h2>
            </div>
            <div className="space-y-2.5 pl-12 text-sm text-muted-foreground leading-relaxed">
              <p>Tu contraseña y el PIN de tus métodos de pago guardados se almacenan cifrados, nunca en texto plano. El acceso al panel de administración requiere un rol autorizado, y las comunicaciones con el servidor viajan bajo autenticación por token.</p>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Share2 className="w-4.5 h-4.5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">5. Tus derechos</h2>
            </div>
            <div className="space-y-2.5 pl-12 text-sm text-muted-foreground leading-relaxed">
              <p>Puedes actualizar tus datos de perfil, tu foto y tus métodos de pago guardados directamente desde tu cuenta. Si quieres consultar, corregir o solicitar la eliminación de tus datos personales, escríbenos desde nuestro formulario de contacto o por WhatsApp.</p>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4.5 h-4.5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">6. Contacto</h2>
            </div>
            <div className="space-y-2.5 pl-12 text-sm text-muted-foreground leading-relaxed">
              <p>Para cualquier pregunta sobre esta política, usa el botón de WhatsApp disponible en cualquier página o el formulario de contacto.</p>
            </div>
          </section>
        </div>

        <p className="text-xs text-muted-foreground/70 mt-10 leading-relaxed">
          Este documento describe en lenguaje claro qué datos maneja Alik Tours hoy y cómo. Antes de tratarlo
          como política definitiva frente a una autoridad de protección de datos, te recomendamos que lo
          revise un abogado especializado en tratamiento de datos personales (en Colombia, Ley 1581 de 2012).
        </p>

        <p className="text-sm text-muted-foreground mt-6">
          ¿Buscas las reglas de uso de la plataforma?{" "}
          <Link to="/terms" className="text-primary font-medium hover:underline">
            Consulta nuestros Términos y Condiciones
          </Link>.
        </p>
      </div>

      <Footer />
    </div>
  );
}
