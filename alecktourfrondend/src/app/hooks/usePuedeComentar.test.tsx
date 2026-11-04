// Hook: quién puede comentar en la comunidad (clientes y equipo de la agencia).
// Autor: Juan Pablo Castillo.
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { usePuedeComentar } from "./usePuedeComentar";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

function conSesion(usuario: object) {
  localStorage.setItem("token", "tok");
  localStorage.setItem("usuario", JSON.stringify(usuario));
}

describe("usePuedeComentar", () => {
  it("sin sesión no puede comentar", () => {
    const { result } = renderHook(() => usePuedeComentar(), { wrapper });
    expect(result.current).toBe(false);
  });

  it("un cliente con perfil sí puede", () => {
    conSesion({ username: "ana", roles: ["cliente"], id_cliente: 3 });
    const { result } = renderHook(() => usePuedeComentar(), { wrapper });
    expect(result.current).toBe(true);
  });

  it.each([["admin"], ["empleado"]])("el equipo (%s) sí puede aunque no tenga perfil de cliente", (rol) => {
    conSesion({ username: "equipo", roles: [rol] });
    const { result } = renderHook(() => usePuedeComentar(), { wrapper });
    expect(result.current).toBe(true);
  });

  it("una cuenta sin perfil de cliente ni rol del equipo no puede", () => {
    conSesion({ username: "sin-perfil", roles: ["cliente"] });
    const { result } = renderHook(() => usePuedeComentar(), { wrapper });
    expect(result.current).toBe(false);
  });
});
