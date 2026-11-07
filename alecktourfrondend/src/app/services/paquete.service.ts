import { apiFetch } from '../api/v1/api';
import type { OfertaVuelo } from './vuelo.service';

export type ModalidadAlojamiento = 'sin' | 'incluido' | 'opcional';
export type ModalidadVuelo = 'sin' | 'incluido' | 'opcional' | 'cotizacion';
export type UnidadPrecio = 'por_persona' | 'por_paquete';
export type CategoriaInclusion =
  | 'alojamiento' | 'desayuno' | 'alimentacion' | 'transporte_terrestre' | 'transporte_aereo'
  | 'actividades' | 'entradas' | 'guia' | 'traslados' | 'seguro' | 'gastos_personales'
  | 'equipaje' | 'impuestos' | 'otro';

export const ETIQUETA_CATEGORIA_INCLUSION: Record<CategoriaInclusion, string> = {
  alojamiento: 'Alojamiento',
  desayuno: 'Desayuno',
  alimentacion: 'Alimentación',
  transporte_terrestre: 'Transporte terrestre',
  transporte_aereo: 'Transporte aéreo',
  actividades: 'Actividades',
  entradas: 'Entradas',
  guia: 'Guía turístico',
  traslados: 'Traslados',
  seguro: 'Seguro',
  gastos_personales: 'Gastos personales',
  equipaje: 'Equipaje',
  impuestos: 'Impuestos y cargos',
  otro: 'Otro',
};

export const ETIQUETA_MODALIDAD_ALOJAMIENTO: Record<ModalidadAlojamiento, string> = {
  sin: 'Sin alojamiento',
  incluido: 'Alojamiento incluido',
  opcional: 'Alojamiento opcional',
};

export const ETIQUETA_MODALIDAD_VUELO: Record<ModalidadVuelo, string> = {
  sin: 'Sin vuelo',
  incluido: 'Vuelo incluido',
  opcional: 'Vuelo opcional',
  cotizacion: 'Vuelo sujeto a cotización',
};

export interface ItinerarioDia {
  id_dia?: number;
  dia: number;
  titulo: string;
  descripcion?: string | null;
  actividades?: string | null;
  horario?: string | null;
  lugar?: string | null;
  informacion_adicional?: string | null;
}

export interface InclusionPaquete {
  id_inclusion?: number;
  tipo: 'incluye' | 'no_incluye';
  categoria: CategoriaInclusion;
  descripcion: string;
}

export interface SalidaPaquete {
  id_salida?: number;
  fecha_salida: string;
  fecha_regreso?: string | null;
  cupos?: number | null;
  estado: 'abierta' | 'cerrada';
  notas?: string | null;
  cupos_usados?: number;
  cupos_disponibles?: number | null;
}

export interface PaquetePopular {
  id_paquete: number;
  nombre_paquete: string;
  descripcion: string;
  duracion_dias: number;
  precio_base: number;
  activo: boolean;
  total_reservas: number;
  calificacion_estimada: number;
}

export interface PaqueteResponse {
  id_paquete: number;
  nombre_paquete: string;
  descripcion: string;
  duracion_dias: number;
  precio_base: number;
  activo: boolean;
  // Ciudad de SALIDA del viaje (vuelo/transporte incluido) — distinta de la
  // ciudad de destino, que se deriva de los hoteles reales vinculados
  // (ver PaqueteDetalleResponse.hoteles[].ciudad).
  ciudad_salida?: string | null;
  condiciones?: string | null;
  /** Qué no incluye, una línea por ítem. */
  no_incluye?: string | null;
  // Calculada en el backend (primer hotel vinculado) — null si el paquete
  // todavía no tiene ningún hotel real asociado.
  ciudad_destino?: string | null;
  // Portada del paquete (mismo patrón que Hotel.imagen_url) -- antes
  // Paquete no tenía ningún campo de imagen propio, ver POST
  // /paquetes/{id}/imagen en reserva_route.py.
  imagen_url?: string | null;
  // Ficha comercial completa
  noches?: number | null;
  destino_ciudad?: string | null;
  destino_pais?: string | null;
  destinos_secundarios?: string | null;
  categoria?: string | null;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
  modalidad_alojamiento?: ModalidadAlojamiento;
  modalidad_vuelo?: ModalidadVuelo;
  unidad_precio?: UnidadPrecio;
  precio_nino?: number | null;
  precio_infante?: number | null;
  min_viajeros?: number | null;
  max_viajeros?: number | null;
}

// Una foto de la galería del paquete (distinta de imagen_url, la portada) --
// ver POST/DELETE /paquetes/{id}/galeria en reserva_route.py.
export interface ImagenGaleriaResponse {
  id_imagen: number;
  url: string;
  orden: number;
}

export interface PaqueteHotelDetalle {
  id_hotel: number;
  nombre_hotel: string;
  ciudad: string | null;
  pais: string | null;
  calificacion: number | null;
  noches_incluidas: number | null;
  caracteristicas: string[];
  // Foto real del hotel (Hotel.imagen_url) -- antes la ficha de paquete no
  // la pedía y usaba una foto genérica por ciudad en su lugar.
  imagen_url: string | null;
}

export interface PaqueteServicioDetalle {
  id_servicio: number;
  nombre_servicio: string;
  categoria: string | null;
  descripcion: string | null;
  dia_actividad: number | null;
  incluido: boolean;
  capacidad_maxima: number | null;
  /** Solo en los opcionales: se cobra por persona al agregarlo. */
  precio_por_persona?: number | null;
}

// Igual que PaqueteResponse pero con destinos/hoteles/servicios reales —
// usado en la página de detalle del paquete (antes mostraba datos de
// ejemplo hardcodeados desde data/packages.ts).
export interface PaqueteDetalleResponse extends PaqueteResponse {
  destinos: string[];
  hoteles: PaqueteHotelDetalle[];
  servicios: PaqueteServicioDetalle[];
  // Galería de fotos reales del paquete (distinta de imagen_url, la
  // portada).
  imagenes: ImagenGaleriaResponse[];
  itinerario?: ItinerarioDia[];
  inclusiones?: InclusionPaquete[];
  salidas?: SalidaPaquete[];
  vuelos?: OfertaVuelo[];
}

export const paqueteService = {
  getAll: (skip = 0, limit = 10) =>
    apiFetch<PaqueteResponse[]>(`/paquetes?skip=${skip}&limit=${limit}`),

  getById: (id: number) =>
    apiFetch<PaqueteResponse>(`/paquetes/${id}`),

  getDetalle: (id: number) =>
    apiFetch<PaqueteDetalleResponse>(`/paquetes/${id}/detalle`),

  // Usa la vista vista_paquetes_populares del backend
  getPopulares: (limit = 6) =>
    apiFetch<PaquetePopular[]>(`/paquetes/populares?limit=${limit}`),

  create: (data: Partial<PaqueteResponse>) =>
    apiFetch<PaqueteResponse>('/paquetes', { method: 'POST', body: data }),

  update: (id: number, data: Partial<PaqueteResponse>) =>
    apiFetch<PaqueteResponse>(`/paquetes/${id}`, { method: 'PUT', body: data }),

  delete: (id: number) =>
    apiFetch<{ message: string }>(`/paquetes/${id}`, { method: 'DELETE' }),

  // Paquetes con destino real parecido para la sección "también te puede
  // interesar" -- ver GET /paquetes/{id}/similares en reserva_route.py.
  getSimilares: (id: number, limit = 6) =>
    apiFetch<PaqueteResponse[]>(`/paquetes/${id}/similares?limit=${limit}`),

  // Sube/reemplaza la portada del paquete (POST /paquetes/{id}/imagen) --
  // antes Paquete no tenía ningún campo de imagen propio.
  subirImagen: (id: number, imagen: File) => {
    const fd = new FormData();
    fd.append('imagen', imagen);
    return apiFetch<PaqueteResponse>(`/paquetes/${id}/imagen`, { method: 'POST', body: fd });
  },

  // Galería de fotos (distinta de la portada, ver subirImagen arriba).
  subirFotoGaleria: (id: number, imagen: File) => {
    const fd = new FormData();
    fd.append('imagen', imagen);
    return apiFetch<ImagenGaleriaResponse>(`/paquetes/${id}/galeria`, { method: 'POST', body: fd });
  },

  borrarFotoGaleria: (id: number, idImagen: number) =>
    apiFetch<{ message: string }>(`/paquetes/${id}/galeria/${idImagen}`, { method: 'DELETE' }),
};