import { AlertCircle, Clock, CreditCard, FileText, Luggage, MapPin, Plane, Shield } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

export default function TravelInfo() {
  const [activeTab, setActiveTab] = useState("documentos");

  const tabs = [
    { id: "documentos", label: "Documentos", icon: FileText },
    { id: "equipaje", label: "Equipaje", icon: Luggage },
    { id: "vuelo", label: "Check-in", icon: Plane },
    { id: "destinos", label: "Destinos", icon: MapPin },
    { id: "seguros", label: "Seguros", icon: Shield },
    { id: "pagos", label: "Pagos", icon: CreditCard },
  ];

  const content = {
    documentos: {
      title: "Documentación requerida",
      items: [
        {
          icon: FileText,
          title: "Cédula de ciudadanía o pasaporte",
          description: "Documento vigente y en buen estado. Para menores de edad, registro civil o tarjeta de identidad.",
        },
        {
          icon: Shield,
          title: "Certificado de vacunación",
          description: "Esquema completo de vacunación COVID-19. Algunos destinos pueden requerir otras vacunas (fiebre amarilla, etc).",
        },
        {
          icon: AlertCircle,
          title: "Permisos especiales",
          description: "Menores de edad que viajan sin padres requieren permiso notariado. Consulta requisitos específicos de tu destino.",
        },
      ],
    },
    equipaje: {
      title: "Políticas de equipaje",
      items: [
        {
          icon: Luggage,
          title: "Equipaje de mano",
          description: "1 maleta de hasta 10kg (55x35x25cm) + 1 artículo personal. Líquidos en envases de máximo 100ml.",
        },
        {
          icon: Luggage,
          title: "Equipaje facturado",
          description: "Incluido en paquetes con vuelo: 1 maleta de hasta 23kg. Peso adicional tiene costo extra.",
        },
        {
          icon: AlertCircle,
          title: "Artículos prohibidos",
          description: "Armas, objetos punzocortantes, líquidos inflamables, baterías de litio sueltas. Revisa lista completa.",
        },
      ],
    },
    vuelo: {
      title: "Check-in y abordaje",
      items: [
        {
          icon: Clock,
          title: "Tiempos recomendados",
          description: "Vuelos nacionales: 2 horas antes. Vuelos internacionales: 3 horas antes del despegue.",
        },
        {
          icon: Plane,
          title: "Check-in online",
          description: "Disponible 24 horas antes del vuelo. Ahorra tiempo en el aeropuerto y elige tu asiento preferido.",
        },
        {
          icon: MapPin,
          title: "Puertas de embarque",
          description: "Cierre de puertas 15 minutos antes de la salida. Ten tu pase de abordar y documento listo.",
        },
      ],
    },
    destinos: {
      title: "Información de destinos",
      items: [
        {
          icon: MapPin,
          title: "Clima y temporadas",
          description: "Cartagena: cálido todo el año (24-32°C). San Andrés: tropical (27-30°C). Eje Cafetero: templado (18-24°C).",
        },
        {
          icon: AlertCircle,
          title: "Recomendaciones de salud",
          description: "Protector solar, repelente de insectos, hidratación constante. Botiquín básico con medicamentos personales.",
        },
        {
          icon: Clock,
          title: "Mejor época para viajar",
          description: "Temporada seca: Dic-Mar y Jul-Ago. Temporada de lluvias: Abr-Jun y Sep-Nov (mejores precios).",
        },
      ],
    },
    seguros: {
      title: "Seguros de viaje",
      items: [
        {
          icon: Shield,
          title: "Seguro médico",
          description: "Cobertura hasta $50.000 USD en emergencias médicas, hospitalización y medicamentos durante tu viaje.",
        },
        {
          icon: Shield,
          title: "Seguro de cancelación",
          description: "Reembolso hasta 100% si cancelas por causas cubiertas (enfermedad, emergencia familiar, etc).",
        },
        {
          icon: Shield,
          title: "Seguro de equipaje",
          description: "Cobertura por pérdida, robo o daño de equipaje hasta $2.000 USD por persona.",
        },
      ],
    },
    pagos: {
      title: "Métodos de pago",
      items: [
        {
          icon: CreditCard,
          title: "Tarjetas de crédito",
          description: "Aceptamos Visa, Mastercard, American Express. Pago en 1 cuota o hasta 12 cuotas sin intereses.",
        },
        {
          icon: CreditCard,
          title: "Pago anticipado",
          description: "Paga 50% al reservar y 50% hasta 15 días antes del viaje. O paga el 100% y recibe 5% descuento adicional.",
        },
        {
          icon: Shield,
          title: "Seguridad de pago",
          description: "Transacciones encriptadas con tecnología SSL. Tus datos están 100% protegidos.",
        },
      ],
    },
  };

  const activeContent = content[activeTab as keyof typeof content];

  return (
    <>
      <div className="min-h-screen bg-background transition-colors duration-300">
        <Navbar />

        {/* Hero Section - Granate de Alik Tours usando variables */}
        <section className="relative py-20 overflow-hidden bg-gradient-to-br from-primary to-primary/80">
          <div className="absolute inset-0">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.1, 0.2, 0.1],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
              }}
              className="absolute top-10 right-10 w-96 h-96 bg-primary-foreground/20 rounded-full blur-3xl"
            />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 text-center text-primary-foreground">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Información para tu viaje
              </h1>
              <p className="text-xl md:text-2xl text-primary-foreground/90 max-w-3xl mx-auto">
                Todo lo que necesitas saber antes de viajar
              </p>
            </motion.div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4">
            {/* Tabs */}
            <div className="mb-12">
              <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-hide">
                {tabs.map((tab, index) => (
                  <motion.button
                    key={tab.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-semibold whitespace-nowrap transition-all cursor-pointer ${activeTab === tab.id
                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg"
                      : "bg-card text-foreground hover:bg-primary/5 hover:text-primary hover:shadow-md border border-border"
                      }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Content Cards */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-foreground">
                {activeContent.title}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeContent.items.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -10 }}
                    className="bg-card rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all border border-border"
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                      <item.icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-card-foreground">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Important Notice - Adaptado al color Secundario (Oro/Miel) */}
        <section className="py-20 bg-secondary/5">
          <div className="max-w-4xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-card rounded-3xl p-8 shadow-xl border-2 border-secondary/30"
            >
              <div className="flex items-start gap-4 flex-col sm:flex-row">
                <div className="w-12 h-12 bg-gradient-to-br from-secondary to-secondary/80 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-3 text-card-foreground">
                    Importante
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    La información proporcionada es de carácter general. Te recomendamos verificar los requisitos específicos de tu destino en las páginas oficiales de migración y consulados. Los requisitos pueden cambiar sin previo aviso.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Para más información, contáctanos al <strong className="text-foreground">+57 (1) 800-ALECK</strong> o escríbenos a{" "}
                    <strong className="text-primary">info@alektours.com</strong>
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ Preview */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                ¿Tienes más preguntas?
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Visita nuestra sección de preguntas frecuentes
              </p>
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="/faq"
                className="inline-block px-10 py-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-full font-bold text-lg shadow-md hover:shadow-xl transition-all cursor-pointer"
              >
                Ver preguntas frecuentes
              </motion.a>
            </motion.div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}