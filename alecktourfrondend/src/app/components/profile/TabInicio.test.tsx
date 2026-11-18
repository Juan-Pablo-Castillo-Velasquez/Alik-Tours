import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../context/FavoritosContext", () => ({ useFavoritos: () => ({ idsFavoritos: new Set([1, 2]) }) }));
vi.mock("../../context/TemaContext", () => ({ useTema: () => ({ temaActivo: null }) }));
const getAll = vi.fn();
vi.mock("../../services/paquete.service", () => ({ paqueteService: { getAll: (...a: unknown[]) => getAll(...a) } }));
vi.mock("../../services/preferencias.service", () => ({ preferenciasService: { getSugerencias: vi.fn(async () => []) } }));

import { nombreReserva, proximasReservas, saldoPorPagar } from "./perfilUtils";
import TabInicio from "./TabInicio";

const enDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const reservaHotel = {
  id_reserva: 13,
  id_paquete: null,
  estado: "confirmada",
  fecha_inicio: enDias(10),
  fecha_fin: enDias(15),
  numero_personas: 2,
  hotel_nombre: "Montaña Mágica",
  destino: "Medellín",
  precio_total: 1_000_000,
  total_pagado: 400_000,
  saldo_pendiente: 600_000,
};
const finalizada = { ...reservaHotel, id_reserva: 3, estado: "finalizada", fecha_inicio: enDias(-60), fecha_fin: enDias(-55), saldo_pendiente: 0 };

function montar(props: Partial<Parameters<typeof TabInicio>[0]> = {}) {
  const handlers = { onIr: vi.fn(), onVerReserva: vi.fn(), onHablarDeReserva: vi.fn() };
  render(
    <MemoryRouter>
      <TabInicio
        reservas={[reservaHotel, finalizada]}
        clienteData={{ nombre: "Carlos", celular: "300", ciudad: "Cali", fecha_nacimiento: "1990-01-01" }}
        tienePreferencias
        idCliente={3}
        noLeidosMensajes={0}
        {...handlers}
        {...props}
      />
    </MemoryRouter>,
  );
  return handlers;
}

beforeEach(() => {
  getAll.mockResolvedValue([
    { id_paquete: 7, nombre_paquete: "Magia del Caribe", activo: true, duracion_dias: 5, precio_base: 1_200_000, destino_ciudad: "Cartagena" },
    { id_paquete: 8, nombre_paquete: "Paquete inactivo", activo: false, duracion_dias: 3, precio_base: 1, destino_ciudad: "Pasto" },
  ]);
});

describe("Utilidades del perfil", () => {
  it("nombra la reserva por paquete, hotel o vuelo, nunca 'Paquete #'", () => {
    expect(nombreReserva({ ...reservaHotel })).toBe("Estadía en Montaña Mágica");
    expect(nombreReserva({ ...reservaHotel, hotel_nombre: null, vuelo_ruta: "BOG → CTG" })).toBe("Vuelo BOG → CTG");
    expect(nombreReserva({ ...reservaHotel, hotel_nombre: null })).toBe("Reserva #13");
  });

  it("calcula próximos viajes y saldo solo de reservas vigentes", () => {
    expect(proximasReservas([finalizada, reservaHotel]).map((r) => r.id_reserva)).toEqual([13]);
    expect(saldoPorPagar([reservaHotel, finalizada, { ...reservaHotel, estado: "cancelada" }])).toBe(600_000);
  });
});

describe("TabInicio", () => {
  it("destaca el próximo viaje con su saldo y acceso directo a pagar", async () => {
    const h = montar();
    expect(screen.getByText("Estadía en Montaña Mágica")).toBeInTheDocument();
    expect(screen.getByText("Faltan 10 días")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pagar saldo de \$600\.000/ })).toHaveAttribute("href", "/pagar/13");
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle" }));
    expect(h.onVerReserva).toHaveBeenCalledWith(13);
    expect(await screen.findByText("Magia del Caribe")).toBeInTheDocument();
    expect(screen.queryByText("Paquete inactivo")).toBeNull();
  });

  it("lista pendientes reales: saldo, mensajes y datos incompletos", () => {
    const h = montar({ noLeidosMensajes: 2, clienteData: { nombre: "Carlos" }, tienePreferencias: false });
    expect(screen.getByText("Completa el pago de Estadía en Montaña Mágica")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Tienes 2 mensajes nuevos"));
    expect(h.onIr).toHaveBeenCalledWith("mensajes");
    expect(screen.getByText("Completa tus datos personales")).toBeInTheDocument();
    expect(screen.getByText("Cuéntanos qué tipo de viajes te gustan")).toBeInTheDocument();
  });

  it("sin viajes próximos invita a explorar y todo al día si no hay pendientes", async () => {
    montar({ reservas: [finalizada] });
    expect(screen.getByText("¿A dónde te gustaría ir?")).toBeInTheDocument();
    expect(screen.getByText(/Todo al día/)).toBeInTheDocument();
    await waitFor(() => expect(getAll).toHaveBeenCalled());
  });
});
