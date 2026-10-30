import { ChevronDown, HelpCircle, MessageCircle, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

interface FAQItem {
  pregunta: string;
  respuesta: string;
  categoria: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    categoria: "Reservas",
    pregunta: "¿Cómo puedo cancelar o modificar mi reserva en Alik Tours?",
    respuesta: "Puedes gestionar, modificar o solicitar la cancelación de tus reservas directamente desde tu perfil de usuario en la sección 'Mis Reservas'. Recuerda revisar las políticas de cancelación de cada hotel, ya que algunas tarifas pueden aplicar cargos adicionales.",
  },
  {
    categoria: "Pagos",
    pregunta: "¿Qué métodos de pago aceptan para los paquetes turísticos?",
    respuesta: "Aceptamos una amplia variedad de métodos de pago seguros, incluyendo Tarjetas de Crédito y Débito (Visa, Mastercard, Amex), Transferencias Bancarias directas y PayPal. Todos tus datos se procesan de forma encriptada.",
  },
  {
    categoria: "Hoteles",
    pregunta: "¿Qué incluye el precio por noche que se muestra en las habitaciones?",
    respuesta: "El precio base incluye el alojamiento por noche para la capacidad máxima de personas indicada en el tipo de habitación. Los servicios adicionales como desayuno, traslados o tours se especifican al momento de armar tu paquete personalizado.",
  },
  {
    categoria: "Soporte",
    pregunta: "¿Cómo me comunico con Alik Tours si tengo una emergencia durante el viaje?",
    respuesta: "Contamos con una línea de asistencia telefónica y soporte vía WhatsApp disponible las 24 horas del día, los 7 días de la semana, exclusiva para clientes con reservas activas. Encontrarás este número en tu voucher de confirmación.",
  },
];

export default function FAQ() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const categorias = ["all", ...new Set(FAQ_DATA.map((item) => item.categoria))];

  // Filtrado dinámico por buscador y categorías
  const faqFiltrados = FAQ_DATA.filter((item) => {
    const matchesSearch =
      item.pregunta.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.respuesta.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "all" || item.categoria === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <>
      <div className="min-h-screen bg-background transition-colors duration-300">
        <Navbar />

        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Encabezado */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent mb-4">
              Preguntas Frecuentes
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              ¿Tienes dudas sobre tu próximo destino o reserva? Aquí encontrarás las respuestas rápidas que necesitas.
            </p>
          </motion.div>

          {/* Barra de Búsqueda */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative max-w-xl mx-auto mb-10"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar pregunta o palabra clave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-card border border-border rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground/60"
            />
          </motion.div>

          {/* Pastillas de Categorías */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {categorias.map((cat) => (
              <motion.button
                key={cat}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setActiveCategory(cat); setOpenIndex(null); }}
                className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all cursor-pointer ${activeCategory === cat
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-card text-foreground border border-border hover:bg-primary/10 hover:text-primary"
                  }`}
              >
                {cat === "all" ? "Ver Todas" : cat}
              </motion.button>
            ))}
          </div>

          {/* Contenedor de Acordeones */}
          <main className="space-y-4">
            <AnimatePresence initial={false}>
              {faqFiltrados.length > 0 ? (
                faqFiltrados.map((faq, index) => {
                  const isOpen = openIndex === index;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden transition-colors"
                    >
                      <button
                        onClick={() => toggleFAQ(index)}
                        className="w-full flex items-center justify-between p-6 text-left group transition-colors hover:bg-primary/5 cursor-pointer"
                      >
                        <div className="flex items-start gap-4 pr-4">
                          <HelpCircle className={`w-6 h-6 mt-0.5 flex-shrink-0 transition-colors ${isOpen ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-primary'}`} />
                          <span className="font-bold text-card-foreground text-base md:text-lg group-hover:text-primary transition-colors">
                            {faq.pregunta}
                          </span>
                        </div>
                        <motion.div
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className={`p-2 rounded-xl flex-shrink-0 transition-colors ${isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}`}
                        >
                          <ChevronDown className="w-5 h-5" />
                        </motion.div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                          >
                            <div className="px-6 pb-6 pt-2 text-muted-foreground text-sm md:text-base leading-relaxed border-t border-border bg-muted/10">
                              {faq.respuesta}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              ) : (
                /* Estado Vacío */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-card rounded-3xl shadow-sm p-12 text-center border border-border transition-colors"
                >
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-card-foreground mb-2">No encontramos resultados</h3>
                  <p className="text-muted-foreground">Intenta buscando con otros términos o seleccionando otra categoría.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Footer de Soporte Adicional */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-16 bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-8 text-primary-foreground flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl"
          >
            <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <MessageCircle className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h3 className="text-xl font-bold">¿Aún tienes dudas?</h3>
                <p className="text-primary-foreground/90 text-sm mt-1">Nuestro equipo de soporte técnico de Alik Tours está listo para ayudarte.</p>
              </div>
            </div>
            <motion.button
              onClick={() => navigate("/contact")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-background text-primary font-bold rounded-xl text-sm shadow-md hover:bg-background/90 transition-colors whitespace-nowrap cursor-pointer"
            >
              Contactar Soporte
            </motion.button>
          </motion.div>
        </div>
      </div>
      <Footer />
    </>
  );
}