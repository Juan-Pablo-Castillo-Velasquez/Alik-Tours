import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardResumen } from "../../services/dashboard.service";

// jsdom no trae ResizeObserver (lo usan los gráficos de recharts).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

vi.mock("../../context/TemaContext", () => ({ useTema: () => ({ temaActivo: null }) }));

import DashboardAdmin from "./DashboardAdmin";

const t = (actual: number, anterior: number, variacion_pct: number | null) => ({ actual, anterior, variacion_pct });
const serie = (n: number) =>
  Array.from({ length: 14 }, (_, i) => ({ fecha: `2026-11-${String(i + 4).padStart(2, "0")}`, total: i === 13 ? n : 0 }));

const base: DashboardResumen = {
  reservas_total: 10,
  reservas_confirmadas: 6,
  reservas_pendientes: 3,
  reservas_canceladas: 1,
  reservas_finalizadas: 0,
  pagos_pagados: 4,
  pagos_pendientes: 2,
  pagos_fallidos: 0,
  pagos_reembolsados: null,
  ingresos_totales: 4_000_000,
  ticket_promedio: 1_000_000,
  clientes_total: 20,
  clientes_nuevos_mes: 5,
  clientes_activos: 8,
  clientes_con_reserva_proxima: 3,
  checkins_proximos_7d: 1,
  checkouts_proximos_7d: 0,
  solicitudes_cancelacion_pendientes: 1,
  contactos_empresariales_pendientes: 0,
  tendencia_reservas: t(10, 5, 100),
  tendencia_ingresos: t(4_000_000, 5_000_000, -20),
  tendencia_cancelaciones: t(1, 0, null),
  tendencia_clientes_nuevos: t(5, 0, null),
  reservas_por_estado: { confirmada: 6, pendiente: 3, cancelada: 1 },
  ingresos_por_metodo: [{ nombre: "Nequi", total: 0, monto: 4_000_000 }],
  paquetes_mas_solicitados: [{ nombre: "Ruta del Sol", total: 4, monto: null }],
  reservas_por_mes: [],
  cancelaciones_por_mes: [],
  reservas_proximas: [],
  hoteles_activos: 12,
  paquetes_activos: 8,
  tasa_conversion_pct: 60,
  tasa_cancelacion_pct: 10,
  tiempo_promedio_confirmacion_horas: 0.25,
  reservas_ultimos_14d: serie(2),
  ingresos_ultimos_14d: serie(300_000),
  comercial_por_mes: [{ mes: "2026-11", reservas: 10, ingresos: 4_000_000 }],
  ventas_por_producto: [{ nombre: "Paquetes", total: 7, monto: 3_000_000 }],
  reservas_por_canal: [
    { nombre: "Sitio web", total: 6, monto: null },
    { nombre: "Asesor", total: 4, monto: null },
  ],
  hoteles_mas_reservados: [],
  asesores_top_mes: [{ nombre: "Laura Gómez", total: 3, monto: null }],
  cartera_por_cobrar: 2_500_000,
  reservas_con_saldo: 3,
  ingresos_hoy: 300_000,
  reservas_hoy: 2,
} as DashboardResumen;

function montar(extra: Partial<DashboardResumen> = {}) {
  const props = {
    setActiveModule: vi.fn(),
    onVerReserva: vi.fn(),
    onFiltrarModulo: vi.fn(),
    onActualizar: vi.fn(),
  };
  render(<DashboardAdmin resumen={{ ...base, ...extra }} actividad={[]} nombreUsuario="laura" actualizando={false} {...props} />);
  return props;
}

describe("DashboardAdmin", () => {
  it("resume el día con cifras reales", () => {
    montar();
    expect(screen.getByText(/laura/)).toBeInTheDocument();
    expect(screen.getByText("$300.000")).toBeInTheDocument();
    expect(screen.getByText("2 reservas nuevas")).toBeInTheDocument();
    expect(screen.getByText("3 reservas con saldo pendiente")).toBeInTheDocument();
    expect(screen.getByText("Se confirman en 15 min en promedio")).toBeInTheDocument();
  });

  it("las alertas llevan al módulo filtrado", () => {
    const p = montar();
    fireEvent.click(screen.getByRole("button", { name: /2 pagos por confirmar/ }));
    expect(p.onFiltrarModulo).toHaveBeenCalledWith("pagos", "pendiente");
    fireEvent.click(screen.getByRole("button", { name: /1 cancelaciones por resolver/ }));
    expect(p.setActiveModule).toHaveBeenCalledWith("cancelaciones");
  });

  it("muestra la variación real y no inventa una sin mes anterior", () => {
    montar();
    expect(screen.getByText(/20% vs\. mes anterior/)).toBeInTheDocument();
    expect(screen.getAllByText("Sin mes anterior para comparar").length).toBeGreaterThan(0);
  });

  it("sin datos muestra estados vacíos claros", () => {
    montar({ hoteles_mas_reservados: [], asesores_top_mes: [], reservas_proximas: [], ticket_promedio: null });
    expect(screen.getByText("Aún no hay reservas de hotel.")).toBeInTheDocument();
    expect(screen.getByText("No hay viajes próximos.")).toBeInTheDocument();
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });

  it("el botón Actualizar vuelve a pedir el resumen", () => {
    const p = montar();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(p.onActualizar).toHaveBeenCalled();
  });
});
