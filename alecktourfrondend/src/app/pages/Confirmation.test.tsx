import { describe, expect, it } from "vitest";
import { codigoReserva } from "./Confirmation";

describe("codigoReserva", () => {
  it("sale del id real de la reserva (antes era un código aleatorio que no existía en ningún lado)", () => {
    expect(codigoReserva(57)).toBe("AT-000057");
    expect(codigoReserva(1234567)).toBe("AT-1234567");
  });
});
