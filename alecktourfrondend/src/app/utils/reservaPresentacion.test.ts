import { describe, expect, it } from "vitest";
import { codigoReserva, porcentajePagado, tipoReserva, tituloReserva } from "./reservaPresentacion";

describe("reservaPresentacion", () => {
  it("el código sale del id real", () => {
    expect(codigoReserva(13)).toBe("AT-000013");
  });

  it("deduce el tipo cuando el backend no lo manda", () => {
    expect(tipoReserva({ tipo_producto: "vuelo" })).toBe("vuelo");
    expect(tipoReserva({ id_paquete: 4 })).toBe("paquete");
    expect(tipoReserva({ vuelo_ruta: "BOG → CTG" })).toBe("vuelo");
    expect(tipoReserva({ hotel_nombre: "Hotel Paraíso" })).toBe("hotel");
  });

  it("el título nunca queda vacío", () => {
    expect(tituloReserva({ id_reserva: 1, nombre_paquete: "Magia del Caribe" })).toBe("Magia del Caribe");
    expect(tituloReserva({ id_reserva: 2, hotel_nombre: "La Palma" })).toBe("Estadía en La Palma");
    expect(tituloReserva({ id_reserva: 3, tipo_producto: "vuelo", vuelo_ruta: "BOG → CTG", hotel_nombre: "X" })).toBe("Vuelo BOG → CTG");
    expect(tituloReserva({ id_reserva: 4 })).toBe("Reserva AT-000004");
  });

  it("el porcentaje pagado queda entre 0 y 100", () => {
    expect(porcentajePagado(200000, 50000)).toBe(25);
    expect(porcentajePagado(0, 100)).toBe(0);
    expect(porcentajePagado(100, 150)).toBe(100);
    expect(porcentajePagado(null, null)).toBe(0);
  });
});
