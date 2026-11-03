# Estrategia de pruebas — AlekTours

**Grupo**: Juan Pablo Castillo · Fernando Gutiérrez · Cristian Sinisterra · **Ficha**: _número_ · **Stack**: React (Vite + TS) + FastAPI + PostgreSQL 16 · **Fecha**: _AAAA-MM-DD_

## 1. Qué hace la app y qué no puede fallar

_(Sección a cargo de Fernando.)_

## 2. Qué prueba cada capa y por qué

_(Sección a cargo de Fernando.)_

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

_(Sección a cargo de Cristian.)_

## 6. Hallazgos y riesgos conocidos

_(Sección a cargo de Cristian.)_

## 7. Evidencia individual

| Integrante | Capas trabajadas (matriz) | Commits de test (`git shortlog`) |
|---|---|---|
| Juan Pablo Castillo | E2E, Front, Front, E2E, BD, API, E2E (+ backend 75%), Front | _completar con `git shortlog -sn -- '*tests/*' '*.test.*' 'e2e/*'`_ |
| Fernando Gutiérrez | E2E, API, Front, BD, E2E, Front, E2E, API | _completar_ |
| Cristian Sinisterra | E2E, E2E (CI), Front, API, Front, BD, E2E, E2E | _completar_ |
