# Cómo ejecutar las pruebas, semana por semana

Guía del **Bootcamp Testing ADSO** sobre AlekTours: qué se probó cada semana
(de la 01 a la 09), quién lo hizo según la [matriz de rotación](../matriz-rotacion.md)
y el comando exacto para correr esas pruebas.

**Equipo:** Juan Pablo Castillo Velásquez (@Juan-Pablo-Castillo-Velasquez) ·
Fernando Gutiérrez (@Fervelop) · Cristian Sinisterra (@cristiansini-dev).
Las capas (Front, API, BD, E2E) rotan cada semana.

Cada semana tiene su rama: `test/semana-01` … `test/semana-09`. Todas las
pruebas también están en `main`, así que los comandos de abajo funcionan
desde `main` o desde la rama de la semana.

---

## 0. Preparación (una sola vez)

Requisitos: Node 22 con `pnpm` (`corepack enable`), Python 3.12 y Docker.

```bash
git clone https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours.git
cd Alik-Tours

# Frontend (Vitest)
cd alecktourfrondend && pnpm install && cd ..

# Backend (pytest)
cd backend && python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp -n .env.example .env            # configuración local (SECRET_KEY, correo...). Windows: copy .env.example .env
cd ..

# E2E (Playwright)
cd e2e && pnpm install && pnpm exec playwright install chromium && cd ..
```

### Los cuatro tipos de comando

| Capa | Comando para un archivo o varios | Suite completa (con umbral de cobertura) |
|---|---|---|
| **Front** | `cd alecktourfrondend && pnpm exec vitest run <archivos>` | `pnpm test` |
| **API / unitarias** | `cd backend && pytest <archivos> --no-cov` | `pytest` |
| **BD** (PostgreSQL real) | ver [Integración con PostgreSQL](#integración-con-postgresql-semanas-6-y-8) | `pytest tests/integration` |
| **E2E** | `cd e2e && pnpm exec playwright test <archivos>` | `pnpm test` |

`--no-cov` se usa al correr **unos pocos** archivos del backend: la cobertura
se exige sobre toda la suite, y con un subconjunto siempre "fallaría" el umbral.

Sin `backend/.env` el backend no arranca y `alembic`/`pytest tests/integration`
fallan con `ValidationError ... for Settings`: por eso el `cp` de arriba (es
lo mismo que hace el CI). Las variables que se exportan en los comandos de
abajo (`DATABASE_URL`, `MAIL_SERVER`...) tienen prioridad sobre ese archivo.

### Preparación de los E2E

Los E2E usan la app completa. Playwright levanta el frontend solo, pero el
backend, la BD de pruebas y Mailpit van en otra terminal:

```bash
docker compose -f docker-compose.test.yml up -d --wait   # PostgreSQL de pruebas (puerto 5433)
docker compose up -d mailpit                              # atrapa los correos (código de verificación)
cd backend
export DATABASE_URL=postgresql+psycopg2://alektours:alektours@localhost:5433/alektours_test
export MAIL_SERVER=localhost MAIL_PORT=1025
alembic upgrade head
uvicorn app.main:app --port 8000
```

En PowerShell: `$env:DATABASE_URL="postgresql+psycopg2://..."; $env:MAIL_SERVER="localhost"; $env:MAIL_PORT="1025"`.

Para ver el reporte con capturas y trazas de un fallo: `cd e2e && pnpm report`.

---

## Semana 01: arranque y primeros E2E

Se instaló Playwright, se midió la cobertura base (backend 47 %) y se creó
la matriz de rotación. Cada uno escribió su primer E2E.

| Integrante | Capa | Prueba |
|---|---|---|
| Juan Pablo | E2E | Login con credenciales inválidas muestra el error |
| Fernando | E2E | Filtro de paquetes sin resultados muestra aviso y se puede quitar |
| Cristian | E2E | Un invitado envía el formulario de contacto y ve la confirmación |

```bash
cd e2e
pnpm exec playwright test tests/login-credenciales-invalidas.spec.js \
  tests/paquetes-filtro-sin-resultados.spec.js tests/contacto-invitado.spec.js
```

## Semana 02: unitarias y CI con umbral

| Integrante | Capa | Prueba |
|---|---|---|
| Juan Pablo | Front | Validaciones, `normalizarTexto`, `localCache`, imágenes de ciudad y comprobante PDF |
| Fernando | API | Reglas de pago, transiciones de estado y validadores |
| Cristian | E2E / CI | Workflow `tests` con umbral de cobertura y evidencia individual; hooks `usePagination`, `useSeoMeta` y contraste WCAG |

```bash
# Front (Juan Pablo y Cristian)
cd alecktourfrondend
pnpm exec vitest run src/app/utils/validaciones.test.ts src/app/utils/normalizarTexto.test.ts \
  src/app/utils/localCache.test.ts src/app/utils/cityImages.test.ts src/app/utils/generarFacturaPdf.test.ts \
  src/app/hooks/usePagination.test.ts src/app/hooks/useSeoMeta.test.ts src/app/utils/contrasteWcag.test.ts

# API (Fernando)
cd ../backend
pytest tests/unit/test_reglas_de_pago.py tests/unit/test_validadores.py --no-cov
```

## Semana 03: componentes con reglas

| Integrante | Capa | Prueba |
|---|---|---|
| Juan Pablo | Front | `ProtectedRoute` por rol y sesión, `AuthContext` y el helper `renderWithProviders` |
| Fernando | Front | `CardPayment`, `PaymentSelector` y reglas de los formularios de pago |
| Cristian | Front | Filtros compartidos: `SearchInput`, `FilterChip`, `DateRangeFilter` |

```bash
cd alecktourfrondend
pnpm exec vitest run src/app/components/ProtectedRoute.test.tsx src/app/context/AuthContext.test.tsx \
  src/app/components/payment/CardPayment.test.tsx src/app/components/payment/PaymentSelector.test.tsx \
  src/app/components/payment/types.test.ts \
  src/app/components/shared/SearchInput.test.tsx src/app/components/shared/FilterChip.test.tsx \
  src/app/components/shared/DateRangeFilter.test.tsx
```

## Semana 04: API contra la BD aislada

| Integrante | Capa | Prueba |
|---|---|---|
| Cristian | API | CRUD de hoteles y habitaciones; seguridad (401/403) y contrato de errores |
| Fernando | BD | Duplicados, dependientes y filtro de disponibilidad según los datos guardados |
| Juan Pablo | Front | PSE, Nequi, PayPal y estado del pago (frontend al 50 %) |

```bash
cd backend
pytest tests/api/test_hoteles_api.py tests/api/test_seguridad_y_errores_api.py \
  tests/api/test_restricciones_de_datos_api.py tests/api/test_destinos_y_servicios_api.py --no-cov

cd ../alecktourfrondend
pnpm exec vitest run src/app/components/payment/MetodosAlternos.test.tsx
```

## Semana 05: dependencias externas con dobles

| Integrante | Capa | Prueba |
|---|---|---|
| Juan Pablo | BD | El repositorio y el correo como dependencias con dobles |
| Fernando | E2E | Estados difíciles con `page.route`: API caído, lista vacía, 422 |
| Cristian | Front | Cliente HTTP (`apiFetch`/`apiLogin`) con MSW: feliz, 500, 422 y respuesta no JSON |

```bash
cd backend
pytest tests/unit/test_dobles_repositorio.py tests/api/test_correo_como_dependencia.py --no-cov

cd ../alecktourfrondend
pnpm exec vitest run src/app/api/v1/api.test.ts

cd ../e2e
pnpm exec playwright test tests/estados-dificiles.spec.js
```

Inventario de dependencias externas: [`dependencias-externas.md`](dependencias-externas.md).

## Semana 06: PostgreSQL real

| Integrante | Capa | Prueba |
|---|---|---|
| Cristian | BD | BD de pruebas en Docker (`docker-compose.test.yml`) e integración de repositorios |
| Juan Pablo | API | Endpoints completos contra PostgreSQL real y límites de los esquemas |
| Fernando | Front | Handlers de MSW comparados con el backend real y `FavoritosContext` |

```bash
# Unitarias (sin BD)
cd backend
pytest tests/unit/test_limites_de_esquemas.py --no-cov

# Integración (necesita la BD de pruebas: ver la sección de PostgreSQL abajo)
pytest tests/integration/test_repositorio_hoteles_pg.py tests/integration/test_api_con_bd_real.py --no-cov

# Front
cd ../alecktourfrondend
pnpm exec vitest run src/app/api/v1/api.test.ts src/app/context/FavoritosContext.test.tsx
```

Comparación MSW vs. backend real: [`msw-vs-backend-real.md`](msw-vs-backend-real.md).

**Prueba de fuego:** en un equipo que no montó la BD, correr dos veces seguidas:
`docker compose -f docker-compose.test.yml down -v`, `up -d --wait`,
`alembic upgrade head` y `pytest tests/integration`.

## Semana 07: flujos críticos E2E

Semana de E2E para todos: sesión reutilizada, datos creados por API y código
de verificación leído desde Mailpit.

| Integrante | Capa | Prueba |
|---|---|---|
| Juan Pablo | E2E | Flujo "iniciar sesión" (feliz, sin verificar, clave equivocada, sesión reutilizada) y base de la suite; además backend al 75 % y tests de front |
| Fernando | E2E | Flujo "buscar destino y ver el hotel" |
| Cristian | E2E | Flujo "crear una cuenta" de punta a punta con el código del correo |

```bash
cd e2e
pnpm exec playwright test tests/flujo-iniciar-sesion.spec.js tests/flujo-buscar-hotel.spec.js tests/flujo-registro.spec.js

# Estabilidad antes de fusionar (5 repeticiones)
pnpm exec playwright test tests/flujo-buscar-hotel.spec.js --repeat-each=5

# Backend y front de la semana (Juan Pablo)
cd ../backend
pytest tests/api/test_cuentas_api.py tests/api/test_panel_admin_api.py --no-cov
cd ../alecktourfrondend
pnpm exec vitest run src/app/context/AuthModalContext.test.tsx src/app/hooks/useTemaGaleria.test.ts \
  src/app/utils/descargarTerminosPdf.test.ts src/app/utils/temaIconos.test.ts
```

## Semana 08: CI completo y 80 %

| Integrante | Capa | Prueba |
|---|---|---|
| Fernando | API | Ramas sin cubrir de reservas, paquetes, clientes y preferencias (backend 81 %); job de integración con PostgreSQL en el CI |
| Juan Pablo | Front | `TemaContext` (colores, favicon, caché y fallas) y caché del frontend en el CI |
| Cristian | E2E | Job de E2E en el CI (backend, PostgreSQL, Mailpit y Redis) y la 404 con salidas |

```bash
cd backend
pytest tests/api/test_clientes_y_empleados_api.py tests/api/test_paquetes_y_reservas_api.py \
  tests/api/test_preferencias_api.py --no-cov

cd ../alecktourfrondend
pnpm exec vitest run src/app/context/TemaContext.test.tsx

cd ../e2e
pnpm exec playwright test tests/rutas-inexistentes.spec.js
```

Los jobs del CI están en [`.github/workflows/tests.yml`](../../.github/workflows/tests.yml):
`frontend`, `backend`, `integracion`, `e2e` y `evidencia-individual`.

## Semana 09: cierre del trimestre

Se corre **todo**, dos veces seguidas y sin reintentos, y se escribe la estrategia.

| Integrante | Aporte |
|---|---|
| Fernando | Estrategia, secciones 1 y 2 (riesgos y qué prueba cada capa) |
| Juan Pablo | Estrategia, secciones 3, 4 y 7; cierre en la matriz |
| Cristian | Estrategia, secciones 5 y 6 (CI, umbrales y hallazgos) |

```bash
# Suite completa con umbrales (frontend ≥ 80 %, backend ≥ 81 %)
cd alecktourfrondend && pnpm test
cd ../backend && pytest
cd ../e2e && pnpm test
```

Documento final: [`docs/estrategia-pruebas.md`](../estrategia-pruebas.md).

---

## Integración con PostgreSQL (semanas 6 y 8)

Los tests de `backend/tests/integration/` se saltan si no existe
`TEST_DATABASE_URL`. Siempre contra la BD de **pruebas** (puerto 5433),
nunca la de desarrollo:

```bash
docker compose -f docker-compose.test.yml up -d --wait
cd backend
export DATABASE_URL=postgresql+psycopg2://alektours:alektours@localhost:5433/alektours_test
export TEST_DATABASE_URL=$DATABASE_URL
alembic upgrade head
pytest tests/integration
cd .. && docker compose -f docker-compose.test.yml down -v   # apagar y dejarla vacía
```

## Si algo falla

- **Front:** `pnpm exec vitest` (modo observación) para iterar sobre un archivo.
- **Backend:** agrega `-x -vv` para parar en el primer error y ver el detalle.
- **E2E:** `pnpm exec playwright test <archivo> --headed` para ver el navegador,
  o `pnpm test:ui` para depurar paso a paso; luego `pnpm report`.
- **E2E que no encuentra datos:** revisa que el backend esté arriba en el
  puerto 8000, conectado a la BD de pruebas, y que Mailpit esté corriendo.
