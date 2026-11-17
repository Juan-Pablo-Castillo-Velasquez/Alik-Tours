import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { ColumnaCsv, descargarCsv } from "../../../utils/exportarCsv";

/** Descarga en CSV (abre en Excel) las filas que la tabla muestra con los
 *  filtros y la búsqueda actuales, no solo la página visible.
 *
 *  Para listados paginados en el servidor se pasa `cargarTodas` (trae todas
 *  las páginas con los filtros actuales) y `total`. */
export default function BotonExportarCsv<T>({
  nombre,
  filas,
  columnas,
  cargarTodas,
  total,
}: {
  nombre: string;
  filas: T[];
  columnas: ColumnaCsv<T>[];
  cargarTodas?: () => Promise<T[]>;
  total?: number;
}) {
  const [cargando, setCargando] = useState(false);
  const cantidad = total ?? filas.length;

  const exportar = async () => {
    if (!cargarTodas) {
      descargarCsv(nombre, filas, columnas);
      return;
    }
    setCargando(true);
    try {
      descargarCsv(nombre, await cargarTodas(), columnas);
    } finally {
      setCargando(false);
    }
  };

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={cantidad === 0 || cargando}
      title="Descarga todo lo que coincide con los filtros actuales (abre en Excel)"
      className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
    >
      {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      Exportar CSV ({cantidad})
    </button>
  );
}
