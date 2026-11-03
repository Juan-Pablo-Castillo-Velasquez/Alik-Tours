// Contexto: sesión del usuario (AuthProvider / useAuth).
// Autor (semana 3, capa Front): Juan Pablo Castillo.
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("AuthContext", () => {
  it("sin nada guardado arranca sin sesión", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.authLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.usuario).toBeNull();
  });

  it("recupera la sesión guardada al recargar la página", () => {
    // Arrange
    localStorage.setItem("token", "abc");
    localStorage.setItem("usuario", JSON.stringify({ username: "ana", roles: ["cliente"] }));
    // Act
    const { result } = renderHook(() => useAuth(), { wrapper });
    // Assert
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.usuario?.username).toBe("ana");
  });

  it("si el usuario guardado está corrupto, descarta la sesión en vez de romper la app", () => {
    localStorage.setItem("token", "abc");
    localStorage.setItem("usuario", "{no es json");

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("login guarda la sesión y reconoce los roles", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.login("tok-1", { username: "admin@alik.co", roles: ["admin"] }));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isEmpleado).toBe(false);
    expect(localStorage.getItem("token")).toBe("tok-1");
  });

  it("login conserva el id_cliente ya guardado si la respuesta no lo trae", () => {
    localStorage.setItem("usuario", JSON.stringify({ username: "ana", id_cliente: 7 }));
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.login("tok-2", { username: "ana", roles: ["cliente"] }));

    expect(result.current.usuario?.id_cliente).toBe(7);
  });

  it("updateUsuario cambia solo los campos pedidos y los persiste; sin sesión no hace nada", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.updateUsuario({ foto_perfil: "x.png" }));
    expect(result.current.usuario).toBeNull();

    act(() => result.current.login("tok", { username: "ana", roles: ["empleado"] }));
    act(() => result.current.updateUsuario({ foto_perfil: "foto.png" }));

    expect(result.current.isEmpleado).toBe(true);
    expect(result.current.usuario).toMatchObject({ username: "ana", foto_perfil: "foto.png" });
    expect(JSON.parse(localStorage.getItem("usuario") ?? "{}").foto_perfil).toBe("foto.png");
  });

  it("logout borra la sesión y el cliente pendiente de vincular", () => {
    sessionStorage.setItem("id_cliente_pendiente", "3");
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login("tok", { username: "ana" }));

    act(() => result.current.logout());

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("id_cliente_pendiente")).toBeNull();
  });

  it("cuando el API avisa que la sesión venció, la cierra y no la deja guardada", () => {
    // Arrange: sesión iniciada
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login("tok-vencido", { username: "ana" }));

    // Act: apiFetch dispara este evento al recibir un 401 (api/v1/api.ts)
    act(() => {
      window.dispatchEvent(new Event("auth:session-expired"));
    });

    // Assert: también fuera de memoria, para que al recargar no "reviva"
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("usuario")).toBeNull();
  });

  it("useAuth fuera de AuthProvider avisa con un error claro", () => {
    expect(() => renderHook(() => useAuth())).toThrow("useAuth debe usarse dentro de AuthProvider");
  });
});
