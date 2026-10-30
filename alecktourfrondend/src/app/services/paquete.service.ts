import { apiFetch } from '../api/v1/api';

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
  // Calculada en el backend (primer hotel vinculado) — null si el paquete
  // todavía no tiene ningún hotel real asociado.
  ciudad_destino?: string | null;
  // Portada del paquete (mismo patrón que Hotel.imagen_url) -- antes
  // Paquete no tenía ningún campo de imagen propio, ver POST
  // /paquetes/{id}/imagen en reserva_route.py.
  imagen_url?: string | null;
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