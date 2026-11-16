// Unidad: validación reutilizable de formularios.
import { describe, expect, it } from "vitest";
import { limpiarTelefono, mensajeErrorEnvio, validarCampo, validarFormulario } from "./validacionFormulario";

describe("validarCampo", () => {
  it("obligatorio: vacío o solo espacios no pasa", () => {
    expect(validarCampo("", { etiqueta: "Nombre", obligatorio: true })).toBe("Nombre es obligatorio");
    expect(validarCampo("    ", { etiqueta: "Nombre", obligatorio: true })).toBe("Nombre es obligatorio");
  });

  it("opcional vacío es válido", () => {
    expect(validarCampo("", { etiqueta: "Mensaje", max: 10 })).toBeNull();
  });

  it("mínimo y máximo se miden sin los espacios de los extremos", () => {
    expect(validarCampo("  a  ", { etiqueta: "Nombre", min: 2 })).toBe("Nombre: mínimo 2 caracteres");
    expect(validarCampo("abcdef", { etiqueta: "Asunto", max: 5 })).toBe("Asunto: máximo 5 caracteres");
    expect(validarCampo("  Ana  ", { etiqueta: "Nombre", min: 2, max: 3 })).toBeNull();
  });

  it.each([
    ["ana@correo.com", true],
    ["ana@correo", false],
    ["ana correo.com", false],
  ])("correo %s -> %s", (valor, ok) => {
    expect(validarCampo(valor, { etiqueta: "Correo", tipo: "correo" }) === null).toBe(ok);
  });

  it.each([
    ["300 123 4567", true],
    ["+57 300 123 4567", true],
    ["(601) 234-5678", true],
    ["12", false],
    ["abc1234567", false],
  ])("teléfono %s -> %s", (valor, ok) => {
    expect(validarCampo(valor, { etiqueta: "Teléfono", tipo: "telefono" }) === null).toBe(ok);
  });

  it.each([
    ["1000111222", true],
    ["AB12345", true],
    ["12-34", false],
    ["123", false],
  ])("documento %s -> %s", (valor, ok) => {
    expect(validarCampo(valor, { etiqueta: "Documento", tipo: "documento" }) === null).toBe(ok);
  });
});

describe("validarFormulario", () => {
  it("devuelve errores por campo y los valores recortados", () => {
    const r = validarFormulario(
      { nombre: "  Ana ", correo: "malo" },
      { nombre: { etiqueta: "Nombre", obligatorio: true, min: 2 }, correo: { etiqueta: "Correo", tipo: "correo" } },
    );
    expect(r.valido).toBe(false);
    expect(r.errores).toEqual({ correo: "Escribe un correo válido (ej. nombre@correo.com)" });
    expect(r.limpios.nombre).toBe("Ana");
  });

  it("formulario correcto", () => {
    const r = validarFormulario({ a: "hola" }, { a: { etiqueta: "A", obligatorio: true } });
    expect(r).toEqual({ errores: {}, limpios: { a: "hola" }, valido: true });
  });
});

describe("utilidades", () => {
  it("limpiarTelefono quita espacios, guiones, puntos y paréntesis", () => {
    expect(limpiarTelefono("(601) 234-56.78")).toBe("6012345678");
  });

  it("mensajeErrorEnvio traduce el 429 y no muestra mensajes técnicos", () => {
    expect(mensajeErrorEnvio(new Error("Demasiadas solicitudes. Intenta de nuevo en un momento."), "x")).toMatch(/Espera unos minutos/);
    expect(mensajeErrorEnvio(new Error("correo: value is not a valid email"), "Revisa los datos")).toBe("Revisa los datos");
    expect(mensajeErrorEnvio(new Error("Error en la petición al servidor"), "Falló")).toBe("Falló");
    expect(mensajeErrorEnvio("raro", "Falló")).toBe("Falló");
  });
});
