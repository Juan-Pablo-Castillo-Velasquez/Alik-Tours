import { BadgeCheck } from "lucide-react";
import { BRAND } from "../../config/brand";

/** Respuesta pública de la agencia debajo de una reseña. */
export default function RespuestaAgencia({ respuesta, fecha }: { respuesta?: string | null; fecha?: string | null }) {
  if (!respuesta) return null;
  const cuando = fecha ? new Date(fecha) : null;
  return (
    <div className="mt-3 rounded-xl border-l-4 border-primary bg-primary/5 px-3 py-2">
      <p className="text-xs font-semibold text-primary flex items-center gap-1">
        <BadgeCheck className="w-3.5 h-3.5" /> Respuesta de {BRAND.name}
        {cuando && !Number.isNaN(cuando.getTime()) && (
          <span className="font-normal text-muted-foreground">
            · {cuando.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </p>
      <p className="text-sm text-foreground/80 mt-0.5 whitespace-pre-line break-words">{respuesta}</p>
    </div>
  );
}
