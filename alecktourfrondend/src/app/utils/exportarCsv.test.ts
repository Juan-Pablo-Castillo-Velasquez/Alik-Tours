// Exportación CSV del panel admin.
// Autor: Juan Pablo Castillo.
import { describe, expect, it } from "vitest";
import { generarCsv } from "./exportarCsv";

type Fila = { nombre: string; monto: number; nota?: string | null };
const columnas = [
  { titulo: "Nombre", valor: (f: Fila) => f.nombre },
  { titulo: "Monto", valor: (f: Fila) => f.monto },
  { titulo: "Nota", valor: (f: Fila) => f.nota },
];

describe("generarCsv", () => {
  it("usa ; como separador y una fila por registro", () => {
    expect(generarCsv([{ nombre: "Ana", monto: 1500 }], columnas)).toBe("Nombre;Monto;Nota\r\nAna;1500;");
  });

  it("encierra entre comillas lo que tiene ; comillas o saltos de línea", () => {
    const csv = generarCsv([{ nombre: 'Luis "Lucho"', monto: 1, nota: "a;b\nc" }], columnas);
    expect(csv.split("\r\n")[1]).toBe('"Luis ""Lucho""";1;"a;b\nc"');
  });

  it("neutraliza fórmulas de Excel pero deja los números negativos", () => {
    const csv = generarCsv([{ nombre: "=HYPERLINK(1)", monto: -5, nota: "-cmd" }], columnas);
    expect(csv.split("\r\n")[1]).toBe("'=HYPERLINK(1);-5;'-cmd");
  });
});
