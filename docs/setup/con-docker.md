# Setup con Docker — AlecTours

> **Modo recomendado para:** demostraciones, pruebas rápidas, entornos de clase.

Con Docker Compose, todos los servicios corren en contenedores:

| Servicio | Qué es | Puerto |
|---|---|---|
| `postgres` | PostgreSQL 16 | 5432 |
| `backend` | FastAPI + Uvicorn | 8000 |
| `frontend` | React + Vite | 5173 |
| `pgadmin` | Administración de BD | 5050 |
| `mailpit` | Servidor SMTP local + Web UI | 8025 / 1025 |
| `redis` | Cache + rate limiting | 6379 |

---

## Prerrequisitos

| Herramienta | Versión mínima | Verificar con |
|---|---|---|
| Docker | 24+ | `docker --version` |
| Docker Compose | 2.20+ | `docker compose version` |
| Git | 2.40+ | `git --version` |

> **Windows**: Docker Desktop requiere WSL2 habilitado.

---

## Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/Juan-Pablo-Castillo-Velasquez/proyectoalectoursDocker.git
cd proyectoalectoursDocker
```

---

## Paso 2 — Variables de entorno (no requiere ningún paso manual)

`backend/.env.example` ya está versionado en el repositorio con valores
por defecto seguros para desarrollo local, y `docker-compose.yml` lo
carga automáticamente. **No es necesario crear ni editar ningún
archivo** para levantar el proyecto — pasá directo al Paso 3.

Valores por defecto (para referencia; ver `backend/.env.example` para la
lista completa):

```env
DATABASE_URL=postgresql+psycopg2://admin:admin123@postgres:5432/alektours_db
SECRET_KEY=change_this_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
MAIL_USERNAME=your_email@example.com
MAIL_PASSWORD=your_password
MAIL_FROM=noreply@alectours.com
MAIL_PORT=1025
MAIL_SERVER=mailpit
MAIL_FROM_NAME=AlecTours
MAIL_STARTTLS=False
MAIL_SSL_TLS=False
REDIS_URL=redis://redis:6379/0
```

> Dentro de Docker, la BD se llama `postgres` (nombre del servicio), no `localhost`.

Si necesitás sobreescribir algún valor (por ejemplo, credenciales reales
de un proveedor de correo) sin tocar un archivo versionado, creá
`backend/.env` — es opcional y sus valores tienen prioridad sobre los
de `.env.example`:

```bash
cp backend/.env.example backend/.env
# editar backend/.env con tus propios valores
```

---

## Paso 3 — Levantar todos los servicios

```bash
docker compose up --build
```

La primera vez tarda más porque descarga las imágenes base y construye
el backend/frontend. Al arrancar, el backend aplica automáticamente las
migraciones de Alembic (incluyendo los datos semilla) — no hace falta
ningún comando adicional.

Para levantarlo en segundo plano: `docker compose up --build -d`.

Verificar que todos los contenedores están corriendo:

```bash
docker compose ps
```

Deberías ver algo así:

```
NAME              IMAGE                    STATUS
postgres_db       postgres:16              Up (healthy)
fastapi_backend   ...                      Up
react_frontend    ...                      Up
pgadmin           dpage/pgadmin4           Up
mailpit           axllent/mailpit          Up
redis_cache       redis:7-alpine           Up
```

---

## Paso 4 — Verificar que todo funciona

| URL | Qué muestra |
|---|---|
| http://localhost:5173 | Frontend (landing page) |
| http://localhost:8000/docs | Swagger UI del backend |
| http://localhost:8000/redoc | ReDoc del backend |
| http://localhost:5050 | pgAdmin |
| http://localhost:8025 | Mailpit (bandeja de emails) |

### Credenciales de prueba

| Usuario | Email/Username | Contraseña | Rol |
|---|---|---|---|
| Admin | `admin@alektours.com` | `Admin1234!` | admin |
| Cliente | `juanp` | `Cliente1234!` | cliente |
| Cliente | `mariag` | `Cliente1234!` | cliente |

---

## Paso 5 — Comandos útiles del día a día

```bash
# Ver logs
docker compose logs -f              # todos los servicios
docker compose logs -f backend      # solo backend
docker compose logs -f frontend     # solo frontend
docker compose logs -f postgres     # solo PostgreSQL

# Detener y reiniciar
docker compose stop                 # detiene (conserva datos)
docker compose start                # vuelve a iniciar
docker compose restart backend      # reinicia solo backend

# Reconstruir (cuando cambias código)
docker compose up --build -d        # reconstruye + levanta

# Limpiar
docker compose down                 # elimina contenedores (datos persisten)
docker compose down -v              # elimina contenedores + volúmenes (¡borra datos!)

# Ejecutar comandos dentro de un contenedor
docker compose exec backend bash
docker compose exec postgres psql -U admin -d alektours_db

# Migraciones (alembic upgrade head ya corre solo al arrancar el backend)
docker compose exec backend alembic current
docker compose exec backend alembic history
docker compose exec backend alembic revision --autogenerate -m "descripcion"
```

---

## Producción

Para despliegue real, usar el compose de producción:

```bash
# Completar backend/.env con valores reales de producción
# Exportar variables de PostgreSQL (no usar defaults de dev)
docker compose -f docker-compose.prod.yml up -d --build
```

Diferencias con dev:
- Backend usa stage `prod` (non-root user, 4 workers, healthcheck)
- PostgreSQL y Redis sin exposición de puerto al host
- Sin Mailpit ni pgAdmin
- Frontend desplegado en Vercel (no Docker)

> ⚠️ **Antes de exponer un despliegue real a internet:** las migraciones
> siembran un usuario admin de demo (`admin@alektours.com` /
> `Admin1234!`, ver `backend/alembic/versions/a7c3e9f21b04_...py`) y
> varios clientes/usuarios de prueba con la misma contraseña genérica.
> Son intencionalmente públicos en este repositorio para que cualquiera
> pueda levantar el proyecto y probarlo — **rotar esas contraseñas (o
> desactivar/eliminar esas cuentas) es obligatorio antes de que el
> despliegue sea accesible por gente fuera de tu equipo.** Además,
> `SECRET_KEY` y las credenciales de `backend/.env.example` son valores
> de desarrollo conocidos — completá `backend/.env` con valores reales
> y nunca los versiones.

---

## Solución de problemas

### Backend arranca y se cae

```bash
docker compose logs backend
# Causas comunes: postgres todavía no está "healthy" (docker compose ps),
# o un valor inválido en backend/.env si creaste uno para sobreescribir
# los defaults de backend/.env.example.
```

### Puerto ya en uso

```bash
# Ver qué usa el puerto (ej: 5432)
netstat -ano | findstr :5432
# Cambiar puerto en docker-compose.yml o cerrar el proceso
```

### Emails no aparecen en Mailpit

```bash
# Verificar que MAIL_SERVER=mailpit (backend/.env.example, o backend/.env si creaste uno)
grep MAIL_SERVER backend/.env.example
# Verificar que Mailpit está corriendo
docker compose ps mailpit
```

### Reset total

```bash
docker compose down -v
docker system prune -f
docker compose up --build -d
# Las migraciones y los datos semilla se vuelven a aplicar solos al arrancar el backend.
```

## Datos de prueba para reseñas y comunidad (opcional)

Para probar las reseñas, los testimonios del inicio y la comunidad con contenido, con los contenedores levantados:

```bash
docker compose exec backend python scripts/seed_demo_comunidad.py          # contenido de ejemplo (etiqueta "Ejemplo"): 50 publicaciones y 18 reseñas; también desde el panel, en Comunidad
docker compose exec backend python scripts/seed_demo_comunidad.py --borrar # las quita
```

Usa los clientes que ya existan en tu base local. **No corre contra producción** (se niega si `DATABASE_URL` es de Neon o `ENTORNO=produccion`): en el sitio real, las reseñas y publicaciones solo pueden venir de clientes reales.
