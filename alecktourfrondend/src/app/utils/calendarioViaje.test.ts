import { describe, expect, it } from "vitest";
import { icsDeViaje } from "./calendarioViaje";

describe("icsDeViaje", () => {
  const ics = icsDeViaje(
    {
      codigo: "AT-000014",
      titulo: "Viaje a Cartagena, Resort Sol y Arena",
      fechaInicio: "2026-12-20",
      fechaFin: "2026-12-23",
      lugar: "Av. Marítima 45, Cartagena",
    },
    new Date("2026-11-23T10:00:00Z"),
  );

  it("es un evento de día completo que incluye el día de salida", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261220");
    // DTEND es exclusivo: el día siguiente a la salida.
    expect(ics).toContain("DTEND;VALUE=DATE:20261224");
  });

  it("escapa comas y lleva el código de la reserva", () => {
    expect(ics).toContain("SUMMARY:Viaje a Cartagena\\, Resort Sol y Arena");
    expect(ics).toContain("LOCATION:Av. Marítima 45\\, Cartagena");
    expect(ics).toContain("UID:AT-000014@aliktours");
  });
});
