import { apiFetch } from '../api/v1/api';

export type TipoPqr =
  | 'peticion'
  | 'informacion'
  | 'consulta'
  | 'queja'
  | 'reclamo'
  | 'sugerencia'
  | 'felicitacion';

export type EstadoPqr = 'radicada' | 'en_tramite' | 'esperando_cliente' | 'respondida' | 'cerrada' | 'desistida';
export type DecisionPqr = 'favorable' | 'parcial' | 'desfavorable' | 'informativa';
export type EstadoPlazo =
  | 'a_tiempo'
  | 'por_vencer'
  | 'vencida'
  | 'pausada'
  | 'respondida_a_tiempo'
  | 'respondida_tarde';

export interface PqrTipo {
  tipo: TipoPqr;
  nombre: string;
  descripcion: string;
  dias: number;
  norma: string;
}

export interface PqrResumen {
  id_pqr: number;
  radicado: string;
  tipo: TipoPqr;
  tipo_nombre: string;
  canal: string;
  asunto: string;
  estado: EstadoPqr;
  prioridad: 'normal' | 'alta';
  id_cliente: number;
  cliente_nombre: string | null;
  id_reserva: number | null;
  id_responsable: number | null;
  responsable_nombre: string | null;
  dias_termino: number;
  fecha_radicacion: string;
  fecha_vencimiento: string;
  prorrogada: boolean;
  dias_habiles_restantes: number;
  estado_plazo: EstadoPlazo;
  decision: DecisionPqr | null;
  fecha_respuesta: string | null;
  satisfaccion: number | null;
  ultima_actividad: string | null;
}

export interface PqrActuacion {
  id_actuacion: number;
  tipo: string;
  texto: string | null;
  autor_nombre: string | null;
  autor_equipo: boolean;
  visible_cliente: boolean;
  fecha: string;
}

export interface PqrDetalle extends PqrResumen {
  descripcion: string;
  pretension: string | null;
  reserva_titulo: string | null;
  fecha_vencimiento_original: string | null;
  motivo_prorroga: string | null;
  respuesta: string | null;
  comentario_satisfaccion: string | null;
  fecha_cierre: string | null;
  puede_prorrogar: boolean;
  puede_solicitar_informacion: boolean;
  actuaciones: PqrActuacion[];
}

export interface PqrCrearInput {
  tipo: TipoPqr;
  asunto: string;
  descripcion: string;
  pretension?: string;
  id_reserva?: number | null;
  autoriza_datos: boolean;
  id_cliente?: number;
  canal?: 'web' | 'telefono' | 'presencial' | 'correo' | 'whatsapp';
}

export interface PqrResumenGestion {
  abiertas: number;
  sin_asignar: number;
  por_vencer: number;
  vencidas: number;
  respondidas: number;
  a_tiempo_pct: number | null;
  satisfaccion_promedio: number | null;
}

export interface PqrPagina {
  items: PqrResumen[];
  total: number;
  page: number;
  page_size: number;
  resumen: PqrResumenGestion;
}

export interface FiltrosGestionPqr {
  estado?: string;
  tipo?: string;
  responsable?: string;
  plazo?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

function query(f: FiltrosGestionPqr) {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const pqrService = {
  tipos: () => apiFetch<PqrTipo[]>('/pqr/tipos'),
  mias: () => apiFetch<PqrResumen[]>('/pqr/mias'),
  ver: (id: number) => apiFetch<PqrDetalle>(`/pqr/${id}`),
  radicar: (data: PqrCrearInput) => apiFetch<PqrDetalle>('/pqr', { method: 'POST', body: data }),
  escribir: (id: number, texto: string, interna = false) =>
    apiFetch<PqrDetalle>(`/pqr/${id}/mensajes`, { method: 'POST', body: { texto, interna } }),
  desistir: (id: number, motivo?: string) =>
    apiFetch<PqrDetalle>(`/pqr/${id}/desistir`, { method: 'POST', body: { motivo } }),
  calificar: (id: number, satisfaccion: number, comentario?: string) =>
    apiFetch<PqrDetalle>(`/pqr/${id}/calificar`, { method: 'POST', body: { satisfaccion, comentario } }),

  // Equipo (admin y asesores)
  gestion: (f: FiltrosGestionPqr) => apiFetch<PqrPagina>(`/pqr/gestion${query(f)}`),
  responsables: () => apiFetch<{ id_usuario: number; nombre: string }[]>('/pqr/gestion/responsables'),
  deCliente: (idCliente: number) => apiFetch<PqrResumen[]>(`/pqr/gestion/cliente/${idCliente}`),
  actualizar: (id: number, data: { estado?: 'en_tramite'; prioridad?: 'normal' | 'alta'; id_responsable?: number }) =>
    apiFetch<PqrDetalle>(`/pqr/${id}/gestion`, { method: 'PATCH', body: data }),
  solicitarInformacion: (id: number, texto: string) =>
    apiFetch<PqrDetalle>(`/pqr/${id}/solicitar-informacion`, { method: 'POST', body: { texto } }),
  prorrogar: (id: number, dias_adicionales: number, motivo: string) =>
    apiFetch<PqrDetalle>(`/pqr/${id}/prorrogar`, { method: 'POST', body: { dias_adicionales, motivo } }),
  responder: (id: number, decision: DecisionPqr, respuesta: string) =>
    apiFetch<PqrDetalle>(`/pqr/${id}/responder`, { method: 'POST', body: { decision, respuesta } }),
  cerrar: (id: number, motivo: string) =>
    apiFetch<PqrDetalle>(`/pqr/${id}/cerrar`, { method: 'POST', body: { motivo } }),
};
