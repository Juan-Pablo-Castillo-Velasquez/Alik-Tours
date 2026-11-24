import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import en from "./en";
import es from "./es";
import { IdiomaProvider, traducir, useIdioma } from "./index";

describe("i18n", () => {
  beforeEach(() => localStorage.clear());

  it("traduce, reemplaza variables y vuelve al español si falta una clave", () => {
    expect(traducir("en", "nav.hoteles")).toBe("Hotels");
    expect(traducir("es", "login.hola", { nombre: "Ana" })).toBe("¡Hola, Ana!");
    expect(traducir("en", "no.existe")).toBe("no.existe");
  });

  it("el inglés tiene todas las claves del español", () => {
    const faltan = Object.keys(es).filter((k) => !(k in en));
    expect(faltan).toEqual([]);
  });

  it("cambia el idioma, lo guarda y actualiza <html lang>", () => {
    function Prueba() {
      const { t, setIdioma } = useIdioma();
      return (
        <>
          <p>{t("nav.vuelos")}</p>
          <button onClick={() => setIdioma("en")}>cambiar</button>
        </>
      );
    }
    render(
      <IdiomaProvider>
        <Prueba />
      </IdiomaProvider>,
    );
    expect(screen.getByText("Vuelos")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es-CO");
    fireEvent.click(screen.getByText("cambiar"));
    expect(screen.getByText("Flights")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("alik_idioma")).toBe("en");
  });
});
