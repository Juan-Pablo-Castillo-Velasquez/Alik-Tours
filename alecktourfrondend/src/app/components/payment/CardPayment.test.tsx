// Componente: formulario de tarjeta del checkout (pago simulado).
// Autor (semana 3, capa Front): Fernando Gutiérrez.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import CardPayment from "./CardPayment";
import { type CardPaymentValue, emptyCardValue } from "./types";

// CardPayment es controlado (el valor vive en Checkout). Este arnés hace
// de Checkout para poder escribir como una persona.
function Arnes({ inicial = emptyCardValue, marca }: { inicial?: CardPaymentValue; marca?: string }) {
  const [valor, setValor] = useState(inicial);
  return <CardPayment value={valor} onChange={setValor} brand={marca} />;
}

describe("CardPayment", () => {
  it("sin datos muestra la tarjeta de ejemplo y el aviso de pago de prueba", () => {
    render(<Arnes marca="VISA" />);

    expect(screen.getByText("•••• •••• •••• ••••")).toBeInTheDocument();
    expect(screen.getByText("NOMBRE DEL TITULAR")).toBeInTheDocument();
    expect(screen.getByText("MM/YY")).toBeInTheDocument();
    expect(screen.getByText("VISA")).toBeInTheDocument();
    expect(screen.getByText(/no se procesa ni se guarda ningún cobro real/)).toBeInTheDocument();
  });

  it("agrupa el número en bloques de 4, ignora letras y lo refleja en la tarjeta", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Arnes />);
    const numero = screen.getByLabelText("Número de tarjeta");
    // Act: se PEGA el número (como lo copia la gente del banco). Escribirlo
    // tecla por tecla con user.type pierde dígitos: cada espacio que agrega
    // el formato mueve el cursor del campo controlado.
    await user.click(numero);
    await user.paste("4111abc111111111");
    // Assert
    expect(numero).toHaveValue("4111 1111 1111 1111");
    expect(screen.getByText("4111 1111 1111 1111")).toBeInTheDocument();
  });

  it("escribe el titular en mayúsculas", async () => {
    const user = userEvent.setup();
    render(<Arnes />);

    await user.type(screen.getByLabelText("Nombre del titular"), "ana pérez");

    expect(screen.getByLabelText("Nombre del titular")).toHaveValue("ANA PÉREZ");
    expect(screen.getByText("ANA PÉREZ")).toBeInTheDocument();
  });

  it("pone la barra del vencimiento sola y deja el CVV en máximo 4 dígitos", async () => {
    const user = userEvent.setup();
    render(<Arnes />);

    await user.type(screen.getByLabelText("Vencimiento"), "1228");
    await user.type(screen.getByLabelText("CVV"), "12a345");

    expect(screen.getByLabelText("Vencimiento")).toHaveValue("12/28");
    expect(screen.getByLabelText("CVV")).toHaveValue("1234");
  });

  it("el CVV no se muestra en pantalla (campo de contraseña)", () => {
    render(<Arnes />);

    expect(screen.getByLabelText("CVV")).toHaveAttribute("type", "password");
  });
});
