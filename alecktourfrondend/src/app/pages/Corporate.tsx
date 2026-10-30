import { useState } from "react";
import { Building2, Calendar, Check, Headphones, Shield, Sparkles, TrendingDown, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { empresaService } from "../services/empresa.service";

export default function Corporate() {
  // El formulario de acá abajo antes era decorativo (sin onSubmit, sin
  // estado) — al hacer clic en "Enviar solicitud" el navegador intentaba
  // un submit nativo que recargaba la página y perdía todo lo escrito, sin
  // avisarle nada a nadie. Ahora llama a POST /api/solicitudes-corporativas
  // (público, sin login) y esa solicitud queda real en el panel de admin.
  const [form, setForm] = useState({
    nombreEmpresa: "", numeroEmpleados: "1 - 50", nombreContacto: "",
    email: "", telefono: "", mensaje: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmitCorporativo(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      await empresaService.crear({
        nombre_empresa: form.nombreEmpresa,
        numero_empleados: form.numeroEmpleados,
        nombre_contacto: form.nombreContacto,
        email_corporativo: form.email,
        telefono: form.telefono,
        mensaje: form.mensaje.trim() || undefined,
      });
      setEnviado(true);
    } catch (err: any) {
      setError(err?.message || "No pudimos enviar tu solicitud. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }


  // Gradients actualizados a variables de Tailwind (primary y secondary)
  const benefits = [
    {
      icon: TrendingDown,
      title: "Descuentos corporativos",
      description: "Hasta 25% de descuento en paquetes para grupos empresariales",
      gradient: "from-primary to-primary/80",
    },
    {
      icon: Calendar,
      title: "Gestión centralizada",
      description: "Administra todas las reservas de tu empresa desde un solo panel",
      gradient: "from-primary/80 to-primary",
    },
    {
      icon: Shield,
      title: "Facturación especial",
      description: "Facturación electrónica y reportes detallados para tu contabilidad",
      gradient: "from-primary to-secondary",
    },
    {
      icon: Headphones,
      title: "Ejecutivo dedicado",
      description: "Asesor personal para resolver todas las necesidades de tu empresa",
      gradient: "from-secondary to-primary/80",
    },
  ];

  const plans = [
    {
      name: "Básico",
      employees: "1 - 50 empleados",
      discount: "10% descuento",
      features: [
        "Descuento del 10% en todos los paquetes",
        "Facturación electrónica",
        "Soporte por email",
        "Reportes mensuales",
      ],
    },
    {
      name: "Profesional",
      employees: "51 - 200 empleados",
      discount: "15% descuento",
      features: [
        "Descuento del 15% en todos los paquetes",
        "Facturación electrónica personalizada",
        "Ejecutivo de cuenta dedicado",
        "Reportes semanales",
        "Política de cancelación flexible",
        "Prioridad en reservas grupales",
      ],
      popular: true,
    },
    {
      name: "Enterprise",
      employees: "200+ empleados",
      discount: "25% descuento",
      features: [
        "Descuento del 25% en todos los paquetes",
        "Integración con sistemas corporativos",
        "Gerente de cuenta senior",
        "Reportes personalizados en tiempo real",
        "Política de cancelación premium",
        "Eventos corporativos exclusivos",
        "Capacitación para equipo de RRHH",
        "API personalizada",
      ],
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-background transition-colors duration-300">
        <Navbar />

        {/* Hero Section */}
        <section className="relative py-24 overflow-hidden">
          {/* Usamos primary y opacity para mantener el look del gradient original */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />
          <div className="absolute inset-0">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 90, 0],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
              }}
              className="absolute top-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl"
            />
          </div>

          <div className="relative max-w-7xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-primary-foreground"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full mb-6"
              >
                {/* Asumimos secondary como el dorado/oro */}
                <Building2 className="w-5 h-5 text-secondary" />
                <span className="font-semibold text-white">Soluciones corporativas</span>
              </motion.div>

              <h1 className="text-6xl font-bold mb-6 text-white">
                Convenios Empresariales
              </h1>
              <p className="text-2xl text-white/90 max-w-3xl mx-auto mb-12">
                Beneficios exclusivos para empresas que cuidan el bienestar de sus colaboradores
              </p>

              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="#contact"
                className="inline-block px-10 py-4 bg-background text-primary rounded-full font-bold text-lg shadow-lg hover:shadow-2xl transition-all"
              >
                Solicita una cotización
              </motion.a>
            </motion.div>
          </div>
        </section>


        {/* Benefits Section */}
        <section className="py-20 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold text-foreground mb-4">
                Beneficios corporativos
              </h2>
              <p className="text-xl text-muted-foreground">
                Todo lo que tu empresa necesita en un solo lugar
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -10 }}
                  className="bg-card rounded-3xl p-8 shadow-sm border border-border hover:shadow-xl transition-all"
                >
                  <div className={`w-16 h-16 bg-gradient-to-br ${benefit.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-md`}>
                    <benefit.icon className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-card-foreground">{benefit.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Plans Section */}
        <section className="py-20 bg-background">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold text-foreground mb-4">
                Planes corporativos
              </h2>
              <p className="text-xl text-muted-foreground">
                Escoge el plan perfecto para tu empresa
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  whileHover={{ scale: plan.popular ? 1.05 : 1.02, y: -10 }}
                  className={`relative bg-card rounded-3xl p-8 shadow-lg ${plan.popular ? "border-4 border-primary" : "border-2 border-border"
                    }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-6 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-secondary" />
                        Más popular
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-8 mt-2">
                    <h3 className="text-2xl font-bold mb-2 text-card-foreground">{plan.name}</h3>
                    <p className="text-muted-foreground mb-4">{plan.employees}</p>
                    <div className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                      {plan.discount}
                    </div>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-gradient-to-br from-primary/80 to-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-full py-4 rounded-xl font-bold transition-all cursor-pointer ${plan.popular
                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl"
                      : "bg-secondary/10 text-foreground hover:bg-secondary/20"
                      }`}
                  >
                    Contactar ventas
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Form Section */}
        <section id="contact" className="py-20 bg-muted/30">
          <div className="max-w-3xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card rounded-3xl p-10 shadow-xl border border-border"
            >
              <div className="text-center mb-8">
                <h2 className="text-4xl font-bold text-foreground mb-4">
                  Solicita una cotización
                </h2>
                <p className="text-xl text-muted-foreground">
                  Nuestro equipo te contactará en menos de 24 horas
                </p>
              </div>

              {enviado ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <Check className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">¡Solicitud recibida!</h3>
                  <p className="text-muted-foreground">Nuestro equipo se pondrá en contacto contigo en menos de 24 horas.</p>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleSubmitCorporativo}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-card-foreground mb-2">
                        Nombre empresa
                      </label>
                      <input
                        type="text"
                        required
                        value={form.nombreEmpresa}
                        onChange={e => setForm({ ...form, nombreEmpresa: e.target.value })}
                        className="w-full px-4 py-4 bg-background text-foreground border-2 border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-muted-foreground/60"
                        placeholder="Tu Empresa S.A.S"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-card-foreground mb-2">
                        Número de empleados
                      </label>
                      <select
                        value={form.numeroEmpleados}
                        onChange={e => setForm({ ...form, numeroEmpleados: e.target.value })}
                        className="w-full px-4 py-4 bg-background text-foreground border-2 border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                      >
                        <option>1 - 50</option>
                        <option>51 - 200</option>
                        <option>200+</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-card-foreground mb-2">
                        Nombre contacto
                      </label>
                      <input
                        type="text"
                        required
                        value={form.nombreContacto}
                        onChange={e => setForm({ ...form, nombreContacto: e.target.value })}
                        className="w-full px-4 py-4 bg-background text-foreground border-2 border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-card-foreground mb-2">
                        Email corporativo
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className="w-full px-4 py-4 bg-background text-foreground border-2 border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-card-foreground mb-2">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      required
                      value={form.telefono}
                      onChange={e => setForm({ ...form, telefono: e.target.value })}
                      className="w-full px-4 py-4 bg-background text-foreground border-2 border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-card-foreground mb-2">
                      Mensaje (opcional)
                    </label>
                    <textarea
                      rows={4}
                      value={form.mensaje}
                      onChange={e => setForm({ ...form, mensaje: e.target.value })}
                      className="w-full px-4 py-4 bg-background text-foreground border-2 border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none placeholder:text-muted-foreground/60"
                      placeholder="Cuéntanos más sobre tus necesidades..."
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 dark:text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                    </p>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={enviando}
                    className="w-full py-5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xl font-bold rounded-2xl shadow-md hover:shadow-xl transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {enviando && <Loader2 className="w-5 h-5 animate-spin" />}
                    {enviando ? "Enviando..." : "Enviar solicitud"}
                  </motion.button>
                </form>
              )}
            </motion.div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}