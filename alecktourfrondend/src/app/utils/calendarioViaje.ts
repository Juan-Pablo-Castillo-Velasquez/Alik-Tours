// Archivo .ics para agregar un viaje al calendario del celular o del correo
// (Google Calendar, Outlook, Calendario de Apple). Evento de día completo
// desde la entrada hasta la salida.

const escapar = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const compacta = (iso: string) => iso.slice(0, 10).replace(/-/g, "");

export interface ViajeCalendario {
  codigo: string;
  titulo: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD (día de salida)
  lugar?: string | null;
  descripcion?: string | null;
}

export function icsDeViaje(v: ViajeCalendario, ahora = new Date()): string {
  // En un evento de día completo, DTEND es exclusivo: el día después de la
  // salida, para que el calendario incluya el día en que se sale.
  const fin = new Date(`${v.fechaFin.slice(0, 10)}T00:00:00Z`);
  fin.setUTCDate(fin.getUTCDate() + 1);
  const sello = ahora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alik Tours//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${v.codigo}@aliktours`,
    `DTSTAMP:${sello}`,
    `DTSTART;VALUE=DATE:${compacta(v.fechaInicio)}`,
    `DTEND;VALUE=DATE:${compacta(fin.toISOString())}`,
    `SUMMARY:${escapar(v.titulo)}`,
    v.lugar ? `LOCATION:${escapar(v.lugar)}` : null,
    `DESCRIPTION:${escapar([`Reserva ${v.codigo} en Alik Tours`, v.descripcion].filter(Boolean).join("\n"))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function descargarIcs(v: ViajeCalendario): void {
  const blob = new Blob([icsDeViaje(v)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `viaje-${v.codigo}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
