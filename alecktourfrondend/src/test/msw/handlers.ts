// Handlers de MSW: respuestas FALSAS del backend para los tests del
// frontend (semana 5). Cada handler imita una respuesta REAL del API de
// AlekTours: en la semana 6 se comparan contra el backend corriendo con la
// BD de pruebas (ver docs de la semana 6) y se corrigen si mienten.
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
];
