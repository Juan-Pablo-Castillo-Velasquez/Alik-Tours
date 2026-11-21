# 4. Variables de entorno y despliegue

Producción: **frontend en Vercel**, **backend en Render (Docker)**, **PostgreSQL
en Neon**, **Redis en Upstash**, imágenes en **Cloudinary** y correo por la API
de **Brevo**. Guía paso a paso: [`despliegue-produccion-servicios-gestionados.md`](../referencia-tecnica/despliegue-produccion-servicios-gestionados.md);
alternativa en un VPS: [`despliegue-produccion.md`](../referencia-tecnica/despliegue-produccion.md).

## 4.1 Entornos

| Entorno | Base de datos | Dónde corre | Para qué |
|---|---|---|---|
| Desarrollo | PostgreSQL de `docker-compose.yml` (puerto 5432) | Equipo de cada integrante | Programar |
| Pruebas | SQLite en memoria (pytest) y PostgreSQL **separado** de `docker-compose.test.yml` (puerto **5433**, base `alektours_test`, sin volumen) | Local y GitHub Actions | Pruebas automáticas; nunca toca datos de desarrollo |
| Producción | Neon | Render + Vercel | Usuarios reales |

## 4.2 Variables del backend (Render → Environment)

| Variable | Obligatoria | Ejemplo / formato | Para qué |
|---|---|---|---|
| `DATABASE_URL` | Sí | `postgresql+psycopg2://usuario:clave@ep-xxx.neon.tech/neondb?sslmode=require` | Conexión a PostgreSQL |
| `SECRET_KEY` | Sí | 48+ caracteres aleatorios (`secrets.token_urlsafe(48)`) | Firma de JWT; menos de 32 caracteres no arranca |
| `ALGORITHM` | Sí | `HS256` | Algoritmo del JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Sí | `30` | Vigencia del token |
| `MAIL_SERVER`, `MAIL_PORT`, `MAIL_FROM`, `MAIL_FROM_NAME` | Sí | `smtp-relay.brevo.com`, `587`, remitente verificado | Correos (verificación, comprobantes) |
| `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_STARTTLS`, `MAIL_SSL_TLS` | Según proveedor | — | Credenciales SMTP |
| `BREVO_API_KEY` | En Render gratis, sí | clave de API de Brevo | Render bloquea SMTP saliente: se envía por HTTPS |
| `REDIS_URL` | No | `rediss://default:clave@xxx.upstash.io:6379` | Caché y límite de intentos (sin Redis: memoria) |
| `CORS_ORIGINS` | Sí en producción | `https://alik-tours.vercel.app` | Orígenes permitidos (las previews de Vercel se aceptan por patrón) |
| `FRONTEND_URL` | Sí en producción | `https://alik-tours.vercel.app` | Enlaces de los correos |
| `CLOUDINARY_URL` | No | `cloudinary://KEY:SECRET@CLOUD` | Imágenes (sin ella, disco local) |
| `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` | No | DSN de Sentry, `0.1` | Monitoreo de errores |
| `CONFIAR_PROXY` | No | `true` | IP real detrás del proxy de Render para el límite de intentos |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_RECYCLE` | No | `5`, `5`, `300` | Pool de conexiones (Neon cierra conexiones inactivas) |
| `RATE_LIMIT_MULTIPLIER`, `CACHE_ENABLED`, `SQL_ECHO` | No | `1`, `true`, `false` | Ajustes de pruebas y depuración |

## 4.3 Variables del frontend (Vercel → Settings → Environment Variables)

| Variable | Ejemplo | Para qué |
|---|---|---|
| `VITE_API_BASE_URL` | `https://alectours-backend.onrender.com` | URL del backend. Vite la incrusta al construir: si cambia, hay que volver a desplegar |

`vercel.json` define las reescrituras de la SPA y las cabeceras de seguridad
(CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

## 4.4 Cómo se despliega

1. **Backend:** Render construye `backend/Dockerfile` (etapa `prod`: usuario
   no root, 4 workers, `HEALTHCHECK` contra `/health`) y al arrancar corre
   `alembic upgrade head`. Cada push a `main` despliega solo.
2. **Frontend:** Vercel construye `alecktourfrondend` (`pnpm build`) en cada
   push a `main`; cada PR tiene su URL de vista previa.
3. **Antes de llegar a `main`:** GitHub Actions corre lint (Ruff, ESLint),
   formato, pruebas con umbral de cobertura, integración con PostgreSQL 16,
   E2E con Playwright, build de Docker y auditoría de dependencias.
4. **Mantener despierto:** `mantener-backend-activo.yml` llama `/health`
   periódicamente (el plan gratis de Render duerme tras 15 min).

## 4.5 Verificación después de desplegar

```bash
curl -s https://<backend>/health          # {"status":"ok",...}
curl -s https://<backend>/api/vuelos/buscar?destino=cartagena | head -c 200
```

Y en el navegador: abrir el sitio, iniciar sesión y revisar que la consola no
muestre errores de CORS.
