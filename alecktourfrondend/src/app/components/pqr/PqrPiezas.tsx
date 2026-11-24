import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Hourglass,
  Lock,
  PauseCircle,
  Star,
  UserCheck,
  XCircle,
} from "lucide-react";
import type { ElementType } from "react";
import type { EstadoPqr, PqrActuacion, PqrResumen } from "../../services/pqr.service";
import { avancePlazo, ESTADO_PQR, ESTADO_PQR_EQUIPO, fechaCorta, fechaHora, textoPlazo } from "../../utils/pqr";

/** Marca de las PQR de demostración (no son de un cliente real). */
export function EtiquetaEjemplo() {
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      Ejemplo
    </span>
  );
}

export function EstadoPqrBadge({ estado, vista = "cliente" }: { estado: EstadoPqr; vista?: "cliente" | "equipo" }) {
  const e = ESTADO_PQR[estado];
  const texto = vista === "equipo" ? ESTADO_PQR_EQUIPO[estado] : e.texto;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${e.clase}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {texto}
    </span>
  );
}

const ICONO_PLAZO: Record<string, ElementType> = {
  a_tiempo: Clock3,
  por_vencer: Hourglass,
  vencida: XCircle,
  pausada: PauseCircle,
  respondida_a_tiempo: CheckCircle2,
  respondida_tarde: CheckCircle2,
};

/** Línea compacta del plazo (para filas de lista). */
export function PlazoCorto({ pqr }: { pqr: PqrResumen }) {
  const t = textoPlazo(pqr);
  const Icono = ICONO_PLAZO[t.tono] ?? Clock3;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${t.clase}`}>
      <Icono className="h-3.5 w-3.5" aria-hidden />
      {t.texto}
    </span>
  );
}

/** Bloque del plazo con barra de avance (para el detalle). */
export function PlazoDetalle({
  pqr,
  vista = "cliente",
}: {
  pqr: PqrResumen & { fecha_vencimiento_original?: string | null };
  vista?: "cliente" | "equipo";
}) {
  const t = textoPlazo(pqr);
  const finalizada = pqr.estado_plazo.startsWith("respondida") || pqr.estado === "cerrada" || pqr.estado === "desistida";
  const barra =
    t.tono === "vencida" ? "bg-destructive" : t.tono === "por_vencer" ? "bg-warning" : t.tono === "pausada" ? "bg-muted-foreground/40" : "bg-primary";
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
          {t.tono === "pausada" && !finalizada ? (
            <p className="text-sm text-foreground">
              {vista === "cliente"
                ? "El plazo vuelve a correr completo cuando nos respondas"
                : "El plazo vuelve a correr completo cuando el cliente responda"}
            </p>
          ) : (
            <p className="text-sm text-foreground">
              {finalizada ? "Fecha límite era el " : "Respuesta a más tardar el "}
              <strong>{fechaCorta(pqr.fecha_vencimiento)}</strong>
            </p>
          )}
        </div>
        <span className={`text-xs font-semibold ${t.clase}`}>{t.texto}</span>
      </div>
      {!finalizada && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
          <div className={`h-full rounded-full ${barra}`} style={{ width: `${avancePlazo(pqr)}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Plazo de {pqr.dias_termino} días hábiles (sin contar sábados, domingos ni festivos)
        {pqr.prorrogada && pqr.fecha_vencimiento_original
          ? `, ampliado desde el ${fechaCorta(pqr.fecha_vencimiento_original)}`
          : ""}
        .
      </p>
    </div>
  );
}

const EVENTO: Record<string, { icono: ElementType; titulo: string }> = {
  radicacion: { icono: FileCheck2, titulo: "Solicitud radicada" },
  estado: { icono: Clock3, titulo: "Actualización" },
  asignacion: { icono: UserCheck, titulo: "Asignación" },
  prorroga: { icono: CalendarClock, titulo: "Plazo ampliado" },
  desistimiento: { icono: XCircle, titulo: "Desistimiento" },
  calificacion: { icono: Star, titulo: "Calificación" },
  cierre: { icono: CheckCircle2, titulo: "Cierre" },
};

/**
 * Historial de la solicitud: mensajes como conversación y los cambios de
 * estado como líneas de sistema. `vista` decide de qué lado van los
 * mensajes propios.
 */
export function HiloPqr({ actuaciones, vista }: { actuaciones: PqrActuacion[]; vista: "cliente" | "equipo" }) {
  return (
    <ol className="space-y-4" aria-label="Historial de la solicitud">
      {actuaciones.map((a) => {
        const esMensaje = ["mensaje_cliente", "mensaje_equipo", "nota_interna", "solicitud_informacion", "respuesta"].includes(a.tipo);
        if (!esMensaje) {
          const ev = EVENTO[a.tipo] ?? EVENTO.estado;
          const Icono = ev.icono;
          return (
            <li key={a.id_actuacion} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icono className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{ev.titulo}</span> · {fechaHora(a.fecha)}
                  {a.autor_nombre && vista === "equipo" ? ` · ${a.autor_nombre}` : ""}
                  {!a.visible_cliente && <span className="ml-1.5 text-warning">(solo equipo)</span>}
                </p>
                {a.texto && <p className="mt-0.5 text-sm text-foreground/85">{a.texto}</p>}
              </div>
            </li>
          );
        }
        const propio = vista === "cliente" ? !a.autor_equipo : a.autor_equipo;
        const interna = a.tipo === "nota_interna";
        const respuesta = a.tipo === "respuesta";
        const pide = a.tipo === "solicitud_informacion";
        const caja = interna
          ? "border-warning/40 bg-warning/10"
          : respuesta
            ? "border-success/40 bg-success/5"
            : pide
              ? "border-info/40 bg-info/5"
              : propio
                ? "border-primary/20 bg-primary/5"
                : "border-border bg-card";
        return (
          <li key={a.id_actuacion} className={`flex ${propio ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] rounded-2xl border px-4 py-3 sm:max-w-[80%] ${caja}`}>
              <p className="mb-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                {interna && <Lock className="h-3 w-3 text-warning" aria-hidden />}
                <span className="font-semibold text-foreground">
                  {vista === "cliente" && a.autor_equipo ? "Equipo Alik Tours" : (a.autor_nombre ?? "—")}
                </span>
                {interna && <span className="text-warning">Nota interna</span>}
                {respuesta && <span className="font-semibold text-success">Respuesta de fondo</span>}
                {pide && <span className="font-semibold text-info">Te pedimos información</span>}
                <span>· {fechaHora(a.fecha)}</span>
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{a.texto}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
