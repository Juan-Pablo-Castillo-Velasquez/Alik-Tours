# E2E de AlekTours (Playwright)

Pruebas de extremo a extremo: un navegador real usa la app como lo haría
una persona (frontend React + API FastAPI + PostgreSQL).

## Cómo correrlas

1. Levanta la BD y el backend (en otra terminal), igual que para desarrollar:

   ```bash
   docker compose up -d postgres
   cd backend && uvicorn app.main:app --port 8000
   ```

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
