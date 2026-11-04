// Contexto: tema de temporada (colores, favicon y barra del navegador).
// Autor (semana 8, capa Front): Juan Pablo Castillo.
//
// Nació del análisis de ramas sin cubrir del reporte de cobertura del
// frontend (artefacto coverage-frontend): TemaContext era el archivo con
// más ramas sin probar. El API es MSW; el DOM es el real de jsdom.
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { API } from "../../test/msw/handlers";
import { server } from "../../test/msw/server";
import type { Tema } from "../services/tema.service";
import { sincronizarThemeColorMeta, TemaProvider, useTema } from "./TemaContext";

const base: Tema = {
  id_tema: 1,
  nombre: "Alik",
  clave: "alik",
  color_primario_claro: "#6e1832",
  color_primario_oscuro: "#c24d6e",
  color_secundario_claro: "#b8912e",
  color_secundario_oscuro: "#e8c77a",
  activo: true,
  es_predeterminado: true,
  icono: null,
  imagen_url: null,
} as Tema;
const halloween: Tema = {
  ...base,
  id_tema: 7,
  nombre: "Halloween",
  clave: "halloween",
  color_primario_claro: "#4a1a6b",
  es_predeterminado: false,
};

const responderTema = (tema: Tema) => server.use(http.get(`${API}/api/temas/activo`, () => HttpResponse.json(tema)));
const wrapper = ({ children }: { children: ReactNode }) => <TemaProvider>{children}</TemaProvider>;
const raiz = () => document.documentElement;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  raiz().removeAttribute("data-tema-temporada");
  document.head.innerHTML = `
    <meta name="theme-color" content="#000000">
    <link id="favicon-svg" rel="icon" href="/favicon.svg">
    <link id="favicon-png" rel="icon" href="/favicon.png">`;
});

describe("TemaContext", () => {
  it("con una temporada activa pinta sus colores y lo recuerda para la próxima visita", async () => {
    // Arrange
    responderTema(halloween);
    // Act
    const { result } = renderHook(() => useTema(), { wrapper });
    // Assert: estado + efectos en el DOM y en localStorage
    await waitFor(() => expect(result.current.temaActivo?.clave).toBe("halloween"));
    expect(raiz().getAttribute("data-tema-temporada")).toBe("halloween");
    const estilos = document.getElementById("tema-temporada-runtime")?.textContent ?? "";
    expect(estilos).toContain("--primary: #4a1a6b;");
    expect(estilos).toContain("--primary-rgb: 74, 26, 107;");
    expect(JSON.parse(localStorage.getItem("alik:tema-activo") ?? "{}").clave).toBe("halloween");
  });

  it("el favicon es siempre el logo, también en Halloween", async () => {
    responderTema(halloween);
    const { result } = renderHook(() => useTema(), { wrapper });
    await waitFor(() => expect(result.current.temaActivo?.clave).toBe("halloween"));
    expect(document.getElementById("favicon-png")?.getAttribute("href")).toBe("/favicon.png");
    expect(document.getElementById("favicon-svg")?.getAttribute("href")).toBe("/icon-192.png");

    responderTema(base);
    await act(() => result.current.refrescarTemaActivo());

    expect(document.getElementById("favicon-png")?.getAttribute("href")).toBe("/favicon.png");
  });

  it("el tema predeterminado quita los estilos de temporada", async () => {
    responderTema(halloween);
    const { result } = renderHook(() => useTema(), { wrapper });
    await waitFor(() => expect(result.current.temaActivo?.clave).toBe("halloween"));

    responderTema(base);
    await act(() => result.current.refrescarTemaActivo());

    expect(raiz().hasAttribute("data-tema-temporada")).toBe(false);
    expect(document.getElementById("tema-temporada-runtime")).toBeNull();
  });

  it("arranca con el tema guardado en la visita anterior, antes de que responda el API", () => {
    localStorage.setItem("alik:tema-activo", JSON.stringify(halloween));
    // El API tarda: nunca responde durante este test
    server.use(http.get(`${API}/api/temas/activo`, () => new Promise(() => {})));

    const { result } = renderHook(() => useTema(), { wrapper });

    expect(result.current.temaActivo?.clave).toBe("halloween");
    expect(raiz().getAttribute("data-tema-temporada")).toBe("halloween");
  });

  it("si el API falla, se queda con lo que tenía (sin romper la página)", async () => {
    localStorage.setItem("alik:tema-activo", "{json roto");
    server.use(http.get(`${API}/api/temas/activo`, () => HttpResponse.json({ detail: "x" }, { status: 500 })));

    const { result } = renderHook(() => useTema(), { wrapper });

    await act(() => result.current.refrescarTemaActivo());
    expect(result.current.temaActivo).toBeNull();
  });

  it("sincronizarThemeColorMeta no hace nada si la página no tiene la etiqueta", () => {
    document.head.innerHTML = "";

    expect(() => sincronizarThemeColorMeta()).not.toThrow();
  });

  it("useTema fuera del proveedor avisa con un error claro", () => {
    expect(() => renderHook(() => useTema())).toThrow("useTema debe usarse dentro de <TemaProvider>");
  });
});
