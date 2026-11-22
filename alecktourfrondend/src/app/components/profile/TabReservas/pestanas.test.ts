import { describe, expect, it } from "vitest";
import { pestanasDe } from "./index";

const hoy = new Date(2026, 10, 21);

describe("pestanasDe (Mis reservas)", () => {
  it("una reserva futura con saldo sale en Próximas y en Por pagar", () => {
    const r = { estado: "confirmada", fecha_inicio: "2026-12-20", fecha_fin: "2026-12-27", saldo_pendiente: 180000 };
    expect(pestanasDe(r, hoy)).toEqual(["todas", "proximas", "por_pagar"]);
  });

  it("un viaje en curso todavía es próximo", () => {
    const r = { estado: "confirmada", fecha_inicio: "2026-11-19", fecha_fin: "2026-11-23", saldo_pendiente: 0 };
    expect(pestanasDe(r, hoy)).toEqual(["todas", "proximas"]);
  });

  it("una reserva terminada va a Pasadas aunque deba saldo", () => {
    const r = { estado: "finalizada", fecha_inicio: "2026-05-25", fecha_fin: "2026-05-28", saldo_pendiente: 340000 };
    expect(pestanasDe(r, hoy)).toEqual(["todas", "pasadas"]);
  });

  it("una cancelada solo va a Canceladas", () => {
    const r = { estado: "cancelada", fecha_inicio: "2026-12-01", fecha_fin: "2026-12-03", saldo_pendiente: 100 };
    expect(pestanasDe(r, hoy)).toEqual(["todas", "canceladas"]);
  });
});
