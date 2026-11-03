# Inventario de dependencias externas (semana 5)

Lo que AlekTours usa y **no controla**, y cómo se reemplaza en las pruebas.

| Dependencia | Dónde se usa | Doble en los tests | Tipo |
|---|---|---|---|
| Correo SMTP (smtplib, o la API de Brevo en producción) | Verificación de cuenta, recuperar contraseña, contacto, confirmación de reserva (`app/core/mail.py`) | `ServidorSMTPFalso` (`backend/tests/fakes.py`) puesto en cada test por el fixture `buzon`: ningún test envía correos reales. `test_correo_como_dependencia.py` verifica que sale, que no sale cuando no debe y que la app resiste si el SMTP cae | Fake + spy |
| Redis | Caché de listados, límite de intentos, idempotencia del chat (`app/core/cache.py`) | `RedisEnMemoria` en `backend/tests/fakes.py`, puesto automáticamente en cada test (`conftest.py`) | Fake |
| PostgreSQL | Toda la persistencia | Unitarias y API: SQLite en memoria. Integración (semana 6): PostgreSQL 16 real en Docker | Fake / real |
| La sesión de SQLAlchemy (repositorio) | Servicios de pago y registro | `MagicMock` de la sesión (`tests/unit/test_dobles_repositorio.py`) | Mock |
| Cloudinary | Imágenes de hoteles, perfiles, comunidad (`app/core/image_storage.py`) | Sin `CLOUDINARY_URL` la app guarda en disco: los tests nunca llaman a Cloudinary | Configuración |
| Pasarela de pagos | Tarjeta, PSE, Nequi, PayPal | No hay proveedor real: `payment_service.py` simula (0002, 0000…). Se prueba como lógica pura | — |
| La hora actual | Vencimiento de caché, tarjetas, tokens | Reloj falso de Vitest (`vi.setSystemTime`); tokens con `expires_delta` negativo | Stub |
| El backend, visto desde el frontend | Todo `services/` y `api/v1/api.ts` | MSW (`src/test/msw/`) en Vitest; `page.route` en Playwright | Fake / stub |
| Portapapeles del navegador | Copiar el Nequi de la agencia | El de `userEvent.setup()` | Fake |

## Revisión de exceso de mocks (en grupo)

Se revisó un test de cada integrante con la tabla "Cuándo un doble ayuda y cuándo estorba":

- `test_dobles_repositorio.py` (Juan Pablo): verifica comportamiento (qué se guarda) **y** estado (reserva confirmada, comprobante numerado). No solo repite el mock.
- `estados-dificiles.spec.js` (Fernando): cada `page.route` provoca un estado que la interfaz debe mostrar; las aserciones son sobre lo que ve la persona, no sobre la ruta interceptada (salvo el conteo de reintentos, que es el comportamiento probado).
- `api.test.ts` (Cristian): MSW responde en la red, así que corre el cliente real completo. Ningún test verifica solo que "se llamó al mock".
