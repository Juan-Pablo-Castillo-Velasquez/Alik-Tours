// Componente: ficha completa de una habitación ("Ver detalles" en la página del hotel).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { HabitacionResponse } from "../../services/hotel.service";
import DetalleHabitacion from "./DetalleHabitacion";

const base: HabitacionResponse = {
  id_habitacion: 7,
  id_hotel: 1,
  id_tipo_habitacion: 2,
  numero_habitacion: "204",
  precio_noche: 350000,
  estado: "disponible",
  tipo_habitacion: { id_tipo_habitacion: 2, nombre_tipo: "Doble", descripcion: "Para dos", capacidad_personas: 2 },
};

const completa: HabitacionResponse = {
  ...base,
  descripcion: "Amplia y luminosa",
  tamano_m2: 28,
  tipo_cama: "1 king",
  vista: "al mar",
  tipo_bano: "Privado con ducha",
  piso: 4,
  servicios: ["wifi", "minibar"],
  comodidades: "Kit de playa",
  desayuno_incluido: true,
  permite_fumar: false,
  admite_mascotas: null,
  imagenes: [
    { id_imagen: 1, url: "https://x.test/1.jpg", orden: 1, descripcion: "Cama" },
    { id_imagen: 2, url: "https://x.test/2.jpg", orden: 2, descripcion: "Baño" },
  ],
};

describe("DetalleHabitacion", () => {
  it("muestra la ficha completa: esenciales, servicios y condiciones especificadas", () => {
    render(<DetalleHabitacion hab={completa} fotoReferencia="ref.jpg" onClose={vi.fn()} />);

    expect(screen.getByText("Hasta 2 personas")).toBeInTheDocument();
    expect(screen.getByText("28 m²")).toBeInTheDocument();
    expect(screen.getByText("Piso 4")).toBeInTheDocument();
    expect(screen.getByText("Wi-Fi gratis")).toBeInTheDocument();
    expect(screen.getByText("Kit de playa")).toBeInTheDocument();
    expect(screen.getByText("Desayuno incluido")).toBeInTheDocument();
    expect(screen.getByText("Habitación para no fumadores")).toBeInTheDocument();
    // "Sin definir" (null) no se muestra.
    expect(screen.queryByText(/mascotas/i)).not.toBeInTheDocument();
  });

  it("pasa las fotos con las flechas y muestra el pie de foto", async () => {
    render(<DetalleHabitacion hab={completa} fotoReferencia="ref.jpg" onClose={vi.fn()} />);

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Foto siguiente" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Baño" })).toBeInTheDocument();
  });

  it("sin fotos propias usa la de referencia y lo avisa", () => {
    render(<DetalleHabitacion hab={base} fotoReferencia="ref.jpg" onClose={vi.fn()} />);

    expect(screen.getByRole("img", { name: "Imagen de referencia" })).toHaveAttribute("src", "ref.jpg");
    expect(screen.getByText(/aún no tiene fotos propias/)).toBeInTheDocument();
  });

  it("no deja elegir una habitación que no está disponible", () => {
    render(<DetalleHabitacion hab={{ ...base, estado: "ocupada" }} fotoReferencia="ref.jpg" onClose={vi.fn()} onElegir={vi.fn()} />);

    expect(screen.getByRole("button", { name: "No disponible" })).toBeDisabled();
  });
});
