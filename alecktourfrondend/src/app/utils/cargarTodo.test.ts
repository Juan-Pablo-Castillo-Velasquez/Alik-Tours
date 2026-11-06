// Panel admin: cargar todas las páginas de un listado (antes solo la primera).
// Autor: Juan Pablo Castillo.
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API } from "../../test/msw/handlers";
import { server } from "../../test/msw/server";
import { cargarTodo } from "./cargarTodo";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("cargarTodo", () => {
  it("sigue pidiendo páginas hasta que una llega incompleta", async () => {
    const pedidas: string[] = [];
    const datos = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }));
    server.use(
      http.get(`${API}/api/clientes`, ({ request }) => {
        const url = new URL(request.url);
        pedidas.push(url.search);
        const skip = Number(url.searchParams.get("skip"));
        const limit = Number(url.searchParams.get("limit"));
        return HttpResponse.json(datos.slice(skip, skip + limit));
      }),
    );

    const todo = await cargarTodo<{ id: number }>("/clientes", 100);

    expect(todo).toHaveLength(250);
    expect(todo.at(-1)).toEqual({ id: 250 });
    expect(pedidas).toEqual(["?skip=0&limit=100", "?skip=100&limit=100", "?skip=200&limit=100"]);
  });

  it("respeta los parámetros que ya trae la ruta", async () => {
    const pedidas: string[] = [];
    server.use(
      http.get(`${API}/api/paquetes`, ({ request }) => {
        pedidas.push(new URL(request.url).search);
        return HttpResponse.json([]);
      }),
    );

    expect(await cargarTodo("/paquetes?incluir_inactivos=true", 50)).toEqual([]);
    expect(pedidas).toEqual(["?incluir_inactivos=true&skip=0&limit=50"]);
  });
});
