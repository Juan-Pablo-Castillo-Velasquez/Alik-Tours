// Handlers de MSW: respuestas FALSAS del backend para los tests del
// frontend (semana 5). Cada handler imita una respuesta REAL del API de
// AlekTours. En la semana 6 se compararon contra el backend corriendo con
// la BD de pruebas (docs/testing/msw-vs-backend-real.md): los cuerpos de
// abajo son copia de lo que respondió el backend real.
import { http, HttpResponse } from "msw";

export const API = "http://api.test";

export const handlers = [
  // GET /api/paquetes: lista pública (Packages.tsx)
  http.get(`${API}/api/paquetes`, () =>
    HttpResponse.json([
      {
        id_paquete: 1,
        nombre_paquete: "Cartagena Mágica",
        descripcion: "4 días en la ciudad amurallada",
        duracion_dias: 4,
        precio_base: 1500000,
        activo: true,
        ciudad_salida: "Bogotá",
        condiciones: null,
        ciudad_destino: "Cartagena",
        imagen_url: null,
      },
    ]),
  ),

  // GET /api/hoteles/{id} inexistente: 404 con el formato de error del API
  http.get(`${API}/api/hoteles/999`, () => HttpResponse.json({ detail: "Hotel no encontrado" }, { status: 404 })),

  // ── Favoritos (FavoritosContext). Capturados del backend real, semana 6 ──
  // Sin sesión el backend responde 401; con sesión, la lista de ids.
  http.get(`${API}/api/favoritos/ids`, ({ request }) =>
    request.headers.get("Authorization")
      ? HttpResponse.json([3])
      : HttpResponse.json({ detail: "No autenticado" }, { status: 401 }),
  ),
  // POST es idempotente en el backend real: repetirlo devuelve 201 igual.
  http.post(`${API}/api/favoritos`, async ({ request }) => {
    const { id_hotel } = (await request.json()) as { id_hotel: number };
    if (id_hotel === 999999) return HttpResponse.json({ detail: "Hotel no encontrado" }, { status: 404 });
    return HttpResponse.json(
      { id_favorito: 1, id_hotel, fecha_creacion: "2026-11-02T19:34:01.842869", hotel: null },
      { status: 201 },
    );
  }),
  http.delete(`${API}/api/favoritos/:idHotel`, ({ params }) =>
    params.idHotel === "999999"
      ? HttpResponse.json({ detail: "Este hotel no está en tus favoritos" }, { status: 404 })
      : new HttpResponse(null, { status: 204 }),
  ),

  // ── Contacto. Capturados del backend real, semana 6 ──
  http.post(`${API}/api/contacto`, () => HttpResponse.json({ ok: true, message: "Mensaje enviado correctamente" })),
];

// 422 REAL de POST /api/contacto con nombre y correo inválidos. Antes los
// tests inventaban un 422 sin "input" ni "ctx" y con otro texto en "msg".
export const CONTACTO_422_REAL = {
  detail: [
    {
      type: "string_too_short",
      loc: ["body", "nombre"],
      msg: "String should have at least 2 characters",
      input: "A",
      ctx: { min_length: 2 },
    },
    {
      type: "value_error",
      loc: ["body", "correo"],
      msg: "value is not a valid email address: An email address must have an @-sign.",
      input: "x",
      ctx: { reason: "An email address must have an @-sign." },
    },
  ],
};
