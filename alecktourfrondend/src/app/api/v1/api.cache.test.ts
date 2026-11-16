// Unidad: caché de lecturas públicas de apiFetch (catálogo).
//
// MSW cuenta cuántas peticiones llegan de verdad al "servidor": así se
// comprueba que el catálogo se pide una sola vez y que una escritura o un
// parámetro de panel lo saltan.
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import { API_CACHE_TTL_MS, apiFetch, esLecturaCacheable, limpiarCacheApi } from "./api";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

function contarHoteles() {
  const contador = { llamadas: 0 };
  server.use(
    http.get(`${API}/api/hoteles/`, () => {
      contador.llamadas += 1;
      return HttpResponse.json([{ id_hotel: contador.llamadas }]);
    }),
  );
  return contador;
}

describe("esLecturaCacheable", () => {
  it.each([
    ["/hoteles/?limit=12", true],
    ["/hoteles/5", true],
    ["/hoteles/caracteristicas", true],
    ["/paquetes?skip=0&limit=10", true],
    ["/paquetes/3/detalle", true],
    ["/vuelos?origen=Bogotá", true],
    ["/resenas/destacadas", true],
    ["/hoteles/?limit=300&todos=true", false],
    ["/paquetes?incluir_inactivos=true", false],
    ["/hoteles/5/fechas-ocupadas", false],
    ["/reservas/mias", false],
    ["/vuelos/admin", false],
  ])("%s -> %s", (ruta, esperado) => {
    expect(esLecturaCacheable(ruta)).toBe(esperado);
  });

  it("solo los GET", () => {
    expect(esLecturaCacheable("/hoteles/", "POST")).toBe(false);
  });
});

describe("apiFetch con caché", () => {
  it("la segunda lectura del catálogo no vuelve a la red", async () => {
    const contador = contarHoteles();
    const a = await apiFetch<{ id_hotel: number }[]>("/hoteles/");
    const b = await apiFetch<{ id_hotel: number }[]>("/hoteles/");
    expect(contador.llamadas).toBe(1);
    expect(b).toEqual(a);
  });

  it("devuelve copias: modificar el resultado no ensucia el caché", async () => {
    contarHoteles();
    const a = await apiFetch<{ id_hotel: number }[]>("/hoteles/");
    a[0].id_hotel = 999;
    const b = await apiFetch<{ id_hotel: number }[]>("/hoteles/");
    expect(b[0].id_hotel).toBe(1);
  });

  it("dos lecturas simultáneas comparten una sola petición", async () => {
    const contador = contarHoteles();
    await Promise.all([apiFetch("/hoteles/"), apiFetch("/hoteles/"), apiFetch("/api/hoteles/")]);
    expect(contador.llamadas).toBe(1);
  });

  it("vence a los 60 s", async () => {
    const contador = contarHoteles();
    const ahora = Date.now();
    const reloj = vi.spyOn(Date, "now").mockReturnValue(ahora);
    await apiFetch("/hoteles/");
    reloj.mockReturnValue(ahora + API_CACHE_TTL_MS + 1);
    await apiFetch("/hoteles/");
    expect(contador.llamadas).toBe(2);
    reloj.mockRestore();
  });

  it("una escritura vacía el caché", async () => {
    const contador = contarHoteles();
    server.use(http.post(`${API}/api/contacto`, () => HttpResponse.json({ ok: true })));
    await apiFetch("/hoteles/");
    await apiFetch("/contacto", { method: "POST", body: { a: 1 } });
    await apiFetch("/hoteles/");
    expect(contador.llamadas).toBe(2);
  });

  it("con otra sesión (token) no reutiliza lo de la anterior", async () => {
    const contador = contarHoteles();
    await apiFetch("/hoteles/");
    localStorage.setItem("token", "tok-asesor");
    await apiFetch("/hoteles/");
    expect(contador.llamadas).toBe(2);
  });

  it("un error no queda guardado", async () => {
    let llamadas = 0;
    server.use(
      http.get(`${API}/api/vuelos`, () => {
        llamadas += 1;
        return llamadas === 1 ? HttpResponse.json({ detail: "caído" }, { status: 500 }) : HttpResponse.json([]);
      }),
    );
    await expect(apiFetch("/vuelos")).rejects.toThrow("caído");
    await expect(apiFetch("/vuelos")).resolves.toEqual([]);
    expect(llamadas).toBe(2);
  });

  it("limpiarCacheApi obliga a pedir de nuevo", async () => {
    const contador = contarHoteles();
    await apiFetch("/hoteles/");
    limpiarCacheApi();
    await apiFetch("/hoteles/");
    expect(contador.llamadas).toBe(2);
  });
});
