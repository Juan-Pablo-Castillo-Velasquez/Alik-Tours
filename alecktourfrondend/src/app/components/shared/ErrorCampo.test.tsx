import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ErrorCampo from "./ErrorCampo";

describe("ErrorCampo", () => {
  it("sin mensaje no pinta nada", () => {
    const { container } = render(<ErrorCampo id="e" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("con mensaje lo anuncia como alerta con su id", () => {
    render(<ErrorCampo id="campo-error" mensaje="El nombre es obligatorio" />);
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("El nombre es obligatorio");
    expect(alerta).toHaveAttribute("id", "campo-error");
  });
});
