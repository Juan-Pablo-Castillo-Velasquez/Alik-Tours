// Unidad: hook de paginación de las tablas del panel de admin.
// Autor (semana 2, capa E2E, test unitario propio): Cristian Sinisterra.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePagination } from "./usePagination";

const veinte = Array.from({ length: 20 }, (_, i) => i + 1);

describe("usePagination", () => {
  it("por defecto muestra 8 elementos por página desde la primera", () => {
    // Act
    const { result } = renderHook(() => usePagination(veinte));
    // Assert
    expect(result.current.page).toBe(0);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.slice).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it.each([
    [16, 2], // justo dos páginas completas (límite)
    [17, 3], // uno más abre una tercera página
    [1, 1],
    [0, 1], // lista vacía: sigue habiendo UNA página (vacía), nunca 0
  ])("con %i elementos hay %i página(s)", (cantidad, paginas) => {
    const lista = Array.from({ length: cantidad }, (_, i) => i);

    const { result } = renderHook(() => usePagination(lista, 8));

    expect(result.current.pageCount).toBe(paginas);
  });

  it("la última página trae solo lo que sobra", () => {
    const { result } = renderHook(() => usePagination(veinte, 8));

    act(() => result.current.setPage(2));

    expect(result.current.slice).toEqual([17, 18, 19, 20]);
  });

  it("si la lista se achica (filtro) y la página queda fuera de rango, vuelve a la última que existe", () => {
    // Arrange: estoy en la página 3 de 3
    const { result, rerender } = renderHook(({ lista }) => usePagination(lista, 8), {
      initialProps: { lista: veinte },
    });
    act(() => result.current.setPage(2));

    // Act: el filtro deja solo 5 elementos (una página)
    rerender({ lista: veinte.slice(0, 5) });

    // Assert
    expect(result.current.page).toBe(0);
    expect(result.current.slice).toEqual([1, 2, 3, 4, 5]);
  });
});
