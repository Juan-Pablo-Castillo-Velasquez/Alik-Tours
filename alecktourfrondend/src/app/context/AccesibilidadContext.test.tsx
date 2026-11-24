import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AccesibilidadProvider, useAccesibilidad } from "./AccesibilidadContext";

function Prueba() {
  const { prefs, cambiar, restablecer, panelAbierto, activas } = useAccesibilidad();
  return (
    <>
      <button onClick={() => cambiar("contraste", !prefs.contraste)}>contraste</button>
      <button onClick={() => cambiar("texto", 2)}>texto</button>
      <button onClick={restablecer}>reset</button>
      <p>activas:{activas}</p>
      <p>panel:{String(panelAbierto)}</p>
    </>
  );
}

describe("AccesibilidadContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("aplica las clases en <html>, las guarda y las restablece", () => {
    render(
      <AccesibilidadProvider>
        <Prueba />
      </AccesibilidadProvider>,
    );
    fireEvent.click(screen.getByText("contraste"));
    fireEvent.click(screen.getByText("texto"));
    expect(document.documentElement.classList.contains("a11y-contraste")).toBe(true);
    expect(document.documentElement.classList.contains("a11y-texto-2")).toBe(true);
    expect(screen.getByText("activas:2")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("alik_accesibilidad")!).contraste).toBe(true);
    fireEvent.click(screen.getByText("reset"));
    expect(document.documentElement.classList.contains("a11y-contraste")).toBe(false);
  });

  it("Alt + A abre el panel", () => {
    render(
      <AccesibilidadProvider>
        <Prueba />
      </AccesibilidadProvider>,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", altKey: true }));
    });
    expect(screen.getByText("panel:true")).toBeInTheDocument();
  });
});
