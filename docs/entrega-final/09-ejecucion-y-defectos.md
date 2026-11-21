# 9. Reporte de ejecución y defectos

## 9.1 Ejecución del 20 nov 2026

Ambiente: backend FastAPI local contra PostgreSQL 16 de pruebas (base aparte,
puerto 5433), Redis apagado a propósito (modo degradado), SMTP falso; frontend
con Vite; navegador Chrome sin interfaz. Las mismas suites corren en GitHub
Actions en cada PR.

| Suite | Comando | Ejecutados | Aprobados | Fallidos | Omitidos | Cobertura |
|---|---|---|---|---|---|---|
| Unitarias backend | `pytest tests/unit` | 99 | 99 | 0 | 0 | — |
| API backend (SQLite en memoria) | `pytest tests/api tests/test_*.py` | 440 | 440 | 0 | 0 | — |
| Integración PostgreSQL 16 | `pytest tests/integration` (con `TEST_DATABASE_URL`) | 27 | 27 | 0 | 0 | — |
| **Total backend** | `pytest` | **566** | **566** | **0** | 0 | **86,16 %** (umbral 81 %) |
| Frontend (unitarias y componentes) | `pnpm test` | 356 | 356 | 0 | 0 | **92,87 %** líneas (umbral 80 %) |
| E2E Playwright (Chrome) | `pnpm exec playwright test` | 33 | 33 | 0 | 0 | — |
| Lint y formato | `ruff check`, `ruff format --check`, `eslint` | — | sin errores | — | — | — |
| **Total** | | **955** | **955** | **0** | | |

Antes de la entrega había 1 prueba de integración marcada `xfail` (búsqueda
sin tildes, DEF-18) y 1 E2E marcada `test.fail()` (cédula repetida, DEF-17):
ambos defectos se corrigieron y las dos pruebas pasan sin marcas.

### E2E ejecutadas (33)

Preparación de sesión (1) · login con credenciales inválidas (1) · contacto
como invitado (1) · estados difíciles: API caído, vacío, 422, reintentar (5) · filtros de
hoteles y WhatsApp (3) · buscar hotel y ver ficha, sin tildes, sin
resultados, hotel inexistente, red lenta (5) · **filtros de vuelos sin
tildes, orden y solo ida (1, nueva)** · iniciar sesión (5) · registro con
código, correo repetido, términos, cédula repetida, doble clic (5) · reservar
paquete (2) · reservar vuelo (1) · filtro de paquetes sin resultados (1) ·
página 404 (1) · panel de vuelos (1).

## 9.2 Sistema de seguimiento de defectos

Los defectos se registran como **issues de GitHub** con la etiqueta
`defecto` y etiquetas de **severidad** y **estado**:

| Severidad | Criterio |
|---|---|
| `severidad: crítica` | Expone datos de otra persona o bloquea la operación de la agencia |
| `severidad: alta` | Rompe un flujo principal (registro, reserva, pago) o la seguridad |
| `severidad: media` | El flujo funciona con error, dato incorrecto o con una alternativa |
| `severidad: baja` | Cosmético, mensajes, herramientas internas |

| Estado | Significado |
|---|---|
| `estado: abierto` | Reproducido y registrado, sin corregir |
| `estado: corregido` | Corrección hecha en una rama, falta integrarla y verificarla |
| `estado: verificado` | Corregido en `main` y cubierto por una prueba en verde (issue cerrado) |

Cada issue tiene pasos para reproducir, resultado esperado y obtenido,
corrección y la prueba que lo cubre. Filtro:
[issues con la etiqueta `defecto`](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues?q=label%3Adefecto).

## 9.3 Registro de defectos

| ID | Issue | Defecto | Severidad | Capa | Estado |
|---|---|---|---|---|---|
| DEF-01 | [#45](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/45) | El error 500 devolvía CORS con credenciales a cualquier origen | Alta | API | Verificado (cerrado) |
| DEF-02 | [#46](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/46) | Cualquier cuenta podía vincularse al perfil de otro cliente y ver sus reservas | Crítica | API | Verificado (cerrado) |
| DEF-03 | [#47](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/47) | El enlace de recuperación servía como el de verificación y se podía reusar 24 h | Alta | API | Verificado (cerrado) |
| DEF-04 | [#48](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/48) | El backend no validaba la regla de contraseña (solo el formulario) | Media | API | Verificado (cerrado) |
| DEF-05 | [#49](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/49) | Con echo=True el log mostraba consultas con hashes de contraseña | Alta | BD | Verificado (cerrado) |
| DEF-06 | [#50](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/50) | Textos más largos que la columna respondían 500 (registro, editar hotel/habitación) | Media | API | Verificado (cerrado) |
| DEF-07 | [#51](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/51) | Los CHECK de reservas estaban en el modelo pero no en la base de datos | Media | BD | Verificado (cerrado) |
| DEF-08 | [#52](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/52) | Borrar un empleado respondía siempre 500 | Media | API | Verificado (cerrado) |
| DEF-09 | [#53](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/53) | Habitación: borrar inexistente = 200; con reservas = 500; número repetido = 400/500 | Baja | API | Verificado (cerrado) |
| DEF-10 | [#54](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/54) | Un administrador podía eliminar su propia cuenta | Media | API | Verificado (cerrado) |
| DEF-11 | [#55](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/55) | Comprobante PDF con las fechas un día antes en Colombia | Media | Front | Verificado (cerrado) |
| DEF-12 | [#56](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/56) | La sesión vencida revivía al recargar la página | Media | Front | Verificado (cerrado) |
| DEF-13 | [#57](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/57) | /packages con el API caído decía "no hay paquetes" | Baja | Front | Verificado (cerrado) |
| DEF-14 | [#58](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/58) | Dos handlers de MSW no coincidían con el backend real | Baja | Front | Verificado (cerrado) |
| DEF-15 | [#59](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/59) | Tests que fallaban según el orden de ejecución | Media | API | Verificado (cerrado) |
| DEF-16 | [#60](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/60) | Accesibilidad: login, registro, contacto y pagos sin etiquetas asociadas ni roles | Media | Front | Verificado (cerrado) |
| DEF-17 | [#61](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/61) | Cédula repetida en el registro dejaba la cuenta creada sin perfil y bloqueaba a la persona | Alta | Front | Corregido · se cierra al integrar la rama |
| DEF-18 | [#62](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/62) | La búsqueda de hoteles distinguía tildes en PostgreSQL (medellin ≠ Medellín) | Media | BD | Corregido · se cierra al integrar la rama |
| DEF-19 | [#63](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/63) | La confirmación de reserva mostraba un código localizador aleatorio que no existía | Media | Front | Corregido · se cierra al integrar la rama |
| DEF-20 | [#64](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/64) | El buscador de vuelos no encontraba destinos escritos sin tilde ni por país o aeropuerto | Media | API | Corregido · se cierra al integrar la rama |
| DEF-21 | [#65](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/65) | Al faltar una variable de entorno el backend caía con un traceback ilegible | Baja | API | Corregido · se cierra al integrar la rama |
| DEF-22 | [#66](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/66) | verificar_entorno.py marcaba SECRET_KEY como no configurada aunque estuviera bien | Baja | API | Corregido · se cierra al integrar la rama |
| DEF-23 | [#67](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/67) | /health no informaba si Redis estaba caído | Baja | API | Corregido · se cierra al integrar la rama |
| DEF-24 | [#68](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues/68) | Los índices creados por migraciones no están declarados en los modelos (alembic check) | Media | BD | Abierto |

**Resumen:** 24 defectos — crítica 1, alta 4, media 13, baja 6.
Abiertos: 1 (DEF-24, severidad media, planificado como deuda técnica DT-02).
No quedan defectos críticos ni altos abiertos, que es el criterio de salida del
[plan de pruebas](07-plan-de-pruebas.md#75-criterios).
