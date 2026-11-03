// Componente: filtro "desde / hasta" (comprobantes del cliente, pagos del panel).
// Autor (semana 3, capa Front): Cristian Sinisterra.
//
// Los <input type="date"> se cambian con fireEvent.change y no con
// user.type: jsdom no simula el selector de fechas del navegador, y escribir
// letra por letra deja valores intermedios inválidos que el input descarta.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { esFechaValida } from "./DateInput";
import DateRangeFilter, { dentroDeRango } from "./DateRangeFilter";

describe("DateRangeFilter", () => {
  it("cada extremo tiene su nombre y limita al otro (desde <= hasta)", () => {
    render(<DateRangeFilter desde="2026-11-01" hasta="2026-11-30" onChange={vi.fn()} label="Pago" />);

    expect(screen.getByLabelText("Pago desde")).toHaveAttribute("max", "2026-11-30");
    expect(screen.getByLabelText("Pago hasta")).toHaveAttribute("min", "2026-11-01");
  });

  it("al cambiar 'desde' conserva el 'hasta' que ya estaba", () => {
    // Arrange
    const onChange = vi.fn();
    render(<DateRangeFilter desde="" hasta="2026-11-30" onChange={onChange} />);
    // Act
    fireEvent.change(screen.getByLabelText("Fecha desde"), { target: { value: "2026-11-10" } });
    // Assert
    expect(onChange).toHaveBeenCalledWith({ desde: "2026-11-10", hasta: "2026-11-30" });
  });

  it("borrar una fecha se avisa como vacía (quita ese extremo del filtro)", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter desde="2026-11-01" hasta="2026-11-30" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Fecha hasta"), { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith({ desde: "2026-11-01", hasta: "" });
  });

  it("sin rango no limita las fechas del calendario más allá de 1900-2100", () => {
    render(<DateRangeFilter desde="" hasta="" onChange={vi.fn()} />);

    expect(screen.getByLabelText("Fecha desde")).toHaveAttribute("min", "1900-01-01");
    expect(screen.getByLabelText("Fecha hasta")).toHaveAttribute("max", "2100-12-31");
  });
});

describe("dentroDeRango", () => {
  it.each([
    ["2026-11-01", "2026-11-01", "2026-11-30", true], // extremo inicial incluido
    ["2026-11-30T23:59:00", "2026-11-01", "2026-11-30", true], // extremo final, con hora
    ["2026-10-31", "2026-11-01", "2026-11-30", false], // un día antes
    ["2026-12-01", "2026-11-01", "2026-11-30", false], // un día después
    ["2020-01-01", "", "2026-11-30", true], // solo "hasta"
    ["2030-01-01", "2026-11-01", "", true], // solo "desde"
    [null, "", "", true], // sin filtro, todo pasa
    [null, "2026-11-01", "", false], // con filtro, sin fecha no pasa
  ])("%s en [%s, %s] es %s", (fecha, desde, hasta, esperado) => {
    expect(dentroDeRango(fecha, desde, hasta)).toBe(esperado);
  });
});

describe("esFechaValida (DateInput)", () => {
  it.each([
    ["2026-11-02", true],
    ["2028-02-29", true], // bisiesto
    ["2026-02-29", false], // no bisiesto
    ["2026-13-01", false],
    ["20260-01-01", false], // año de 5 cifras (el bug que evita DateInput)
    ["", false],
  ])("%s es %s", (valor, esperado) => {
    expect(esFechaValida(valor)).toBe(esperado);
  });
});
