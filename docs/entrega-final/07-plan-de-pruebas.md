# 7. Plan de pruebas

Complementa la [estrategia de pruebas](../estrategia-pruebas.md) (riesgos y
por qué de cada capa) con el plan formal: alcance, niveles, ambientes,
criterios y calendario.

## 7.1 Identificación

| Campo | Valor |
|---|---|
| Sistema | AlekTours (Alik Tours, RNT 224224): sitio de reservas + panel + API + prototipo IoT |
| Versión bajo prueba | Rama `main` (despliegue continuo); entrega final del 20 nov 2026 |
| Responsables | Juan Pablo Castillo, Fernando Gutiérrez, Cristian Sinisterra (capas rotativas, [matriz](../matriz-rotacion.md)) |

## 7.2 Alcance

**Dentro del alcance**

| Módulo | Funcionalidades |
|---|---|
| Cuentas | Registro con código por correo, login JWT, recuperación de contraseña, roles y permisos |
| Catálogo | Búsqueda de hoteles (fechas, sin tildes), ficha, paquetes, buscador de vuelos (filtros, facetas, orden, paginación) |
| Reservas | Cotización en el servidor, creación idempotente, cruce de fechas, capacidad, cupos de vuelo, cancelación |
| Pagos | Reglas y transiciones de estado, abonos, comprobantes numerados, pagos asíncronos (PSE/Nequi) |
| Panel | CRUD de productos, reservas, dashboard, exportación, moderación |
| Comunicación | Notificaciones, chat con adjuntos privados, correos |
| Seguridad | 401/403, límites de intentos, CORS, errores sin filtraciones, validación de archivos |
| IoT | Autenticación del dispositivo, validación de lecturas, alertas, panel |
| No funcionales | Accesibilidad básica (roles ARIA, contraste), rendimiento (caché), arranque y salud |

**Fuera del alcance:** pasarelas de pago reales (los pagos son simulados y
asistidos por asesor), envío real de correos (se usa un SMTP falso / Mailpit),
Cloudinary real, pruebas de carga, el hardware ESP32 (se prueba con el
simulador, que usa el mismo protocolo), y la librería `components/ui` de
shadcn (código generado). Ver §3 de la [estrategia](../estrategia-pruebas.md).

## 7.3 Niveles de prueba

| Nivel | Qué valida | Herramienta | Dónde | Cantidad (20 nov 2026) |
|---|---|---|---|---|
| Unitarias backend | Reglas puras: pagos, validadores, límites de esquemas, caché, simulador IoT | pytest | `backend/tests/unit` | 99 casos (39 funciones) |
| Unitarias y de componentes frontend | Utilidades, hooks, contextos, componentes con reglas, cliente HTTP | Vitest + Testing Library + MSW | `alecktourfrondend/src/**/*.test.ts(x)` | 356 casos en 46 archivos |
| API (integración de componentes) | Contrato HTTP completo con BD SQLite en memoria | pytest + TestClient | `backend/tests/api`, `backend/tests/test_*.py` | 440 casos |
| Integración con BD real | Repositorios, FK/CHECK, concurrencia, migraciones | pytest + PostgreSQL 16 | `backend/tests/integration` | 27 casos |
| Sistema / E2E | Flujos completos en el navegador | Playwright | `e2e/tests` | Ver [§9](09-ejecucion-y-defectos.md) |
| Aceptación | Criterios *Dado/cuando/entonces* de cada HU | Revisión manual + E2E | [`historias-usuario`](../historias-usuario/README.md) | 36 HU |

## 7.4 Ambientes (prueba separado de desarrollo)

| Ambiente | Base de datos | Cómo se levanta | Aislamiento |
|---|---|---|---|
| Desarrollo | `postgres` de `docker-compose.yml`, puerto 5432, base `alektours_db`, volumen persistente | `docker compose up` | Datos de trabajo del equipo |
| Pruebas unitarias/API | SQLite en memoria (`StaticPool`), una base nueva por prueba | `pytest` | Nada se escribe en disco ni en la BD de desarrollo |
| Pruebas de integración | `docker-compose.test.yml`: PostgreSQL 16 en puerto **5433**, base `alektours_test`, **sin volumen** | `docker compose -f docker-compose.test.yml up -d --wait` | Otra base, otro puerto; `down -v` la borra. Las pruebas se saltan si no existe `TEST_DATABASE_URL` |
| E2E | Backend + PostgreSQL + Redis + Mailpit como servicios del job de CI | `.github/workflows/tests.yml` | Contenedores efímeros por ejecución; datos creados por API en cada prueba |
| Producción | Neon | Render | Nunca se usa para pruebas automáticas |

Dependencias externas en pruebas: correo con `ServidorSMTPFalso`, Redis con
`RedisEnMemoria` (`backend/tests/fakes.py`), API del frontend con MSW, y en
E2E `page.route` para simular caídas. Inventario: [`dependencias-externas.md`](../testing/dependencias-externas.md).

## 7.5 Criterios

| Criterio | Regla |
|---|---|
| Entrada | Historia con criterios de aceptación; rama propia; CI configurado |
| Suspensión | Si falla la migración o el arranque del backend, se detiene la ejecución hasta corregir |
| Salida (aprobación) | 100 % de las pruebas en verde; cobertura ≥ **81 %** backend y ≥ **80 %** frontend (umbral que hace fallar el CI); 0 defectos críticos o altos abiertos; E2E de flujos críticos en verde |
| Regresión | Toda la suite corre en cada PR y en cada push a `main` |

## 7.6 Casos por riesgo (trazabilidad)

| Riesgo (estrategia §1) | Pruebas que lo cubren |
|---|---|
| Ver o tomar datos de otro cliente | `test_seguridad_y_errores_api.py`, `test_adjuntos_chat_privados_api.py`, `test_iot_api.py::test_solo_admin_ve_el_panel` |
| Login o registro fallan | `test_cuentas_api.py`, `test_verificacion_email.py`, E2E `iniciar-sesion`, `registro` |
| Reserva cruzada o precio incorrecto | `test_reservas_pagos.py`, `test_ecosistema_reservas_api.py`, `test_concurrencia_reservas_pg.py` |
| Pago aprobado sin confirmar la reserva | `tests/unit/test_reglas_de_pago.py`, `test_dobles_repositorio.py` |
| El buscador no encuentra el destino | `test_buscar_vuelos_api.py`, `test_repositorio_hoteles_pg.py::test_buscar_sin_tilde...`, E2E de filtros |
| Errores que filtran detalles o CORS abierto | `test_seguridad_y_errores_api.py`, `test_salud_y_configuracion_api.py` |

## 7.7 Calendario

Las pruebas se construyeron en las 9 semanas del Bootcamp Testing ADSO (una
rama `test/semana-NN` por semana, [guía](../testing/README.md)) y se ejecutan
de forma continua en GitHub Actions. Cierre: ejecución completa del 20 nov
2026, registrada en [`09-ejecucion-y-defectos.md`](09-ejecucion-y-defectos.md).
