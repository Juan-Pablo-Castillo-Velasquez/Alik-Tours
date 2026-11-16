// Componente: guía flotante de uso (cómo reservar y cómo usar el perfil).
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import GuiaUso, { PASOS_PERFIL, PASOS_RESERVA } from "./GuiaUso";

function montar(ruta = "/") {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <GuiaUso />
    </MemoryRouter>,
  );
}

describe("GuiaUso", () => {
  it("abre el recorrido de reserva y avanza paso a paso", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /abrir guía/i }));

    expect(screen.getByText(PASOS_RESERVA[0].titulo)).toBeInTheDocument();
    expect(screen.getByText(`Paso 1 de ${PASOS_RESERVA.length}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText(PASOS_RESERVA[1].titulo)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));
    expect(screen.getByText(PASOS_RESERVA[0].titulo)).toBeInTheDocument();
  });

  it("cambia al recorrido del perfil", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /abrir guía/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Tu perfil" }));
    expect(screen.getByText(PASOS_PERFIL[0].titulo)).toBeInTheDocument();
  });

  it("en /profile abre directamente la guía del perfil", () => {
    montar("/profile");
    fireEvent.click(screen.getByRole("button", { name: /abrir guía/i }));
    expect(screen.getByRole("tab", { name: "Tu perfil" })).toHaveAttribute("aria-selected", "true");
  });

  it("se puede abrir con el evento guia:abrir", () => {
    montar();
    fireEvent(window, new CustomEvent("guia:abrir", { detail: "perfil" }));
    expect(screen.getByText(PASOS_PERFIL[0].titulo)).toBeInTheDocument();
  });

  it("no aparece en el panel de administración", () => {
    montar("/admin");
    expect(screen.queryByRole("button", { name: /abrir guía/i })).not.toBeInTheDocument();
  });

  it("marca la guía como vista la primera vez que se abre", () => {
    montar();
    expect(localStorage.getItem("guia_uso_vista")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /abrir guía/i }));
    expect(localStorage.getItem("guia_uso_vista")).toBe("1");
  });
});
