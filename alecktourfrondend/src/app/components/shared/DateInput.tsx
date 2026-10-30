import { InputHTMLAttributes } from "react";

// Límites por defecto de cualquier fecha del sistema. Sin `max`, los
// <input type="date"> de Chrome/Edge dejan escribir años de 5 o 6 cifras
// (ej. 20255-01-01), que luego llegaban al backend como fechas imposibles.
export const FECHA_MIN = "1900-01-01";
export const FECHA_MAX = "2100-12-31";

/** true si `valor` es una fecha ISO real (AAAA-MM-DD, año de 4 dígitos). */
export function esFechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> & {
  value: string;
  /** Recibe "" o una fecha AAAA-MM-DD válida; nunca un año de más de 4 cifras. */
  onValueChange: (valor: string) => void;
};

// Campo de fecha único para todo el sitio (registro, checkout, buscador,
// panel). Respeta los `min`/`max` que pase cada pantalla y, si no pasa
// ninguno, usa 1900-2100.
export default function DateInput({ value, onValueChange, min = FECHA_MIN, max = FECHA_MAX, ...rest }: Props) {
  return (
    <input
      {...rest}
      type="date"
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        // Mientras el usuario escribe, el navegador puede entregar "" o un
        // año de 5+ cifras: se descarta lo que no sea una fecha real.
        if (v === "" || esFechaValida(v)) onValueChange(v);
      }}
    />
  );
}
