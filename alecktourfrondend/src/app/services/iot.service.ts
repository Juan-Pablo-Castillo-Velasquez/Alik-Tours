import { apiFetch } from '../api/v1/api';

export interface LecturaIoT {
  id_lectura: number;
  medido_en: string | null;
  recibido_en: string;
  latitud: number | null;
  longitud: number | null;
  velocidad_kmh: number | null;
  temperatura_c: number | null;
  humedad_pct: number | null;
  pasajeros: number | null;
  bateria_pct: number | null;
}

export type EstadoDispositivo = 'en_linea' | 'inactivo' | 'sin_datos';

export interface DispositivoIoT {
  id_dispositivo: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  ultima_conexion: string | null;
  estado: EstadoDispositivo;
  ultima_lectura: LecturaIoT | null;
  alertas: string[];
}

export const iotService = {
  dispositivos: () => apiFetch<DispositivoIoT[]>('/iot/dispositivos'),
  crear: (datos: { nombre: string; descripcion?: string }) =>
    apiFetch<DispositivoIoT & { clave: string }>('/iot/dispositivos', { method: 'POST', body: datos }),
  cambiarActivo: (id: number, activo: boolean) =>
    apiFetch<DispositivoIoT>(`/iot/dispositivos/${id}/activo?activo=${activo}`, { method: 'PATCH' }),
  lecturas: (id: number, limite = 30) => apiFetch<LecturaIoT[]>(`/iot/dispositivos/${id}/lecturas?limite=${limite}`),
};
