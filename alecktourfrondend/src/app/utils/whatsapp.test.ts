// Enlaces de WhatsApp (wa.me) para la agencia y para los clientes del panel.
// Autor: Juan Pablo Castillo.
import { describe, expect, it } from "vitest";
import { enlaceWhatsApp, enlaceWhatsAppAgencia, numeroWhatsApp } from "./whatsapp";

describe("numeroWhatsApp", () => {
  it.each([
    ["3001234567", "573001234567"],
    ["300 123 4567", "573001234567"],
    ["+57 322 812 7104", "573228127104"],
    ["573228127104", "573228127104"],
  ])("normaliza %s a %s", (entrada, esperado) => {
    expect(numeroWhatsApp(entrada)).toBe(esperado);
  });

  it.each([[""], [null], [undefined], ["12345"]])("sin número utilizable (%s) devuelve null", (entrada) => {
    expect(numeroWhatsApp(entrada)).toBeNull();
  });
});

describe("enlaceWhatsApp", () => {
  it("codifica el mensaje inicial", () => {
    expect(enlaceWhatsApp("3001234567", "Hola, ¿qué tal?")).toBe(
      "https://wa.me/573001234567?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F",
    );
  });

  it("sin mensaje deja solo el número", () => {
    expect(enlaceWhatsApp("3001234567")).toBe("https://wa.me/573001234567");
  });

  it("el de la agencia usa el teléfono oficial", () => {
    expect(enlaceWhatsAppAgencia("Hola")).toBe("https://wa.me/573228127104?text=Hola");
  });
});
