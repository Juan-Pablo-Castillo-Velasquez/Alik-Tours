import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { RangoOcupado } from "../../services/hotel.service";
import { cn } from "../ui/utils";

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
// (getDay(): 0=domingo) → lon, así el grid empieza en lunes.
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** yyyy-mm-dd local, sin zona horaria ni corrimiento de día. */
function isoLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function hoyISO(): string {
  const n = new Date();
  return isoLocal(n);
}

function addDays(iso: string, n: number): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d + n);
}

/**
 * Calendario de ocupación por habitación. Muestra, mes a mes, qué días ya
 * están reservados (rangos reales de GET /hoteles/{id}/fechas-ocupadas).
 * Solo informa fechas; nunca expone quién reservó. Navegable con las
 * flechas y con "Hoy"; no permite retroceder más allá del mes actual.
 */
export default function CalendarioOcupacion({
  rangos,
  className,
  rangoSeleccionado,
}: {
  rangos: RangoOcupado[];
  className?: string;
  /** Rango elegido por el usuario (ej: fechas del form), [inicio, fin).
   * Activa el resaltado de la selección y marca en rojo sólido los días
   * que el usuario eligió pero ya están ocupados (conflicto). */
  rangoSeleccionado?: { fechaInicio?: string; fechaFin?: string };
}) {
  const now = new Date();
  const [vista, setVista] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));

  // Conjunto de días ocupados: cada fecha dentro de [checkin, checkout).
  const ocupados = new Set<string>();
  rangos.forEach((r) => {
    let d = r.fecha_checkin;
    const fin = addDays(r.fecha_checkout, 0);
    while (d < isoLocal(fin)) {
      ocupados.add(d);
      d = isoLocal(addDays(d, 1));
    }
  });

  // Conjunto de días del rango seleccionado por el usuario, [inicio, fin).
  const seleccion = new Set<string>();
  const inicioSel = rangoSeleccionado?.fechaInicio;
  const finSel = rangoSeleccionado?.fechaFin;
  const tieneSeleccion = !!inicioSel && !!finSel && finSel > inicioSel;
  if (tieneSeleccion) {
    let d = inicioSel;
    while (d < finSel) {
      seleccion.add(d);
      d = isoLocal(addDays(d, 1));
    }
  }
  const hayConflicto = tieneSeleccion && [...seleccion].some((d) => ocupados.has(d));

  const year = vista.getFullYear();
  const month = vista.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const esMesActual =
    month === now.getMonth() && year === now.getFullYear();

  const prevDisabled = year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth());
  const nextDisabled =
    year > now.getFullYear() + 1 ||
    (year === now.getFullYear() + 1 && month >= now.getMonth());

  const irMeses = (n: number) => {
    setVista((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));
  };

  const mesOcupado = () =>
    Array.from({ length: daysInMonth }, (_, i) => isoLocal(new Date(year, month, i + 1)))
      .filter((d) => ocupados.has(d)).length;

  const totalOcupado = ocupados.size;

  return (
    <div className={cn("rounded-xl border border-border bg-muted/20 p-4", className)}>
      {/* Encabezado + navegación del mes */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-foreground capitalize">
          {MESES[month]} {year}
        </span>
        <div className="flex items-center gap-1">
          <button aria-label="Mes anterior"
            type="button"
            onClick={() => irMeses(-1)}
            disabled={prevDisabled}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
            title="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setVista(new Date(now.getFullYear(), now.getMonth(), 1))}
            disabled={esMesActual}
            className="px-2 py-1 rounded-md text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-40 transition-colors"
            title="Volver al mes actual"
          >
            Hoy
          </button>
          <button aria-label="Mes siguiente"
            type="button"
            onClick={() => irMeses(1)}
            disabled={nextDisabled}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
            title="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 text-center mb-1">
        {DIAS_SEMANA.map((d) => (
          <span key={d} className="text-[10px] font-bold text-muted-foreground">
            {d}
          </span>
        ))}
      </div>

      {/* Grid del mes */}
      <div className="grid grid-cols-7 gap-y-1 justify-items-center text-center">
        {ORDEN_DIAS.slice(0, firstWeekday).map((_, i) => (
          <span key={`b-${i}`} className="w-8 h-8" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dia = isoLocal(new Date(year, month, day));
          const esOcupado = ocupados.has(dia);
          const esSeleccion = seleccion.has(dia);
          const esConflicto = esOcupado && esSeleccion;
          const esHoy = dia === hoyISO();
          const esPasado = dia < hoyISO();

          let cellClass =
            "w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors relative ";
          if (esConflicto)
            cellClass +=
              "bg-destructive text-white font-bold shadow-md shadow-destructive/30";
          else if (esOcupado)
            cellClass +=
              "bg-destructive/15 text-destructive font-bold ring-1 ring-destructive/30 cursor-default";
          else if (esSeleccion)
            cellClass +=
              "bg-primary/15 text-primary font-bold ring-1 ring-primary/40";
          else if (esHoy)
            cellClass += "ring-2 ring-primary text-primary font-bold text-foreground";
          else if (esPasado)
            cellClass += "text-muted-foreground/40";
          else
            cellClass += "text-foreground hover:bg-muted";

          return (
            <span
              key={day}
              className={cellClass}
              title={`${dia}${esConflicto ? " — Ocupada y dentro de tu selección (conflicto)" : esOcupado ? " — Ocupada" : esSeleccion ? " — En tus fechas elegidas" : ""}`}
            >
              {day}
            </span>
          );
        })}
      </div>

      {/* Leyenda y resumen */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-medium text-muted-foreground border-t border-border/60 pt-3">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-destructive/30 ring-1 ring-destructive/50 inline-block" />
          Ocupada
        </span>
        {tieneSeleccion && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-primary/20 ring-1 ring-primary/40 inline-block" />
            Tus fechas
          </span>
        )}
        {hayConflicto && (
          <span className="flex items-center gap-1.5 text-destructive">
            <span className="w-3 h-3 rounded-full bg-destructive inline-block" />
            Conflicto
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full ring-2 ring-primary inline-block" />
          Hoy
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <CalendarDays className="w-3.5 h-3.5 text-destructive/70" />
          {totalOcupado > 0
            ? `${totalOcupado} día${totalOcupado === 1 ? "" : "s"} reservado${totalOcupado === 1 ? "" : "s"} en el rango mostrado`
            : "Sin reservas en el rango mostrado"}
        </span>
      </div>
      {mesOcupado() === 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No hay días ocupados en {MESES[month]} {year}.
        </p>
      )}
    </div>
  );
}
