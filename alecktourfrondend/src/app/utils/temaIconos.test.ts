// Unidad: catálogo de íconos de los temas de temporada (panel de Temas).
// Autor (semana 7, cierre: completar el frontend al 75%): Fernando Gutiérrez.
import { describe, expect, it } from "vitest";
import { getTemaIcono, TEMA_ICONOS, TEMA_ICONOS_OPCIONES } from "./temaIconos";

describe("temaIconos", () => {
  it("cada opción del selector tiene su ícono en el catálogo", () => {
    for (const opcion of TEMA_ICONOS_OPCIONES) {
      expect(TEMA_ICONOS[opcion.valor]).toBe(opcion.Icono);
    }
  });

  it("no hay opciones repetidas y todas tienen etiqueta", () => {
    const valores = TEMA_ICONOS_OPCIONES.map((o) => o.valor);
    expect(new Set(valores).size).toBe(valores.length);
    expect(TEMA_ICONOS_OPCIONES.every((o) => o.etiqueta.trim().length > 0)).toBe(true);
  });

  it("el selector ofrece todos los íconos del catálogo", () => {
    expect(TEMA_ICONOS_OPCIONES.map((o) => o.valor).sort()).toEqual(Object.keys(TEMA_ICONOS).sort());
  });
});

describe("getTemaIcono", () => {
  it("devuelve el ícono pedido si existe", () => {
    expect(getTemaIcono("ghost")).toBe(TEMA_ICONOS.ghost);
  });

  it.each([null, undefined, "", "icono-que-ya-no-existe"])("con %s usa Destellos como respaldo", (valor) => {
    expect(getTemaIcono(valor)).toBe(TEMA_ICONOS.sparkles);
  });
});
