import { describe, expect, it } from "vitest";
import { avancePlazo, fechaCorta, textoPlazo, TIPOS_PQR } from "./pqr";

const base = { dias_habiles_restantes: 10, fecha_vencimiento: "2026-12-16" };

describe("plazos de las PQR", () => {
  it("usa los plazos legales por tipo", () => {
    const plazos = Object.fromEntries(TIPOS_PQR.map((t) => [t.tipo, t.dias]));
    expect(plazos).toEqual({
      peticion: 15,
      reclamo: 15,
      queja: 15,
      informacion: 10,
      consulta: 30,
      sugerencia: 15,
      felicitacion: 15,
    });
  });

  it("describe cada estado del plazo", () => {
    expect(textoPlazo({ ...base, estado_plazo: "a_tiempo" }).texto).toBe("10 días hábiles para responder");
    expect(textoPlazo({ ...base, estado_plazo: "por_vencer", dias_habiles_restantes: 1 }).texto).toBe("Vence en 1 día hábil");
    expect(textoPlazo({ ...base, estado_plazo: "por_vencer", dias_habiles_restantes: 0 }).texto).toBe("Vence hoy");
    expect(textoPlazo({ ...base, estado_plazo: "vencida", dias_habiles_restantes: -3 }).texto).toBe(
      "Vencida hace 3 días hábiles",
    );
    expect(textoPlazo({ ...base, estado_plazo: "pausada" }).texto).toBe("Plazo en pausa");
    expect(textoPlazo({ ...base, estado_plazo: "respondida_tarde" }).clase).toBe("text-destructive");
  });

  it("calcula el avance de la barra, también con prórroga", () => {
    expect(avancePlazo({ dias_termino: 15, dias_habiles_restantes: 15, prorrogada: false })).toBe(4);
    expect(avancePlazo({ dias_termino: 10, dias_habiles_restantes: 5, prorrogada: false })).toBe(50);
    expect(avancePlazo({ dias_termino: 10, dias_habiles_restantes: 10, prorrogada: true })).toBe(50);
    expect(avancePlazo({ dias_termino: 15, dias_habiles_restantes: -2, prorrogada: false })).toBe(100);
  });

  it("muestra una fecha de calendario sin correrla por la zona horaria", () => {
    expect(fechaCorta("2026-12-16")).toBe("16 dic 2026");
    expect(fechaCorta(null)).toBe("—");
  });
});
