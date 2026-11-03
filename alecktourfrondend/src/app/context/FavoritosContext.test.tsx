// Contexto: hoteles favoritos del cliente (corazón de las tarjetas de hotel).
// Autor (semana 6, capa Front): Fernando Gutiérrez.
//
// El backend es MSW con los handlers que en la semana 6 se compararon con
// el API real (src/test/msw/handlers.ts). Los avisos (toast) se reemplazan
// por un spy: lo que importa es QUÉ se le dice a la persona.
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API } from "../../test/msw/handlers";
import { server } from "../../test/msw/server";
import { prepararSesion } from "../../test/renderWithProviders";
import { AuthProvider } from "./AuthContext";
import { FavoritosProvider, useFavoritos } from "./FavoritosContext";

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>
    <FavoritosProvider>{children}</FavoritosProvider>
  </AuthProvider>
);

describe("FavoritosContext", () => {
  it("con sesión carga los favoritos guardados en el servidor", async () => {
    prepararSesion({ id_cliente: 1 });

    const { result } = renderHook(() => useFavoritos(), { wrapper });

    await waitFor(() => expect(result.current.isFavorito(3)).toBe(true));
    expect(result.current.isFavorito(4)).toBe(false);
  });

  it("sin sesión no pide nada al servidor y avisa que hay que iniciar sesión", async () => {
    // Arrange: cualquier petición haría fallar el test (onUnhandledRequest)
    const pedido = vi.fn();
    server.use(
      http.post(`${API}/api/favoritos`, () => {
        pedido();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const { result } = renderHook(() => useFavoritos(), { wrapper });
    // Act
    await act(() => result.current.toggleFavorito(3));
    // Assert
    expect(pedido).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("Inicia sesión para guardar hoteles en tus favoritos");
  });

  it("agregar un hotel lo marca como favorito y lo confirma", async () => {
    prepararSesion({ id_cliente: 1 });
    const { result } = renderHook(() => useFavoritos(), { wrapper });
    await waitFor(() => expect(result.current.isFavorito(3)).toBe(true));

    await act(() => result.current.toggleFavorito(8));

    expect(result.current.isFavorito(8)).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Guardado en tus favoritos");
    expect(result.current.loadingIds.size).toBe(0);
  });

  it("tocar de nuevo un favorito lo quita (DELETE 204 real)", async () => {
    prepararSesion({ id_cliente: 1 });
    const { result } = renderHook(() => useFavoritos(), { wrapper });
    await waitFor(() => expect(result.current.isFavorito(3)).toBe(true));

    await act(() => result.current.toggleFavorito(3));

    expect(result.current.isFavorito(3)).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("Eliminado de tus favoritos");
  });

  it("si el servidor rechaza el cambio (404 real), no lo marca y lo avisa", async () => {
    prepararSesion({ id_cliente: 1 });
    const { result } = renderHook(() => useFavoritos(), { wrapper });
    await waitFor(() => expect(result.current.isFavorito(3)).toBe(true));

    await act(() => result.current.toggleFavorito(999999)); // hotel inexistente

    expect(result.current.isFavorito(999999)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("No se pudo actualizar tus favoritos. Intenta de nuevo.");
    expect(result.current.loadingIds.has(999999)).toBe(false);
  });

  it("si no se pueden cargar los favoritos, la app sigue funcionando sin ellos", async () => {
    server.use(http.get(`${API}/api/favoritos/ids`, () => HttpResponse.json({ detail: "Error interno" }, { status: 500 })));
    prepararSesion({ id_cliente: 1 });

    const { result } = renderHook(() => useFavoritos(), { wrapper });

    await waitFor(() => expect(result.current.idsFavoritos.size).toBe(0));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("useFavoritos fuera del proveedor avisa con un error claro", () => {
    expect(() => renderHook(() => useFavoritos())).toThrow("useFavoritos debe usarse dentro de FavoritosProvider");
  });
});
