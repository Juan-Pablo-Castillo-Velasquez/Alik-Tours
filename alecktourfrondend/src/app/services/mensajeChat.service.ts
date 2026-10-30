import { apiFetch } from "../api/v1/api";

// Espejo de ReservaResumenChatResponse -- resumen mínimo de la reserva
// etiquetada en un mensaje (ver mensaje_chat_schema.py).
export interface ReservaResumenChat {
  id_reserva: number;
  nombre_paquete: string | null;
  destino: string | null;
  hotel_nombre: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

// Espejo de MensajeChatResponse (backend/app/schemas/mensaje_chat_schema.py).
export interface MensajeChat {
  id_mensaje: number;
  id_cliente: number;
  id_usuario_remitente: number;
  remitente_tipo: "admin" | "cliente";
  contenido: string | null;
  imagen_url: string | null;
  // Adjunto que no es una imagen (por ahora, PDF real) -- nunca coexiste
  // con imagen_url en el mismo mensaje. Ver archivo_url en
  // mensaje_chat_schema.py.
  archivo_url: string | null;
  archivo_nombre: string | null;
  // Reserva de la que se está hablando en este mensaje, si se etiquetó una
  // -- null si no se etiquetó ninguna, o si la reserva ya se borró.
  id_reserva: number | null;
  reserva: ReservaResumenChat | null;
  leido: boolean;
  fecha_envio: string | null;
  // Denormalizados por el backend (MensajeChatRepository) para no tener
  // que resolver el nombre/foto del remitente aparte en el frontend.
  remitente_nombre: string | null;
  remitente_foto: string | null;
}

// Mensajes de chat de soporte, no documentos -- mismo límite validado en
// el backend (ver CONTENIDO_MAX_LENGTH en mensaje_chat_route.py). Vive acá
// para que el contador/límite del textarea (ModuleMensajes.tsx,
// TabMensajes.tsx) nunca se desincronice del valor real que exige el
// servidor.
export const MENSAJE_CONTENIDO_MAX_LENGTH = 500;

// Espejo de HiloResumenResponse -- una fila por cliente en la bandeja
// compartida del admin (ModuleMensajes.tsx). No existe una tabla de
// "hilo": esto se deriva agregando mensajes_chat por id_cliente.
export interface HiloResumen {
  id_cliente: number;
  cliente_nombre: string;
  cliente_foto: string | null;
  ultimo_mensaje: string | null;
  ultimo_mensaje_fecha: string | null;
  // Quién escribió el último mensaje -- "cliente" | "admin". Lo usa
  // ModuleMensajes.tsx para aproximar "en línea" (cliente activo hace
  // poco) y la alerta de "sin responder en 5 minutos" -- ver
  // ultimo_mensaje_remitente_tipo en HiloResumenResponse (backend).
  ultimo_mensaje_remitente_tipo: "admin" | "cliente" | null;
  no_leidos: number;
}

// Espejo de HilosPaginadosResponse -- GET /mensajes/hilos ya NO devuelve
// un array plano (bug real de producción: ModuleMensajes.tsx seguía
// haciendo `hilos.find(...)` sobre lo que pasó a ser este objeto, y
// tronaba con "e.find is not a function" en cuanto cargaban los hilos).
export interface HilosPaginados {
  items: HiloResumen[];
  total: number;
  skip: number;
  limit: number;
}

function construirFormData(contenido?: string, archivo?: File, idReserva?: number, clientMsgId?: string): FormData {
  const fd = new FormData();
  if (contenido) fd.append("contenido", contenido);
  if (archivo) fd.append("archivo", archivo);
  if (idReserva != null) fd.append("id_reserva", String(idReserva));
  // Id de idempotencia: el backend rechaza (409) un segundo envío con el
  // mismo id, así un doble clic o un reintento no guardan dos mensajes.
  if (clientMsgId) fd.append("client_msg_id", clientMsgId);
  return fd;
}

/** Id único por intento de envío (se reutiliza solo si se reintenta el mismo). */
export function nuevoClientMsgId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Une mensajes nuevos a la lista sin repetir ninguno (por id_mensaje) y en
 * orden. El polling cada 5 s y la respuesta del POST de envío pueden traer
 * el MISMO mensaje: antes ambos se concatenaban y el mensaje aparecía dos
 * veces. No es un filtro visual: es la reconciliación de dos fuentes que
 * describen el mismo registro de la base de datos.
 */
export function fusionarMensajes(actuales: MensajeChat[], nuevos: MensajeChat[]): MensajeChat[] {
  if (nuevos.length === 0) return actuales;
  const porId = new Map<number, MensajeChat>();
  for (const m of actuales) porId.set(m.id_mensaje, m);
  for (const m of nuevos) porId.set(m.id_mensaje, m);
  return Array.from(porId.values()).sort((a, b) => a.id_mensaje - b.id_mensaje);
}

// Opciones de paginación de un hilo -- afterId para polling incremental
// (mensajes nuevos), beforeId para cargar historial anterior. El backend
// rechaza combinar ambos en la misma petición (ver _validar_after_before
// en mensaje_chat_route.py), así que nunca se pasan juntos desde acá.
interface OpcionesHilo {
  afterId?: number;
  beforeId?: number;
}

function construirQueryHilo(opts?: OpcionesHilo): string {
  const params = new URLSearchParams();
  if (opts?.afterId != null) params.set("after_id", String(opts.afterId));
  if (opts?.beforeId != null) params.set("before_id", String(opts.beforeId));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// Chat privado admin<->cliente (con capturas vía Cloudinary) -- un solo
// hilo continuo por cliente, bandeja compartida (cualquier admin ve y
// responde cualquier hilo). Solo polling, sin websockets (ver el
// comentario de mensaje_chat_route.py: el backend está en el plan free de
// Render, que duerme tras 15 min de inactividad y mataría cualquier
// socket abierto) -- por eso getHilo/getMiHilo aceptan `afterId` para
// pedir solo los mensajes nuevos en cada ciclo, en vez de recargar todo
// el hilo.
export const mensajeChatService = {
  // ── Admin (bandeja compartida) ──────────────────────────────────────
  getHilos: (opts?: { search?: string; skip?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.search) params.set("search", opts.search);
    if (opts?.skip != null) params.set("skip", String(opts.skip));
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return apiFetch<HilosPaginados>(`/mensajes/hilos${qs ? `?${qs}` : ""}`);
  },

  getHilo: (idCliente: number, opts?: OpcionesHilo) =>
    apiFetch<MensajeChat[]>(`/mensajes/hilos/${idCliente}${construirQueryHilo(opts)}`),

  enviarComoAdmin: (idCliente: number, contenido?: string, archivo?: File, idReserva?: number, clientMsgId?: string) => {
    const fd = construirFormData(contenido, archivo, idReserva, clientMsgId);
    fd.append("id_cliente", String(idCliente));
    return apiFetch<MensajeChat>("/mensajes/enviar", { method: "POST", body: fd });
  },

  // ── Cliente (su propio hilo) ─────────────────────────────────────────
  getMiHilo: (opts?: OpcionesHilo) => apiFetch<MensajeChat[]>(`/mensajes/me${construirQueryHilo(opts)}`),

  enviarComoCliente: (contenido?: string, archivo?: File, idReserva?: number, clientMsgId?: string) =>
    apiFetch<MensajeChat>("/mensajes/me/enviar", {
      method: "POST",
      body: construirFormData(contenido, archivo, idReserva, clientMsgId),
    }),

  // ── Compartidos por ambos roles ──────────────────────────────────────
  // idCliente: lo pasa el admin (indica de qué hilo); el cliente lo omite
  // -- su propio hilo se resuelve del token en el backend, nunca de un
  // parámetro.
  marcarLeido: (idCliente?: number) =>
    apiFetch<{ actualizados: number }>("/mensajes/leido", {
      method: "PATCH",
      body: idCliente != null ? { id_cliente: idCliente } : {},
    }),

  getNoLeidos: () => apiFetch<{ no_leidos: number }>("/mensajes/no-leidos"),
};
