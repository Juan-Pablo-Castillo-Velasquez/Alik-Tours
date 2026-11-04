// Unidad: cliente HTTP del frontend (apiFetch / apiLogin) contra un backend falso.
// Autor (semana 5, capa Front): Cristian Sinisterra.
//
// Tipo de doble: FAKE de red con MSW. Las peticiones salen de verdad con
// fetch y MSW las responde en la capa de red, así que se prueba el cliente
// completo (URL, cabeceras, cuerpo, manejo de errores) sin backend real.
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API, CONTACTO_422_REAL } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import { apiFetch, apiGetResenas, apiLogin } from "./api";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("apiFetch: caso feliz", () => {
  it("antepone /api, manda el token guardado y devuelve el JSON", async () => {
    // Arrange: spy de lo que llega al "servidor"
    localStorage.setItem("token", "tok-123");
    let cabeceraAuth: string | null = null;
    server.use(
      http.get(`${API}/api/hoteles/7`, ({ request }) => {
        cabeceraAuth = request.headers.get("Authorization");
        return HttpResponse.json({ id_hotel: 7, nombre_hotel: "Hotel Caribe" });
      }),
    );
    // Act
    const hotel = await apiFetch<{ nombre_hotel: string }>("/hoteles/7");
    // Assert: estado (lo que devuelve) y comportamiento (lo que mandó)
    expect(hotel.nombre_hotel).toBe("Hotel Caribe");
    expect(cabeceraAuth).toBe("Bearer tok-123");
  });

  it("sin sesión no manda Authorization", async () => {
    let cabeceraAuth: string | null = "sin leer";
    server.use(
      http.get(`${API}/api/paquetes`, ({ request }) => {
        cabeceraAuth = request.headers.get("Authorization");
        return HttpResponse.json([]);
      }),
    );

    await apiFetch("/paquetes?skip=0&limit=10");

    expect(cabeceraAuth).toBeNull();
  });

  it("convierte un objeto en JSON con su Content-Type", async () => {
    let recibido: unknown = null;
    let tipo: string | null = null;
    server.use(
      http.post(`${API}/api/contacto`, async ({ request }) => {
        tipo = request.headers.get("Content-Type");
        recibido = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiFetch("/contacto", { method: "POST", body: { nombre: "Ana", asunto: "Hola" } });

    expect(tipo).toBe("application/json");
    expect(recibido).toEqual({ nombre: "Ana", asunto: "Hola" });
  });

  it("deja un FormData intacto (el navegador pone el multipart)", async () => {
    let tipo: string | null = null;
    server.use(
      http.post(`${API}/api/hoteles/1/imagen`, ({ request }) => {
        tipo = request.headers.get("Content-Type");
        return HttpResponse.json({ ok: true });
      }),
    );
    const datos = new FormData();
    datos.append("archivo", new Blob(["x"], { type: "image/png" }), "foto.png");

    await apiFetch("/hoteles/1/imagen", { method: "POST", body: datos });

    // La regla del cliente: NO convertirlo a JSON ni forzar ese Content-Type
    // (el multipart con su boundary lo arma fetch en el navegador).
    expect(tipo).not.toBe("application/json");
  });

  it("las rutas de /auth no llevan el prefijo /api", async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json({ ok: true })));

    await expect(apiFetch("/auth/refresh", { method: "POST" })).resolves.toEqual({ ok: true });
  });

  it("corrige un /api duplicado y lo avisa en consola", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(http.get(`${API}/api/destinos`, () => HttpResponse.json([])));

    await expect(apiFetch("/api/destinos")).resolves.toEqual([]);
    expect(aviso).toHaveBeenCalledTimes(1);

    aviso.mockRestore();
  });

  it("un 204 (sin cuerpo) devuelve un objeto vacío", async () => {
    server.use(http.delete(`${API}/api/favoritos/3`, () => new HttpResponse(null, { status: 204 })));

    await expect(apiFetch("/favoritos/3", { method: "DELETE" })).resolves.toEqual({});
  });
});

describe("apiFetch: errores", () => {
  it("un 404 lanza el detalle del API (handler compartido)", async () => {
    await expect(apiFetch("/hoteles/999")).rejects.toThrow("Hotel no encontrado");
  });

  it("un 500 lanza el mensaje genérico que manda el backend", async () => {
    server.use(
      http.get(`${API}/api/hoteles/1`, () =>
        HttpResponse.json(
          { detail: "Error interno del servidor. Revisa los logs del servidor para ver el detalle." },
          { status: 500 },
        ),
      ),
    );

    await expect(apiFetch("/hoteles/1")).rejects.toThrow("Error interno del servidor.");
  });

  it("un 422 de FastAPI se convierte en texto legible (no '[object Object]')", async () => {
    // Cuerpo capturado del backend real en la semana 6 (CONTACTO_422_REAL).
    server.use(http.post(`${API}/api/contacto`, () => HttpResponse.json(CONTACTO_422_REAL, { status: 422 })));

    await expect(apiFetch("/contacto", { method: "POST", body: {} })).rejects.toThrow(
      "body.nombre: String should have at least 2 characters; body.correo: value is not a valid email address: An email address must have an @-sign.",
    );
  });

  it("un 422 con la lista vacía usa un mensaje por defecto", async () => {
    server.use(http.post(`${API}/api/contacto`, () => HttpResponse.json({ detail: [] }, { status: 422 })));

    await expect(apiFetch("/contacto", { method: "POST", body: {} })).rejects.toThrow("Datos inválidos en la solicitud");
  });

  // Semana 6: ningún endpoint real responde "detail" como objeto (se buscó en
  // todo backend/app). Se deja como defensa del cliente, con un 409 real.
  it("un detalle con forma de objeto junta sus textos (caso defensivo)", async () => {
    server.use(
      http.get(`${API}/api/reservas/1`, () =>
        HttpResponse.json({ detail: { mensaje: "Reserva vencida", codigo: 41 } }, { status: 409 }),
      ),
    );

    await expect(apiFetch("/reservas/1")).rejects.toThrow("Reserva vencida");
  });

  it("una respuesta que no es JSON (página de error de un proxy) no rompe el cliente", async () => {
    server.use(
      http.get(`${API}/api/hoteles/1`, () =>
        new HttpResponse("<html><body>502 Bad Gateway</body></html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(apiFetch("/hoteles/1")).rejects.toThrow("Error en la petición al servidor");
  });
});

describe("apiFetch: respuestas reales del backend (semana 6)", () => {
  it("POST /contacto devuelve el cuerpo real de éxito", async () => {
    await expect(apiFetch("/contacto", { method: "POST", body: { nombre: "Ana" } })).resolves.toEqual({
      ok: true,
      message: "Mensaje enviado correctamente",
    });
  });

  it("un 409 de pago repetido llega con su detalle de texto", async () => {
    server.use(
      http.post(`${API}/api/reservas/5/pagar`, () =>
        HttpResponse.json({ detail: "Esta reserva ya está pagada en su totalidad" }, { status: 409 }),
      ),
    );

    await expect(apiFetch("/reservas/5/pagar", { method: "POST", body: {} })).rejects.toThrow(
      "Esta reserva ya está pagada en su totalidad",
    );
  });
});

describe("apiFetch: sesión vencida", () => {
  it("un 401 avisa a la app con el evento auth:session-expired", async () => {
    const escucha = vi.fn();
    window.addEventListener("auth:session-expired", escucha);
    server.use(http.get(`${API}/api/clientes/1`, () => HttpResponse.json({ detail: "Token expirado o inválido" }, { status: 401 })));

    await expect(apiFetch("/clientes/1")).rejects.toThrow("Token expirado o inválido");

    expect(escucha).toHaveBeenCalledTimes(1);
    window.removeEventListener("auth:session-expired", escucha);
  });

  it("un 403 de cuenta desactivada también cierra la sesión; otro 403 no", async () => {
    const escucha = vi.fn();
    window.addEventListener("auth:session-expired", escucha);
    server.use(
      http.get(`${API}/api/clientes/1`, () =>
        HttpResponse.json({ detail: "Esta cuenta está desactivada. Contacta al administrador." }, { status: 403 }),
      ),
      http.get(`${API}/api/clientes/2`, () =>
        HttpResponse.json({ detail: "No tienes permiso para acceder a estos datos" }, { status: 403 }),
      ),
    );

    await expect(apiFetch("/clientes/1")).rejects.toThrow();
    await expect(apiFetch("/clientes/2")).rejects.toThrow("No tienes permiso");

    expect(escucha).toHaveBeenCalledTimes(1);
    window.removeEventListener("auth:session-expired", escucha);
  });
});

describe("apiLogin", () => {
  it("manda usuario y clave como formulario y guarda el token", async () => {
    let cuerpo = "";
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        cuerpo = await request.text();
        return HttpResponse.json({ access_token: "jwt-nuevo", token_type: "bearer" });
      }),
    );

    await apiLogin("ana@correo.com", "Clave 123");

    expect(new URLSearchParams(cuerpo).get("username")).toBe("ana@correo.com");
    expect(new URLSearchParams(cuerpo).get("password")).toBe("Clave 123");
    expect(localStorage.getItem("token")).toBe("jwt-nuevo");
  });

  it("con credenciales inválidas lanza el detalle y no guarda nada", async () => {
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json({ detail: "Credenciales inválidas" }, { status: 401 })));

    await expect(apiLogin("ana@correo.com", "mala")).rejects.toThrow("Credenciales inválidas");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("si el error no trae JSON usa 'Login fallido'", async () => {
    server.use(http.post(`${API}/auth/login`, () => new HttpResponse("Bad Gateway", { status: 502 })));

    await expect(apiLogin("ana@correo.com", "x")).rejects.toThrow("Login fallido");
  });
});

describe("apiGetResenas", () => {
  it("sin filtro pide la página; con estrellas agrega el filtro", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API}/api/resenas`, ({ request }) => {
        urls.push(new URL(request.url).search);
        return HttpResponse.json({ total: 0, promedio: 5, resenas: [], distribucion: { "5": 0 } });
      }),
    );

    await apiGetResenas(0, 9);
    const filtrada = await apiGetResenas(9, 9, 4);

    expect(urls).toEqual(["?skip=0&limit=9", "?skip=9&limit=9&calificacion=4"]);
    expect(filtrada.distribucion).toEqual({ "5": 0 });
  });
});
