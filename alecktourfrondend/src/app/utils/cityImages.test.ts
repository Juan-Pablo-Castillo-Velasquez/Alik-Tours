// Unidad: foto de portada por ciudad (tarjetas de hoteles y paquetes).
// Autor (semana 2, capa Front): Juan Pablo Castillo.
import { describe, expect, it } from "vitest";
import { getCityImage, getDefaultImage } from "./cityImages";

const FOTO_CARTAGENA = "photo-1658591049748-4937f0a9051a";
const FOTO_POR_DEFECTO = "photo-1566073771259-6a8506099945";

describe("getCityImage", () => {
  it("encuentra la ciudad sin importar mayúsculas ni espacios alrededor", () => {
    expect(getCityImage("  CARTAGENA ")).toContain(FOTO_CARTAGENA);
  });

  it("reconoce la ciudad con y sin tilde (Medellín / Medellin)", () => {
    expect(getCityImage("Medellín")).toBe(getCityImage("Medellin"));
  });

  it.each([null, undefined, "", "Ciudad Inexistente"])("usa la foto por defecto para %s", (ciudad) => {
    expect(getCityImage(ciudad)).toContain(FOTO_POR_DEFECTO);
  });

  it("arma la URL con ancho 1200 y calidad 80 si no se piden otros", () => {
    expect(getCityImage("Cali")).toMatch(/\?w=1200&q=80&auto=format$/);
    expect(getCityImage("Cali", { width: 400, quality: 60 })).toMatch(/\?w=400&q=60$/);
  });
});

describe("getDefaultImage", () => {
  it("devuelve la foto genérica con las opciones pedidas", () => {
    expect(getDefaultImage({ width: 800 })).toBe(`https://images.unsplash.com/${FOTO_POR_DEFECTO}?w=800&q=80&auto=format`);
  });
});
