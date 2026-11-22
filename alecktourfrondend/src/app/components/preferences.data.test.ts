import { describe, expect, it } from "vitest";
import { etiquetaPreferencia } from "./preferences.data";

describe("etiquetaPreferencia", () => {
  it("traduce los valores guardados a texto legible", () => {
    expect(etiquetaPreferencia("presupuesto", "mid")).toBe("Estándar");
    expect(etiquetaPreferencia("compania", "couple")).toBe("En Pareja");
    expect(etiquetaPreferencia("clima", "warm")).toBe("Clima Cálido");
  });

  it("un valor que no está en el catálogo se muestra tal cual y uno vacío no muestra nada", () => {
    expect(etiquetaPreferencia("clima", "calido")).toBe("calido");
    expect(etiquetaPreferencia("ritmo", null)).toBe("");
  });
});
