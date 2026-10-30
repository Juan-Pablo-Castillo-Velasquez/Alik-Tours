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
// (/api, /auth, /health, /static) y Vite lo reenvía al backend. Evita CORS
// en local y funciona en navegadores que bloquean peticiones a otro puerto.
// Dentro de Docker el backend es http://backend:8000 (docker-compose.yml);
// fuera de Docker, http://localhost:8000. En producción (Vercel) no aplica:
// ahí se usa VITE_API_BASE_URL.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:8000'
const apiProxy = Object.fromEntries(
  ['/api', '/auth', '/health', '/static'].map((ruta) => [ruta, { target: API_PROXY_TARGET, changeOrigin: true }]),
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
})