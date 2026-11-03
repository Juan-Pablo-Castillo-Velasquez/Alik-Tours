// Componente: buscador de las listas (reservas y comprobantes del perfil).
// Autor (semana 3, capa Front): Cristian Sinisterra.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SearchInput from "./SearchInput";

describe("SearchInput", () => {
  it("tiene nombre accesible: el placeholder o el que se le pase", () => {
    const { rerender } = render(<SearchInput value="" onChange={vi.fn()} placeholder="Buscar reserva..." />);
    expect(screen.getByRole("searchbox", { name: "Buscar reserva..." })).toBeInTheDocument();

    rerender(<SearchInput value="" onChange={vi.fn()} ariaLabel="Buscar comprobantes" />);
    expect(screen.getByRole("searchbox", { name: "Buscar comprobantes" })).toHaveAttribute("placeholder", "Buscar...");
  });

  it("avisa cada letra que se escribe", async () => {
    // Arrange
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    // Act
    await user.type(screen.getByRole("searchbox"), "Cali");
    // Assert: el valor lo controla el padre; cada tecla llega por separado
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onChange).toHaveBeenLastCalledWith("i");
  });

  it("muestra el valor que le da el padre", () => {
    render(<SearchInput value="Cartagena" onChange={vi.fn()} />);

    expect(screen.getByRole("searchbox")).toHaveValue("Cartagena");
  });
});
