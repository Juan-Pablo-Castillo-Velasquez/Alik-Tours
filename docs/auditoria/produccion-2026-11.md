# Auditoría de producción — noviembre 2026

Revisión de seguridad, formularios, panel de asesores y paginación. Este documento resume qué se encontró, qué se corrigió, cómo se probó y qué queda pendiente.

## 1. Vulnerabilidades corregidas

| # | Hallazgo | Riesgo | Corrección |
| --- | --- | --- | --- |
| 1 | `require_admin` y `require_empleado` aceptaban **cualquier JWT firmado**, incluido el **refresh token** (7 días) y los tokens de verificación o restablecimiento. | Un refresh token robado daba una semana de acceso al panel. | Nuevo `decode_access_token` (solo `type=access`) en `security.py`, usado por todas las dependencias de rol y por `deps.py`. |
| 2 | Los roles se leían **del token**, no de la base de datos. | A un admin al que le quitaban el rol, o una cuenta desactivada, seguía entrando al panel hasta que vencía el token. | `_roles_vigentes()` verifica en la BD, en cada petición, que el usuario exista, esté activo y tenga el rol (en `require_admin`, `require_empleado`, `require_permission` y `exigir_propietario_o_admin`). |
| 3 | Los **comprobantes de pago** se servían públicos en `/uploads/comprobantes/<archivo>`. | Cualquiera con el enlace veía el documento. | La ruta pública responde 404. Nuevo `GET /api/pagos/{id}/comprobante` (solo el dueño o el equipo, `Cache-Control: no-store`). El panel los abre con descarga autenticada (`abrirArchivoProtegido`). |
| 4 | El **token provisional del registro** (antes de verificar el correo) servía para todo. | Reservar, pagar, publicar o chatear sin correo verificado. | `get_usuario_verificado` en reservar, pagar, subir comprobante, confirmar pago, reseñas, publicar y comentar, chat, métodos de pago y solicitudes de cancelación. |
| 5 | Detrás del proxy de Render todos los usuarios llegaban con **la misma IP**. | Un solo atacante con 5 intentos bloqueaba el login de todo el mundo. | `ip_cliente()` usa la última IP de `X-Forwarded-For` (la del proxy; las anteriores pueden falsificarse). Variable `CONFIAR_PROXY`. |
| 6 | **Sin Redis, el rate limiting se apagaba** y cada petición esperaba el timeout de Redis. | Login sin protección contra fuerza bruta cuando Upstash fallaba. | Contador en memoria de respaldo + cortocircuito de Redis. |
| 7 | **Sin límite** en contacto, corporativo, publicar/comentar, reseñas, crear reserva, cancelaciones y comprobantes. | Spam y abuso automatizado. | Reglas por método y ruta en `security_middleware.py` (las lecturas `GET` nunca se limitan), con `Retry-After`. |
| 8 | Textos de **solo espacios** pasaban como válidos (`"   "` con `min_length=3`). | Datos basura en formularios. | `str_strip_whitespace` en los esquemas de entrada (excepto contraseñas) y recorte explícito en los formularios multipart de la comunidad. |
| 9 | Un asesor solo veía **las reservas asignadas a él** (filtro en el navegador). | El enlace de una reserva desde el chat abría una tabla vacía. | Admin y asesores consultan todas las reservas; lo que cada rol puede **modificar** lo valida el backend (cambiar estado y borrar siguen siendo solo del admin). |

## 2. Funcionalidades nuevas

- **Listado de reservas paginado en el backend** (`GET /api/reservas/buscar`): búsqueda por código (`#25`), cliente, documento, correo, paquete, hotel o destino; filtros por estado, estado de pago, canal, tipo de viaje, asesor, cliente y rango de fechas; orden por código, fecha de viaje o fecha de creación; conteos por estado. El módulo Reservas del panel lo usa con skeleton de carga, contador «Mostrando X–Y de N» y filtros nuevos (tipo y fechas).
- **Dashboard del asesor** (`DashboardEmpleado.tsx`): total de reservas, pendientes, confirmadas, canceladas, pagos pendientes e ingresos registrados (cada tarjeta abre el módulo ya filtrado); reservas recientes; actividad del equipo; viajes próximos; gráfica de reservas nuevas de 14 días; alertas de reservas nuevas hoy y pendientes de atención.
- Los asesores pueden **dejar notas internas** y ver la **actividad reciente** (antes solo el admin). En el detalle de una reserva, el asesor ve el estado en modo lectura (sin botones que el backend rechazaría).
- **Paginación** en Vuelos (público), Temas, Roles, Comunidad (moderación), Comprobantes y Favoritos del perfil. Banners no se paginan a propósito: se ordenan arrastrando.
- **Login y registro conservan lo escrito** al cerrar el modal (clic afuera, la X o al pasar de uno al otro). Las contraseñas quedan solo en memoria, nunca en `sessionStorage` (`utils/borradorAuth.ts`). El registro vuelve al paso donde se quedó la persona; si ya creó la cuenta, al paso del código.
- **Validación de formularios reutilizable** (`utils/validacionFormulario.ts` + `ErrorCampo`): contacto y corporativo con campos obligatorios marcados, límites iguales al backend, error debajo de cada campo, foco en el primer error, contador de caracteres, bloqueo de doble envío y mensaje claro para el 429.
- El botón de chat del cliente ya no aparece dentro del panel de administración.
- **Índices** para el listado y la disponibilidad (migración `f2a7c4e9b1d8`).

## 3. Pruebas ejecutadas

| Suite | Resultado |
| --- | --- |
| Backend (`pytest`, SQLite) | 494 pasan, 27 omitidas · cobertura 84,9 % (mínimo 81 %) |
| Backend integración PostgreSQL (`TEST_DATABASE_URL`) | 26 pasan, 1 xfail — incluye **concurrencia real**: dos clientes reservando la misma habitación a la vez (solo uno lo logra) y doble clic con la misma clave (una sola reserva) |
| Frontend (`vitest` con cobertura) | 316 pasan · umbral 80 % cumplido |
| E2E (Playwright, local con PostgreSQL + Mailpit) | 32 de 33 pasan; el restante depende del proyecto `setup` que el CI sí ejecuta |
| Build de producción (`pnpm build`) y `ruff` | OK |

Nuevas pruebas: `test_busqueda_reservas_panel_api.py` (acceso entre roles, búsqueda, filtros, paginación, permisos del asesor), `test_rate_limit_api.py` (límites, IP real, falsificación de `X-Forwarded-For`, Redis caído, espacios), `TestTokensYRolesVigentes`, `TestComprobantesPrivados` y `TestCuentaSinVerificar` en `test_seguridad_y_errores_api.py`, `test_concurrencia_reservas_pg.py`, y en el frontend `api.cache.test.ts`, `borradorAuth.test.ts`, `validacionFormulario.test.ts` y `ErrorCampo.test.tsx`.

## 4. Pendientes (no resueltos en esta ronda)

- **Archivos del chat** (`/uploads/chat` en local, Cloudinary público en producción): siguen accesibles por URL (nombres aleatorios UUID, no listables). Hacerlos privados exige Cloudinary `type=authenticated` con URLs firmadas y cambiar cómo el chat muestra imágenes en línea.
- **Comprobantes en Render Free**: se guardan en el disco del contenedor, que se borra en cada despliegue. Conviene moverlos a almacenamiento persistente privado (Cloudinary autenticado o S3).
- **Formularios**: se aplicó la validación reutilizable a contacto y corporativo (el registro ya validaba campo por campo). Falta revisar el checkout y aplicarla con el mismo patrón a: cuenta del perfil, cancelación, reseña, publicar en la comunidad y los formularios del panel (hoteles, paquetes, vuelos, usuarios).
- **Dashboard del admin**: no se rediseñó (ya tenía tendencias, gráficas y actividad); el rediseño completo se hizo en el del asesor.
- **Exportar CSV** en Reservas exporta la página visible, no todas las reservas filtradas.

## 5. Desplegar en producción

1. Hacer merge a `main`: Vercel despliega el frontend y Render el backend. Render ejecuta `alembic upgrade head` al arrancar (migración de índices `f2a7c4e9b1d8`, solo agrega índices).
2. Variables nuevas, todas opcionales: `CONFIAR_PROXY` (por defecto `true`, correcto en Render), `CACHE_*`, `DB_POOL_*` y `RATE_LIMIT_MULTIPLIER` (por defecto `1`; solo para E2E).
3. Después de desplegar, verificar:
   - Iniciar sesión como asesor: el módulo Reservas muestra todas las reservas y el enlace de una reserva en el chat abre su detalle.
   - `https://<backend>/uploads/comprobantes/cualquiera.pdf` responde 404.
   - El login sigue funcionando (si alguien quedó con una sesión vieja de refresh token, debe volver a iniciar sesión: es lo esperado).
