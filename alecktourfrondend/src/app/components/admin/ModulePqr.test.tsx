import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PqrDetalle, PqrPagina } from "../../services/pqr.service";

const fila = {
  id_pqr: 9,
  radicado: "PQR-2026-000009",
  tipo: "reclamo" as const,
  tipo_nombre: "Reclamo",
  canal: "web",
  asunto: "No me reembolsaron la noche",
  estado: "en_tramite" as const,
  prioridad: "alta" as const,
  id_cliente: 3,
  cliente_nombre: "Carlos Lopez",
  id_reserva: null,
  id_responsable: null,
  responsable_nombre: null,
  dias_termino: 15,
  fecha_radicacion: "2026-11-24T15:00:00Z",
  fecha_vencimiento: "2026-11-26",
  prorrogada: false,
  dias_habiles_restantes: 2,
  estado_plazo: "por_vencer" as const,
  decision: null,
  fecha_respuesta: null,
  satisfaccion: null,
  ultima_actividad: null,
};

const pagina: PqrPagina = {
  items: [fila],
  total: 1,
  page: 1,
  page_size: 10,
  resumen: { abiertas: 1, sin_asignar: 1, por_vencer: 1, vencidas: 0, respondidas: 4, a_tiempo_pct: 75, satisfaccion_promedio: 4.5 },
};

const detalle: PqrDetalle = {
  ...fila,
  descripcion: "Salí un día antes y no me devolvieron la noche.",
  pretension: "Reembolso de una noche.",
  reserva_titulo: null,
  fecha_vencimiento_original: null,
  motivo_prorroga: null,
  respuesta: null,
  comentario_satisfaccion: null,
  fecha_cierre: null,
  puede_prorrogar: true,
  puede_solicitar_informacion: true,
  actuaciones: [],
};

const servicio = vi.hoisted(() => ({
  gestion: vi.fn(),
  responsables: vi.fn(),
  ver: vi.fn(),
  responder: vi.fn(),
  escribir: vi.fn(),
  actualizar: vi.fn(),
  prorrogar: vi.fn(),
  solicitarInformacion: vi.fn(),
  cerrar: vi.fn(),
  radicar: vi.fn(),
}));
vi.mock("../../services/pqr.service", () => ({ pqrService: servicio }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ModulePqr from "./ModulePqr";

describe("ModulePqr (equipo)", () => {
  beforeEach(() => {
    Object.values(servicio).forEach((f) => f.mockReset());
    servicio.gestion.mockResolvedValue(pagina);
    servicio.responsables.mockResolvedValue([{ id_usuario: 1, nombre: "Laura" }]);
    servicio.ver.mockResolvedValue(detalle);
  });

  it("muestra los indicadores y la bandeja con su plazo", async () => {
    render(<ModulePqr />);
    expect(await screen.findByText("No me reembolsaron la noche")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Vence en 2 días hábiles")).toBeInTheDocument();
    expect(screen.getByText("Sin asignar")).toBeInTheDocument();
  });

  it("filtra por vencidas desde el indicador", async () => {
    render(<ModulePqr />);
    await screen.findByText("No me reembolsaron la noche");
    fireEvent.click(screen.getByText("Vencidas sin responder"));
    await waitFor(() => expect(servicio.gestion).toHaveBeenLastCalledWith(expect.objectContaining({ plazo: "vencidas", page: 1 })));
  });

  it("en un reclamo la respuesta negativa exige motivos y no ofrece la opción informativa", async () => {
    servicio.responder.mockResolvedValue({ ...detalle, estado: "respondida" });
    render(<ModulePqr />);
    fireEvent.click(await screen.findByText("No me reembolsaron la noche"));
    fireEvent.click(await screen.findByRole("tab", { name: /respuesta de fondo/i }));
    const decision = screen.getByLabelText(/decisión/i) as HTMLSelectElement;
    expect([...decision.options].map((o) => o.value)).toEqual(["favorable", "parcial", "desfavorable"]);
    fireEvent.change(decision, { target: { value: "desfavorable" } });
    const texto = screen.getByLabelText("Texto");
    fireEvent.change(texto, { target: { value: "No procede el reembolso, lo sentimos." } });
    const enviar = screen.getByRole("button", { name: /enviar respuesta/i });
    expect(enviar).toBeDisabled();
    const motivo =
      "No procede el reembolso: el hotel registró tu salida el día pactado y la política aceptada no contempla devolución.";
    fireEvent.change(texto, { target: { value: motivo } });
    expect(enviar).toBeEnabled();
    fireEvent.click(enviar);
    await waitFor(() => expect(servicio.responder).toHaveBeenCalledWith(9, "desfavorable", motivo));
  });
});
