import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("../../../api/v1/api", () => ({ apiFetch }));

import ClienteCombobox from "./ClienteCombobox";

const valentina = {
  id_cliente: 5,
  nombre: "Valentina",
  apellido: "Ríos",
  cedula: "1020",
  correo: "v@correo.co",
  celular: null,
  tiene_cuenta: true,
};

describe("ClienteCombobox", () => {
  it("busca al escribir y se elige con el teclado", async () => {
    apiFetch.mockResolvedValue([valentina]);
    const onChange = vi.fn();
    render(<ClienteCombobox value={null} onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Cliente" });
    fireEvent.change(input, { target: { value: "vale" } });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/clientes/buscar?q=vale"));
    expect(await screen.findByRole("option", { name: /Valentina Ríos/ })).toBeInTheDocument();
    expect(screen.getByText(/1 cliente encontrado/)).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(valentina);
  });

  it("con un cliente elegido muestra su ficha y permite cambiarlo", () => {
    const onChange = vi.fn();
    render(<ClienteCombobox value={valentina} onChange={onChange} />);
    expect(screen.getByText("Valentina Ríos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cambiar cliente/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
