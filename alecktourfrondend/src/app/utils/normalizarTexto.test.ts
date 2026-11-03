// Unidad: comparación de destinos sin tildes (filtros de hoteles y paquetes).
// Autor (semana 2, capa Front): Juan Pablo Castillo.
import { describe, expect, it } from "vitest";
import { normalizarTexto } from "./normalizarTexto";

describe("normalizarTexto", () => {
  it("quita tildes y pasa a minúsculas", () => {
    expect(normalizarTexto("Medellín")).toBe("medellin");
    expect(normalizarTexto("BOGOTÁ")).toBe("bogota");
  });

  it("también quita la virgulilla y la diéresis (ñ -> n, ü -> u)", () => {
    expect(normalizarTexto("Peñol Güicán")).toBe("penol guican");
  });

  it("permite que una búsqueda sin tilde encuentre el dato guardado con tilde", () => {
    // Arrange: así compara Packages.tsx el filtro con el destino del paquete
    const guardado = "San Andrés, Colombia";
    const busqueda = "san andres";
    // Act
    const coincide = normalizarTexto(guardado).includes(normalizarTexto(busqueda));
    // Assert
    expect(coincide).toBe(true);
  });

  it("deja igual un texto sin tildes ni mayúsculas, incluso vacío", () => {
    expect(normalizarTexto("cartagena")).toBe("cartagena");
    expect(normalizarTexto("")).toBe("");
  });
});
