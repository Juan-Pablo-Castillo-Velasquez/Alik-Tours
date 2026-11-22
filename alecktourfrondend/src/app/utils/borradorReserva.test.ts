import { afterEach, describe, expect, it, vi } from "vitest";
import { borrarBorrador, claveBorradorHotel, guardarBorrador, haceCuanto, leerBorrador, VIGENCIA_BORRADOR_MS } from "./borradorReserva";

const clave = claveBorradorHotel(7, 21);

afterEach(() => localStorage.clear());

describe("borrador de reserva", () => {
  it("guarda y recupera los datos con la hora en que se guardaron", () => {
    guardarBorrador(clave, { nombres: "Ana", paso: 2 }, 1000);
    expect(leerBorrador(clave, 2000)).toEqual({ datos: { nombres: "Ana", paso: 2 }, guardadoEn: 1000 });
  });

  it("un borrador vencido se descarta y se borra", () => {
    guardarBorrador(clave, { nombres: "Ana" }, 0);
    expect(leerBorrador(clave, VIGENCIA_BORRADOR_MS + 1)).toBeNull();
    expect(localStorage.getItem(clave)).toBeNull();
  });

  it("un valor corrupto no rompe el checkout", () => {
    localStorage.setItem(clave, "{no es json");
    expect(leerBorrador(clave)).toBeNull();
    localStorage.setItem(clave, JSON.stringify({ v: 9 }));
    expect(leerBorrador(clave)).toBeNull();
  });

  it("si el navegador no deja guardar, sigue sin error", () => {
    const espia = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => guardarBorrador(clave, { a: 1 })).not.toThrow();
    espia.mockRestore();
  });

  it("borrar quita el borrador", () => {
    guardarBorrador(clave, { a: 1 });
    borrarBorrador(clave);
    expect(leerBorrador(clave)).toBeNull();
  });

  it("dice hace cuánto se guardó", () => {
    const ahora = 10 * 24 * 3600 * 1000;
    expect(haceCuanto(ahora - 20_000, ahora)).toBe("hace un momento");
    expect(haceCuanto(ahora - 5 * 60_000, ahora)).toBe("hace 5 min");
    expect(haceCuanto(ahora - 3 * 3600_000, ahora)).toBe("hace 3 h");
    expect(haceCuanto(ahora - 30 * 3600_000, ahora)).toBe("ayer");
  });
});
