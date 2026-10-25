# Frontend — AlecTours

Aplicación web SPA para la plataforma de gestión turística AlecTours.

---

## Stack

| Tecnología | Versión | Propósito |
|---|---|---|
| React | 18.3.1 | Framework UI |
| TypeScript | — | Tipado estático |
| Vite | 6.3.5 | Build tool + dev server |
| Tailwind CSS | 4.1.12 | Utility-first CSS |
| shadcn/ui | — | Componentes base (Radix UI) |
| MUI | 7.3.5 | Componentes admin |
| react-router | 7.13.0 | Enrutamiento SPA |
| react-hook-form | 7.55 | Formularios |
| motion (Framer Motion) | 12.23 | Animaciones |
| Recharts | 2.15 | Gráficas |
| jsPDF | 4.2 | Generación PDF |
| Sonner | 2.0 | Toast notifications |
| lucide-react | 0.487 | Icons |

---

## Setup

```bash
# Instalar dependencias
pnpm install

# Variables de entorno
cp .env.example .env
# Editar VITE_API_BASE_URL si es necesario (default: http://localhost:8000)

# Iniciar dev server
pnpm dev
```

Acceder a http://localhost:5173

---

## Estructura

```
alecktourfrondend/src/
├── main.tsx              ← Entry point
├── app/
│   ├── App.tsx           ← RouterProvider
│   ├── routes.tsx        ← Definición de rutas
│   ├── layouts/
│   │   └── RootLayout.tsx
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   ├── FavoritosContext.tsx
│   │   └── AuthModalContext.tsx
│   ├── api/v1/
│   │   └── api.ts          ← apiFetch(), apiLogin()
│   ├── services/           ← 22 módulos de servicio
│   ├── pages/              ← 24 páginas
│   ├── components/
│   │   ├── ui/             ← 42 componentes shadcn/ui
│   │   ├── admin/          ← 18 componentes admin
│   │   ├── profile/        ← Perfil con tabs
│   │   ├── payment/        ← 6 componentes de pago
│   │   └── hotel/          ← CalendarioOcupacion
│   ├── hooks/              ← useSeoMeta, usePagination
│   ├── utils/              ← localCache, generarFacturaPdf
│   └── data/               ← Tipos estáticos
├── src/styles/
│   ├── theme.css           ← Design system (light/dark)
│   ├── tailwind.css        ← Config Tailwind
│   └── index.css           ← Master CSS
├── public/                 ← Assets estáticos
├── index.html              ← SEO meta tags, Open Graph, JSON-LD
├── vite.config.ts
├── Dockerfile              ← Dev (Node 22 Alpine)
├── Dockerfile.prod         ← Prod multi-stage (nginx)
└── nginx.conf              ← SPA routing, asset caching
```

---

## Páginas principales

| Ruta | Descripción |
|---|---|
| `/` | Landing page (hero, destinos, ofertas, testimonios) |
| `/search` | Búsqueda de hoteles/paquetes con filtros |
| `/hotel/:id` | Detalle de hotel (habitaciones, reseñas, calendario) |
| `/package/:id` | Detalle de paquete turístico |
| `/checkout/:id` | Checkout multistep con selector de pago |
| `/profile` | Perfil con tabs (Reservas, Favoritos, Cuenta, Preferencias) |
| `/admin` | Panel admin completo (Dashboard, Reservas, Hoteles, etc.) |

---

## Design System

- **Primary**: `#6e1832` (granate) — botones, links, acentos
- **Gold**: `#b8912e` — badges premium, estrellas
- **Dark mode**: Toggle con persistencia en localStorage
- **Fuentes**: Playfair Display (títulos) + Inter (body)

---

## Docker

**Dev**: Node 22 Alpine con Vite dev server (hot-reload).

**Prod**: Multi-stage build → Vite build → nginx 1.27 Alpine con SPA routing y asset caching.

---

## Deploy

- **Frontend**: Vercel (`https://alik-tours.vercel.app/`)
- **Backend**: Docker en servidor propio

---

## Paquete name

El `package.json` tiene `"name": "@figma/my-make-file"` (origen del proyecto Figma Make). Esto es cosmético y no afecta la funcionalidad.
