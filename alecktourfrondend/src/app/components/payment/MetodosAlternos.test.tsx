// Componentes: PSE, Nequi, PayPal y el estado del pago en el checkout.
// Autor (semana 4, cierre: completar el frontend al 50%): Fernando Gutiérrez.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import NequiPayment from "./NequiPayment";
import PaymentStatus from "./PaymentStatus";
import PayPalPayment from "./PayPalPayment";
import PSEPayment from "./PSEPayment";
import { emptyNequiValue, emptyPSEValue } from "./types";

function PSE() {
  const [valor, setValor] = useState(emptyPSEValue);
  return <PSEPayment value={valor} onChange={setValor} />;
}

function Nequi() {
  const [valor, setValor] = useState(emptyNequiValue);
  return <NequiPayment value={valor} onChange={setValor} />;
}

describe("PSEPayment", () => {
  it("deja elegir el banco y solo acepta dígitos en el documento", async () => {
    const user = userEvent.setup();
    render(<PSE />);

    await user.selectOptions(screen.getByLabelText("Selecciona tu banco"), "Davivienda");
    await user.type(screen.getByLabelText("Número de documento"), "10.203-040a50");

    expect(screen.getByLabelText("Selecciona tu banco")).toHaveValue("Davivienda");
    expect(screen.getByLabelText("Número de documento")).toHaveValue("1020304050");
  });

  it("arranca sin banco elegido", () => {
    render(<PSE />);

    expect(screen.getByLabelText("Selecciona tu banco")).toHaveValue("");
    expect(screen.getByRole("option", { name: "Elige un banco…" })).toBeInTheDocument();
  });
});

describe("NequiPayment", () => {
  it("muestra el Nequi de la agencia y lo copia al portapapeles", async () => {
    // userEvent.setup() reemplaza el portapapeles por uno de prueba
    const user = userEvent.setup();
    render(<Nequi />);

    expect(screen.getByText("322 817 4200")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar" }));

    expect(await navigator.clipboard.readText()).toBe("3228174200");
    expect(screen.getByRole("button", { name: "Copiado" })).toBeInTheDocument();
  });

  it("el celular acepta solo 10 dígitos", async () => {
    const user = userEvent.setup();
    render(<Nequi />);

    await user.type(screen.getByLabelText(/Tu número de celular Nequi/), "300-123-4567-99");

    expect(screen.getByLabelText(/Tu número de celular Nequi/)).toHaveValue("3001234567");
  });
});

describe("PayPalPayment", () => {
  it("anuncia el monto en pesos colombianos", () => {
    render(<PayPalPayment amount={1250000} />);

    expect(screen.getByText(/autorizar \$1\.250\.000/)).toBeInTheDocument();
  });
});

describe("PaymentStatus", () => {
  it("un pago aprobado aclara que es de prueba y no hubo cobro real", () => {
    render(<PaymentStatus state="approved" amount={500000} />);
    expect(screen.getByText(/no se realizó ningún cobro real/)).toBeInTheDocument();
  });


  it.each([
    ["processing", "Procesando tu pago…"],
    ["approved", "Pago aprobado"],
    ["rejected", "Pago rechazado"],
    ["pendiente_verificacion", "Pago pendiente de verificación"],
  ] as const)("en estado %s muestra «%s»", (estado, texto) => {
    render(<PaymentStatus state={estado} amount={500000} />);

    expect(screen.getByText(texto)).toBeInTheDocument();
  });

  it("un pago rechazado ofrece reintentar y avisa al hacer clic", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<PaymentStatus state="rejected" amount={500000} onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("sin onRetry no muestra el botón de reintentar", () => {
    render(<PaymentStatus state="rejected" amount={500000} />);

    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });
});
