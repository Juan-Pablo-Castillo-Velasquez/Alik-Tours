# ¿Mienten los handlers de MSW? (semana 6, capa Front)

Se levantó el backend contra la BD de pruebas (PostgreSQL 16, `docker-compose.test.yml`)
y se capturaron las respuestas reales de los endpoints que simulan los tests del frontend.
Responsable: Fernando Gutiérrez.

| Endpoint y caso | Handler de la semana 5 | Respuesta real | ¿Coincide? | Acción |
|---|---|---|---|---|
| `GET /api/paquetes` (lista) | Lista con los 10 campos de `PaqueteResponse` | Mismos 10 campos; `precio_base` llega como `1200000.0` | Sí | — |
| `GET /api/hoteles/999` (404) | `{"detail": "Hotel no encontrado"}` | Igual | Sí | — |
| `POST /api/contacto` (422) | `detail` con `loc`, `msg`, `type` y un `msg` corto inventado | `detail` también trae `input` y `ctx`, y `msg` = `value is not a valid email address: An email address must have an @-sign.` | **No** | Se copió el cuerpo real (`CONTACTO_422_REAL`) y se ajustó el test del mensaje |
| `POST /api/contacto` (éxito) | No existía | `200 {"ok": true, "message": "Mensaje enviado correctamente"}` | Nuevo | Handler + test |
| Error con `detail` objeto (409) | `{"detail": {"mensaje": …, "codigo": 41}}` | Ningún endpoint lo produce (búsqueda de `detail={` en `backend/app`: 0 resultados). Los 409 reales traen texto | **No** | El test quedó marcado como caso defensivo y se agregó uno con un 409 real (`/reservas/{id}/pagar`) |
| `GET /api/favoritos/ids` | No existía | Con sesión: `[1]`. Sin sesión: `401 {"detail": "No autenticado"}` | Nuevo | Handler + tests de `FavoritosContext` |
| `POST /api/favoritos` | No existía | `201` con el favorito. Repetido: `201` otra vez (idempotente). Hotel inexistente: `404 {"detail": "Hotel no encontrado"}` | Nuevo | Handler + tests |
| `DELETE /api/favoritos/{id}` | `204` (test del cliente HTTP) | `204` sin cuerpo; si no era favorito: `404 {"detail": "Este hotel no está en tus favoritos"}` | Sí (y faltaba el 404) | Handler con los dos casos |
| `401` token vencido | `{"detail": "Token expirado o inválido"}` | Igual | Sí | — |
| `403` cuenta desactivada | `Esta cuenta está desactivada. Contacta al administrador.` | Igual | Sí | — |
| Nuevos errores de la capa API (semana 6) | — | `/auth/register` con datos inválidos ahora responde `422` (antes `500`) | Nuevo | Lo cubre `api.test.ts` con el formato de 422 real |
