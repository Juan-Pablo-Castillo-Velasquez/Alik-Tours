// Componente: pago de una reserva ya creada (paquetes, anticipo, saldo).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import PagoDeReserva from "./PagoDeReserva";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const METODOS = [
  { id_metodo: 1, nombre_metodo: "Tarjeta", codigo: "tarjeta_credito" },
  { id_metodo: 2, nombre_metodo: "PayPal", codigo: "paypal" },
  { id_metodo: 3, nombre_metodo: "Nequi", codigo: "nequi" },
];

function backend({ guardados = [] as unknown[], estadoPago = "pagado", verificaPin = true } = {}) {
  const pagos: unknown[] = [];
  server.use(
    http.get(`${API}/api/metodos-pago`, () => HttpResponse.json(METODOS)),
    http.get(`${API}/api/metodos-pago-guardados`, () => HttpResponse.json(guardados)),
    http.post(`${API}/api/metodos-pago-guardados`, async ({ request }) => {
      const b = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id_metodo_guardado: 9, alias: b.alias, tipo: b.tipo, ultimos4: b.ultimos4 ?? null, predeterminado: false }, { status: 201 });
    }),
    http.post(`${API}/api/metodos-pago-guardados/:id/verificar`, () => HttpResponse.json({ valido: verificaPin })),
    http.post(`${API}/api/reservas/7/pagar`, async ({ request }) => {
      const b = await request.json();
      pagos.push(b);
      return HttpResponse.json({
        pago: { id_pago: 1, id_reserva: 7, id_metodo_pago: 2, monto: 500000, fecha_pago: "2030-01-01", referencia: "PAY-1", estado: estadoPago, metodo_pago: METODOS[1] },
        reserva: { id_reserva: 7 },
      });
    }),
  );
  return pagos;
}

describe("PagoDeReserva", () => {
  it("si ya está pagada no ofrece pagar otra vez", () => {
    backend();
    render(<PagoDeReserva idReserva={7} total={1000} totalPagado={1000} />);

    expect(screen.getByText(/ya está pagada en su totalidad/)).toBeInTheDocument();
  });

  it("solo ofrece Nequi y PayPal y avisa que los pagos son simulados", async () => {
    backend();
    render(<PagoDeReserva idReserva={7} total={1000000} totalPagado={0} />);

    expect(await screen.findByRole("radio", { name: /PayPal/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Nequi/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Tarjeta/ })).not.toBeInTheDocument();
    expect(screen.getByText(/modo de prueba/)).toBeInTheDocument();
  });

  it("paga el anticipo del 50% con PayPal creando el PIN la primera vez", async () => {
    const pagos = backend();
    const onPagado = vi.fn();
    render(<PagoDeReserva idReserva={7} total={1000000} totalPagado={0} onPagado={onPagado} />);
    await userEvent.click(await screen.findByRole("radio", { name: /PayPal/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Anticipo del 50%/ }));

    const pins = document.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]');
    await userEvent.type(pins[0], "1234");
    await userEvent.type(pins[1], "1234");
    await userEvent.click(screen.getByRole("button", { name: /Pagar \$500\.000/ }));

    await waitFor(() => expect(screen.getByText("Pago aprobado")).toBeInTheDocument());
    expect(pagos[0]).toMatchObject({ id_metodo_pago: 2, tipo_pago: "parcial" });
    expect(onPagado).toHaveBeenCalled();
  });

  it("con saldo pendiente paga el saldo usando el método guardado", async () => {
    const pagos = backend({ guardados: [{ id_metodo_guardado: 4, alias: "PayPal", tipo: "paypal", ultimos4: null, predeterminado: true }] });
    render(<PagoDeReserva idReserva={7} total={1000000} totalPagado={500000} />);

    expect(await screen.findByText(/Falta el saldo/)).toBeInTheDocument();
    await screen.findByText(/Usaremos tu PayPal guardado/);
    const pin = document.querySelector<HTMLInputElement>('input[inputmode="numeric"]')!;
    await userEvent.type(pin, "1234");
    await userEvent.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(pagos[0]).toMatchObject({ tipo_pago: "saldo", id_metodo_guardado: 4 }));
  });

  it("si el PIN no coincide con el guardado no cobra", async () => {
    const pagos = backend({ guardados: [{ id_metodo_guardado: 4, alias: "PayPal", tipo: "paypal", ultimos4: null, predeterminado: true }], verificaPin: false });
    render(<PagoDeReserva idReserva={7} total={1000000} totalPagado={0} />);
    await screen.findByText(/Usaremos tu PayPal guardado/);
    await userEvent.type(document.querySelector<HTMLInputElement>('input[inputmode="numeric"]')!, "9999");
    await userEvent.click(screen.getByRole("button", { name: /Pagar/ }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Pagar/ })).toBeEnabled());
    expect(pagos).toHaveLength(0);
  });

  it("un pago rechazado deja reintentar", async () => {
    backend({ estadoPago: "rechazado" });
    render(<PagoDeReserva idReserva={7} total={1000000} totalPagado={0} />);
    await userEvent.click(await screen.findByRole("radio", { name: /PayPal/ }));
    const pins = document.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]');
    await userEvent.type(pins[0], "1234");
    await userEvent.type(pins[1], "1234");
    await userEvent.click(screen.getByRole("button", { name: /Pagar/ }));

    expect(await screen.findByText("Pago rechazado")).toBeInTheDocument();
  });
});
