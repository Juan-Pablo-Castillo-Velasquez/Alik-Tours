import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

export type DireccionOrden = "asc" | "desc";
type Valor = string | number | null | undefined;

/**
 * Orden por columna para las tablas del panel. `obtener` dice qué valor
 * usar de cada fila para cada campo. Primer clic en un encabezado: de
 * mayor a menor; segundo clic: al revés. Los vacíos van siempre al final.
 */
export function useOrden<T, C extends string>(
  filas: T[],
  obtener: (fila: T, campo: C) => Valor,
  inicial: { campo: C; dir: DireccionOrden },
) {
  const [orden, setOrden] = useState(inicial);

  const ordenadas = useMemo(() => {
    const copia = [...filas];
    copia.sort((a, b) => {
      const va = obtener(a, orden.campo);
      const vb = obtener(b, orden.campo);
      const vacioA = va == null || va === "";
      const vacioB = vb == null || vb === "";
      if (vacioA || vacioB) return vacioA === vacioB ? 0 : vacioA ? 1 : -1;
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
      return orden.dir === "asc" ? cmp : -cmp;
    });
    return copia;
    // obtener es una función de la tabla; el orden depende de filas y orden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, orden]);

  const ordenarPor = (campo: C) =>
    setOrden((o) => ({ campo, dir: o.campo === campo && o.dir === "desc" ? "asc" : "desc" }));

  return { ordenadas, orden, ordenarPor };
}

/** Encabezado de tabla que ordena al hacer clic (con aria-sort). */
export function EncabezadoOrdenable<C extends string>({
  campo,
  texto,
  orden,
  onOrdenar,
  className,
}: {
  campo: C;
  texto: string;
  orden: { campo: C; dir: DireccionOrden };
  onOrdenar: (campo: C) => void;
  className: string;
}) {
  const activo = orden.campo === campo;
  return (
    <th className={className} aria-sort={activo ? (orden.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        className="inline-flex items-center gap-1 uppercase hover:text-foreground"
      >
        {texto}
        {!activo ? (
          <ArrowUpDown className="w-3 h-3 opacity-50" />
        ) : orden.dir === "asc" ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        )}
      </button>
    </th>
  );
}
