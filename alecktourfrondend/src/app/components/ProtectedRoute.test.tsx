// Componente: ProtectedRoute (quién puede ver /profile, /admin, /preferences...).
// Autor (semana 3, capa Front): Juan Pablo Castillo.
//
// La sesión es la real (AuthProvider leyendo localStorage, vía
// renderWithProviders). Solo se reemplaza useAuthModal: el modal de login
// de verdad trae animaciones y llamadas al API que no son lo que se prueba
// aquí; basta con saber que se pidió abrirlo.
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import ProtectedRoute from "./ProtectedRoute";

const openLogin = vi.fn();
vi.mock("../context/AuthModalContext", () => ({
  useAuthModal: () => ({ openLogin, openRegister: vi.fn(), closeModals: vi.fn() }),
}));

function App({ requiredRole }: { requiredRole?: "admin" | "empleado" }) {
  return (
    <Routes>
      <Route path="/" element={<h1>Inicio</h1>} />
      <Route path="/admin" element={<h1>Panel de administración</h1>} />
      <Route
        path="/privado"
        element={
          <ProtectedRoute requiredRole={requiredRole}>
            <h1>Contenido privado</h1>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    openLogin.mockClear();
  });

  it("sin sesión manda al inicio y abre el modal de login una sola vez", async () => {
    // Act
    renderWithProviders(<App />, { ruta: "/privado" });
    // Assert
    expect(await screen.findByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Contenido privado" })).not.toBeInTheDocument();
    expect(openLogin).toHaveBeenCalledTimes(1);
  });

  it("un cliente con sesión ve su contenido", async () => {
    renderWithProviders(<App />, { ruta: "/privado", sesion: { roles: ["cliente"] } });

    expect(await screen.findByRole("heading", { name: "Contenido privado" })).toBeInTheDocument();
    expect(openLogin).not.toHaveBeenCalled();
  });

  it.each([["admin"], ["empleado"]])("un %s que entra a una ruta de cliente va a su panel", async (rol) => {
    renderWithProviders(<App />, { ruta: "/privado", sesion: { roles: [rol] } });

    expect(await screen.findByRole("heading", { name: "Panel de administración" })).toBeInTheDocument();
  });

  it("una ruta solo de admin no deja pasar a un cliente", async () => {
    renderWithProviders(<App requiredRole="admin" />, { ruta: "/privado", sesion: { roles: ["cliente"] } });

    expect(await screen.findByRole("heading", { name: "Inicio" })).toBeInTheDocument();
  });

  it("una ruta solo de admin tampoco deja pasar a un empleado", async () => {
    renderWithProviders(<App requiredRole="admin" />, { ruta: "/privado", sesion: { roles: ["empleado"] } });

    expect(await screen.findByRole("heading", { name: "Inicio" })).toBeInTheDocument();
  });

  it.each([["admin"], ["empleado"]])("una ruta de empleado deja pasar a un %s", async (rol) => {
    renderWithProviders(<App requiredRole="empleado" />, { ruta: "/privado", sesion: { roles: [rol] } });

    expect(await screen.findByRole("heading", { name: "Contenido privado" })).toBeInTheDocument();
  });

  it("una ruta de empleado no deja pasar a un cliente", async () => {
    renderWithProviders(<App requiredRole="empleado" />, { ruta: "/privado", sesion: { roles: ["cliente"] } });

    expect(await screen.findByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Contenido privado" })).not.toBeInTheDocument();
  });
});
