import { apiFetch, BASE_URL } from "../api/v1/api";

// Espejo de app/schemas/comunidad_schema.py
export interface AutorComunidad {
  nombre: string;
  foto: string | null;
}

export interface ComentarioComunidad {
  id_comentario: number;
  id_publicacion: number;
  contenido: string;
  oculto: boolean;
  fecha_creacion: string | null;
  autor: AutorComunidad;
  es_mio: boolean;
}

export type EstadoPublicacion = "pendiente" | "aprobada" | "rechazada" | "oculta";

export interface PublicacionComunidad {
  id_publicacion: number;
  titulo: string;
  contenido: string;
  calificacion: number | null;
  destino: string | null;
  video_url: string | null;
  imagenes: string[];
  estado: EstadoPublicacion;
  motivo_moderacion: string | null;
  fecha_creacion: string | null;
  autor: AutorComunidad;
  comentarios: ComentarioComunidad[];
  total_comentarios: number;
  es_mia: boolean;
}

export interface PublicacionesPaginadas {
  items: PublicacionComunidad[];
  total: number;
  skip: number;
  limit: number;
}

export interface VideoAgencia {
  id_video: number;
  titulo: string;
  descripcion: string | null;
  video_url: string;
  portada_url: string | null;
  orden: number;
  activo: boolean;
  fecha_creacion: string | null;
}

export interface NuevaPublicacion {
  titulo: string;
  contenido: string;
  calificacion?: number;
  destino?: string;
  video?: File;
  imagenes?: File[];
}

// Mismos límites que valida el backend (comunidad_route.py).
export const LIMITES_COMUNIDAD = {
  videoMaxBytes: 50 * 1024 * 1024,
  videoMaxSegundos: 60,
  fotoMaxBytes: 5 * 1024 * 1024,
  maxFotos: 4,
  comentarioMax: 500,
  videoAgenciaMaxBytes: 80 * 1024 * 1024,
};

/** URL absoluta de un archivo (Cloudinary ya viene absoluta; disco local es /uploads/...). */
export function resolveMediaComunidad(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${BASE_URL}${url}`;
}

export const comunidadService = {
  // Público
  getPublicaciones: (skip = 0, limit = 10) =>
    apiFetch<PublicacionesPaginadas>(`/comunidad/publicaciones?skip=${skip}&limit=${limit}`),
  getVideos: () => apiFetch<VideoAgencia[]>("/comunidad/videos"),

  // Cliente
  getMisPublicaciones: () => apiFetch<PublicacionComunidad[]>("/comunidad/mis-publicaciones"),
  publicar: (data: NuevaPublicacion) => {
    const fd = new FormData();
    fd.append("titulo", data.titulo);
    fd.append("contenido", data.contenido);
    if (data.calificacion) fd.append("calificacion", String(data.calificacion));
    if (data.destino) fd.append("destino", data.destino);
    if (data.video) fd.append("video", data.video);
    (data.imagenes ?? []).forEach((img) => fd.append("imagenes", img));
    return apiFetch<PublicacionComunidad>("/comunidad/publicaciones", { method: "POST", body: fd });
  },
  borrarPublicacion: (id: number) =>
    apiFetch<{ message: string }>(`/comunidad/publicaciones/${id}`, { method: "DELETE" }),
  comentar: (idPublicacion: number, contenido: string) =>
    apiFetch<ComentarioComunidad>(`/comunidad/publicaciones/${idPublicacion}/comentarios`, {
      method: "POST",
      body: { contenido },
    }),
  borrarComentario: (id: number) => apiFetch<{ message: string }>(`/comunidad/comentarios/${id}`, { method: "DELETE" }),

  // Moderación (admin / asesor)
  adminGetPublicaciones: (estado?: EstadoPublicacion) =>
    apiFetch<PublicacionComunidad[]>(`/comunidad/admin/publicaciones${estado ? `?estado=${estado}` : ""}`),
  adminModerar: (id: number, estado: EstadoPublicacion, motivo?: string) =>
    apiFetch<PublicacionComunidad>(`/comunidad/admin/publicaciones/${id}/moderar`, {
      method: "PUT",
      body: { estado, motivo: motivo || null },
    }),
  adminBorrarPublicacion: (id: number) =>
    apiFetch<{ message: string }>(`/comunidad/admin/publicaciones/${id}`, { method: "DELETE" }),
  adminOcultarComentario: (id: number, oculto: boolean) =>
    apiFetch<ComentarioComunidad>(`/comunidad/admin/comentarios/${id}`, { method: "PUT", body: { oculto } }),

  // Videos de la agencia (admin)
  adminGetVideos: () => apiFetch<VideoAgencia[]>("/comunidad/admin/videos"),
  adminSubirVideo: (data: { titulo: string; descripcion?: string; video: File; portada?: File }) => {
    const fd = new FormData();
    fd.append("titulo", data.titulo);
    if (data.descripcion) fd.append("descripcion", data.descripcion);
    fd.append("video", data.video);
    if (data.portada) fd.append("portada", data.portada);
    return apiFetch<VideoAgencia>("/comunidad/admin/videos", { method: "POST", body: fd });
  },
  adminEditarVideo: (id: number, data: Partial<Pick<VideoAgencia, "titulo" | "descripcion" | "activo" | "orden">>) =>
    apiFetch<VideoAgencia>(`/comunidad/admin/videos/${id}`, { method: "PUT", body: data }),
  adminBorrarVideo: (id: number) =>
    apiFetch<{ message: string }>(`/comunidad/admin/videos/${id}`, { method: "DELETE" }),
};

/** Duración real de un video local (segundos) leyendo sus metadatos en el navegador. */
export function duracionVideo(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? v.duration : 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    v.src = url;
  });
}
