interface Props {
  monthName: string;
  firstDay: number;
  daysInMonth: number;
  checkIn: number;
  checkOut: number;
  esEsteMes: boolean;
  hoyDia: number;
}

export default function CalendarioGrid({
  monthName,
  firstDay,
  daysInMonth,
  checkIn,
  checkOut,
  esEsteMes,
  hoyDia,
}: Props) {
  return (
    <>
      <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-2">
        <span className="text-sm font-bold text-foreground capitalize">
          {monthName}
        </span>
        <div className="flex gap-3 text-[10px] font-medium text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />{" "}
            <span>Inicio</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-gold" />{" "}
            <span>Fin</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-2 rounded bg-primary/10 border border-primary/20" />{" "}
            <span>Estancia</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center mb-2">
        {["D", "L", "M", "X", "J", "V", "S"].map((d) => (
          <span
            key={d}
            className="text-[10px] font-bold text-muted-foreground"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 justify-items-center text-center">
        {Array.from({ length: firstDay }).map((_, i) => (
          <span key={`e-${i}`} className="w-8 h-8" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isIn = day === checkIn;
          const isOut = day === checkOut;
          const inRange = day > checkIn && day < checkOut;
          const isHoy =
            esEsteMes && day === hoyDia && !isIn && !isOut && !inRange;

          let cellClass =
            "w-8 h-8 flex items-center justify-center text-xs rounded-full transition-all relative text-muted-foreground ";

          if (isIn)
            cellClass +=
              "bg-primary text-primary-foreground font-bold shadow-sm";
          else if (isOut)
            cellClass += "bg-gold text-gold-foreground font-bold shadow-sm";
          else if (inRange)
            cellClass +=
              "bg-primary/10 text-primary font-medium rounded-md w-full";
          else if (isHoy)
            cellClass += "ring-2 ring-primary text-primary font-bold";
          else cellClass += "hover:bg-muted text-foreground";

          return (
            <span key={day} className={cellClass}>
              {day}
              {(isIn || isOut) && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/60" />
              )}
            </span>
          );
        })}
      </div>
    </>
  );
}