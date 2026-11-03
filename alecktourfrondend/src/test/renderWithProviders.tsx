// Helper compartido de los tests de componentes (semana 3).
//
// Monta el componente dentro de un router en memoria y del AuthProvider
// real, como en la app. La sesión se prepara igual que la deja el login:
// token y usuario en localStorage, que AuthProvider lee al arrancar.
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../app/context/AuthContext";

export interface SesionDePrueba {
  username?: string;
  id_cliente?: number;
  roles?: string[];
}

interface Opciones extends Omit<RenderOptions, "wrapper"> {
  /** Ruta inicial del router en memoria. */
  ruta?: string;
  /** Si se pasa, el test arranca con esa sesión iniciada. */
  sesion?: SesionDePrueba;
}

export function prepararSesion(sesion: SesionDePrueba) {
  localStorage.setItem("token", "token-de-prueba");
  localStorage.setItem(
    "usuario",
    JSON.stringify({ username: "ana@correo.com", id_cliente: 1, roles: ["cliente"], ...sesion }),
  );
}

export function renderWithProviders(ui: ReactElement, { ruta = "/", sesion, ...opciones }: Opciones = {}) {
  if (sesion) prepararSesion(sesion);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[ruta]}>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper: Wrapper, ...opciones });
}
