import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CampoArea, CampoTexto } from "./Campos";

describe("Campos de formulario", () => {
  it("une etiqueta, ayuda y error al control", () => {
    render(<CampoTexto label="Correo" maxLength={120} ayuda="El de tu cuenta" error="Falta la @" defaultValue="x" />);
    const input = screen.getByLabelText("Correo");
    expect(input).toHaveAttribute("maxLength", "120");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain("-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Falta la @");
  });

  it("el campo de contraseña se puede mostrar", () => {
    render(<CampoTexto label="Clave" type="password" maxLength={72} />);
    expect(screen.getByLabelText("Clave")).toHaveAttribute("type", "password");
    screen.getByRole("button", { name: "Mostrar contraseña" }).click();
  });

  it("el área de texto muestra el contador y el mínimo", () => {
    render(<CampoArea label="Mensaje" maxLength={2000} minimo={10} value="Hola" onChange={() => {}} />);
    expect(screen.getByText("4/2.000")).toBeInTheDocument();
    expect(screen.getByText(/faltan 6/)).toBeInTheDocument();
  });
});
