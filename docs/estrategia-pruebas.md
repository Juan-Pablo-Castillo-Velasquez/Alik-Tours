# Estrategia de pruebas — AlekTours

**Grupo**: Juan Pablo Castillo · Fernando Gutiérrez · Cristian Sinisterra · **Ficha**: _número_ · **Stack**: React (Vite + TS) + FastAPI + PostgreSQL 16 · **Fecha**: _AAAA-MM-DD_

## 1. Qué hace la app y qué no puede fallar

AlekTours es la plataforma de la agencia Alik Tours (RNT 224224): las personas buscan hoteles y paquetes, se registran, reservan y pagan (pagos simulados); el equipo administra el catálogo, las reservas y los clientes desde un panel con roles.

| Riesgo | Por qué importa |
|---|---|
| Que alguien vea o tome datos de otro cliente | Datos personales (cédula, celular) y reservas pagadas: es el riesgo más grave (Ley 1581 de 2012) |
| Que el login o el registro fallen | Sin cuenta no hay reserva: la agencia deja de vender en línea |
| Que una reserva se cruce con otra o tenga mal el precio | Doble venta de la misma habitación o cobro equivocado |
| Que un pago aprobado no confirme la reserva (o se "desapruebe") | Dinero recibido sin reserva confirmada, o al revés |
| Que el buscador no encuentre el destino | La persona cree que no hay viajes y se va |
| Que un error interno filtre detalles o abra CORS | Información del servidor expuesta a cualquier sitio |

## 2. Qué prueba cada capa y por qué

| Capa | Qué verifica | Herramienta | Cantidad de tests |
|---|---|---|---|
| Unitarias (backend) | Reglas de pago y transiciones, validadores, límites de los esquemas, dobles del repositorio | pytest | 33 funciones (más casos parametrizados) en `tests/unit` |
| Unitarias y componentes (frontend) | Utilidades (fechas, contraste WCAG, caché), hooks, contextos de sesión/tema/favoritos, ruta protegida, filtros y formularios de pago, cliente HTTP | Vitest + Testing Library + MSW | 24 archivos, 148 bloques `it` |
| API | Todo el contrato HTTP: CRUD, 401/403, 404/409/422, errores sin filtraciones, correos como dependencia | pytest + `TestClient` (SQLite en memoria) | 137 funciones en `tests/api` + 87 de las suites previas |
| Integración con BD | Repositorios, restricciones reales (FK, CHECK, longitud), migraciones, endpoints contra PostgreSQL | pytest + PostgreSQL 16 | 25 en `tests/integration` |
| E2E (flujos críticos) | Iniciar sesión, buscar y ver un hotel, crear una cuenta; estados difíciles con `page.route`; defectos de tiempos | Playwright | 24 tests + la preparación de la sesión |

**Por qué esta forma**: en AlekTours la lógica vive casi toda en el **backend** (disponibilidad, precios, pagos, permisos), así que el grueso de la suite son pruebas de API rápidas contra SQLite, y la integración con PostgreSQL cubre lo que SQLite no ve (llaves foráneas, CHECK, longitudes, orden). El frontend tiene pocas reglas propias pero mucha pantalla: se prueban sus reglas con Vitest y sus pantallas con pocos E2E sobre los tres flujos que, si fallan, dejan a la agencia sin vender.

## 3. Qué no se prueba y por qué

| Fuera de la suite o de la cobertura | Motivo |
|---|---|
| `components/ui/**` (shadcn/ui) | Librería generada, no es código propio |
| `pages/**` y pantallas grandes (`Navbar`, `RegisterModal`, `LoginModal`, panel de admin) | Se cubren con los E2E de los flujos críticos; probarlas con Testing Library duplicaría esos tests |
| `services/**` del frontend | Una línea por endpoint; la lógica común (errores, token, sesión vencida) está en `api/v1/api.ts`, que sí se mide |
| `app/repositories/*`, `core/database.py`, `core/cache.py`, `core/mail.py`, `core/image_storage.py` | Adaptadores de infraestructura: se prueban con dobles (semana 5) y contra PostgreSQL real en `tests/integration` |
| `main.py`, `core/config.py` | Arranque y configuración, sin reglas que probar |
| Cloudinary, Brevo, pasarelas de pago reales | No se llaman nunca desde las pruebas (ver sección 4) |

## 4. Datos y entornos

- **BD de pruebas**: PostgreSQL 16 en `docker-compose.test.yml` (puerto 5433, `alektours_test`, datos en RAM). El esquema lo crean las migraciones (`alembic upgrade head`), igual que en producción. Nunca la BD de desarrollo: los tests de integración solo leen `TEST_DATABASE_URL`.
- **Limpieza**: cada test de integración corre dentro de una transacción con *savepoints* que se deshace al final; se eligió sobre `TRUNCATE` porque las migraciones siembran datos que la app necesita (roles, tipos de habitación). Unitarias y de API: SQLite en memoria nueva por test.
- **Dobles**: Redis en memoria y SMTP falso en **todos** los tests del backend (`tests/fakes.py`, fixtures automáticas); MSW para el backend visto desde el frontend; `page.route` para estados difíciles en E2E; reloj falso de Vitest para fechas.
- **E2E**: cada test crea sus datos por API con valores únicos (`e2e/tests/support/api.js`): cuentas verificadas leyendo el código en Mailpit, hoteles con el admin sembrado. La sesión de cliente se prepara una vez (`auth.setup.js`) y se reutiliza.

## 5. CI y umbrales

- Workflow: [`.github/workflows/tests.yml`](../.github/workflows/tests.yml) (lint y Docker siguen en `ci.yml`). Último run en verde de `main`: _pegar enlace_.
- Jobs obligatorios en el ruleset de `main`: `frontend`, `backend`, `integracion`, `e2e` y `Lint (Ruff + ESLint)`. `evidencia-individual` solo informa.
- Artefactos: `coverage-frontend`, `coverage-backend` (siempre) y `e2e-report` con trazas y log del API (si falla).
- Saltados: el job `backend` salta a propósito los 25 de `tests/integration` (no tiene BD); el job `integracion` los corre y **falla si queda alguno saltado**.

| Parte | Cobertura actual | Umbral configurado |
|---|---|---|
| Frontend | _anotar de `pnpm test`_ | 80% (líneas, ramas, funciones y sentencias) |
| Backend | 81% (sin `TEST_DATABASE_URL`, como en el CI) | 81% (`fail_under`) |

## 6. Hallazgos y riesgos conocidos

| Defecto | Capa que lo encontró | Estado |
|---|---|---|
| El 500 devolvía CORS con credenciales a cualquier origen | API (S4) | Corregido |
| Cualquier cuenta podía vincularse al perfil de otro cliente y ver sus reservas | API (S8) | Corregido |
| El enlace de recuperación servía también el de verificación, y se podía reusar 24 h | API (S7) | Corregido (tipo propio, 1 h, un solo uso) |
| El backend no validaba la contraseña (solo el formulario) | Integración (S6) | Corregido |
| `echo=True`: el log mostraba consultas con hashes de contraseña | Integración (S6) | Corregido |
| Textos más largos que la columna respondían 500 (registro, editar hotel/habitación) | Integración (S6) | Corregido |
| Los CHECK de `reservas` estaban en el modelo pero no en la BD | Integración (S6) | Corregido (migración `f3c1d9a7b5e2`) |
| Borrar un empleado respondía siempre 500 | API (S8) | Corregido |
| Habitación: borrar inexistente = 200; con reservas = 500; número repetido = 400/500 | API (S4) | Corregido (404/409) |
| Un admin podía eliminar su propia cuenta | API (S7) | Corregido |
| Comprobante PDF con las fechas un día antes en Colombia | Unitarias front (S2) | Corregido |
| La sesión vencida "revivía" al recargar | Componentes (S3) | Corregido |
| `/packages` con el API caído decía "no hay paquetes" | E2E (S5) | Corregido (error + Reintentar) |
| Dos handlers de MSW no coincidían con el backend real | Front (S6) | Corregido |
| 15 tests fallaban según el orden (PRAGMA sin apagar); tablas que existían o no según el orden | Suite (S1, S7) | Corregido |
| Accesibilidad: login, registro, contacto, pagos sin etiquetas asociadas ni roles | E2E y componentes | Corregido |
| Cédula repetida en el registro deja la cuenta creada sin perfil | E2E (S7) | **Abierto**: incidencia #N, test con `test.fail()` |
| La búsqueda distingue tildes en PostgreSQL (`medellin` ≠ `Medellín`) | Integración (S6) | **Abierto**: incidencia #N, test con `xfail(strict=True)` |

## 7. Evidencia individual

| Integrante | Capas trabajadas (matriz) | Commits de test (`git shortlog`) |
|---|---|---|
| Juan Pablo Castillo | E2E, Front, Front, E2E, BD, API, E2E (+ backend 75%), Front | _completar con `git shortlog -sn -- '*tests/*' '*.test.*' 'e2e/*'`_ |
| Fernando Gutiérrez | E2E, API, Front, BD, E2E, Front, E2E, API | _completar_ |
| Cristian Sinisterra | E2E, E2E (CI), Front, API, Front, BD, E2E, E2E | _completar_ |
