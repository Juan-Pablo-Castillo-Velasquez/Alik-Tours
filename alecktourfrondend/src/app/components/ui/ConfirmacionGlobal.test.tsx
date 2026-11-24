import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { confirmar } from "../../utils/confirmar";
import ConfirmacionGlobal from "./ConfirmacionGlobal";

describe("confirmar()", () => {
  it("muestra el diálogo del sitio y resuelve según el botón", async () => {
    render(<ConfirmacionGlobal />);
    const promesa = confirmar({ titulo: "¿Borrar la reseña?", confirmar: "Borrar", peligro: true });
    expect(await screen.findByRole("alertdialog", { name: "¿Borrar la reseña?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    await expect(promesa).resolves.toBe(true);
    const otra = confirmar({ titulo: "¿Seguro?" });
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await expect(otra).resolves.toBe(false);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
