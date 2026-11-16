// Unidad: borrador de los formularios de login y registro (utils/borradorAuth.ts).
import { afterEach, describe, expect, it, vi } from "vitest";
import { borradorLogin, borradorRegistro } from "./borradorAuth";

const baseRegistro = { correo_electronico: "", password: "", confirmPassword: "", nombre: "", paso: 1, terminos: false };

afterEach(() => {
  borradorLogin.borrar();
  borradorRegistro.borrar();
  vi.restoreAllMocks();
});

describe("borradorAuth", () => {
  it("sin borrador devuelve los valores iniciales", () => {
    expect(borradorLogin.leer({ username: "", password: "" })).toEqual({ username: "", password: "" });
  });

  it("conserva lo escrito al cerrar y volver a abrir", () => {
    borradorRegistro.guardar({ ...baseRegistro, correo_electronico: "ana@test.com", nombre: "Ana", paso: 2, terminos: true });
    expect(borradorRegistro.leer(baseRegistro)).toMatchObject({
      correo_electronico: "ana@test.com",
      nombre: "Ana",
      paso: 2,
      terminos: true,
    });
  });

  it("las contraseñas nunca van a sessionStorage, solo a memoria", () => {
    borradorRegistro.guardar({ ...baseRegistro, correo_electronico: "ana@test.com", password: "Secreta123", confirmPassword: "Secreta123" });
    const guardado = sessionStorage.getItem("borrador_registro") ?? "";
    expect(guardado).toContain("ana@test.com");
    expect(guardado).not.toContain("Secreta123");
    // Mientras la página siga abierta, la contraseña sí se conserva.
    expect(borradorRegistro.leer(baseRegistro).password).toBe("Secreta123");
  });

  it("tras recargar (sin memoria) recupera los datos no secretos", () => {
    sessionStorage.setItem("borrador_login", JSON.stringify({ username: "ana@test.com", password: "nunca-deberia-estar" }));
    // El de sessionStorage solo trae lo que el formulario conoce; aquí además
    // simula un valor viejo: se respeta el tipo de cada campo.
    expect(borradorLogin.leer({ username: "", password: "" }).username).toBe("ana@test.com");
  });

  it("ignora claves desconocidas y tipos distintos", () => {
    sessionStorage.setItem("borrador_registro", JSON.stringify({ nombre: 123, extra: "x", paso: "dos" }));
    const leido = borradorRegistro.leer(baseRegistro) as Record<string, unknown>;
    expect(leido.nombre).toBe("");
    expect(leido.paso).toBe(1);
    expect(leido).not.toHaveProperty("extra");
  });

  it("un JSON dañado no rompe el formulario", () => {
    sessionStorage.setItem("borrador_login", "{no es json");
    expect(borradorLogin.leer({ username: "", password: "" })).toEqual({ username: "", password: "" });
  });

  it("borrar descarta el borrador (tras ingresar o registrarse)", () => {
    borradorLogin.guardar({ username: "ana@test.com", password: "x" });
    borradorLogin.borrar();
    expect(borradorLogin.leer({ username: "", password: "" })).toEqual({ username: "", password: "" });
    expect(sessionStorage.getItem("borrador_login")).toBeNull();
  });

  it("sin sessionStorage disponible sigue funcionando en memoria", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    borradorLogin.guardar({ username: "ana@test.com", password: "x" });
    expect(borradorLogin.leer({ username: "", password: "" }).username).toBe("ana@test.com");
    borradorLogin.borrar();
  });
});
