// Hook: fotos de Cloudinary de la temporada activa (acentos de Halloween, etc.).
// Autor (semana 7, cierre: completar el frontend al 75%): Fernando Gutiérrez.
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API } from "../../test/msw/handlers";
import { server } from "../../test/msw/server";
import { useTemaGaleria } from "./useTemaGaleria";

const tema = vi.hoisted(() => ({ activo: null as null | { clave: string; es_predeterminado: boolean } }));
vi.mock("../context/TemaContext", () => ({ useTema: () => ({ temaActivo: tema.activo }) }));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useTemaGaleria", () => {
  it("con el tema por defecto no pide nada y no hay fotos", () => {
    tema.activo = { clave: "alik", es_predeterminado: true };

    const { result } = renderHook(() => useTemaGaleria());

    expect(result.current).toEqual({ imagenes: [], cargando: false });
  });

  it("con una temporada activa trae sus fotos", async () => {
    tema.activo = { clave: "halloween", es_predeterminado: false };
    server.use(
      http.get(`${API}/api/temas/halloween/galeria`, () => HttpResponse.json(["https://res.cloudinary.com/x/1.jpg"])),
    );

    const { result } = renderHook(() => useTemaGaleria());

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.imagenes).toEqual(["https://res.cloudinary.com/x/1.jpg"]);
  });

  it("si la galería falla, sigue sin fotos y sin romper nada", async () => {
    tema.activo = { clave: "halloween", es_predeterminado: false };
    server.use(http.get(`${API}/api/temas/halloween/galeria`, () => HttpResponse.json({ detail: "x" }, { status: 500 })));

    const { result } = renderHook(() => useTemaGaleria());

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.imagenes).toEqual([]);
  });
});
