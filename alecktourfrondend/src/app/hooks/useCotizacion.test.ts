// Hook: pide al backend el desglose de precio de una reserva (cotizador).
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API } from "../../test/msw/handlers";
import { server } from "../../test/msw/server";
import type { SeleccionProducto } from "../data/reservaTypes";
import { useCotizacion } from "./useCotizacion";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const SEL: SeleccionProducto = { tipo_producto: "paquete", id_paquete: 1, fecha_inicio: "2030-01-10", adultos: 2 };

const COTIZACION = {
  tipo_producto: "paquete",
  fecha_inicio: "2030-01-10",
  fecha_fin: "2030-01-13",
  noches: 3,
  adultos: 2,
  ninos: 0,
  infantes: 0,
  conceptos: [
    { tipo: "paquete", descripcion: "Paquete X · adulto", cantidad: 2, precio_unitario: 1000, subtotal: 2000, incluido: false },
    { tipo: "alojamiento_incluido", descripcion: "Alojamiento incluido", cantidad: 3, precio_unitario: 0, subtotal: 0, incluido: true },
  ],
  total: 2000,
  estado_vuelo: "no_aplica",
  advertencias: [],
};

describe("useCotizacion", () => {
  it("sin selección no consulta y no muestra nada", () => {
    const { result } = renderHook(() => useCotizacion(null, 0));

    expect(result.current).toEqual({ cotizacion: null, cargando: false, error: null });
  });

  it("trae el desglose calculado por el backend", async () => {
    let cuerpo: unknown = null;
    server.use(
      http.post(`${API}/api/reservas/cotizar`, async ({ request }) => {
        cuerpo = await request.json();
        return HttpResponse.json(COTIZACION);
      }),
    );

    const { result } = renderHook(() => useCotizacion(SEL, 0));

    await waitFor(() => expect(result.current.cotizacion?.total).toBe(2000));
    expect(result.current.error).toBeNull();
    expect(cuerpo).toMatchObject({ tipo_producto: "paquete", id_paquete: 1, adultos: 2 });
  });

  it("si la selección no es válida muestra el mensaje del backend", async () => {
    server.use(
      http.post(`${API}/api/reservas/cotizar`, () =>
        HttpResponse.json({ detail: "Este paquete no incluye vuelo ni lo ofrece como opción" }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useCotizacion(SEL, 0));

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.cotizacion).toBeNull();
    expect(result.current.error).toContain("no incluye vuelo");
  });
});
