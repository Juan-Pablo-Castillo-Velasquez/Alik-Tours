import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionComunidad } from "../../services/comunidad.service";
import PublicacionCard from "./PublicacionCard";

const base: PublicacionComunidad = {
  id_publicacion: 1,
  titulo: "Atardecer en la muralla",
  contenido: "Recomendadísimo el city tour.",
  calificacion: 5,
  destino: "Cartagena",
  video_url: null,
  imagenes: [],
  estado: "aprobada",
  motivo_moderacion: null,
  fecha_creacion: "2026-11-20T12:00:00",
  autor: { nombre: "Laura G.", foto: null, es_equipo: false },
  comentarios: [],
  total_comentarios: 0,
  es_mia: false,
} as PublicacionComunidad;

describe("PublicacionCard", () => {
  it("marca con la etiqueta Ejemplo el contenido de demostración", () => {
    render(<PublicacionCard publicacion={{ ...base, es_ejemplo: true }} puedeComentar={false} onPedirLogin={vi.fn()} />);
    expect(screen.getByText("Ejemplo")).toBeInTheDocument();
  });

  it("no marca las publicaciones reales", () => {
    render(<PublicacionCard publicacion={base} puedeComentar={false} onPedirLogin={vi.fn()} />);
    expect(screen.queryByText("Ejemplo")).not.toBeInTheDocument();
  });

  it("enlaza el paquete con el que viajó el autor para reservarlo", () => {
    render(
      <MemoryRouter>
        <PublicacionCard
          publicacion={{
            ...base,
            viaje: {
              tipo: "paquete",
              id: 7,
              nombre: "Magia del Caribe",
              destino: "Cartagena",
              imagen_url: null,
              precio_desde: 1200000,
              unidad_precio: "por_persona",
            },
          }}
          puedeComentar={false}
          onPedirLogin={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Magia del Caribe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Magia del Caribe/ })).toHaveAttribute("href", "/package/7");
    expect(screen.getByText(/por persona/)).toBeInTheDocument();
  });
});
