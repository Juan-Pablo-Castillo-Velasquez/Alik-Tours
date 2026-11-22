/** Utilidades de presentación de una reserva compartidas por la
 * confirmación, Mis reservas y el detalle. */

/** Código que el cliente puede dictar a un asesor: sale del id real de la reserva. */
export function codigoReserva(id: number) {
  return `AT-${String(id).padStart(6, "0")}`;
}

export type TipoReserva = "hotel" | "paquete" | "vuelo";

/** Qué se reservó: el backend lo dice en `tipo_producto`; las reservas
 * viejas no lo traen y se deduce de lo que tengan. */
export function tipoReserva(r: {
  tipo_producto?: string | null;
  id_paquete?: number | null;
  vuelo_ruta?: string | null;
  hotel_nombre?: string | null;
}): TipoReserva {
  if (r.tipo_producto === "paquete" || r.tipo_producto === "vuelo" || r.tipo_producto === "hotel") return r.tipo_producto;
  if (r.id_paquete) return "paquete";
  if (r.vuelo_ruta && !r.hotel_nombre) return "vuelo";
  return "hotel";
}

export const ETIQUETA_TIPO: Record<TipoReserva, string> = {
  hotel: "Hotel",
  paquete: "Paquete",
  vuelo: "Vuelo",
};

/** Título legible de la reserva (nunca "Paquete #None"). */
export function tituloReserva(r: {
  id_reserva: number;
  nombre_paquete?: string | null;
  hotel_nombre?: string | null;
  vuelo_ruta?: string | null;
  tipo_producto?: string | null;
  id_paquete?: number | null;
}) {
  const tipo = tipoReserva(r);
  if (r.nombre_paquete) return r.nombre_paquete;
  if (tipo === "vuelo" && r.vuelo_ruta) return `Vuelo ${r.vuelo_ruta}`;
  if (r.hotel_nombre) return `Estadía en ${r.hotel_nombre}`;
  if (r.vuelo_ruta) return `Vuelo ${r.vuelo_ruta}`;
  return `Reserva ${codigoReserva(r.id_reserva)}`;
}

/** Porcentaje pagado (0–100), sin pasarse por redondeos o abonos de más. */
export function porcentajePagado(total: number | null | undefined, pagado: number | null | undefined) {
  const t = Number(total ?? 0);
  if (t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(pagado ?? 0) / t) * 100)));
}
