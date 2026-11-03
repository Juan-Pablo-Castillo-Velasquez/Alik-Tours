// Componente: chip de filtro (estado de reservas, moderación de comunidad).
// Autor (semana 3, capa Front): Cristian Sinisterra.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FilterChip from "./FilterChip";

describe("FilterChip", () => {
  it("anuncia si está activo con aria-pressed", () => {
    const { rerender } = render(<FilterChip selected={false}>Pendientes</FilterChip>);
    expect(screen.getByRole("button", { name: "Pendientes" })).toHaveAttribute("aria-pressed", "false");

    rerender(<FilterChip selected>Pendientes</FilterChip>);
    expect(screen.getByRole("button", { name: "Pendientes" })).toHaveAttribute("aria-pressed", "true");
  });

  it("muestra el contador solo si se le pasa, incluso cuando es 0", () => {
    const { rerender } = render(<FilterChip selected={false}>Todas</FilterChip>);
    expect(screen.getByRole("button")).toHaveTextContent(/^Todas$/);

    rerender(
      <FilterChip selected={false} count={0}>
        Canceladas
      </FilterChip>,
    );
    expect(screen.getByRole("button", { name: /Canceladas/ })).toHaveTextContent(/^Canceladas\s*0$/);
  });

  it("al hacer clic avisa; deshabilitado no", async () => {
    // Arrange
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <FilterChip selected={false} onClick={onClick}>
        Confirmadas
      </FilterChip>,
    );
    // Act + Assert
    await user.click(screen.getByRole("button", { name: "Confirmadas" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <FilterChip selected={false} onClick={onClick} disabled>
        Confirmadas
      </FilterChip>,
    );
    await user.click(screen.getByRole("button", { name: "Confirmadas" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("no envía formularios por accidente (type=button)", () => {
    render(<FilterChip selected={false}>Todas</FilterChip>);

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
