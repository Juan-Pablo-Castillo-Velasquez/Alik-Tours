# Plan de despliegue — servicios separados (DB / Backend / Vercel)

Alternativa a `despliegue-produccion.md` (todo junto en un VPS): aquí la base de datos, el backend y el frontend viven en tres proveedores distintos, cada uno especializado en lo suyo. Ventaja principal: no necesitas administrar un servidor tú mismo (parches, Docker, TLS a mano) — cada proveedor se encarga de su parte. Precios y límites verificados en septiembre 2026 directo en la documentación oficial de cada proveedor, para no dar datos viejos.

## Resumen de la arquitectura

| Pieza | Dónde | Costo |
|---|---|---|
| Base de datos (Postgres) | Neon | Gratis (permanente, sin tarjeta) |
| Redis (caché) | Upstash | Gratis (permanente, sin tarjeta) |
| Backend (FastAPI) | Render (Docker) | Gratis, o Railway (~$5/mes) si no quieres que "duerma" |
| Frontend (React/Vite) | Vercel | Gratis (plan Hobby) |

Todo esto ya lo soporta el código tal como está — no hace falta escribir nada nuevo, solo configurar variables de entorno correctamente. Verificado leyendo `backend/app/core/database.py`, `backend/app/core/cache.py`, `backend/app/core/config.py`, `backend/app/main.py` y `backend/Dockerfile`.

---

## Paso 1 — Base de datos: Neon (Postgres)

Por qué Neon y no otra: es la única opción gratis que no expira ni se borra sola (a diferencia de Render, cuya base de datos gratis se borra a los 30-44 días). Límite real: 0.5 GB de almacenamiento y 100 horas de cómputo al mes, con la base "durmiéndose" tras 5 minutos sin uso (el primer query después de eso tarda un poco más en responder). Para el tamaño de datos de AlecTours hoy, 0.5 GB alcanza de sobra.

1. Crea cuenta en neon.com (sin tarjeta).
2. Crea un proyecto nuevo → te da un connection string tipo:
   ```
   postgresql://usuario:clave@ep-xxxxx-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. El backend usa el driver `psycopg2`, así que solo cambia el prefijo — esto es lo que vas a poner como `DATABASE_URL`:
   ```
   postgresql+psycopg2://usuario:clave@ep-xxxxx-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   El `?sslmode=require` es obligatorio con Neon, no lo quites.
4. No necesitas crear las tablas a mano — las migraciones de Alembic corren solas al arrancar el backend (ver Paso 3).

---

## Paso 2 — Redis: Upstash

Gratis y permanente también: 256 MB, 500 mil comandos al mes, 10 GB de banda ancha. AlecTours cachea listados de hoteles/reservas/paquetes con TTLs cortos (60s a 30 min), así que el uso real de comandos debería quedar lejos del límite salvo tráfico muy alto.

1. Crea cuenta en upstash.com (sin tarjeta).
2. Crea una base Redis nueva → elige la región más cercana a donde vaya a estar tu backend (si usas Render en us-east, elige Upstash en us-east también, para menos latencia).
3. Copia el connection string en formato Redis nativo (no la API REST) — se ve así:
   ```
   rediss://default:TU_CLAVE@tu-base.upstash.io:6379
   ```
   El backend usa `redis.Redis.from_url()`, que soporta `rediss://` (con TLS) directo, sin tocar código.
4. Esto va como `REDIS_URL` en el Paso 3.

---

## Paso 3 — Backend: Render (Docker, gratis)

Render construye la imagen directo desde `backend/Dockerfile`, usando el stage `prod` que ya existe (sin `--reload`, con 4 workers, usuario no-root, healthcheck real contra `/health`). Al arrancar, el propio contenedor corre `alembic upgrade head` solo — no tienes que ejecutar migraciones a mano ni desde Render.

**El límite real a tener en cuenta:** el plan gratis de Render "duerme" el servicio tras 15 minutos sin tráfico, y la siguiente petición tarda ~1 minuto en responder mientras despierta. Para un proyecto de portafolio/demo está bien; si quieres que el backend esté siempre despierto (por ejemplo, para una demo en vivo importante), la alternativa es Railway (~$5/mes de uso, sin ese "dormir").

### Con Render (gratis)

1. Crea cuenta en render.com y conecta tu cuenta de GitHub, dale acceso al repo `proyectoalectoursDocker`.
2. "New" → "Web Service" → selecciona el repo.
3. Root Directory: `backend` (el Dockerfile vive ahí, no en la raíz del repo).
4. Runtime: Docker. Render detecta el `Dockerfile` solo — en "Docker Build Context Directory" deja `backend`, y en el Dockerfile target, si te lo pide, pon `prod` (si Render no te deja elegir el stage, puedes forzarlo agregando `--target prod` en la configuración avanzada del build, o duplicar temporalmente un `Dockerfile` solo con el stage prod — dime si te pide esto y lo resolvemos juntos).
5. Plan: Free.
6. En "Environment Variables" agrega todas las de `backend/.env.example`, con los valores reales:
   ```
   DATABASE_URL=postgresql+psycopg2://usuario:clave@ep-xxxxx.neon.tech/neondb?sslmode=require
   REDIS_URL=rediss://default:TU_CLAVE@tu-base.upstash.io:6379
   SECRET_KEY=<genera una con: python3 -c "import secrets; print(secrets.token_urlsafe(48))">
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   MAIL_USERNAME=xxxxx@smtp-brevo.com
   MAIL_PASSWORD=<tu SMTP key de Brevo>
   MAIL_FROM=<el correo que verificaste en Brevo>
   MAIL_PORT=587
   MAIL_SERVER=smtp-relay.brevo.com
   MAIL_FROM_NAME=AlecTours
   MAIL_STARTTLS=True
   MAIL_SSL_TLS=False
   BREVO_API_KEY=<tu API key de Brevo, empieza con "xkeysib-" -- OBLIGATORIA en Render Free, ver nota abajo>
   FRONTEND_URL=https://tu-proyecto.vercel.app
   CORS_ORIGINS=https://tu-proyecto.vercel.app
   CLOUDINARY_URL=cloudinary://...   (opcional)
   ```
   ⚠️ **`BREVO_API_KEY` no es opcional en el plan Free de Render.** Confirmado en el changelog oficial de Render: desde el 26 de septiembre de 2025, los servicios web gratis no pueden abrir conexiones salientes a los puertos SMTP (25, 465, 587) — así que `MAIL_SERVER=smtp-relay.brevo.com` de arriba nunca va a conectar en este plan, sin importar qué tan bien puestas estén las credenciales. `BREVO_API_KEY` hace que el backend mande los correos por la API HTTPS de Brevo (puerto 443, nunca bloqueado) en vez de por SMTP — mismo remitente, mismo proveedor, sin dar de alta nada nuevo. Es una credencial DISTINTA a `MAIL_PASSWORD`: se genera en Settings → SMTP y API → pestaña **"API Keys"** (no la pestaña "SMTP"). Detalle completo en `backend/.env.example`.

   Brevo es el proveedor de correo real que usa este proyecto (plan gratis, sin
   tarjeta, 300 correos/día — de sobra para verificación de cuenta, reset
   de contraseña y confirmaciones de reserva). Cualquier otro proveedor SMTP
   (Gmail, SendGrid) funciona igual para las variables `MAIL_*` sin tocar
   código, pero ninguno tiene un equivalente a `BREVO_API_KEY` en este
   proyecto — si cambias de proveedor y te quedas en Render Free, sigues
   necesitando una salida por HTTPS en su lugar.
7. Deploy. Render te da una URL tipo `https://alectours-backend.onrender.com` — ese es tu `VITE_API_BASE_URL` para el Paso 4.
8. Sobre las fotos/comprobantes/banners subidos en runtime: el plan free de Render no tiene disco persistente, así que cualquier archivo guardado en `app/static/uploads` se perdería si el contenedor se reinicia. Como ya tienes `CLOUDINARY_URL` soportado en el código (`backend/app/core/config.py`), en este escenario SÍ te conviene definirlo — así las imágenes se van a Cloudinary en vez de al disco del contenedor.

### Rendimiento: caché y servicio despierto

- **Servicio despierto (configurar una vez):** crea un monitor gratuito en [UptimeRobot](https://uptimerobot.com) o [cron-job.org](https://cron-job.org) que haga `GET https://<tu-backend>.onrender.com/health` cada 5 minutos. Es lo que de verdad evita el arranque en frío: los cron gratuitos de GitHub se ejecutan con retrasos de horas (en noviembre de 2026 corrió 2 veces en un día y encontró el backend dormido). El monitor además te avisa por correo si el backend se cae.
- **Respaldo:** el flujo `.github/workflows/mantener-backend-activo.yml` consulta `/health` cada 10 minutos para que Render no duerma el backend (y la conexión a Neon quede caliente). Un solo servicio despierto todo el mes (~744 h) cabe en las 750 horas gratis de Render. Si la URL del backend cambia, defínela en GitHub › Settings › Secrets and variables › Actions › **Variables** como `BACKEND_URL`.
- **Caché de dos niveles** (`backend/app/core/cache.py`): memoria del proceso (L1, 20 s) + Redis/Upstash (L2, TTL de cada endpoint). Si Upstash falla, se deja de intentar por 30 s y el sitio sigue funcionando con la base de datos. Variables opcionales:

  | Variable | Por defecto | Para qué |
  | --- | --- | --- |
  | `CACHE_ENABLED` | `true` | `false` apaga todo el caché (depurar). |
  | `CACHE_LOCAL_TTL` | `20` | Segundos máximos en memoria local (0 = sin L1). |
  | `CACHE_LOCAL_MAX` | `500` | Claves máximas en memoria por worker. |
  | `CACHE_TTL_FACTOR` | `1.0` | Multiplica todos los TTL (ej. `2` = el doble de tiempo en caché). |
  | `REDIS_REINTENTO_SEGUNDOS` | `30` | Pausa antes de volver a intentar Redis tras un fallo. |
  | `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `5` / `5` | Conexiones a Neon por worker. |
  | `DB_POOL_RECYCLE` | `280` | Segundos antes de renovar una conexión (Neon corta las inactivas). |

- **Respuestas comprimidas** con GZip y **caché de 60 s en el navegador** para el catálogo (`apiFetch` en `alecktourfrondend/src/app/api/v1/api.ts`): volver a una página ya vista es instantáneo y cualquier guardado desde el panel lo vacía.

### Alternativa: Railway (sin "dormir", ~$5/mes)

Mismo Dockerfile, mismo target `prod`, mismas variables de entorno. La diferencia es que Railway sí ofrece disco persistente si lo necesitas, y el servicio no se duerme por inactividad. El plan Hobby da $5 de uso incluido al mes — para una app con tráfico bajo/moderado normalmente no pasas de eso. Ventaja adicional sobre Render Free: Railway no bloquea los puertos SMTP salientes, así que `BREVO_API_KEY` es opcional aquí (podés quedarte solo con las variables `MAIL_*` de SMTP tal cual, aunque dejar `BREVO_API_KEY` puesta tampoco hace daño).

1. railway.com → "New Project" → "Deploy from GitHub repo".
2. Selecciona el repo, y en la configuración del servicio pon Root Directory `backend` y Dockerfile target `prod`.
3. Mismas variables de entorno que arriba.
4. Railway te da su propia URL pública para usar como `VITE_API_BASE_URL`.

---

## Paso 4 — Frontend: Vercel

1. vercel.com → "Add New Project" → importa `Juan-Pablo-Castillo-Velasquez/proyectoalectoursDocker`.
2. Root Directory: `alecktourfrondend`.
3. Framework: Vite (Vercel lo detecta solo).
4. Environment Variables:
   ```
   VITE_API_BASE_URL=https://alectours-backend.onrender.com
   ```
   (la URL real que te dio Render o Railway en el Paso 3 — sin esta variable, el build usa `http://localhost:8000` y no sirve en producción).
5. Deploy. Vercel te da `tu-proyecto.vercel.app` gratis (plan Hobby, gratis de forma permanente para proyectos personales/no comerciales).
6. Vuelve al Paso 3 y actualiza `FRONTEND_URL`/`CORS_ORIGINS` del backend con esta URL real de Vercel (si la pusiste como placeholder antes).

Cada `git push` a `main` después de esto, Vercel redespliega el frontend solo.

---

## Orden recomendado para hacerlo sin trabarte

1. Neon primero (Paso 1) — necesitas el connection string antes de tocar el backend.
2. Upstash (Paso 2) — igual, antes del backend.
3. Backend en Render/Railway (Paso 3) — con los dos connection strings ya en mano. Verifica que levantó bien antes de seguir:
   ```
   curl https://tu-backend.onrender.com/health
   ```
4. Frontend en Vercel (Paso 4) — con la URL real del backend ya funcionando.
5. Vuelve al backend y actualiza `FRONTEND_URL`/`CORS_ORIGINS` con la URL real de Vercel, y vuelve a desplegar el backend para que tome el cambio (en Render/Railway esto normalmente es un botón "Redeploy", no hace falta tocar código).

## Qué falta decidir de tu lado

- Proveedor SMTP: este proyecto ya usa Brevo (ver Paso 3) — solo hace falta crear tu propia cuenta gratis y tu propio remitente verificado, no hay nada más que decidir salvo que prefieras otro proveedor (Gmail, SendGrid) en su lugar.
- Si usas el plan free de Render (sin disco persistente), definir `CLOUDINARY_URL` para que las fotos/banners no se pierdan en cada reinicio.
- Si en algún momento el tráfico crece y el "dormir" de Render se vuelve molesto, migrar el backend a Railway es solo cambiar de plataforma — el Dockerfile y las variables de entorno son las mismas.
