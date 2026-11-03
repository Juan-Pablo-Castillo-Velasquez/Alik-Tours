import { defineConfig, devices } from '@playwright/test';

// Puerto del frontend. Cámbialo con FRONT_PORT si el 5173 ya está ocupado.
const port = Number(process.env.FRONT_PORT ?? 5173);

export default defineConfig({
  testDir: './tests',
  // Un flujo E2E de AlekTours toca frontend + API + BD: 30 s por test
  // alcanza de sobra en local; la espera del primer arranque de Vite la
  // cubre el timeout propio del webServer (abajo).
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Los tests no comparten datos (cada uno crea los suyos con valores
  // únicos), así que pueden correr en paralelo.
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${port}`,
    // Guarda la traza solo cuando un test falla y se reintenta: se abre con "pnpm report"
    trace: 'on-first-retry',
    // La app está en español (fechas, moneda): el navegador también.
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  },
  // Lista en la terminal + reporte HTML que abres cuando quieras con "pnpm report"
  reporter: [['list'], ['html', { open: 'never' }]],
  retries: process.env.CI ? 1 : 0,
  projects: [
    // Semana 7: la sesión de un cliente se prepara UNA vez (por API) y la
    // reutilizan los tests que la necesitan con test.use({ storageState }).
    { name: 'setup', testMatch: /.*\.setup\.js/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
  ],
  // Playwright levanta el frontend (Vite, con su proxy hacia el backend en
  // http://localhost:8000). El backend (contra la BD de PRUEBAS) y Mailpit
  // los levantas tú antes: ver e2e/README.md. Se lanza vite con node, sin
  // pnpm de por medio, para que Playwright pueda detenerlo al terminar.
  webServer: {
    command: `node node_modules/vite/bin/vite.js --port ${port} --strictPort`,
    cwd: '../alecktourfrondend',
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
