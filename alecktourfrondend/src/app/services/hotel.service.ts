import { apiFetch } from '../api/v1/api';

export interface CaracteristicaResponse {
  id_caracteristica: number;
  nombre_caracteristica: string;
}

export interface HotelCaracteristicaResponse {
  id_hotel: number;
  id_caracteristica: number;
  disponible: boolean;
  caracteristica?: CaracteristicaResponse;
}

export interface TipoHabitacionResponse {
  id_tipo_habitacion: number;
  nombre_tipo: string;
  descripcion?: string;
  capacidad_personas: number;
}

export interface HabitacionResponse {
  id_habitacion: number;
  id_hotel: number;
  id_tipo_habitacion: number;
  numero_habitacion: string;
  precio_noche: number;
  estado: string;
  tipo_habitacion?: TipoHabitacionResponse;
}

// Una foto de la galería del hotel (distinta de imagen_url, la portada) --
// ver POST/DELETE /hoteles/{id}/galeria en hotel_route.py.
export interface ImagenGaleriaResponse {
  id_imagen: number;
  url: string;
  orden: number;
}

export interface HotelResponse {
  id_hotel: number;
  nombre_hotel: string;
  calificacion: number;
  ciudad: string;
  pais: string;
  direccion?: string;
  codigo_postal?: string;
  correo_electronico: string;
  telefono: string;
  imagen_url?: string | null;
  descripcion?: string | null;
  politicas?: string | null;
  // Reseñas reales de clientes (calculadas en el backend desde la tabla
  // `resenas`) — total_resenas siempre viene, calificacion_promedio es
  // null si el hotel todavía no tiene ninguna reseña real.
  total_resenas: number;
  calificacion_promedio: number | null;
}

export interface HotelDetailResponse extends HotelResponse {
  habitaciones: HabitacionResponse[];
  hotel_caracteristicas: HotelCaracteristicaResponse[];
  // Galería de fotos reales (distinta de imagen_url, la portada) -- antes
  // no existía ninguna forma de subir más de una foto por hotel.
  imagenes?: ImagenGaleriaResponse[];
}

export interface RangoOcupado {
  fecha_checkin: string;
  fecha_checkout: string;
}

export interface HabitacionFechasOcupadas {
  id_habitacion: number;
  rangos: RangoOcupado[];
}

// Sugerencia de destino respaldada por hoteles reales (ver
// HotelRepository.get_destinos_reales en el backend) -- a diferencia del
// catálogo /destinos/sugerencias (pensado para servicios/actividades, sin
// relación con los hoteles), esto nunca sugiere una ciudad sin al menos un
// hotel real. total_hoteles es el conteo real, nunca inventado.
export interface DestinoReal {
  ciudad: string;
  pais: string | null;
  total_hoteles: number;
}

export const hotelService = {
  // El backend ya responde con HotelDetailResponse (incluye habitaciones y
  // hotel_caracteristicas) también en el listado, no solo en el detalle —
  // el tipo aquí reflejaba solo un subconjunto y forzaba casts `as any`
  // en SearchResults.tsx/HotelCard.tsx para leer esos campos.
  //
  // fechaCheckin/fechaCheckout son opcionales (FASE G): cuando se mandan,
  // el backend filtra a hoteles con disponibilidad real para esas fechas
  // (ver GET /hoteles/ en hotel_route.py) — antes el buscador las capturaba
  // pero nunca las enviaba, así que nunca filtraban nada de verdad.
  getAll: (skip = 0, limit = 50, opts?: { fechaCheckin?: string; fechaCheckout?: string }) => {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (opts?.fechaCheckin && opts?.fechaCheckout) {
      params.set('fecha_checkin', opts.fechaCheckin);
      params.set('fecha_checkout', opts.fechaCheckout);
    }
    return apiFetch<HotelDetailResponse[]>(`/hoteles/?${params.toString()}`);
  },

  getById: (id: number) =>
    apiFetch<HotelDetailResponse>(`/hoteles/${id}`),

  // Sugerencias de destino para el buscador (SearchBar.tsx), respaldadas
  // por hoteles reales -- antes el buscador usaba destinoService.getSugerencias
  // (catálogo de servicios/actividades sin relación con los hoteles), que
  // podía sugerir/aceptar una ciudad sin ningún hotel ni paquete real.
  getDestinosSugeridos: (q = '', limit = 8) =>
    apiFetch<DestinoReal[]>(`/hoteles/destinos-sugeridos?q=${encodeURIComponent(q)}&limit=${limit}`),

  // Fechas ya reservadas por habitación (reservas activas) — para mostrarle
  // al cliente disponibilidad real antes de elegir fechas. Nunca expone
  // quién reservó, solo los rangos (ver GET /hoteles/{id}/fechas-ocupadas).
  getFechasOcupadas: (id: number) =>
    apiFetch<HabitacionFechasOcupadas[]>(`/hoteles/${id}/fechas-ocupadas`),

  create: (data: Partial<HotelResponse>) =>
    apiFetch<HotelResponse>('/hoteles/', { method: 'POST', body: data }),

  update: (id: number, data: Partial<HotelResponse>) =>
    apiFetch<HotelResponse>(`/hoteles/${id}`, { method: 'PUT', body: data }),

  delete: (id: number) =>
    apiFetch<{ message: string }>(`/hoteles/${id}`, { method: 'DELETE' }),

  // Sube/reemplaza la foto principal del hotel (POST /hoteles/{id}/imagen,
  // ver hotel_route.py) — antes Hotel no tenía ningún campo de imagen real.
  subirImagen: (id: number, imagen: File) => {
    const fd = new FormData();
    fd.append('imagen', imagen);
    return apiFetch<HotelResponse>(`/hoteles/${id}/imagen`, { method: 'POST', body: fd });
  },

  // Catálogo de tipos de habitación (Individual, Doble, Suite, etc.) — el
  // backend ya tenía el modelo/schema pero ningún endpoint para leerlo.
  getTiposHabitacion: () =>
    apiFetch<TipoHabitacionResponse[]>('/hoteles/tipos-habitacion/'),

  createTipoHabitacion: (data: { nombre_tipo: string; descripcion?: string; capacidad_personas: number }) =>
    apiFetch<TipoHabitacionResponse>('/hoteles/tipos-habitacion/', { method: 'POST', body: data }),

  // Habitaciones: el backend ya tenía el CRUD completo, solo faltaba el
  // wrapper del lado del frontend para usarlo desde el admin.
  createHabitacion: (hotelId: number, data: { id_tipo_habitacion: number; numero_habitacion: string; precio_noche: number; estado?: string }) =>
    apiFetch<HabitacionResponse>(`/hoteles/${hotelId}/habitaciones`, { method: 'POST', body: data }),

  updateHabitacion: (habitacionId: number, data: Partial<{ numero_habitacion: string; precio_noche: number; estado: string }>) =>
    apiFetch<HabitacionResponse>(`/hoteles/habitaciones/${habitacionId}`, { method: 'PUT', body: data }),

  deleteHabitacion: (habitacionId: number) =>
    apiFetch<{ message: string }>(`/hoteles/habitaciones/${habitacionId}`, { method: 'DELETE' }),

  // Hoteles de la misma ciudad (excluyendo este) para la sección "también
  // te puede interesar" de la ficha de hotel -- ver GET
  // /hoteles/{id}/similares en hotel_route.py.
  getSimilares: (id: number, limit = 6) =>
    apiFetch<HotelDetailResponse[]>(`/hoteles/${id}/similares?limit=${limit}`),

  // Galería de fotos (distinta de la portada, ver subirImagen arriba) --
  // antes no existía ninguna forma de subir más de una foto real por hotel.
  subirFotoGaleria: (id: number, imagen: File) => {
    const fd = new FormData();
    fd.append('imagen', imagen);
    return apiFetch<ImagenGaleriaResponse>(`/hoteles/${id}/galeria`, { method: 'POST', body: fd });
  },

  borrarFotoGaleria: (id: number, idImagen: number) =>
    apiFetch<{ message: string }>(`/hoteles/${id}/galeria/${idImagen}`, { method: 'DELETE' }),
};