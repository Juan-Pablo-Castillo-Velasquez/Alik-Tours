import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronUp,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  Loader2,
  MessageCircle,
  Paperclip,
  Receipt,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { resolveFotoUrl, inputCls } from "../admin/types";
import {
  MENSAJE_CONTENIDO_MAX_LENGTH,
  fusionarMensajes,
  mensajeChatService,
  nuevoClientMsgId,
  type MensajeChat,
} from "../../services/mensajeChat.service";
import type { ReservaResponse } from "../../data/reservaTypes";
import { fmt } from "./TabReservas/utils";

// Chat privado con el equipo de Alik Tours -- un solo hilo continuo (no uno
// por reserva); cualquier admin puede responder. Solo polling cada 5s
// (sin websockets, mismo criterio que ModuleMensajes.tsx del panel admin).
const POLL_MENSAJES_MS = 5000;
// Mismo límite que devuelve MensajeChatRepository.get_mensajes por defecto
// (backend) -- si la carga trae exactamente este número, asumimos que
// puede haber más historial antes y mostramos "Cargar mensajes anteriores".
const LIMITE_HISTORIAL = 50;

const CATEGORIAS_INICIALES = [
  { icon: UserRound, label: "Problema con mi cuenta", texto: "Tengo un problema con mi cuenta: " },
  { icon: CalendarDays, label: "Problema con una reserva", texto: "Tengo un problema con una reserva: " },
  { icon: Receipt, label: "Problema de facturación", texto: "Tengo un problema de facturación: " },
  { icon: CreditCard, label: "Problema con un pago", texto: "Tengo un problema con un pago: " },
  { icon: HelpCircle, label: "Otra consulta", texto: "" },
] as const;

function etiquetaReserva(r: ReservaResponse): string {
  const nombre = r.nombre_paquete || (r.hotel_nombre ? `Estadía en ${r.hotel_nombre}` : `Reserva #${r.id_reserva}`);
  return `${nombre} · ${fmt(r.fecha_inicio)}`;
}

interface Props {
  // Reservas del propio cliente (mismas que ya carga Profile.tsx para
  // TabReservas) -- alimenta el selector "¿de qué reserva hablas?" sin
  // pedirlas de nuevo al backend. Sin ellas, el chat sigue funcionando
  // igual, solo sin selector.
  reservas?: ReservaResponse[];
  // Deep-link desde "Hablar de esta reserva" en TabReservas -- preselecciona
  // esa reserva en el composer al entrar a esta pestaña.
  reservaIdInicial?: number | null;
}

export default function TabMensajes({ reservas = [], reservaIdInicial = null }: Props) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [idReservaSeleccionada, setIdReservaSeleccionada] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [imagenAmpliada, setImagenAmpliada] = useState<string | undefined>(undefined);
  const [hayMasAnteriores, setHayMasAnteriores] = useState(false);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mensajesRef = useRef<MensajeChat[]>([]);
  mensajesRef.current = mensajes;
  // Candado síncrono de envío: `enviando` es estado de React y no se
  // actualiza entre dos pulsaciones rápidas de Enter, así que no basta.
  const enviandoRef = useRef(false);
  // El polling no arranca hasta tener el historial inicial: sin esto, un
  // ciclo que corría antes de la carga pedía el hilo completo (afterId
  // indefinido) y lo concatenaba encima del mismo historial.
  const cargaInicialListaRef = useRef(false);

  useEffect(() => {
    mensajeChatService
      .getMiHilo()
      .then((data) => {
        setMensajes((prev) => fusionarMensajes(prev, data));
        setHayMasAnteriores(data.length >= LIMITE_HISTORIAL);
      })
      .catch(console.error)
      .finally(() => {
        cargaInicialListaRef.current = true;
        setLoading(false);
      });
    // Abrir la pestaña ya cuenta como "leer" los mensajes del admin.
    mensajeChatService.marcarLeido().catch(() => {});
  }, []);

  // "Hablar de esta reserva" (TabReservas) -- preselecciona la reserva y
  // deja el cursor listo para escribir, sin pisar lo que el cliente ya
  // hubiera escrito si vuelve a pasar por acá.
  useEffect(() => {
    if (reservaIdInicial == null) return;
    setIdReservaSeleccionada(reservaIdInicial);
    setTexto((actual) => (actual ? actual : "Quiero hablar sobre esta reserva: "));
    textareaRef.current?.focus();
  }, [reservaIdInicial]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!cargaInicialListaRef.current) return;
      const actuales = mensajesRef.current;
      const ultimoId = actuales.length ? actuales[actuales.length - 1].id_mensaje : undefined;
      try {
        const nuevos = await mensajeChatService.getMiHilo({ afterId: ultimoId });
        if (nuevos.length > 0) {
          setMensajes((prev) => fusionarMensajes(prev, nuevos));
          if (nuevos.some((m) => m.remitente_tipo === "admin")) {
            mensajeChatService.marcarLeido().catch(() => {});
          }
        }
      } catch {
        /* se reintenta en el próximo ciclo */
      }
    }, POLL_MENSAJES_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes.length]);

  const cargarAnteriores = async () => {
    if (mensajes.length === 0 || cargandoAnteriores) return;
    const contenedor = scrollRef.current;
    const scrollHeightAntes = contenedor?.scrollHeight ?? 0;
    setCargandoAnteriores(true);
    try {
      const anteriores = await mensajeChatService.getMiHilo({ beforeId: mensajes[0].id_mensaje });
      setHayMasAnteriores(anteriores.length >= LIMITE_HISTORIAL);
      if (anteriores.length > 0) {
        setMensajes((prev) => fusionarMensajes(prev, anteriores));
        // Mantiene la posición visual del scroll -- sin esto, insertar
        // mensajes arriba deja al cliente viendo un punto distinto del hilo.
        requestAnimationFrame(() => {
          if (contenedor) contenedor.scrollTop = contenedor.scrollHeight - scrollHeightAntes;
        });
      }
    } catch {
      // se puede reintentar con el mismo botón
    } finally {
      setCargandoAnteriores(false);
    }
  };

  const limpiarArchivo = () => {
    setArchivo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const excedeLimite = texto.length > MENSAJE_CONTENIDO_MAX_LENGTH;

  const usarPlantilla = (textoInicial: string) => {
    setTexto(textoInicial);
    textareaRef.current?.focus();
  };

  const enviar = async () => {
    if ((!texto.trim() && !archivo) || excedeLimite || enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const nuevo = await mensajeChatService.enviarComoCliente(
        texto.trim() || undefined,
        archivo ?? undefined,
        idReservaSeleccionada ?? undefined,
        nuevoClientMsgId(),
      );
      setMensajes((prev) => fusionarMensajes(prev, [nuevo]));
      setTexto("");
      limpiarArchivo();
    } catch {
      // el texto/archivo quedan como estaban para poder reintentar
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const reservaSeleccionada = useMemo(
    () => reservas.find((r) => r.id_reserva === idReservaSeleccionada) ?? null,
    [reservas, idReservaSeleccionada],
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Mensajes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escríbele directo a nuestro equipo -- por aquí puedes hablar de tus reservas o enviar capturas de pantalla.
        </p>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-320px)] min-h-[420px]">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Cargando tu conversación...</p>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {mensajes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <MessageCircle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                  <h3 className="text-base font-bold text-foreground tracking-tight">Aún no tienes mensajes</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1 mb-4">
                    Cuéntanos qué necesitas -- te responderá el equipo de Alik Tours.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 max-w-sm">
                    {CATEGORIAS_INICIALES.map(({ icon: Icon, label, texto: textoPlantilla }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => usarPlantilla(textoPlantilla)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/40 text-xs font-medium text-foreground hover:bg-muted hover:border-primary/40 transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5 text-primary" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {hayMasAnteriores && (
                    <div className="flex justify-center pb-1">
                      <button
                        type="button"
                        onClick={cargarAnteriores}
                        disabled={cargandoAnteriores}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        {cargandoAnteriores ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ChevronUp className="w-3.5 h-3.5" />
                        )}
                        Cargar mensajes anteriores
                      </button>
                    </div>
                  )}
                  {mensajes.map((m) => (
                    <div key={m.id_mensaje} className={`flex ${m.remitente_tipo === "cliente" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[80%] sm:max-w-[70%] flex flex-col gap-1">
                        {m.remitente_tipo === "admin" && (
                          <span className="text-[11px] text-muted-foreground px-1">{m.remitente_nombre ?? "Alik Tours"}</span>
                        )}
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 ${
                            m.remitente_tipo === "cliente"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {m.reserva && (
                            <p
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold mb-1.5 px-1.5 py-0.5 rounded-full ${
                                m.remitente_tipo === "cliente"
                                  ? "bg-primary-foreground/15 text-primary-foreground"
                                  : "bg-primary/10 text-primary"
                              }`}
                            >
                              <CalendarDays className="w-3 h-3" />
                              {m.reserva.nombre_paquete || m.reserva.hotel_nombre || `Reserva #${m.reserva.id_reserva}`}
                            </p>
                          )}
                          {m.imagen_url && (
                            <img
                              src={resolveFotoUrl(m.imagen_url)}
                              alt="Captura enviada"
                              className="rounded-lg mb-1.5 max-h-56 object-cover cursor-pointer"
                              onClick={() => setImagenAmpliada(resolveFotoUrl(m.imagen_url))}
                            />
                          )}
                          {m.archivo_url && (
                            <a
                              href={resolveFotoUrl(m.archivo_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={m.archivo_nombre ?? undefined}
                              className={`flex items-center gap-2 mb-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                                m.remitente_tipo === "cliente"
                                  ? "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
                                  : "bg-background text-foreground hover:bg-muted"
                              }`}
                            >
                              <FileText className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate flex-1">{m.archivo_nombre || "Documento"}</span>
                              <Download className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                            </a>
                          )}
                          {m.contenido && <p className="text-sm whitespace-pre-wrap break-words">{m.contenido}</p>}
                          <p
                            className={`text-[10px] mt-1 ${
                              m.remitente_tipo === "cliente" ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            {m.fecha_envio
                              ? new Date(m.fecha_envio).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {reservas.length > 0 && (
              <div className="px-5 pt-2.5 flex items-center gap-2 flex-wrap border-t border-border/60">
                <span className="text-[11px] text-muted-foreground">¿De qué reserva hablas? (opcional)</span>
                <select
                  value={idReservaSeleccionada ?? ""}
                  onChange={(e) => setIdReservaSeleccionada(e.target.value ? Number(e.target.value) : null)}
                  className="text-xs bg-muted/40 border border-border rounded-lg px-2 py-1 text-foreground outline-none focus:ring-2 focus:ring-primary/40 max-w-[220px]"
                >
                  <option value="">Ninguna reserva en particular</option>
                  {reservas.map((r) => (
                    <option key={r.id_reserva} value={r.id_reserva}>
                      {etiquetaReserva(r)}
                    </option>
                  ))}
                </select>
                {reservaSeleccionada && (
                  <button
                    type="button"
                    onClick={() => setIdReservaSeleccionada(null)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Quitar reserva"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {archivo && (
              <div className="px-5 pt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground truncate">{archivo.name}</span>
                <button onClick={limpiarArchivo} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="px-5 py-3 border-t border-border flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0"
                title="Adjuntar imagen o PDF"
                type="button"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <div className="flex-1 flex flex-col gap-1">
                <textarea
                  ref={textareaRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                  placeholder="Escribe un mensaje..."
                  rows={1}
                  className={`${inputCls} resize-none w-full`}
                />
                {texto.length > MENSAJE_CONTENIDO_MAX_LENGTH * 0.8 && (
                  <span className={`text-[10px] self-end ${excedeLimite ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {texto.length}/{MENSAJE_CONTENIDO_MAX_LENGTH}
                  </span>
                )}
              </div>
              <button
                onClick={enviar}
                disabled={enviando || excedeLimite || (!texto.trim() && !archivo)}
                className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-all flex-shrink-0"
                title="Enviar"
                type="button"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {imagenAmpliada && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
            onClick={() => setImagenAmpliada(undefined)}
          >
            <img src={imagenAmpliada} alt="Captura ampliada" className="max-w-full max-h-full rounded-lg" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
