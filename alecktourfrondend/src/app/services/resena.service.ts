import { apiFetch } from "../api/v1/api";

export interface ResenaCreate {
  id_reserva: number;
  calificacion: number;
  comentario: string;
  foto_url?: string;
}

export interface ResenaResponse {
  id_resena: number;
  id_reserva: number;
  id_hotel: number;
  calificacion: number;
  comentario: string;
  foto_url?: string;
  fecha_creacion: string;
  nombre_cliente?: string;
  fecha_edicion?: string | null;
  respuesta_agencia?: string | null;
  fecha_respuesta?: string | null;
  visible?: boolean;
  nombre_hotel?: string | null;
}

export type FiltroResenasAdmin = "sin_responder" | "ocultas" | "bajas";

export const resenaService = {
  crear: (data: ResenaCreate) =>
    apiFetch<ResenaResponse>("/resenas", { method: "POST", body: data }),
  getByHotel: (idHotel: number) =>
    apiFetch<ResenaResponse[]>(`/resenas/hotel/${idHotel}`),

  // Cliente
  mias: () => apiFetch<ResenaResponse[]>("/resenas/mias"),
  editar: (id: number, data: { calificacion?: number; comentario?: string }) =>
    apiFetch<ResenaResponse>(`/resenas/${id}`, { method: "PUT", body: data }),
  borrar: (id: number) => apiFetch<{ message: string }>(`/resenas/${id}`, { method: "DELETE" }),

  // Equipo (admin / asesor)
  adminListar: (filtro?: FiltroResenasAdmin) =>
    apiFetch<ResenaResponse[]>(`/resenas/admin/todas${filtro ? `?filtro=${filtro}` : ""}`),
  adminResponder: (id: number, respuesta: string | null) =>
    apiFetch<ResenaResponse>(`/resenas/admin/${id}/responder`, { method: "PUT", body: { respuesta } }),
  adminVisibilidad: (id: number, visible: boolean) =>
    apiFetch<ResenaResponse>(`/resenas/admin/${id}/visibilidad`, { method: "PUT", body: { visible } }),
};
