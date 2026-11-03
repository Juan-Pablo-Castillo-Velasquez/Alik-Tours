# E2E de AlekTours (Playwright)

Pruebas de extremo a extremo: un navegador real usa la app como lo haría
una persona (frontend React + API FastAPI + PostgreSQL).

## Cómo correrlas

1. Levanta la BD de **pruebas**, Mailpit y el backend contra esa BD (en
   otra terminal). Desde la semana 7 los E2E crean sus datos por API y leen
   el código de verificación del correo en Mailpit:

   ```bash
   docker compose -f docker-compose.test.yml up -d --wait
   docker compose up -d mailpit
   cd backend
   export DATABASE_URL=postgresql+psycopg2://alektours:alektours@localhost:5433/alektours_test
   export MAIL_SERVER=localhost MAIL_PORT=1025
   alembic upgrade head
   uvicorn app.main:app --port 8000
   ```

   (En PowerShell: `$env:DATABASE_URL="..."; $env:MAIL_SERVER="localhost"`.)

2. Instala y corre los E2E (Playwright levanta el frontend solo, con Vite):

   ```bash
   cd alecktourfrondend && pnpm install      # una vez: Vite lo necesita
   cd ../e2e && pnpm install
   pnpm exec playwright install chromium     # una vez: el navegador
   pnpm test
   ```

3. Reporte HTML (y trazas si algo falla): `pnpm report`.

Para grabar un flujo nuevo: `pnpm codegen` (con el frontend corriendo).

## Reglas del grupo

- Locators por rol o etiqueta (`getByRole`, `getByLabel`). Si no se puede,
  se arregla la accesibilidad del componente, no se usa `getByTestId`.
- Estructura AAA y al menos una aserción sobre lo que ve la persona.
- Datos únicos cuando el flujo crea registros (`Date.now()`).
- Todos los tests importan `test` y `expect` de `./fixtures.js` (oculta el
  aviso de cookies y el folleto de bienvenida).
- Nunca `waitForTimeout`: las aserciones web-first ya esperan.
- Los datos se crean por API con `tests/support/api.js` (valores únicos).
- La sesión de cliente se prepara una vez (`auth.setup.js`) y se reutiliza
  con `test.use({ storageState: SESION_CLIENTE })`.
- Antes de dar por bueno un test: `pnpm exec playwright test <archivo> --repeat-each=5`.
