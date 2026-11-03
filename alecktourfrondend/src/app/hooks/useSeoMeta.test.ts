// Unidad: metadatos SEO por página (título, descripción, URL canónica).
// Autor (semana 2, capa E2E, test unitario propio): Cristian Sinisterra.
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSeoMeta } from "./useSeoMeta";

const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute("content");

describe("useSeoMeta", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
  });

  it("pone el título con el nombre de la agencia en la pestaña y en las redes", () => {
    renderHook(() => useSeoMeta({ title: "Paquetes de viaje" }));

    expect(document.title).toBe("Paquetes de viaje | Alik Tours");
    expect(meta('meta[property="og:title"]')).toBe("Paquetes de viaje | Alik Tours");
    expect(meta('meta[name="twitter:title"]')).toBe("Paquetes de viaje | Alik Tours");
  });

  it("sin título usa solo el nombre de la agencia", () => {
    renderHook(() => useSeoMeta({ title: "" }));

    expect(document.title).toBe("Alik Tours");
  });

  it("con ruta arma la URL canónica del sitio real", () => {
    renderHook(() => useSeoMeta({ title: "Hotel", path: "/hotel/12" }));

    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://alik-tours.vercel.app/hotel/12",
    );
    expect(meta('meta[property="og:url"]')).toBe("https://alik-tours.vercel.app/hotel/12");
  });

  it("reutiliza las etiquetas existentes al cambiar de página (no las duplica)", () => {
    const { rerender } = renderHook(({ titulo }) => useSeoMeta({ title: titulo, description: "Viajes" }), {
      initialProps: { titulo: "Inicio" },
    });

    rerender({ titulo: "Contacto" });

    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.title).toBe("Contacto | Alik Tours");
  });

  it("sin descripción ni ruta no inventa esas etiquetas", () => {
    renderHook(() => useSeoMeta({ title: "FAQ" }));

    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
