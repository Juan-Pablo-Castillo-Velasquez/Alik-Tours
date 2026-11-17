import { describe, expect, it } from "vitest";
import { objetivoTemporada, partesRestantes } from "./CuentaRegresivaTemporada";

describe("Cuenta regresiva de temporada", () => {
  it("Navidad apunta al 25 de diciembre del año en curso", () => {
    const o = objetivoTemporada("navidad", new Date(2026, 10, 17));
    expect(o?.fecha).toEqual(new Date(2026, 11, 25));
    expect(o?.falta).toBe("para Navidad");
  });

  it("Fin de año apunta al 1 de enero siguiente, y en enero al recién pasado", () => {
    expect(objetivoTemporada("fin-de-anio", new Date(2026, 11, 20))?.fecha).toEqual(new Date(2027, 0, 1));
    expect(objetivoTemporada("fin-de-anio", new Date(2027, 0, 1, 10))?.fecha).toEqual(new Date(2027, 0, 1));
  });

  it("otras temporadas no tienen cuenta regresiva", () => {
    expect(objetivoTemporada("halloween", new Date())).toBeNull();
    expect(objetivoTemporada(undefined, new Date())).toBeNull();
  });

  it("descompone el tiempo restante y nunca da negativos", () => {
    const ms = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000;
    expect(partesRestantes(ms)).toEqual({ dias: 2, horas: 3, minutos: 4, segundos: 5 });
    expect(partesRestantes(-5000)).toEqual({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
  });
});
