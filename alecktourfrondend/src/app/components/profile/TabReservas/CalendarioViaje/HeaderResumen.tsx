import { nombreReserva } from "../../perfilUtils";
import { Plane, Sunrise, Sunset } from "lucide-react";
import { fmt } from "../utils";

interface Props {
  proxima: any;
  diasRestantes: number;
  noches: number;
}

// Antes esta tarjeta era un bloque sólido bg-gradient-to-br from-primary
// de pared a pared (texto blanco encima) -- se veía bien pero dominaba
// toda la sección con el color de marca en vez de con la información real
// del viaje. Ahora el color queda como un acento (el círculo difuminado
// de fondo y el chip de "días para irte"), y el resto es una tarjeta
// clara con los mismos tokens que ya usa el resto del perfil.
export default function HeaderResumen({ proxima, diasRestantes, noches }: Props) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary/8 via-card to-card p-5 border-b border-border">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Tu próximo viaje
          </span>
          <h3 className="text-xl font-bold tracking-tight leading-tight text-foreground truncate">
            {nombreReserva(proxima)}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reserva #{proxima.id_reserva}
          </p>
        </div>
        <div className="text-center bg-primary rounded-xl px-3.5 py-2 shadow-sm shrink-0">
          <span className="block text-3xl font-black leading-none text-primary-foreground">
            {diasRestantes}
          </span>
          <span className="text-[9px] font-medium tracking-wide uppercase text-primary-foreground/80 block mt-1">
            días para irte
          </span>
        </div>
      </div>

      {/* Info Check-in / Check-out */}
      <div className="relative grid grid-cols-7 items-center bg-card border border-border rounded-xl p-3 text-center shadow-sm">
        <div className="col-span-3 text-left pl-1">
          <div className="flex items-center gap-1 text-muted-foreground text-[9px] font-bold uppercase tracking-wider mb-0.5">
            <Sunrise className="w-3 h-3" /> Check-in
          </div>
          <p className="text-sm font-bold truncate text-foreground">
            {fmt(proxima.fecha_inicio, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
        <div className="col-span-1 flex flex-col items-center justify-center gap-0.5">
          <Plane className="w-4 h-4 rotate-45 text-primary" />
          <span className="text-[9px] font-semibold tracking-tight text-muted-foreground">
            {noches} {noches === 1 ? "noche" : "noches"}
          </span>
        </div>
        <div className="col-span-3 text-right pr-1">
          <div className="flex items-center justify-end gap-1 text-muted-foreground text-[9px] font-bold uppercase tracking-wider mb-0.5">
            <Sunset className="w-3 h-3" /> Check-out
          </div>
          <p className="text-sm font-bold truncate text-foreground">
            {fmt(proxima.fecha_fin, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
