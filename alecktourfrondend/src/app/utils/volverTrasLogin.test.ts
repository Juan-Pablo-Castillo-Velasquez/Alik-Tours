import { beforeEach, describe, expect, it } from "vitest";
import { guardarVuelta, rutaLoginConVuelta, tomarVuelta } from "./volverTrasLogin";

describe("volver tras iniciar sesión", () => {
  beforeEach(() => sessionStorage.clear());

  it("devuelve una sola vez la ruta interna guardada", () => {
    guardarVuelta("/checkout/12?habitacion=3&start=2026-12-20");
    expect(tomarVuelta()).toBe("/checkout/12?habitacion=3&start=2026-12-20");
    expect(tomarVuelta()).toBeNull();
  });

  it("ignora destinos externos", () => {
    guardarVuelta("https://otro-sitio.com");
    guardarVuelta("//otro-sitio.com");
    expect(tomarVuelta()).toBeNull();
  });

  it("arma la ruta de login con la vuelta codificada", () => {
    expect(rutaLoginConVuelta("/checkout/1?a=1&b=2")).toBe("/login?volver=%2Fcheckout%2F1%3Fa%3D1%26b%3D2");
  });
});
