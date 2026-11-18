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

import DashboardEmpleado from "./DashboardEmpleado";
import type { ResumenEmpleado } from "../../services/dashboard.service";

vi.mock("../../api/v1/api", () => ({
  apiFetch: vi.fn(async () => ({ items: [{ id_reserva: 9, cliente_nombre: "Ana Ríos", nombre_paquete: "Ruta del Sol", fecha_reserva: new Date().toISOString(), fecha_inicio: "2026-12-20", estado: "pendiente", precio_total: 1, saldo_pendiente: 500000 }] })),
}));

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
  asesores_top_mes: [
    { nombre: "Pedro Ruiz", total: 4, monto: null },
    { nombre: "Laura Gómez", total: 3, monto: null },
  ],
  cartera_por_cobrar: 2_500_000,
  reservas_con_saldo: 3,
  ingresos_hoy: 300_000,
  reservas_hoy: 2,
} as DashboardResumen;

const asesora: ResumenEmpleado = {
  chats_pendientes: 3,
  chats_respondidos_hoy: 5,
  tiempo_promedio_respuesta_minutos: 12.4,
  reservas_gestionadas: 20,
  cancelaciones_pendientes: 1,
  cancelaciones_aprobadas: 0,
  cancelaciones_rechazadas: 0,
  cancelaciones_total: 1,
  nombre: "Laura",
  reservas_gestionadas_mes: 3,
  reservas_gestionadas_mes_anterior: 2,
  ventas_cobradas_mes: 1_800_000,
  mis_reservas_con_saldo: 2,
  mis_reservas_pendientes: 1,
  posicion_ranking_mes: 2,
  asesores_activos_mes: 4,
};

function montar(e: ResumenEmpleado | null = asesora, extra: Partial<DashboardResumen> = {}) {
  const props = { setActiveModule: vi.fn(), onVerReserva: vi.fn(), onFiltrarModulo: vi.fn(), onActualizar: vi.fn() };
  render(
    <DashboardEmpleado resumen={{ ...base, ...extra }} resumenEmpleado={e} actividad={[]} nombreUsuario="laura" actualizando={false} {...props} />,
  );
  return props;
}

describe("DashboardEmpleado", () => {
  it("saluda al asesor y resume su bandeja con cifras reales", async () => {
    montar();
    expect(screen.getByText(/Buen(os|as) .*, Laura/)).toBeInTheDocument();
    expect(screen.getByText("Tienes 3 chats por responder, 2 pagos por confirmar y 3 reservas por confirmar.")).toBeInTheDocument();
    expect(screen.getByText("12 min")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("de 4 este mes")).toBeInTheDocument();
    expect(await screen.findByText("Ana Ríos")).toBeInTheDocument();
  });

  it("cada tarea de la bandeja abre su módulo", () => {
    const p = montar();
    fireEvent.click(screen.getByRole("button", { name: /Chats por responder/ }));
    expect(p.setActiveModule).toHaveBeenCalledWith("mensajes");
    fireEvent.click(screen.getByRole("button", { name: /Pagos por confirmar/ }));
    expect(p.onFiltrarModulo).toHaveBeenCalledWith("pagos", "pendiente");
  });

  it("marca al asesor en el ranking del equipo", () => {
    montar();
    expect(screen.getByText("Tú")).toBeInTheDocument();
  });

  it("con todo al día lo dice y no inventa un puesto", () => {
    montar({ ...asesora, chats_pendientes: 0, posicion_ranking_mes: null }, { pagos_pendientes: 0, reservas_pendientes: 0 });
    expect(screen.getByText("Tu bandeja está al día. ¡Buen trabajo!")).toBeInTheDocument();
    expect(screen.getByText("Puesto del mes")).toBeInTheDocument();
  });
});
