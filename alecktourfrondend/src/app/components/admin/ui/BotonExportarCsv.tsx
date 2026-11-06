import { Download } from "lucide-react";
import { ColumnaCsv, descargarCsv } from "../../../utils/exportarCsv";

/** Descarga en CSV (abre en Excel) las filas que la tabla muestra con los
 *  filtros y la búsqueda actuales, no solo la página visible. */
export default function BotonExportarCsv<T>({
  nombre,
  filas,
  columnas,
}: {
  nombre: string;
  filas: T[];
  columnas: ColumnaCsv<T>[];
}) {
  return (
    <button
      type="button"
      onClick={() => descargarCsv(nombre, filas, columnas)}
      disabled={filas.length === 0}
      title="Descarga lo que ves con los filtros actuales (abre en Excel)"
      className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
    >
      <Download className="w-4 h-4" />
      Exportar CSV ({filas.length})
    </button>
  );
}
