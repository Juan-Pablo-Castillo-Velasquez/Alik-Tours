// Unidad: reglas de los formularios de pago (tarjeta, PSE, Nequi).
// Autor (semana 3, capa Front): Fernando Gutiérrez.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cardLast4,
  emptyCardValue,
  formatCardNumber,
  formatExpiry,
  formatNequiDestino,
  isCardValueValid,
  isExpiryValid,
  isNequiValueValid,
  isPSEValueValid,
} from "./types";

const tarjetaValida = { number: "4111 1111 1111 1111", name: "ANA PÉREZ", expiry: "12/28", cvv: "123" };

describe("formatCardNumber / formatExpiry", () => {
  it.each([
    ["4111111111111111", "4111 1111 1111 1111"],
    ["4111-1111-1111-1111-9999", "4111 1111 1111 1111"], // máximo 16 dígitos
    ["411", "411"],
    ["", ""],
  ])("formatCardNumber(%s) = %s", (entrada, salida) => {
    expect(formatCardNumber(entrada)).toBe(salida);
  });

  it.each([
    ["1", "1"],
    ["12", "12"], // dos dígitos: aún sin barra (límite)
    ["122", "12/2"], // tercer dígito: aparece la barra
    ["12/28", "12/28"],
    ["122899", "12/28"],
  ])("formatExpiry(%s) = %s", (entrada, salida) => {
    expect(formatExpiry(entrada)).toBe(salida);
  });
});

describe("isExpiryValid (con la fecha de hoy fija: 15 de noviembre de 2026)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 15));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ["11/26", true], // vence este mes: todavía sirve (límite)
    ["10/26", false], // venció el mes pasado
    ["12/26", true],
    ["01/27", true],
    ["00/27", false], // mes 0
    ["13/27", false], // mes 13
    ["1/27", false], // formato incompleto
    ["", false],
  ])("%s es %s", (vencimiento, esperado) => {
    expect(isExpiryValid(vencimiento)).toBe(esperado);
  });

  it("una tarjeta completa y vigente es válida", () => {
    expect(isCardValueValid(tarjetaValida)).toBe(true);
  });

  it.each([
    ["número de 15 dígitos", { number: "4111 1111 1111 111" }],
    ["titular de 2 letras", { name: "AN" }],
    ["vencida", { expiry: "10/26" }],
    ["CVV de 2 dígitos", { cvv: "12" }],
  ])("no es válida con %s", (_caso, cambio) => {
    expect(isCardValueValid({ ...tarjetaValida, ...cambio })).toBe(false);
  });

  it("la tarjeta vacía no es válida", () => {
    expect(isCardValueValid(emptyCardValue)).toBe(false);
  });
});

describe("cardLast4", () => {
  it("solo los últimos 4 dígitos viajan al backend", () => {
    expect(cardLast4(tarjetaValida)).toBe("1111");
    expect(cardLast4({ ...tarjetaValida, number: "4000 0000 0000 0002" })).toBe("0002");
  });
});

describe("PSE y Nequi", () => {
  it.each([
    [{ banco: "Bancolombia", documento: "123456" }, true], // 6 dígitos: mínimo
    [{ banco: "Bancolombia", documento: "12345" }, false],
    [{ banco: "Bancolombia", documento: "123456789012345" }, true], // 15: máximo
    [{ banco: "Bancolombia", documento: "1234567890123456" }, false],
    [{ banco: "  ", documento: "1020304050" }, false], // sin banco
    [{ banco: "Davivienda", documento: "10203a4050" }, false],
  ])("isPSEValueValid(%o) es %s", (valor, esperado) => {
    expect(isPSEValueValid(valor)).toBe(esperado);
  });

  it.each([
    ["3001234567", true],
    [" 3001234567 ", true],
    ["300123456", false],
    ["2001234567", false],
  ])("isNequiValueValid(%s) es %s", (celular, esperado) => {
    expect(isNequiValueValid({ celular })).toBe(esperado);
  });

  it("muestra el número Nequi de la agencia en bloques legibles", () => {
    expect(formatNequiDestino()).toBe("322 817 4200");
    expect(formatNequiDestino("3001234567")).toBe("300 123 4567");
  });
});
