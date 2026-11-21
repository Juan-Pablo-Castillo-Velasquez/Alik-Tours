import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DispositivoIoT } from "../../services/iot.service";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const lectura = {
  id_lectura: 7,
  medido_en: null,
  recibido_en: new Date().toISOString(),
  latitud: 10.4251,
  longitud: -75.5492,
  velocidad_kmh: 28,
  temperatura_c: 30.1,
  humedad_pct: 65,
  pasajeros: 3,
  bateria_pct: 95,
};

const dispositivos: DispositivoIoT[] = [
  {
    id_dispositivo: 1,
    nombre: "Van de traslados 01",
    descripcion: "Aeropuerto - Centro Histórico",
    activo: true,
    ultima_conexion: new Date().toISOString(),
    estado: "en_linea",
    ultima_lectura: lectura,
    alertas: ["Temperatura de cabina alta (30.1 °C)"],
  },
  {
    id_dispositivo: 2,
    nombre: "Van 02",
    descripcion: null,
    activo: true,
    ultima_conexion: null,
    estado: "sin_datos",
    ultima_lectura: null,
    alertas: [],
  },
];

vi.mock("../../services/iot.service", () => ({
  iotService: {
    dispositivos: vi.fn(() => Promise.resolve(dispositivos)),
    lecturas: vi.fn(() => Promise.resolve([lectura, { ...lectura, id_lectura: 6, temperatura_c: 24 }])),
    crear: vi.fn(),
    cambiarActivo: vi.fn(),
  },
}));

import ModuleIoT from "./ModuleIoT";

describe("ModuleIoT", () => {
  it("muestra el estado, la última lectura y las alertas de cada vehículo", async () => {
    render(<ModuleIoT />);
    expect(await screen.findByText("Van de traslados 01")).toBeInTheDocument();
    expect(screen.getByText("En línea")).toBeInTheDocument();
    expect(screen.getByText("30.1 °C")).toBeInTheDocument();
    expect(screen.getByText(/Temperatura de cabina alta/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver posición/ })).toHaveAttribute("href", expect.stringContaining("openstreetmap.org"));
  });

  it("un dispositivo sin lecturas explica cómo empezar a enviar datos", async () => {
    render(<ModuleIoT />);
    await waitFor(() => expect(screen.getByText("Sin datos aún")).toBeInTheDocument());
    expect(screen.getByText(/Todavía no llegan lecturas/)).toBeInTheDocument();
  });
});
