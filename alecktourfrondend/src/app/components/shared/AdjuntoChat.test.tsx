import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const obtener = vi.fn();
vi.mock("../../api/v1/api", () => ({
  obtenerArchivoProtegido: (...a: unknown[]) => obtener(...a),
  abrirArchivoProtegido: vi.fn(),
}));

import { EnlaceAdjunto, ImagenAdjunto, esAdjuntoProtegido } from "./AdjuntoChat";

beforeEach(() => {
  obtener.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:adjunto");
  URL.revokeObjectURL = vi.fn();
});

describe("Adjuntos del chat", () => {
  it("reconoce las rutas protegidas de la API", () => {
    expect(esAdjuntoProtegido("/mensajes/5/adjunto")).toBe(true);
    expect(esAdjuntoProtegido("https://res.cloudinary.com/x.png")).toBe(false);
    expect(esAdjuntoProtegido(null)).toBe(false);
  });

  it("una imagen protegida se pide con sesión y se muestra como blob", async () => {
    obtener.mockResolvedValue(new Blob(["x"], { type: "image/png" }));
    render(<ImagenAdjunto url="/mensajes/5/adjunto" />);
    expect(screen.getByLabelText("Cargando imagen")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByAltText("Captura enviada")).toHaveAttribute("src", "blob:adjunto"));
    expect(obtener).toHaveBeenCalledWith("/mensajes/5/adjunto");
  });

  it("si no hay acceso muestra un aviso en vez de una imagen rota", async () => {
    obtener.mockRejectedValue(new Error("No tienes acceso"));
    render(<ImagenAdjunto url="/mensajes/5/adjunto" />);
    expect(await screen.findByText("No se pudo cargar la imagen.")).toBeInTheDocument();
  });

  it("los adjuntos viejos con URL pública se usan directo", () => {
    render(<ImagenAdjunto url="https://res.cloudinary.com/demo/x.png" />);
    expect(screen.getByAltText("Captura enviada")).toHaveAttribute("src", "https://res.cloudinary.com/demo/x.png");
    expect(obtener).not.toHaveBeenCalled();
  });

  it("un PDF protegido se abre con un botón, no con un enlace directo", () => {
    render(
      <EnlaceAdjunto url="/mensajes/7/adjunto" nombre="voucher.pdf">
        voucher.pdf
      </EnlaceAdjunto>,
    );
    expect(screen.getByRole("button", { name: "voucher.pdf" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
