# Matriz de rotación de capas

**Grupo**: AlekTours · **Ficha**: _número_ · **Stack**: React (Vite + TypeScript) + FastAPI + PostgreSQL 16

Capas: **Front** (React) · **API** (backend) · **BD** (integración) · **E2E** (Playwright)

Reglas:

- Cada semana cambias de capa. No repites capa hasta haber pasado por las cuatro.
- En la columna escribe la capa y, al cerrar la semana, el enlace a tu PR de tests.
- Quien revisa tu PR debe haber trabajado en otra capa esa semana.
- Grupo de 3: cada semana de rotación queda una capa sin dueño. Se eligió cuál
  según lo que pide el reto de esa semana (ver "Por qué esta rotación").

| Integrante (usuario GitHub) | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 |
|---|---|---|---|---|---|---|---|---|---|
| Juan Pablo Castillo (@Juan-Pablo-Castillo-Velasquez) | E2E: login con credenciales inválidas | Front | Front: `ProtectedRoute` (+ backend al 40%) | E2E | BD | API | E2E: iniciar sesión (+ backend al 75%) | Front | Todas |
| Fernando Gutiérrez (@Fervelop) | E2E: filtro de paquetes sin resultados | API | Front: `CardPayment` | BD | E2E | Front | E2E: buscar y ver un hotel | API | Todas |
| Cristian Sinisterra (@cristiansini-dev) | E2E: mensaje de contacto como invitado | E2E (CI) | Front: `Newsletter` y filtros compartidos | API | Front | BD | E2E: registro de cuenta | E2E | Todas |

### Por qué esta rotación

| Semana | Capas en juego | Capa sin dueño y por qué |
|---|---|---|
| S2 | Front, API, E2E | BD: el reto dice que en grupos de 3 queda para la semana siguiente |
| S4 | API, BD, E2E | Front: esa semana el frontend no tiene tareas nuevas (lo dice el reto) |
| S5 | Front, BD, E2E | API: el reto exige MSW en el front y `page.route` en E2E; la dependencia externa del backend (correo) la cubre la capa BD con el repositorio y la capa E2E con el API caído |
| S6 | Front, API, BD | E2E: la semana 7 es E2E para todos y ahí se hace la suite independiente de datos |
| S8 | Front, API, E2E | BD: el servicio de PostgreSQL y las migraciones del job de integración los hace la capa API |

Entre S2 y S6 cada integrante pasa por las cuatro capas: Juan Pablo (Front → E2E → BD → API),
Fernando (API → BD → E2E → Front), Cristian (E2E → API → Front → BD).

## Cobertura semanal

Anota la cobertura real al cerrar cada semana. El umbral de la semana siguiente es el mayor entre el piso del plan y este valor, redondeado hacia abajo.

| Semana | Frontend (%) | Backend (%) | Umbral configurado para la semana siguiente |
|---|---|---|---|
| S1 (línea base) | 0 (aún no hay tests de frontend) | 47 | Front 30 · Back 47 |
| S2 | _anotar el % de líneas de `pnpm test`_ | 47 | Front 30 · Back 47 |
| S3 | _anotar_ (entran ProtectedRoute, shared y payment) | 47 | Front 40 · Back 47 |
| S4 | _anotar_ (sin tareas nuevas de front) | 70 | Front 50 · Back 70 |
| S5 | _anotar_ (entra api/v1/api.ts) | 70 | Front 60 · Back 70 |
| S6 | _anotar_ | 70 (sin `TEST_DATABASE_URL`, como en el CI) | Front 70 · Back 70 |
| S7 | _anotar_ | 75 | Front 75 · Back 75 |
| S8 | _anotar_ | 81 | Front 80 · Back 81 |

## Flujos críticos (semana 7)

| Flujo | Por qué es crítico | Responsable | Archivo |
|---|---|---|---|
| Iniciar sesión | Puerta a reservas, pagos y datos personales | Juan Pablo | `e2e/tests/flujo-iniciar-sesion.spec.js` |
| Buscar destino y ver el hotel | Lo que hace todos los días quien visita la agencia | Fernando | `e2e/tests/flujo-buscar-hotel.spec.js` |
| Crear una cuenta | Maneja datos personales; es la entrada de cada cliente nuevo | Cristian | `e2e/tests/flujo-registro.spec.js` |

Estabilidad: `pnpm exec playwright test --repeat-each=5` antes de fusionar (anotar el resultado en el PR).

## Prueba de fuego de la BD (semana 6)

En un equipo que no montó la BD: `docker compose -f docker-compose.test.yml down -v`,
`up -d --wait`, `alembic upgrade head` y `pytest tests/integration` dos veces seguidas.

| Fecha | Quién la corrió | Corrida 1 | Corrida 2 |
|---|---|---|---|
| | | | |

## Regla de rama

- [ ] Ruleset `main protegida` activo (Settings → Rules → Rulesets), con los checks del workflow `tests` obligatorios.
- [ ] Semana 8: checks obligatorios `frontend`, `backend`, `integracion` y `e2e` (además de `Lint` del workflow de Docker CI).
- [ ] PR de prueba con un test roto en cada capa: el merge quedó bloqueado (enlace al PR cerrado: ___).
- Si el repo no permite rulesets: regla manual del grupo, **nadie fusiona un PR en rojo**.

## Registro de vocero aleatorio

El vocero escribe su respuesta **antes** de que el instructor llegue a la mesa; el instructor la verifica con una pregunta corta y anota el resultado.

| Semana | Vocero | Capa preguntada | Respuesta escrita | Resultado (Alto / Medio / Bajo) |
|---|---|---|---|---|
| S1 | | | | |
| S2 | | | | |
| S3 | | | | |
| S4 | | | | |
| S5 | | | | |
| S6 | | | | |
| S7 | | | | |
| S8 | | | | |
| S9 | | | | |
