/**
 * Parsea "YYYY-MM-DD" (o timestamps ISO) en horario LOCAL para evitar
 * el desfase de timezone que producía new Date(string) al interpretar
 * la fecha como UTC.
 */
export function parseFechaLocal(fecha: string): Date {
  if (!fecha) return new Date(NaN);
  const soloFecha = fecha.split("T")[0];
  const [y, m, d] = soloFecha.split("-").map(Number);
  if (!y || !m || !d) return new Date(fecha);
  return new Date(y, m - 1, d);
}

export const nights = (a: string, b: string) =>
  Math.max(
    1,
    Math.ceil(
      (parseFechaLocal(b).getTime() - parseFechaLocal(a).getTime()) / 86400000,
    ),
  );

export const fmt = (d: string, opts?: Intl.DateTimeFormatOptions) =>
  parseFechaLocal(d).toLocaleDateString(
    "es-CO",
    opts ?? { day: "numeric", month: "short", year: "numeric" },
  );

export type EstadoViaje = "futuro" | "hoy" | "en_curso" | "finalizado";

/**
 * Determina en qué punto de su ciclo de vida está un viaje respecto a "hoy":
 * - futuro: aún no llega la fecha de check-in
 * - hoy: el check-in es exactamente hoy
 * - en_curso: ya empezó y todavía no llega el check-out
 * - finalizado: el check-out ya pasó
 */
export function getEstadoViaje(
  fechaInicio: string,
  fechaFin: string,
  hoy: Date,
): EstadoViaje {
  const ini = parseFechaLocal(fechaInicio).getTime();
  const fin = parseFechaLocal(fechaFin).getTime();
  const h = hoy.getTime();
  if (h < ini) return "futuro";
  if (h === ini) return "hoy";
  if (h <= fin) return "en_curso";
  return "finalizado";
}
/**
 * Comparte una reserva usando la Web Share API nativa (móvil / navegadores
 * compatibles) y cae a copiar el resumen al portapapeles si no está disponible
 * o si el usuario cierra el share sheet por error de plataforma.
 */
export async function compartirReserva(reserva: any): Promise<"compartido" | "copiado" | "cancelado" | "error"> {
  const partes = [
    `Mi reserva en Alik Tours #ID-${reserva.id_reserva}`,
    reserva.id_paquete ? `Paquete #${reserva.id_paquete}` : null,
    reserva.fecha_inicio && reserva.fecha_fin
      ? `${fmt(reserva.fecha_inicio)} → ${fmt(reserva.fecha_fin)}`
      : null,
    reserva.precio_total
      ? `Total: $${Number(reserva.precio_total).toLocaleString("es-CO")} COP`
      : null,
  ].filter(Boolean);
  const texto = partes.join("\n");
  const url = `${window.location.origin}/profile`;

  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await (navigator as any).share({
        title: "Mi reserva en Alik Tours",
        text: texto,
        url,
      });
      return "compartido";
    } catch (err: any) {
      // El usuario cerró el share sheet: no es un error real, no hacemos fallback.
      if (err?.name === "AbortError") return "cancelado";
      // Cualquier otra falla (API no soportada de facto, etc.) cae al portapapeles.
    }
  }

  try {
    await navigator.clipboard.writeText(`${texto}\n${url}`);
    return "copiado";
  } catch {
    return "error";
  }
}
