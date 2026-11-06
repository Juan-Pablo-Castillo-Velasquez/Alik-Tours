// Orden por columna de las tablas del panel.
// Autor: Juan Pablo Castillo.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useOrden } from "./useOrden";

type Fila = { id: number; nombre: string; monto: number | null };
const filas: Fila[] = [
  { id: 1, nombre: "Ñandú", monto: 50 },
  { id: 2, nombre: "ana", monto: null },
  { id: 3, nombre: "Bruno", monto: 200 },
];
const obtener = (f: Fila, campo: "id" | "nombre" | "monto") => f[campo];

describe("useOrden", () => {
  it("ordena por el campo inicial de mayor a menor", () => {
    const { result } = renderHook(() => useOrden(filas, obtener, { campo: "id", dir: "desc" }));
    expect(result.current.ordenadas.map((f) => f.id)).toEqual([3, 2, 1]);
  });

  it("un clic en otra columna ordena por ella y el segundo clic invierte", () => {
    const { result } = renderHook(() => useOrden(filas, obtener, { campo: "id", dir: "desc" }));

    act(() => result.current.ordenarPor("nombre"));
    expect(result.current.ordenadas.map((f) => f.nombre)).toEqual(["Ñandú", "Bruno", "ana"]);

    act(() => result.current.ordenarPor("nombre"));
    expect(result.current.ordenadas.map((f) => f.nombre)).toEqual(["ana", "Bruno", "Ñandú"]);
  });

  it("los vacíos quedan al final en cualquier dirección", () => {
    const { result } = renderHook(() => useOrden(filas, obtener, { campo: "monto", dir: "desc" }));
    expect(result.current.ordenadas.map((f) => f.monto)).toEqual([200, 50, null]);

    act(() => result.current.ordenarPor("monto"));
    expect(result.current.ordenadas.map((f) => f.monto)).toEqual([50, 200, null]);
  });
});
