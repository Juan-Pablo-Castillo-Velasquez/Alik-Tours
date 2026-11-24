import type { DecisionPqr, EstadoPlazo, EstadoPqr, PqrResumen, TipoPqr } from "../services/pqr.service";

/** Copia local de los tipos y plazos para pintar sin esperar al API; la
 * fuente de verdad es GET /api/pqr/tipos (mismos valores). */
export const TIPOS_PQR: { tipo: TipoPqr; nombre: string; corto: string; dias: number; ayuda: string }[] = [
  { tipo: "peticion", nombre: "Petición", corto: "Petición", dias: 15, ayuda: "Pides un cambio, un trámite o una gestión sobre tu viaje." },
  { tipo: "reclamo", nombre: "Reclamo", corto: "Reclamo", dias: 15, ayuda: "Un servicio no se prestó como se ofreció y pides que se corrija o se reembolse." },
  { tipo: "queja", nombre: "Queja", corto: "Queja", dias: 15, ayuda: "Tu inconformidad con la atención o el trato que recibiste." },
  { tipo: "informacion", nombre: "Información o documentos", corto: "Información", dias: 10, ayuda: "Una copia, un certificado o un dato puntual de tu reserva." },
  { tipo: "consulta", nombre: "Consulta", corto: "Consulta", dias: 30, ayuda: "Un concepto u orientación sobre nuestros servicios." },
  { tipo: "sugerencia", nombre: "Sugerencia", corto: "Sugerencia", dias: 15, ayuda: "Una idea para mejorar." },
  { tipo: "felicitacion", nombre: "Felicitación", corto: "Felicitación", dias: 15, ayuda: "Reconocer una buena experiencia o a alguien del equipo." },
];

export const NOMBRE_TIPO_PQR: Record<TipoPqr, string> = Object.fromEntries(
  TIPOS_PQR.map((t) => [t.tipo, t.nombre]),
) as Record<TipoPqr, string>;

export const ESTADO_PQR: Record<EstadoPqr, { texto: string; clase: string }> = {
  radicada: { texto: "Radicada", clase: "bg-info/10 text-info" },
  en_tramite: { texto: "En trámite", clase: "bg-primary/10 text-primary" },
  esperando_cliente: { texto: "Esperando tu respuesta", clase: "bg-warning/15 text-warning" },
  respondida: { texto: "Respondida", clase: "bg-success/10 text-success" },
  cerrada: { texto: "Cerrada", clase: "bg-muted text-muted-foreground" },
  desistida: { texto: "Desistida", clase: "bg-muted text-muted-foreground" },
};

/** En el panel del equipo "esperando_cliente" se lee distinto. */
export const ESTADO_PQR_EQUIPO: Record<EstadoPqr, string> = {
  ...Object.fromEntries(Object.entries(ESTADO_PQR).map(([k, v]) => [k, v.texto])),
  esperando_cliente: "Esperando al cliente",
} as Record<EstadoPqr, string>;

export const DECISION_PQR: Record<DecisionPqr, { texto: string; clase: string }> = {
  favorable: { texto: "Accedemos a lo que pediste", clase: "border-success/30 bg-success/5 text-success" },
  parcial: { texto: "Accedemos en parte", clase: "border-warning/30 bg-warning/5 text-warning" },
  desfavorable: { texto: "No accedemos a lo que pediste", clase: "border-destructive/30 bg-destructive/5 text-destructive" },
  informativa: { texto: "Respuesta informativa", clase: "border-info/30 bg-info/5 text-info" },
};

export const ABIERTOS: EstadoPqr[] = ["radicada", "en_tramite", "esperando_cliente"];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-12-16" → "16 dic 2026" sin pasar por la zona horaria (es una fecha, no un instante). */
export function fechaCorta(iso: string | null | undefined) {
  if (!iso) return "—";
  if (iso.length > 10) {
    // Es un instante (radicación, respuesta): se muestra el día en la hora local.
    const f = new Date(iso);
    return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
  }
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

export function fechaHora(iso: string | null | undefined) {
  if (!iso) return "—";
  const f = new Date(iso);
  return f.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Texto del plazo para una fila o un encabezado. */
export function textoPlazo(p: Pick<PqrResumen, "estado_plazo" | "dias_habiles_restantes" | "fecha_vencimiento">): {
  texto: string;
  clase: string;
  tono: EstadoPlazo;
} {
  const n = p.dias_habiles_restantes;
  switch (p.estado_plazo) {
    case "respondida_a_tiempo":
      return { texto: "Respondida a tiempo", clase: "text-success", tono: p.estado_plazo };
    case "respondida_tarde":
      return { texto: "Respondida fuera de plazo", clase: "text-destructive", tono: p.estado_plazo };
    case "pausada":
      return { texto: "Plazo en pausa", clase: "text-muted-foreground", tono: p.estado_plazo };
    case "vencida":
      return {
        texto: `Vencida hace ${Math.abs(n)} ${Math.abs(n) === 1 ? "día hábil" : "días hábiles"}`,
        clase: "text-destructive",
        tono: p.estado_plazo,
      };
    case "por_vencer":
      return {
        texto: n === 0 ? "Vence hoy" : `Vence en ${n} ${n === 1 ? "día hábil" : "días hábiles"}`,
        clase: "text-warning",
        tono: p.estado_plazo,
      };
    default:
      return { texto: `${n} días hábiles para responder`, clase: "text-muted-foreground", tono: p.estado_plazo };
  }
}

/** Avance del plazo (0–100) para la barra: cuánto del término ya se consumió. */
export function avancePlazo(p: Pick<PqrResumen, "dias_termino" | "dias_habiles_restantes" | "prorrogada">) {
  const total = p.dias_termino * (p.prorrogada ? 2 : 1);
  const usado = total - Math.max(0, p.dias_habiles_restantes);
  return Math.min(100, Math.max(4, Math.round((usado / total) * 100)));
}
