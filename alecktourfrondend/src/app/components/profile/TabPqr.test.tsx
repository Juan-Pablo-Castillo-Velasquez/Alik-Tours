import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PqrDetalle, PqrResumen } from "../../services/pqr.service";

const resumen: PqrResumen = {
  id_pqr: 7,
  radicado: "PQR-2026-000007",
  tipo: "reclamo",
  tipo_nombre: "Reclamo",
  canal: "web",
  asunto: "Cobro doble en mi reserva",
  estado: "en_tramite",
  prioridad: "alta",
  id_cliente: 3,
  cliente_nombre: "Carlos Lopez",
  id_reserva: null,
  id_responsable: 1,
  responsable_nombre: "Laura",
  dias_termino: 15,
  fecha_radicacion: "2026-11-24T15:00:00Z",
  fecha_vencimiento: "2026-12-16",
  prorrogada: false,
  dias_habiles_restantes: 12,
  estado_plazo: "a_tiempo",
  decision: null,
  fecha_respuesta: null,
  satisfaccion: null,
  categoria: null,
  categoria_nombre: null,
  motivo: null,
  es_ejemplo: false,
  ultima_actividad: "2026-11-24T15:00:00Z",
};

const detalle: PqrDetalle = {
  ...resumen,
  descripcion: "Me cobraron dos veces el anticipo.",
  pretension: "Que me devuelvan el cobro repetido.",
  reserva_titulo: null,
  fecha_vencimiento_original: null,
  motivo_prorroga: null,
  respuesta: null,
  comentario_satisfaccion: null,
  fecha_cierre: null,
  puede_prorrogar: false,
  puede_solicitar_informacion: false,
  actuaciones: [
    {
      id_actuacion: 1,
      tipo: "radicacion",
      texto: "Radicada por el cliente.",
      autor_nombre: "Carlos Lopez",
      autor_equipo: false,
      visible_cliente: true,
      fecha: "2026-11-24T15:00:00Z",
    },
    {
      id_actuacion: 2,
      tipo: "mensaje_equipo",
      texto: "Ya estamos revisando con pagos.",
      autor_nombre: "Laura",
      autor_equipo: true,
      visible_cliente: true,
      fecha: "2026-11-24T16:00:00Z",
    },
  ],
};

const servicio = vi.hoisted(() => ({
  mias: vi.fn(),
  ver: vi.fn(),
  radicar: vi.fn(),
  escribir: vi.fn(),
  desistir: vi.fn(),
  calificar: vi.fn(),
}));
vi.mock("../../services/pqr.service", () => ({ pqrService: servicio }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TabPqr from "./TabPqr";

const montar = () =>
  render(
    <MemoryRouter>
      <TabPqr reservas={[]} />
    </MemoryRouter>,
  );

describe("TabPqr (cliente)", () => {
  beforeEach(() => {
    Object.values(servicio).forEach((f) => f.mockReset());
  });

  it("muestra el estado vacío con la invitación a radicar", async () => {
    servicio.mias.mockResolvedValue([]);
    montar();
    expect(await screen.findByText("Aún no tienes solicitudes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /radicar una solicitud/i })).toBeInTheDocument();
  });

  it("lista las solicitudes con radicado, estado y plazo", async () => {
    servicio.mias.mockResolvedValue([resumen]);
    montar();
    expect(await screen.findByText("Cobro doble en mi reserva")).toBeInTheDocument();
    expect(screen.getByText("PQR-2026-000007")).toBeInTheDocument();
    expect(screen.getByText("En trámite")).toBeInTheDocument();
    expect(screen.getByText("12 días hábiles para responder")).toBeInTheDocument();
  });

  it("en un reclamo exige lo que espera el cliente y la autorización antes de radicar", async () => {
    servicio.mias.mockResolvedValue([]);
    servicio.radicar.mockResolvedValue(detalle);
    servicio.ver.mockResolvedValue(detalle);
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /nueva solicitud/i }));
    fireEvent.click(screen.getByRole("radio", { name: /reclamo/i }));
    fireEvent.change(screen.getByLabelText("Asunto"), { target: { value: "Cobro doble en mi reserva" } });
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Me cobraron dos veces el anticipo de la reserva." },
    });
    const enviar = screen.getByRole("button", { name: /radicar solicitud/i });
    expect(enviar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/qué esperas que hagamos/i), {
      target: { value: "Que me devuelvan el cobro repetido." },
    });
    expect(enviar).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(enviar).toBeEnabled();
    fireEvent.click(enviar);
    await waitFor(() =>
      expect(servicio.radicar).toHaveBeenCalledWith({
        tipo: "reclamo",
        asunto: "Cobro doble en mi reserva",
        descripcion: "Me cobraron dos veces el anticipo de la reserva.",
        pretension: "Que me devuelvan el cobro repetido.",
        id_reserva: null,
        autoriza_datos: true,
      }),
    );
    // Tras radicar abre el detalle con el historial.
    expect(await screen.findByText("Ya estamos revisando con pagos.")).toBeInTheDocument();
    expect(screen.getByText("Equipo Alik Tours")).toBeInTheDocument();
  });

  it("el cliente escribe en una solicitud abierta", async () => {
    servicio.mias.mockResolvedValue([resumen]);
    servicio.ver.mockResolvedValue(detalle);
    servicio.escribir.mockResolvedValue(detalle);
    montar();
    fireEvent.click(await screen.findByText("Cobro doble en mi reserva"));
    const caja = await screen.findByLabelText("Escribe un mensaje");
    fireEvent.change(caja, { target: { value: "Adjunto el número de la transacción: 4471" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => expect(servicio.escribir).toHaveBeenCalledWith(7, "Adjunto el número de la transacción: 4471"));
  });
});
