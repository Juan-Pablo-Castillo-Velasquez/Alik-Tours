// Unidad: contraste WCAG 2.1 AA de los colores de temporada.
// Autor (semana 2, capa E2E, test unitario propio): Cristian Sinisterra.
import { describe, expect, it } from "vitest";
import { AA_MINIMO, contraste, cumpleAA, hexToRgbNums } from "./contrasteWcag";
import { PALETAS_PRESET } from "./temaPaletas";

const BLANCO = "#ffffff";
const TEXTO_OSCURO = "#1f1a12"; // color del texto sobre los tonos secundarios

describe("hexToRgbNums", () => {
  it("convierte un hex de 6 dígitos, con o sin #, en mayúsculas o minúsculas", () => {
    expect(hexToRgbNums("#0e7c86")).toEqual([14, 124, 134]);
    expect(hexToRgbNums("FFFFFF")).toEqual([255, 255, 255]);
  });

  it.each(["#fff", "#12345", "#1234567", "#gggggg", ""])("rechaza %s", (hex) => {
    expect(hexToRgbNums(hex)).toBeNull();
  });
});

describe("contraste", () => {
  it("negro sobre blanco es el máximo (21:1) y un color contra sí mismo el mínimo (1:1)", () => {
    expect(contraste("#000000", BLANCO)).toBeCloseTo(21, 5);
    expect(contraste("#6e1832", "#6e1832")).toBeCloseTo(1, 5);
  });

  it("no depende del orden de los colores", () => {
    expect(contraste(BLANCO, "#0e7c86")).toBe(contraste("#0e7c86", BLANCO));
  });

  it("devuelve null si alguno de los colores no es válido", () => {
    expect(contraste("rojo", BLANCO)).toBeNull();
    expect(contraste(BLANCO, "#12")).toBeNull();
  });
});

describe("cumpleAA", () => {
  it("4.5 exacto cumple; una centésima menos ya no (valor límite)", () => {
    expect(AA_MINIMO).toBe(4.5);
    expect(cumpleAA(4.5)).toBe(true);
    expect(cumpleAA(4.49)).toBe(false);
  });
});

describe("PALETAS_PRESET", () => {
  // Regla de negocio: el admin aplica estas paletas con un clic, así que
  // TODAS deben leerse bien: primarios con texto blanco y secundarios con
  // texto oscuro, en modo claro y oscuro.
  it.each(PALETAS_PRESET.map((p) => [p.clave, p] as const))("la paleta %s cumple AA", (_clave, paleta) => {
    const ratios = [
      contraste(paleta.color_primario_claro, BLANCO),
      contraste(paleta.color_primario_oscuro, BLANCO),
      contraste(paleta.color_secundario_claro, TEXTO_OSCURO),
      contraste(paleta.color_secundario_oscuro, TEXTO_OSCURO),
    ];

    for (const ratio of ratios) {
      expect(ratio).not.toBeNull();
      expect(cumpleAA(ratio as number)).toBe(true);
    }
  });

  it("no hay dos paletas con la misma clave", () => {
    const claves = PALETAS_PRESET.map((p) => p.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
