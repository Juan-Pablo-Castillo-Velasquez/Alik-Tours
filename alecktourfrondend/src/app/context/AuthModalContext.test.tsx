// Contexto: qué modal de cuenta está abierto (login o registro).
// Autor (semana 7, cierre: completar el frontend al 75%): Fernando Gutiérrez.
//
// Los modales reales traen animaciones, llamadas al API y navegación; aquí
// se reemplazan por STUBS mínimos que muestran si están abiertos y ofrecen
// sus mismos callbacks. Lo que se prueba es la coordinación del contexto.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthModalProvider, useAuthModal } from "./AuthModalContext";

vi.mock("../components/LoginModal", () => ({
  default: ({ isOpen, onClose, onSwitchToRegister }: { isOpen: boolean; onClose: () => void; onSwitchToRegister: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Login">
        <button onClick={onSwitchToRegister}>Ir a registro</button>
        <button onClick={onClose}>Cerrar login</button>
      </div>
    ) : null,
}));
vi.mock("../components/RegisterModal", () => ({
  default: ({ isOpen, onClose, onSwitchToLogin }: { isOpen: boolean; onClose: () => void; onSwitchToLogin: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Registro">
        <button onClick={onSwitchToLogin}>Ir a login</button>
        <button onClick={onClose}>Cerrar registro</button>
      </div>
    ) : null,
}));

function Botones() {
  const { openLogin, openRegister, closeModals } = useAuthModal();
  return (
    <>
      <button onClick={openLogin}>Abrir login</button>
      <button onClick={openRegister}>Abrir registro</button>
      <button onClick={closeModals}>Cerrar todo</button>
    </>
  );
}

const montar = () =>
  render(
    <AuthModalProvider>
      <Botones />
    </AuthModalProvider>,
  );

describe("AuthModalContext", () => {
  it("arranca sin ningún modal abierto", () => {
    montar();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre el login y, desde ahí, pasar a registro cierra el login", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: "Abrir login" }));
    expect(screen.getByRole("dialog", { name: "Login" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ir a registro" }));
    expect(screen.getByRole("dialog", { name: "Registro" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Login" })).not.toBeInTheDocument();
  });

  it("nunca hay dos modales abiertos a la vez", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: "Abrir registro" }));
    await user.click(screen.getByRole("button", { name: "Abrir login" }));

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Login" })).toBeInTheDocument();
  });

  it("cada modal se cierra solo y closeModals cierra cualquiera", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: "Abrir registro" }));
    await user.click(screen.getByRole("button", { name: "Cerrar registro" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir registro" }));
    await user.click(screen.getByRole("button", { name: "Ir a login" }));
    await user.click(screen.getByRole("button", { name: "Cerrar login" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir login" }));
    await user.click(screen.getByRole("button", { name: "Cerrar todo" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("useAuthModal fuera del proveedor avisa con un error claro", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Botones />)).toThrow("useAuthModal debe usarse dentro de AuthModalProvider");
  });
});
