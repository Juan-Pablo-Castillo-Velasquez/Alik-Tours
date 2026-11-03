// Unidad: reglas de celular del registro (mismas que backend/app/schemas/validadores.py).
// Autor (semana 2, capa Front): Juan Pablo Castillo.
import { describe, expect, it } from "vitest";
import { esCelularValido, normalizarCelular } from "./validaciones";

describe("normalizarCelular", () => {
  it("quita espacios, guiones, puntos y paréntesis", () => {
    // Arrange
    const escrito = "(300) 123-45.67";
    // Act
    const normalizado = normalizarCelular(escrito);
    // Assert
    expect(normalizado).toBe("3001234567");
  });

  it("quita el indicativo +57 solo cuando lo que sigue es un móvil colombiano", () => {
    expect(normalizarCelular("+57 300 123 4567")).toBe("3001234567");
    // Un fijo con +57 (no empieza por 3) se deja como internacional.
    expect(normalizarCelular("+57 601 234 5678")).toBe("+576012345678");
  });
});

describe("esCelularValido", () => {
  // Particiones: móvil colombiano (exactamente 10 dígitos, empieza por 3)
  // e internacional (+ y entre 8 y 15 dígitos). Se prueba cada valor límite.
  it.each([
    ["3001234567", true], // 10 dígitos: límite exacto
    ["300123456", false], // 9 dígitos: uno menos
    ["30012345678", false], // 11 dígitos: uno más
    ["2001234567", false], // 10 dígitos pero no empieza por 3
    ["300 123 4567", true], // con separadores se normaliza antes
    ["+12345678", true], // internacional: 8 dígitos, mínimo
    ["+1234567", false], // 7 dígitos: uno menos que el mínimo
    ["+123456789012345", true], // 15 dígitos, máximo
    ["+1234567890123456", false], // 16 dígitos: uno más que el máximo
    ["", false],
    ["300abc4567", false],
  ])("esCelularValido(%s) es %s", (valor, esperado) => {
    expect(esCelularValido(valor)).toBe(esperado);
  });
});
