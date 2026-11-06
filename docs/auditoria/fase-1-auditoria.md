# Auditoría integral de Alik Tours: fase 1

- Fecha: 5 de noviembre de 2026
- Rama: `mejora/fase-1-auditoria`. Ningún cambio de esta fase va directo a `main` ni a producción.
- Autor del proyecto: Juan Pablo Castillo Velásquez

## 1. Resumen ejecutivo

Alik Tours tiene una base técnica sólida para su tamaño:
- **Backend:** FastAPI con PostgreSQL y Redis, migraciones Alembic, 400 pruebas y 83 % de cobertura.
- **Permisos:** se verifican en el backend, incluida la propiedad de reservas y pagos.
- **Pagos:** tienen bloqueo contra pagos duplicados.
- **Chat:** tiene idempotencia por `client_msg_id`.
- **Frontend:** React con TypeScript y pruebas Vitest, MSW y Playwright.

Los problemas más graves no están en el código de negocio. Están en tres frentes:

1. **Producción.** El backend en Render responde 500 en reseñas y promociones. La causa probable es una migración sin aplicar. Además se duerme por inactividad (plan gratuito).
2. **Confianza comercial.** El sitio mostraba datos que no salen de la base de datos (calificaciones, urgencia, reglas de hotel) y pagos simulados sin decir que lo son.
3. **Dependencias.** Había paquetes con vulnerabilidades conocidas, 17 en el frontend y 26 en el backend.

## 2. Mapa técnico

| Capa | Tecnología | Dónde |
|---|---|---|
| Frontend | React 18, TypeScript, Vite 6, Tailwind 4, React Router 7 (modo librería, SPA) | `alecktourfrondend/` → Vercel |
| Backend | FastAPI 0.115, SQLAlchemy, Alembic, Redis (caché y límite de intentos), Sentry | `backend/` → Render (Docker, `entrypoint.sh` corre `alembic upgrade head`) |
| BD | PostgreSQL 16 | 24 routers, unas 25 tablas, migraciones en `backend/alembic/versions` |
| Pagos | **Simulados** (`services/payment_service.py`). Ninguna pasarela real conectada. | Tarjeta, PSE y PayPal resuelven al instante. Nequi queda en verificación manual de un asesor. |
| Pruebas | pytest (unitarias, API e integración con Postgres), Vitest + MSW, Playwright E2E con Mailpit | CI de GitHub Actions: `tests.yml` y `ci.yml` |

Rutas públicas del frontend: `/`, `/packages`, `/package/:id`, `/hotel/:id`, `/search`, `/checkout/:id`, `/comunidad`, `/testimonios`, `/benefits`, `/corporate`, `/travel-info`, `/faq`, `/contact`, `/terms` y `/privacy`. Las protegidas son `/profile` y `/admin`.

## 3. Matriz de hallazgos

| # | Problema | Módulo | Severidad | Causa | Solución | Riesgo | Estado |
|---|---|---|---|---|---|---|---|
| 1 | El backend de producción responde **500** en `/api/resenas`, `/api/resenas/destacadas`, `/api/promociones/seleccion-casa` y `/api/hoteles/destinos-sugeridos` | Infra / BD | **Crítico** | Probable: la migración `a7c3e9f1b4d2` (columnas nuevas en `resenas` y `comentarios_comunidad`) no se aplicó en Render, o el deploy falló al correrla | Revisar los logs de Render, aplicar `alembic upgrade head` y redeploy | Sin esto no cargan reseñas ni promociones en el inicio | **Bloqueado**: necesita acceso a Render (logs) |
| 2 | El backend se duerme: 503 al arrancar, y después de varias páginas las peticiones fallan | Infra | Alto | Plan gratuito de Render y protección anti-bots de Cloudflare | Plan pago o ping de mantenimiento; revisar los límites | Primeras visitas lentas o fallidas | Pendiente (decisión de costo) |
| 3 | Los pagos con tarjeta, PSE y PayPal son simulados y el checkout no lo decía; "Pago aprobado" parecía un cobro real | Pagos | **Crítico** | No hay pasarela conectada (decisión del proyecto) | Aviso claro en el checkout, "Pago de prueba: no se realizó ningún cobro real" y enlace a WhatsApp para pagar | Un cliente real podía creer que pagó | **Completado** (rama) |
| 4 | Una tarjeta de hotel sin reseñas mostraba "8.0 Excelente" y 4 estrellas inventados | Hoteles | Alto | Valor por defecto `8` y `4` en `HotelCard.tsx` | Mostrar "Aún sin calificaciones" | Publicidad engañosa (Ley 1480) | **Completado** (rama) |
| 5 | "¡Muy solicitado! Este hotel se reserva frecuentemente" aparecía fijo en todos los hoteles | Hoteles | Alto | Texto de urgencia sin datos (FOMO) | Quitado | Publicidad engañosa | **Completado** (rama) |
| 6 | "Reglas del alojamiento" fijas (check-in 15:00, check-out 12:00) iguales para todos los hoteles | Hoteles | Medio | Bloque estático "Políticas simuladas" | Quitado; ya se muestran las `politicas` reales de cada hotel | Información falsa al cliente | **Completado** (rama) |
| 7 | 17 vulnerabilidades en el frontend: 1 crítica en DOMPurify (vía jspdf) y 7 altas en react-router | Seguridad | Alto | Versiones viejas; `pnpm.overrides` ignorado por pnpm 11 | react-router 7.18.2, `dompurify>=3.4.17` y overrides movidos a `pnpm-workspace.yaml` | Bajo: mismo major | **Completado**: `pnpm audit` da 0 |
| 8 | 26 avisos de pip-audit en el backend: starlette 0.38.6, python-jose, ecdsa, aiosmtplib, pyasn1 y pytest | Seguridad | Alto | FastAPI 0.115 fija starlette viejo; python-jose está sin mantenimiento | Fase 5: PyJWT 2.15 en lugar de python-jose (se van también pyasn1 y ecdsa), FastAPI 0.162 con starlette 1.10, fastapi-mail 1.6.8 con aiosmtplib 5.1.3 y pytest 9.1.1 | Medio: versiones mayores. Las 382 pruebas unitarias pasan con las versiones nuevas y la app arranca con Sentry activo | **Completado** (rama fase 3-5) |
| 9 | `[Pendiente: razón social]`, `[Pendiente: NIT]` y `[Pendiente: dirección]` visibles en los Términos | Legal | Alto | Faltan los datos reales de la agencia | El propietario debe dar los datos; no se inventan | Falta de identificación del prestador (Ley 1480, comercio electrónico) | **Bloqueado**: faltan datos reales |
| 10 | Los Términos no mencionan la **reversión del pago** (Ley 1480, art. 51). Hay que revisar si el **retracto** aplica a servicios turísticos con fecha determinada | Legal | Medio | Redacción incompleta | Texto propuesto para revisión de un abogado; no se publica sin revisión | Derechos del consumidor | Pendiente (revisión jurídica) |
| 11 | Los enlaces de WhatsApp a clientes en el panel abrían chats inexistentes (sin el indicativo 57) | Panel | Medio | `wa.me/3001234567` | `utils/whatsapp.ts` normaliza el número; tiene pruebas | — | **Completado** (en `main`) |
| 12 | Chat: posibles mensajes duplicados | Chat | — | Revisado: `fusionarMensajes` deduplica por id y el envío usa `client_msg_id` idempotente y un candado contra doble clic | No requiere cambio | — | Verificado sin hallazgo |
| 13 | Permisos | Seguridad | — | Revisados los 24 routers. Las rutas públicas sin sesión son solo de catálogo (hoteles, paquetes, reseñas, temas). Reservas y pagos verifican `exigir_propietario_o_admin` | No requiere cambio | — | Verificado sin hallazgo |
| 14 | Las alertas de Dependabot están desactivadas en el repositorio | Infra | Bajo | Configuración de GitHub | Nuevo workflow `auditoria-dependencias` (semanal, solo informa) | — | **Completado** (rama) |
| 15 | `/faq`, `/terms` y `/privacy` no llegan a "red inactiva" en 45 s | Rendimiento | Bajo | Peticiones que siguen activas (por investigar: video o polling) | Medir en la fase 6 | — | Pendiente |

## 3b. Avance de las fases 3 y 5 (rama `mejora/fase-3-5-operacion-seguridad`)

| Requisito | Estado | Evidencia | Prueba |
|---|---|---|---|
| Evitar reservas dobles de la misma habitación (condición de carrera) | Completado | `SELECT ... FOR UPDATE` sobre la habitación en `ReservaRepository._verificar_disponibilidad` | 406 pruebas, incluida la integración en PostgreSQL 16 |
| La misma habitación repetida en una reserva | Completado | Responde 409 | `test_la_misma_habitacion_dos_veces_con_fechas_cruzadas_da_409` |
| Validación de capacidad en el backend | Completado | Responde 422 con un mensaje claro (`CapacidadInsuficienteError`) | `test_no_se_reservan_mas_huespedes_de_los_que_caben` |
| Afirmaciones de seguridad sin respaldo ("SSL 256 bits", "100% protegidos") | Completado | Textos corregidos | — |
| JWT con PyJWT | Completado | `app/core/security.py` | Pruebas de autenticación (token con otra clave → 401, etc.) |
| FastAPI, starlette y fastapi-mail al día | Completado | `requirements.txt` | 382 pruebas unitarias con las versiones nuevas en CI y arranque con Sentry |
| Comprobantes que no dicen ser factura DIAN | Ya cumplía | `generarFacturaPdf.ts`, `ComprobantePDF.tsx` y Términos | — |
| Idempotencia de `POST /reservas` | Completado (rama fase 7) | `clave_idempotencia` por intento en el checkout y en el panel, con restricción única por cliente. Migración `b8d4f2a6c9e1` | `test_el_mismo_intento_enviado_dos_veces_crea_una_sola_reserva`; migración probada subir/bajar/subir en PostgreSQL 16 |

## 4. Plan priorizado (fases siguientes)

1. **Ahora (necesita al propietario):**
   - Logs de Render y aplicar la migración (hallazgo 1).
   - Datos legales reales: razón social, NIT y dirección (hallazgo 9).
   - Decidir si se conecta una pasarela real (Wompi, PayU o Mercado Pago) o se mantiene el pago asistido por asesor.
2. **Fase 3, Operación:** idempotencia por clave en `POST /reservas`, transacción única para crear reserva con habitaciones, y comprobantes que digan "comprobante", no "factura electrónica DIAN".
3. **Fase 5, Seguridad:** subir FastAPI/starlette, cambiar python-jose por PyJWT y subir aiosmtplib, cada uno con toda la batería de pruebas.
4. **Fases 2 y 4, UX y panel:** filtros de hoteles con datos reales, paginación del lado del servidor en las tablas del panel y exportación CSV.
5. **Fase 6:** rendimiento (code splitting medido con Lighthouse) e investigación del hallazgo 15.

## 5. Pruebas de esta fase

| Prueba | Resultado | Evidencia |
|---|---|---|
| Recorrido del sitio publicado (37 páginas, Playwright desde GitHub Actions) | Ningún enlace interno lleva a 404; hay errores 500 del backend (hallazgo 1) | Workflow temporal `revisar-enlaces` |
| `pnpm audit --prod` | 0 vulnerabilidades (antes 17) | Run 42146013837 |
| `pip-audit` | 26 avisos antes; pyasn1 corregido, el resto planificado | Run 42145767790 |
| CI completo (frontend, backend, integración, e2e) | Ver el PR de esta rama | GitHub Actions |

## 6. Despliegue y rollback

- **Despliegue:** se revisa el PR de `mejora/fase-1-auditoria`, y cuando el CI esté verde se hace merge a `main`. Vercel publica solo y Render redeploya (corre las migraciones).
- **Rollback:** se revierte el merge en GitHub (`Revert`). Esta fase no tiene cambios de base de datos.

## 7. Matriz final de requisitos (fases 1 a 7)

| Requisito | Estado | Evidencia | Prueba |
|---|---|---|---|
| Auditoría integral con matriz de hallazgos | Completado | Este documento | — |
| Sin datos inventados (calificaciones, urgencia, reglas, ubicación, fotos) | Completado | PR #28 y #31 | Revisión de código y CI |
| Pagos simulados presentados como tales | Completado | Aviso en el checkout y "Pago de prueba" | `MetodosAlternos.test.tsx` |
| Pasarela de pagos real | Bloqueado | Decisión del propietario (Wompi, PayU, Mercado Pago o pago asistido) | — |
| Reservas: carrera, duplicado, capacidad e idempotencia | Completado | PR #29 y fase 7 | 408 pruebas backend (incluida PostgreSQL) |
| Comprobantes que no dicen ser factura DIAN | Completado (ya cumplía) | `generarFacturaPdf.ts` | — |
| Permisos verificados en el backend | Completado (verificado) | Revisión de los 24 routers | Pruebas de autorización existentes |
| Dependencias sin vulnerabilidades conocidas | Completado | `pnpm audit` 0; backend actualizado (PyJWT, FastAPI 0.162, fastapi-mail 1.6.8) | CI y auditoría semanal |
| Panel: todos los registros y CSV | Completado | PR #30 | `cargarTodo.test.ts`, `exportarCsv.test.ts` |
| Búsqueda: filtros persistentes | Completado | PR #31 | e2e de búsqueda |
| Botones sin acción | Completado | "Habla con un asesor", "Ver mapa" y dirección | — |
| WhatsApp de la agencia | Completado (en `main`) | +57 322 817 4200 | `whatsapp.test.ts` |
| Rendimiento: code splitting e imágenes | Completado | `lazy()` ya existía; Unsplash con `auto=format` | `cityImages.test.ts` |
| Producción: errores 500 en Render | Bloqueado | Se necesitan los logs de Render | — |
| Textos legales (datos del prestador, reversión del pago) | Bloqueado / pendiente de revisión jurídica | `docs/legal/propuestas-para-revision-juridica.md` | — |
| `/faq`, `/terms` y `/privacy` lentas en cargar | Pendiente | Hay que medirlo con el backend sano; hoy los fallos del backend lo enmascaran | — |

### Orden de despliegue

1. Merge de #28 → #29 → #30 → #31 → #32, en orden.
2. Render redeploya y `entrypoint.sh` corre `alembic upgrade head`. Eso aplica `a7c3e9f1b4d2` (si faltaba) y `b8d4f2a6c9e1`.
3. Comprobar que `/health`, `/api/resenas`, `/api/promociones/seleccion-casa` y una reserva de prueba funcionan.

### Rollback

- **Frontend:** "Revert" del merge en GitHub, y Vercel vuelve a publicar.
- **Backend:** el mismo revert. Para deshacer la columna de idempotencia se corre `alembic downgrade a7c3e9f1b4d2`. La columna es nullable, así que el código anterior funciona aunque siga existiendo.
