/**
 * Exportación a CSV de las tablas del panel (reservas, pagos, clientes).
 *
 * Formato pensado para abrirse directo en Excel en Colombia: separador ";"
 * (Excel en español usa la coma como separador decimal) y BOM UTF-8 para
 * que las tildes y la ñ se vean bien.
 */
export interface ColumnaCsv<T> {
  titulo: string;
  valor: (fila: T) => string | number | null | undefined;
}

const SEPARADOR = ";";

function celda(valor: string | number | null | undefined): string {
  if (valor == null) return "";
  let texto = String(valor);
  // Contra inyección de fórmulas en Excel (=, +, -, @ al inicio). Los
  // números negativos reales sí pueden empezar por "-".
  if (/^[=+@]/.test(texto) || (/^-/.test(texto) && typeof valor !== "number")) texto = `'${texto}`;
  if (/[";\n\r]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function generarCsv<T>(filas: T[], columnas: ColumnaCsv<T>[]): string {
  const encabezado = columnas.map((c) => celda(c.titulo)).join(SEPARADOR);
  const cuerpo = filas.map((f) => columnas.map((c) => celda(c.valor(f))).join(SEPARADOR));
  return [encabezado, ...cuerpo].join("\r\n");
}

/** Descarga el CSV en el navegador con el nombre dado (sin extensión). */
export function descargarCsv<T>(nombre: string, filas: T[], columnas: ColumnaCsv<T>[]): void {
  const blob = new Blob(["﻿" + generarCsv(filas, columnas)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
