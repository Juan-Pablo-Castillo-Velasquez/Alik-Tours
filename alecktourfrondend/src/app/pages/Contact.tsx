import { CheckCircle2, Clock, MapPin, MessageSquare, Send, User } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { FormEvent, useEffect, useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { ClienteResponse, clienteService } from "../services/cliente.service";
import { contactoService } from "../services/contacto.service";

export default function Contact() {
  const { usuario, isAuthenticated } = useAuth();
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Si el cliente está logueado, se autocompletan nombre/correo con los
  // datos reales del perfil (GET /clientes/{id}) — nunca se inventan.
  const [cliente, setCliente] = useState<ClienteResponse | null>(null);
  const [autocompletando, setAutocompletando] = useState(false);

  useEffect(() => {
    let activo = true;
    if (!isAuthenticated || !usuario?.id_cliente) {
      setCliente(null);
      return;
    }
    setAutocompletando(true);
    clienteService
      .getById(usuario.id_cliente)
      .then((c) => {
        if (!activo) return;
        setCliente(c);
        setNombre(`${c.nombre} ${c.apellido}`.trim());
        setCorreo(c.correo);
      })
      .catch(() => {
        // Si falla, solo dejamos que el usuario escriba a mano.
      })
      .finally(() => activo && setAutocompletando(false));
    return () => {
      activo = false;
    };
  }, [isAuthenticated, usuario?.id_cliente]);

  const reenviarOtro = () => {
    setEnviado(false);
    if (cliente) {
      setNombre(`${cliente.nombre} ${cliente.apellido}`.trim());
      setCorreo(cliente.correo);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await contactoService.enviar({ nombre, correo, asunto, mensaje });
      setEnviado(true);
      // Limpiar formulario
      setNombre("");
      setCorreo("");
      setAsunto("");
      setMensaje("");
    } catch (err) {
      console.error("Error enviando contacto:", err);
      setError(
        "No pudimos enviar tu mensaje. Intenta de nuevo en unos minutos.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background transition-colors duration-300">
        <Navbar />

        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* Encabezado Principal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent mb-4">
              Ponte en Contacto
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              ¿Planeando tu próxima escapada o necesitas asistencia con un
              paquete personalizado? Nuestro equipo experto está a un mensaje de
              distancia.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* COLUMNA IZQUIERDA: Tarjetas de Información */}
            <div className="lg:col-span-5 space-y-6">
              {/* Tarjeta Informativa Principal */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card p-8 rounded-3xl shadow-lg border border-border relative overflow-hidden transition-colors"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10" />

                <h2 className="text-2xl font-bold text-card-foreground mb-6 flex items-center gap-3">
                  <MessageSquare className="text-primary w-6 h-6" />
                  Atención Inmediata
                </h2>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                        Oficina Central
                      </h3>
                      <p className="text-card-foreground font-medium text-sm mt-0.5">
                        Av. El Dorado #68b-45, Edificio C
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Bogotá, Colombia
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Tarjeta de Horarios - Gradiente oficial */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-primary to-primary/80 p-6 rounded-3xl text-primary-foreground shadow-xl flex items-center gap-5"
              >
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                  <Clock className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Horario de Operaciones</h3>
                  <p className="text-primary-foreground/90 text-sm mt-0.5">
                    Lunes a Viernes: 8:00 AM - 7:00 PM
                  </p>
                  <p className="text-primary-foreground/90 text-sm">
                    Sábados y Domingos: 9:00 AM - 4:00 PM
                  </p>
                </div>
              </motion.div>
            </div>

            {/* COLUMNA DERECHA: Formulario de Contacto */}
            <div className="lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card p-8 md:p-10 rounded-3xl shadow-lg border border-border transition-colors"
              >
                <AnimatePresence mode="wait">
                  {!enviado ? (
                    /* Formulario Activo */
                    <motion.form
                      key="contact-form"
                      onSubmit={handleSubmit}
                      className="space-y-6"
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-card-foreground">
                            Tu nombre completo
                          </label>
                          <input
                            type="text"
                            required
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            disabled={!!cliente || autocompletando}
                            placeholder="Ej. Alejandro Pérez"
                            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/60 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-muted/40"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-card-foreground">
                            Correo electrónico
                          </label>
                          <input
                            type="email"
                            required
                            value={correo}
                            onChange={(e) => setCorreo(e.target.value)}
                            disabled={!!cliente || autocompletando}
                            placeholder="ejemplo@correo.com"
                            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/60 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-muted/40"
                          />
                        </div>
                      </div>

                      {cliente && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-xl px-4 py-3">
                          <User className="w-4 h-4 text-primary shrink-0" />
                          <span>
                            Usarás los datos de tu cuenta: enviaremos la
                            respuesta a <strong className="text-foreground">{cliente.correo}</strong>. Si
                            prefieres otro correo, cierra sesión o escríbenos
                            desde el formulario de invitado.
                          </span>
                        </div>
                      )}
                      {autocompletando && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-block h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Cargando tus datos de cuenta...
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-card-foreground">
                          Asunto del mensaje
                        </label>
                        <input
                          type="text"
                          required
                          value={asunto}
                          onChange={(e) => setAsunto(e.target.value)}
                          placeholder="Ej. Cotización paquete Cancún / Problema con mi reserva"
                          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/60"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-card-foreground">
                          ¿En qué podemos ayudarte?
                        </label>
                        <textarea
                          rows={5}
                          required
                          value={mensaje}
                          onChange={(e) => setMensaje(e.target.value)}
                          placeholder="Escribe detalladamente tus dudas, fechas tentativas o requerimientos especiales..."
                          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-foreground resize-none placeholder:text-muted-foreground/60"
                        />
                      </div>

                      {error && (
                        <p className="text-sm text-red-500 text-center">
                          {error}
                        </p>
                      )}

                      {/* Botón de Envío Animado - Identidad Alik Tours */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl font-bold text-base shadow-md hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {loading ? (
                          <div className="w-6 h-6 border-3 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send className="w-5 h-5 text-secondary" />
                            Enviar Mensaje de Consulta
                          </>
                        )}
                      </motion.button>
                    </motion.form>
                  ) : (
                    /* Vista de Éxito Post-Envío */
                    <motion.div
                      key="success-message"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-12 px-4"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 200,
                          damping: 15,
                        }}
                        className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
                      >
                        <CheckCircle2 className="w-12 h-12" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">
                        ¡Mensaje enviado con éxito!
                      </h3>
                      <p className="text-muted-foreground max-w-md mx-auto mb-8">
                        Gracias por escribirnos. Hemos registrado tu solicitud
                        en el sistema de Alik Tours y un asesor te responderá al
                        correo electrónico en menos de 2 horas.
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={reenviarOtro}
                        className="px-6 py-3 border border-border text-foreground rounded-xl font-semibold hover:bg-secondary/10 transition-colors cursor-pointer"
                      >
                        Enviar otro mensaje
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
