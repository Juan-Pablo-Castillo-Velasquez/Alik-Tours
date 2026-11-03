/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

// Proxy de desarrollo: el frontend llama al API en su mismo origen
// (/api, /auth, /health, /uploads) y Vite lo reenvía al backend. Evita CORS
// en local y funciona en navegadores que bloquean peticiones a otro puerto.
// Dentro de Docker el backend es http://backend:8000 (docker-compose.yml);
// fuera de Docker, http://localhost:8000. En producción (Vercel) no aplica:
// ahí se usa VITE_API_BASE_URL.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:8000'
const apiProxy = Object.fromEntries(
  ['/api', '/auth', '/health', '/uploads', '/static'].map((ruta) => [ruta, { target: API_PROXY_TARGET, changeOrigin: true }]),
)

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // === CONFIGURACIÓN PARA DOCKER ===
  server: {
    host: true, // Permite que Docker exponga el puerto fuera del contenedor
    port: 5173, // Asegura que use el puerto fijo que expusiste en tu Dockerfile
    watch: {
      usePolling: true, // Fuerza a Vite a revisar cambios si estás en Windows/WSL con Docker
    },
    proxy: apiProxy,
  },

  // === PRUEBAS (Bootcamp Testing ADSO) ===
  // "pnpm test" corre Vitest UNA vez y mide la cobertura: si baja del
  // umbral, el comando falla (local y en CI). Ver docs/matriz-rotacion.md.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // El cliente HTTP arma las URLs con esta base: en los tests apunta a un
    // host falso que solo existe en los handlers de MSW (src/test/msw/).
    env: { VITE_API_BASE_URL: 'http://api.test' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Se mide la LÓGICA de la interfaz. Va entrando por capas, a medida
      // que el bootcamp llega a cada una, y nunca sale:
      // - Semana 1-2: lógica sin pantalla (utils, hooks y contextos).
      // - Semana 3: componentes con reglas (ruta protegida, filtros, pagos).
      // - Semana 5: el cliente HTTP (api/v1/api.ts), probado con MSW.
      include: [
        'src/app/utils/**',
        'src/app/hooks/**',
        'src/app/context/**',
        'src/app/components/ProtectedRoute.tsx',
        'src/app/components/shared/**',
        'src/app/components/payment/**',
        'src/app/api/**',
      ],
      // Fuera, con su porqué:
      // - src/app/components/ui/**: librería shadcn/ui generada, no es
      //   código propio (tampoco se lintea, ver eslint.config.js).
      // - pages/** y las pantallas grandes: se cubren con los E2E de /e2e.
      // - services/**: adaptadores HTTP de una línea por endpoint; su
      //   contrato lo prueban el backend (semana 4) y los E2E. La lógica
      //   común (errores, token, sesión vencida) está en api/v1/api.ts,
      //   que sí se mide desde la semana 5.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
      // Regla de trinquete: el umbral solo sube (docs/matriz-rotacion.md).
      // Semana 5: piso del 60%.
      thresholds: { lines: 60, branches: 60, functions: 60, statements: 60 },
    },
  },
})
