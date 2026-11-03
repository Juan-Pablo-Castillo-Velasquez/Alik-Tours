// Componente: selector del método de pago en el checkout.
// Autor (semana 3, capa Front): Fernando Gutiérrez.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MetodoPago } from "../../services/reserva.service";
import PaymentSelector from "./PaymentSelector";

const metodos = [
  { id_metodo: 1, codigo: "tarjeta_credito", nombre_metodo: "Tarjeta de crédito" },
  { id_metodo: 2, codigo: "pse", nombre_metodo: "PSE" },
  { id_metodo: 3, codigo: "efectivo", nombre_metodo: "Efectivo en oficina" },
] as MetodoPago[];

describe("PaymentSelector", () => {
  it("muestra un radio por método y marca solo el seleccionado", () => {
    render(<PaymentSelector metodos={metodos} selectedId={2} onSelect={vi.fn()} />);

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "PSE" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Tarjeta de crédito" })).not.toBeChecked();
  });

  it("al elegir un método avisa su id", async () => {
    // Arrange
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PaymentSelector metodos={metodos} selectedId={null} onSelect={onSelect} />);
    // Act: también se puede hacer clic en el texto (el label envuelve al radio)
    await user.click(screen.getByText("Efectivo en oficina"));
    // Assert
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("sin métodos disponibles no muestra opciones", () => {
    render(<PaymentSelector metodos={[]} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });
});
