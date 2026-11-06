import { Bed, Check, Eye, Maximize2, Users } from "lucide-react";
import { useState } from "react";
import type { HabitacionResponse } from "../../services/hotel.service";
import { resolveFotoUrl } from "../admin/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";

/** Comodidades guardadas una por línea -> lista. */
export function listaComodidades(texto?: string | null): string[] {
  return (texto ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Datos rápidos de la habitación: solo lo que está cargado, nada inventado. */
export function DatosHabitacion({ hab, className = "" }: { hab: HabitacionResponse; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground font-medium ${className}`}>
      {hab.tipo_cama && (
        <span className="flex items-center gap-1.5">
          <Bed className="w-4 h-4 text-primary" /> {hab.tipo_cama}
        </span>
      )}
      {hab.tipo_habitacion?.capacidad_personas != null && (
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary" /> Máx. {hab.tipo_habitacion.capacidad_personas} pers.
        </span>
      )}
      {hab.tamano_m2 != null && (
        <span className="flex items-center gap-1.5">
          <Maximize2 className="w-4 h-4 text-primary" /> {hab.tamano_m2} m²
        </span>
      )}
      {hab.vista && (
        <span className="flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-primary" />
          {/^(al|a la|a)\s/i.test(hab.vista) ? `Vista ${hab.vista}` : `Vista: ${hab.vista}`}
        </span>
      )}
    </div>
  );
}

interface Props {
  hab: HabitacionResponse | null;
  /** Foto de referencia si la habitación no tiene fotos propias. */
  fotoReferencia: string;
  onClose: () => void;
  onElegir?: (hab: HabitacionResponse) => void;
}

/** "Ver detalles" de una habitación: sus fotos propias y toda su información. */
export default function DetalleHabitacion({ hab, fotoReferencia, onClose, onElegir }: Props) {
  const [indice, setIndice] = useState(0);
  if (!hab) return null;

  const propias = (hab.imagenes ?? []).map((i) => resolveFotoUrl(i.url) ?? i.url);
  const fotos = propias.length > 0 ? propias : [fotoReferencia];
  const actual = fotos[Math.min(indice, fotos.length - 1)];
  const comodidades = listaComodidades(hab.comodidades);
  const descripcion = hab.descripcion || hab.tipo_habitacion?.descripcion;
  const disponible = hab.estado === "disponible";
  const nombre = hab.tipo_habitacion?.nombre_tipo ?? "Habitación";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="relative bg-muted">
          <img src={actual} alt={propias.length ? `Foto de la habitación ${nombre}` : "Imagen de referencia"} className="w-full aspect-[16/10] object-cover" />
          {propias.length === 0 && (
            <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
              Imagen de referencia: esta habitación aún no tiene fotos propias
            </span>
          )}
        </div>
        {fotos.length > 1 && (
          <div className="flex gap-2 px-5 pt-3 overflow-x-auto">
            {fotos.map((f, i) => (
              <button
                key={f}
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
                aria-current={i === indice}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === indice ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                <img src={f} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="p-5 space-y-4">
          <div>
            <DialogTitle className="text-xl font-bold">
              {nombre} <span className="text-sm font-medium text-muted-foreground">· Hab. {hab.numero_habitacion}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">Fotos e información de la habitación</DialogDescription>
            <DatosHabitacion hab={hab} className="mt-2" />
          </div>
          {descripcion && <p className="text-sm text-muted-foreground whitespace-pre-line">{descripcion}</p>}
          {comodidades.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Comodidades</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {comodidades.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-success shrink-0" /> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div>
              <p className="text-xs text-muted-foreground">Precio por noche</p>
              <p className="text-2xl font-bold text-primary">${Number(hab.precio_noche).toLocaleString("es-CO")}</p>
            </div>
            {onElegir && (
              <button
                type="button"
                disabled={!disponible}
                onClick={() => {
                  onElegir(hab);
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:bg-muted disabled:text-muted-foreground"
              >
                {disponible ? "Elegir esta habitación" : "No disponible"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
