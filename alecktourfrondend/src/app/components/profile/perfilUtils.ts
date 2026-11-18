import { parseFechaLocal } from "./TabReservas/utils";

type ReservaBasica = {
  id_reserva: number;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  nombre_paquete?: string | null;
  hotel_nombre?: string | null;
  vuelo_ruta?: string | null;
  saldo_pendiente?: number | null;
};

/** Nombre legible de una reserva: paquete, hotel o vuelo (nunca "Paquete #"). */
export function nombreReserva(r: ReservaBasica): string {
  if (r.nombre_paquete) return r.nombre_paquete;
  if (r.hotel_nombre) return `Estadía en ${r.hotel_nombre}`;
  if (r.vuelo_ruta) return `Vuelo ${r.vuelo_ruta}`;
  return `Reserva #${r.id_reserva}`;
}

function hoyLocal(): Date {
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth(), h.getDate());
}

/** Reservas vigentes que todavía no terminan, de la más cercana a la más lejana. */
export function proximasReservas<T extends ReservaBasica>(reservas: T[]): T[] {
  const hoy = hoyLocal().getTime();
  return reservas
    .filter((r) => (r.estado === "confirmada" || r.estado === "pendiente") && parseFechaLocal(r.fecha_fin).getTime() >= hoy)
    .sort((a, b) => parseFechaLocal(a.fecha_inicio).getTime() - parseFechaLocal(b.fecha_inicio).getTime());
}

export function diasHasta(fecha: string): number {
  return Math.round((parseFechaLocal(fecha).getTime() - hoyLocal().getTime()) / 86_400_000);
}

/** Saldo total por pagar de las reservas vigentes. */
export function saldoPorPagar(reservas: ReservaBasica[]): number {
  return reservas
    .filter((r) => r.estado === "confirmada" || r.estado === "pendiente")
    .reduce((s, r) => s + Number(r.saldo_pendiente ?? 0), 0);
}

export const pesos = (v: number) => `$${Math.round(v).toLocaleString("es-CO")}`;
