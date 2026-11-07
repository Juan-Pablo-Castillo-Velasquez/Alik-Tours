import { apiFetch } from '../api/v1/api';

export type EstadoOferta = 'borrador' | 'publicada' | 'pausada' | 'agotada' | 'finalizada';
export type TipoTrayecto = 'solo_ida' | 'ida_regreso' | 'multiples';
export type ClaseVuelo = 'economica' | 'premium_economy' | 'ejecutiva' | 'primera';
export type TipoServicio = 'regular' | 'charter' | 'bajo_costo' | 'otro';

export const ETIQUETA_TIPO_SERVICIO: Record<TipoServicio, string> = {
  regular: 'Vuelo regular',
  charter: 'Vuelo chárter',
  bajo_costo: 'Aerolínea de bajo costo',
  otro: 'Otro',
};

/** Oferta aérea gestionada por la agencia (no es disponibilidad en tiempo real). */
export interface OfertaVuelo {
  id_oferta: number;
  titulo: string;
  descripcion?: string | null;
  estado: EstadoOferta;
  aerolinea?: string | null;
  numero_vuelo?: string | null;
  codigo_referencia?: string | null;
  imagen_url?: string | null;
  tipo_servicio?: TipoServicio | null;
  documentos_requeridos?: string | null;
  venta_independiente: boolean;
  origen_pais?: string | null;
  origen_ciudad: string;
  origen_aeropuerto?: string | null;
  origen_iata?: string | null;
  origen_zona_horaria?: string | null;
  destino_pais?: string | null;
  destino_ciudad: string;
  destino_aeropuerto?: string | null;
  destino_iata?: string | null;
  destino_zona_horaria?: string | null;
  tipo_trayecto: TipoTrayecto;
  fecha_salida: string;
  hora_salida?: string | null;
  fecha_llegada?: string | null;
  hora_llegada?: string | null;
  fecha_regreso?: string | null;
  hora_regreso?: string | null;
  fecha_llegada_regreso?: string | null;
  hora_llegada_regreso?: string | null;
  duracion_estimada?: string | null;
  clase?: ClaseVuelo | null;
  escalas?: number | null;
  aeropuertos_conexion?: string | null;
  horarios_conexion?: string | null;
  equipaje_mano?: string | null;
  equipaje_bodega?: string | null;
  condiciones_cambio?: string | null;
  condiciones_cancelacion?: string | null;
  restricciones?: string | null;
  informacion_adicional?: string | null;
  precio_adulto: number;
  precio_nino?: number | null;
  precio_infante?: number | null;
  impuestos_incluidos?: boolean | null;
  cargos_adicionales: number;
  descripcion_cargos?: string | null;
  cupos?: number | null;
  cupos_usados: number;
  cupos_disponibles?: number | null;
  vigencia_hasta?: string | null;
  condiciones_comerciales?: string | null;
}

export interface OfertaVueloAdmin extends OfertaVuelo {
  reservas_activas: number;
  paquetes: { id_paquete: number; nombre_paquete: string }[];
}

export interface PaginaOfertas {
  items: OfertaVueloAdmin[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface FiltrosOfertas {
  estado?: string;
  q?: string;
  origen?: string;
  destino?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  aerolinea?: string;
  pagina?: number;
  por_pagina?: number;
}

export interface PasajeroOferta {
  id_reserva: number;
  estado_reserva: string;
  cliente: string;
  tipo: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento?: string | null;
  nacionalidad?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
}

export interface ReservaDeOferta {
  id_reserva: number;
  estado: string;
  cliente: string;
  tipo_producto?: string | null;
  adultos?: number | null;
  ninos?: number | null;
  infantes?: number | null;
  estado_vuelo?: string | null;
  fecha_reserva?: string | null;
}

export type OfertaVueloInput = Partial<Omit<OfertaVuelo, 'id_oferta' | 'cupos_usados' | 'cupos_disponibles' | 'imagen_url'>>;

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const ETIQUETA_ESTADO_OFERTA: Record<EstadoOferta, string> = {
  borrador: 'Borrador',
  publicada: 'Publicada',
  pausada: 'Pausada',
  agotada: 'Agotada',
  finalizada: 'Finalizada',
};

export const ETIQUETA_CLASE: Record<ClaseVuelo, string> = {
  economica: 'Económica',
  premium_economy: 'Premium economy',
  ejecutiva: 'Ejecutiva',
  primera: 'Primera clase',
};

export const ETIQUETA_TRAYECTO: Record<TipoTrayecto, string> = {
  solo_ida: 'Solo ida',
  ida_regreso: 'Ida y regreso',
  multiples: 'Varios trayectos',
};

/** "Bogotá (BOG) → Cartagena (CTG)". */
export function rutaOferta(o: Pick<OfertaVuelo, 'origen_ciudad' | 'origen_iata' | 'destino_ciudad' | 'destino_iata' | 'tipo_trayecto'>): string {
  const a = `${o.origen_ciudad}${o.origen_iata ? ` (${o.origen_iata})` : ''}`;
  const b = `${o.destino_ciudad}${o.destino_iata ? ` (${o.destino_iata})` : ''}`;
  return `${a} ${o.tipo_trayecto === 'ida_regreso' ? '⇄' : '→'} ${b}`;
}

/** "08:30" desde "08:30:00". */
export function hora(h?: string | null): string | null {
  return h ? h.slice(0, 5) : null;
}

export const vueloService = {
  listarPublicas: (filtros: Omit<FiltrosOfertas, 'estado' | 'q' | 'pagina' | 'por_pagina'> & { solo_independientes?: boolean } = {}) =>
    apiFetch<OfertaVuelo[]>(`/vuelos${query(filtros)}`),
  listarAdmin: (filtros: FiltrosOfertas = {}) => apiFetch<PaginaOfertas>(`/vuelos/admin${query({ ...filtros })}`),
  obtener: (id: number) => apiFetch<OfertaVueloAdmin>(`/vuelos/${id}`),
  crear: (datos: OfertaVueloInput) => apiFetch<OfertaVueloAdmin>('/vuelos', { method: 'POST', body: datos }),
  editar: (id: number, datos: OfertaVueloInput) => apiFetch<OfertaVueloAdmin>(`/vuelos/${id}`, { method: 'PUT', body: datos }),
  cambiarEstado: (id: number, estado: EstadoOferta) =>
    apiFetch<OfertaVueloAdmin>(`/vuelos/${id}/estado`, { method: 'PATCH', body: { estado } }),
  eliminar: (id: number) => apiFetch<{ message: string }>(`/vuelos/${id}`, { method: 'DELETE' }),
  subirImagen: (id: number, imagen: File) => {
    const fd = new FormData();
    fd.append('imagen', imagen);
    return apiFetch<OfertaVueloAdmin>(`/vuelos/${id}/imagen`, { method: 'POST', body: fd });
  },
  reservas: (id: number) => apiFetch<ReservaDeOferta[]>(`/vuelos/${id}/reservas`),
  pasajeros: (id: number) => apiFetch<PasajeroOferta[]>(`/vuelos/${id}/pasajeros`),
};
