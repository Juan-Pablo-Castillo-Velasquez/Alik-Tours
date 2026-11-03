// Unidad: caché en localStorage con expiración (panel de admin).
// Autor (semana 2, capa Front): Juan Pablo Castillo.
//
// La regla depende de la hora: se controla con el reloj falso de Vitest
// (FIRST: Repeatable), nunca con esperas reales.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalCache, getLocalCache, setLocalCache } from "./localCache";

const AHORA = new Date("2026-11-02T10:00:00-05:00");

describe("localCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve el valor guardado mientras no venza", () => {
    // Arrange
    setLocalCache("hoteles", [{ id: 1, nombre: "Hotel Caribe" }], 60);
    // Act
    vi.advanceTimersByTime(30_000);
    const valor = getLocalCache<{ id: number; nombre: string }[]>("hoteles");
    // Assert
    expect(valor).toEqual([{ id: 1, nombre: "Hotel Caribe" }]);
  });

  it("sigue vigente justo en el instante del vencimiento (valor límite)", () => {
    setLocalCache("clientes", ["Ana"], 60);
    vi.advanceTimersByTime(60_000);
    expect(getLocalCache("clientes")).toEqual(["Ana"]);
  });

  it("vence 1 ms después del TTL y borra la clave", () => {
    setLocalCache("clientes", ["Ana"], 60);
    vi.advanceTimersByTime(60_001);

    expect(getLocalCache("clientes")).toBeNull();
    expect(localStorage.getItem("clientes")).toBeNull();
  });

  it("devuelve null si no hay nada guardado o si el JSON está corrupto", () => {
    expect(getLocalCache("no-existe")).toBeNull();

    localStorage.setItem("roto", "{esto no es json");
    expect(getLocalCache("roto")).toBeNull();
  });

  it("descarta una entrada sin fecha de vencimiento válida", () => {
    localStorage.setItem("viejo", JSON.stringify({ value: 1 }));

    expect(getLocalCache("viejo")).toBeNull();
    expect(localStorage.getItem("viejo")).toBeNull();
  });

  it("clearLocalCache borra solo la clave pedida", () => {
    setLocalCache("a", 1, 60);
    setLocalCache("b", 2, 60);

    clearLocalCache("a");

    expect(getLocalCache("a")).toBeNull();
    expect(getLocalCache("b")).toBe(2);
  });

  it("no rompe la app si el navegador no deja escribir (cuota llena, modo privado)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => setLocalCache("x", 1, 60)).not.toThrow();

    setItem.mockRestore();
  });
});
