import { Award, Crown, Gift, Plane, Sparkles, Star, TrendingUp, Zap } from "lucide-react";
import { motion } from "motion/react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

export default function Benefits() {
  const benefits = [
    {
      icon: Star,
      title: "Gana puntos en cada viaje",
      description: "Acumula 10 puntos por cada $100.000 gastados en tus reservas",
      gradient: "from-primary to-primary/80",
    },
    {
      icon: Gift,
      title: "Redime tus puntos",
      description: "Canjea puntos por descuentos, upgrades gratis y beneficios exclusivos",
      gradient: "from-secondary to-secondary/80",
    },
    {
      icon: TrendingUp,
      title: "Niveles de membresía",
      description: "Sube de nivel y desbloquea beneficios premium a medida que viajas",
      gradient: "from-primary to-secondary",
    },
    {
      icon: Zap,
      title: "Ofertas exclusivas",
      description: "Acceso anticipado a ofertas especiales y descuentos de temporada",
      gradient: "from-primary/80 to-primary",
    },
  ];

  const tiers = [
    {
      name: "Explorador",
      icon: Plane,
      points: "0 - 999 puntos",
      color: "from-muted-foreground to-foreground/70",
      benefits: [
        "10 puntos por cada $100.000",
        "Descuentos especiales en temporadas bajas",
        "Newsletter con ofertas exclusivas",
      ],
    },
    {
      name: "Viajero",
      icon: Star,
      points: "1.000 - 4.999 puntos",
      color: "from-primary to-primary/80",
      benefits: [
        "15 puntos por cada $100.000",
        "5% descuento adicional en todos los paquetes",
        "Check-in prioritario",
        "Cambios de fecha sin costo (1 vez al año)",
      ],
    },
    {
      name: "Elite",
      icon: Crown,
      points: "5.000+ puntos",
      color: "from-primary to-secondary",
      benefits: [
        "20 puntos por cada $100.000",
        "10% descuento en todos los paquetes",
        "Upgrade gratuito sujeto a disponibilidad",
        "Asistente personal de viajes",
        "Acceso a sala VIP",
        "Cancelación gratuita hasta 24h antes",
      ],
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-background transition-colors duration-300">
        <Navbar />

        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80" />
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-72 h-72 bg-primary-foreground rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary-foreground rounded-full blur-3xl" />
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
                transition={{ delay: 0.2, type: "spring" }}
                className="inline-flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm px-6 py-3 rounded-full mb-6"
              >
                <Sparkles className="w-5 h-5 text-secondary" />
                <span className="font-semibold">Programa de fidelidad</span>
              </motion.div>

              <h1 className="text-6xl font-bold mb-6 tracking-tight">
                Alik Tours Rewards
              </h1>
              <p className="text-2xl text-primary-foreground/90 max-w-3xl mx-auto font-light">
                Viaja más, ahorra más. Gana puntos en cada viaje y disfruta de beneficios exclusivos
              </p>
            </motion.div>
          </div>
        </section>

        {/* Aviso: el programa todavía no está activo */}
        <section className="py-6">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-start gap-3 bg-secondary/10 border border-secondary/30 rounded-2xl p-5">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground text-sm">Próximamente</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Alik Tours Rewards todavía no está activo. Lo de abajo es un adelanto de cómo
                  funcionará — por ahora ninguna reserva acumula puntos ni existen niveles reales.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Grid */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold text-foreground mb-4">
                ¿Cómo funciona?
              </h2>
              <p className="text-xl text-muted-foreground">
                Es fácil empezar a ganar recompensas
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
                  className="bg-card rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all border border-border"
                >
                  <div className={`w-16 h-16 bg-gradient-to-br ${benefit.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                    <benefit.icon className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-card-foreground">{benefit.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{benefit.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Membership Tiers */}
        <section className="py-20 bg-secondary/5">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold text-foreground mb-4">
                Niveles de membresía
              </h2>
              <p className="text-xl text-muted-foreground">
                Sube de nivel y desbloquea más beneficios
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {tiers.map((tier, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  whileHover={{ scale: 1.05, y: -10 }}
                  className="relative"
                >
                  <div className="bg-card rounded-3xl p-8 shadow-sm hover:shadow-xl border border-border overflow-hidden h-full transition-all">
                    <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${tier.color}`} />

                    <div className="text-center mb-8">
                      <div className={`w-20 h-20 bg-gradient-to-br ${tier.color} rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                        <tier.icon className="w-10 h-10 text-primary-foreground" />
                      </div>
                      <h3 className="text-2xl font-bold mb-2 text-card-foreground">{tier.name}</h3>
                      <p className="text-sm font-semibold bg-muted text-muted-foreground px-3 py-1 rounded-full inline-block">
                        {tier.points}
                      </p>
                    </div>

                    <ul className="space-y-4">
                      {tier.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className={`w-6 h-6 bg-gradient-to-br ${tier.color} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>
                            <Award className="w-3.5 h-3.5 text-primary-foreground" />
                          </div>
                          <span className="text-muted-foreground text-sm leading-snug">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-gradient-to-r from-primary to-primary/80 rounded-3xl p-12 text-center text-primary-foreground shadow-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary-foreground/10 rounded-full blur-3xl -mr-10 -mt-10" />
              <h2 className="text-4xl font-bold mb-6">
                ¿Quieres ser de los primeros en enterarte?
              </h2>
              <p className="text-xl mb-8 text-primary-foreground/90 font-light max-w-2xl mx-auto">
                Crea tu cuenta y te avisaremos en cuanto Alik Tours Rewards esté disponible.
              </p>
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="/register"
                className="inline-block px-10 py-4 bg-primary-foreground text-primary rounded-full font-bold text-lg shadow-md hover:shadow-2xl transition-all cursor-pointer"
              >
                Crear mi cuenta
              </motion.a>
            </motion.div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}