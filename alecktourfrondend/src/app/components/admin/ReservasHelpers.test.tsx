import { describe, expect, it } from "vitest";
import { cobroDe, productoDe } from "./ModuleReservas";

const base = { id_reserva: 9, id_cliente: 1, id_paquete: 0, fecha_inicio: "2026-12-20", fecha_fin: "2026-12-24", numero_personas: 2, estado: "pendiente" } as any;

describe("Listado de reservas del panel", () => {
  it("nombra el producto según su tipo (antes un vuelo salía como '#')", () => {
    expect(productoDe({ ...base, tipo_producto: "vuelo", vuelo_ruta: "BOG ⇄ CTG" })).toMatchObject({ tipo: "Vuelo", nombre: "BOG ⇄ CTG" });
    expect(productoDe({ ...base, tipo_producto: "hotel", hotel_nombre: "Hotel Caribe" })).toMatchObject({ tipo: "Hotel", nombre: "Hotel Caribe" });
    expect(productoDe({ ...base, tipo_producto: "paquete", nombre_paquete: "Ruta del Sol" })).toMatchObject({ tipo: "Paquete", nombre: "Ruta del Sol" });
    expect(productoDe({ ...base, destino: null })).toMatchObject({ nombre: "Reserva #9" });
  });

  it("resume el cobro con los totales reales de la reserva", () => {
    expect(cobroDe({ ...base, precio_total: 1000, total_pagado: 1000, saldo_pendiente: 0 })).toMatchObject({ etiqueta: "Pagada", pct: 100 });
    expect(cobroDe({ ...base, precio_total: 1000, total_pagado: 400, saldo_pendiente: 600 })).toMatchObject({ etiqueta: "Abono", pct: 40, saldo: 600 });
    expect(cobroDe({ ...base, precio_total: 1000, total_pagado: 0, saldo_pendiente: 1000 })).toMatchObject({ etiqueta: "Sin pago", saldo: 1000 });
  });
});
