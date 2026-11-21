# 2. Scrum: backlog, sprints, historias puntuadas, tareas y planning poker

Cómo se aplicó Scrum en AlekTours. Las fechas, ramas, PR y autores salen del
historial real del repositorio (`git log`, PR de GitHub); lo que es propuesta
o plantilla está marcado como tal.

## 2.1 Roles

| Rol Scrum | Quién | Responsabilidad en el proyecto |
|---|---|---|
| Product Owner | Juan Pablo Castillo Velásquez | Fundador de la agencia: prioriza el backlog según lo que necesita vender Alik Tours (RNT 224224) |
| Scrum Master | Rotativo por sprint (ver §2.5) | Cuida el tablero, la daily y que la rama de cada HU llegue a `main` por PR |
| Equipo de desarrollo | Juan Pablo Castillo, Fernando Gutiérrez (@Fervelop), Cristian Sinisterra (@cristiansini-dev) | Capas Front, API, BD y E2E, rotando cada semana ([matriz de rotación](../matriz-rotacion.md)) |

Eventos: planning al inicio de cada sprint (con planning poker), daily corta
por WhatsApp del equipo, revisión con demo en el entorno de Vercel y
retrospectiva (plantilla en [`13-equipo-y-feedback.md`](13-equipo-y-feedback.md)).

## 2.2 Product backlog con historias puntuadas

Historias en [`docs/historias-usuario/`](../historias-usuario/README.md), cada
una con criterios de aceptación *Dado / cuando / entonces*.

**Cómo se calcularon los puntos de la columna "propuesta":** complejidad =
número de criterios de aceptación + número de endpoints que toca la historia,
llevada a la escala Fibonacci (≤4 → 3, 5–6 → 5, 7–8 → 8, ≥9 → 13). Es el
punto de partida que el equipo lleva al planning poker (§2.4): el valor
final es el que el equipo acuerde votando, y se anota en la columna
"Acordado" de la plantilla de §2.4.

| ID | Historia | Actor | Prioridad | CA | Endpoints | Puntos (propuesta) |
|---|---|---|---|---|---|---|
| [HU-01](../historias-usuario/HU-01_explorar_inicio.md) | Explorar la página de inicio | Visitante | Alta | 3 | 4 | 8 |
| [HU-02](../historias-usuario/HU-02_buscar_hoteles.md) | Buscar hoteles por destino y fechas | Visitante | Alta | 4 | 2 | 5 |
| [HU-03](../historias-usuario/HU-03_ver_ficha_hotel.md) | Ver la ficha de un hotel y sus habitaciones | Visitante | Alta | 5 | 3 | 8 |
| [HU-04](../historias-usuario/HU-04_explorar_paquetes.md) | Explorar paquetes turísticos | Visitante | Alta | 4 | 2 | 5 |
| [HU-05](../historias-usuario/HU-05_consultar_vuelos.md) | Consultar ofertas de vuelos | Visitante | Media | 3 | 2 | 5 |
| [HU-06](../historias-usuario/HU-06_guia_de_uso.md) | Consultar la guía de uso | Visitante / Cliente | Media | 5 | 1 | 5 |
| [HU-07](../historias-usuario/HU-07_registro_y_verificacion.md) | Registrarme y verificar mi correo | Visitante | Alta | 4 | 3 | 8 |
| [HU-08](../historias-usuario/HU-08_inicio_sesion.md) | Iniciar sesión y recuperar mi contraseña | Cliente | Alta | 4 | 3 | 8 |
| [HU-09](../historias-usuario/HU-09_metodo_de_pago.md) | Registrar un método de pago | Cliente | Alta | 3 | 1 | 3 |
| [HU-10](../historias-usuario/HU-10_reservar_hotel.md) | Reservar un hotel | Cliente | Alta | 5 | 2 | 8 |
| [HU-11](../historias-usuario/HU-11_reservar_paquete.md) | Reservar un paquete turístico | Cliente | Alta | 5 | 2 | 8 |
| [HU-12](../historias-usuario/HU-12_reservar_vuelo.md) | Reservar un vuelo | Cliente | Media | 3 | 2 | 5 |
| [HU-13](../historias-usuario/HU-13_pagar_reserva.md) | Pagar una reserva | Cliente | Alta | 4 | 2 | 5 |
| [HU-14](../historias-usuario/HU-14_mis_reservas.md) | Consultar mis reservas | Cliente | Alta | 4 | 2 | 5 |
| [HU-15](../historias-usuario/HU-15_cancelar_reserva.md) | Solicitar la cancelación de una reserva | Cliente | Alta | 3 | 1 | 3 |
| [HU-16](../historias-usuario/HU-16_chat_con_asesor.md) | Chatear con un asesor | Cliente | Alta | 4 | 3 | 8 |
| [HU-17](../historias-usuario/HU-17_notificaciones.md) | Recibir notificaciones | Cliente | Media | 2 | 1 | 3 |
| [HU-18](../historias-usuario/HU-18_favoritos.md) | Guardar hoteles favoritos | Cliente | Baja | 3 | 2 | 5 |
| [HU-19](../historias-usuario/HU-19_preferencias.md) | Configurar mis preferencias de viaje | Cliente | Baja | 2 | 3 | 5 |
| [HU-20](../historias-usuario/HU-20_comprobantes.md) | Descargar mis comprobantes | Cliente | Media | 2 | 1 | 3 |
| [HU-21](../historias-usuario/HU-21_mi_cuenta.md) | Gestionar mi cuenta | Cliente | Media | 3 | 3 | 5 |
| [HU-22](../historias-usuario/HU-22_resena_estadia.md) | Dejar una reseña de mi estadía | Cliente | Media | 4 | 3 | 8 |
| [HU-23](../historias-usuario/HU-23_comunidad.md) | Publicar en la comunidad viajera | Cliente | Media | 4 | 2 | 5 |
| [HU-24](../historias-usuario/HU-24_contacto_y_corporativo.md) | Contactar a la agencia y pedir planes corporativos | Visitante | Media | 3 | 2 | 5 |
| [HU-25](../historias-usuario/HU-25_moderar_resenas_y_comunidad.md) | Moderar reseñas y publicaciones | Asesor / Administrador | Media | 4 | 4 | 8 |
| [HU-26](../historias-usuario/HU-26_gestionar_hoteles.md) | Gestionar hoteles y habitaciones | Administrador | Alta | 5 | 4 | 13 |
| [HU-27](../historias-usuario/HU-27_gestionar_paquetes.md) | Gestionar paquetes turísticos | Administrador | Alta | 4 | 3 | 8 |
| [HU-28](../historias-usuario/HU-28_gestionar_vuelos.md) | Gestionar ofertas aéreas | Administrador | Media | 3 | 3 | 5 |
| [HU-29](../historias-usuario/HU-29_gestionar_reservas_y_pagos.md) | Gestionar reservas y pagos | Asesor / Administrador | Alta | 4 | 4 | 8 |
| [HU-30](../historias-usuario/HU-30_atender_cancelaciones.md) | Atender solicitudes de cancelación | Asesor / Administrador | Alta | 3 | 2 | 5 |
| [HU-31](../historias-usuario/HU-31_promociones_y_temas.md) | Gestionar promociones, banners y temas de temporada | Administrador | Media | 2 | 3 | 5 |
| [HU-32](../historias-usuario/HU-32_dashboard.md) | Consultar el dashboard de indicadores | Administrador / Asesor | Media | 4 | 1 | 5 |
| [HU-33](../historias-usuario/HU-33_usuarios_y_roles.md) | Gestionar usuarios, roles y permisos | Administrador | Alta | 3 | 3 | 5 |
| [HU-34](../historias-usuario/HU-34_configuracion_agencia.md) | Configurar los datos de la agencia | Administrador | Media | 1 | 2 | 3 |
| [HU-35](../historias-usuario/HU-35_rendimiento.md) | Navegar el sitio con rapidez | Visitante / Cliente | Alta | 4 | 3 | 8 |
| [HU-36](../historias-usuario/HU-36_telemetria_iot.md) | Ver la telemetría de los vehículos de traslado | Administrador | Baja (bonificación) | 4 | 4 | 8 |

**Total del backlog: 36 historias · 217 puntos (propuesta).**


Definition of Ready: historia con criterios de aceptación, pantalla y
endpoints identificados. Definition of Done: PR revisado por alguien de otra
capa, CI en verde (lint, pruebas con umbral de cobertura, E2E), desplegado en
Vercel/Render y criterio de aceptación verificado en producción.

## 2.3 Sprints (línea de tiempo real del repositorio)

| Sprint | Fechas | Objetivo | Evidencia en el repo | Commits |
|---|---|---|---|---|
| 0 | jun 2026 | Arranque: estructura FastAPI + React, autenticación base | Primeros commits del 3 jun; PR #1 | 34 |
| 1 | ago 2026 | Docker, Alembic en vez de SQL a mano, datos demo, frontend base | PR #2–#21; issues #6–#17 | 73 |
| 2 | sep 2026 | Catálogo, reservas, pagos simulados (Nequi con comprobante), panel de asesor, SEO | 125 commits del 2 al 30 de sep | 125 |
| 3 | oct 2026 | Ramas por HU: `feature/HU-01` a `feature/HU-11` (login por correo, recuperar contraseña, modales, home, reseñas, búsqueda, detalle, favoritos, flujo de reserva, pagos) | Ramas `feature/HU-*`, PR #23–#25 (Fervelop, cristiansini-dev) | 16 |
| 4 | 1–7 nov 2026 | Bootcamp de testing semanas 01–09 y auditoría en 7 fases; ecosistema de vuelos y paquetes | Ramas `test/semana-01…09`, `mejora/fase-*`, PR #26–#44 | 101 |
| 5 | 8–20 nov 2026 | Dashboards, perfil, seguridad, temporada, buscador de vuelos, rediseño del flujo de reserva, prototipo IoT y entrega final | Rama `entrega/rubrica-final` | 36 + los de esta entrega |

### Sprint backlog del sprint 5 (entrega)

| Tarea | HU | Capa | Estado |
|---|---|---|---|
| Buscador de vuelos sin tildes con facetas, orden y paginación (`GET /api/vuelos/buscar`) | HU-05 | API + Front | Hecho |
| Rediseño del flujo de reserva (encabezado con pasos, resumen, ayuda) | HU-10/11/12/13 | Front | Hecho |
| Código de reserva real en la confirmación (antes aleatorio) | HU-10 | Front | Hecho (defecto DEF-12) |
| Búsqueda de hoteles sin tildes (antes `xfail`) | HU-02 | API + BD | Hecho (defecto DEF-11) |
| Prototipo IoT: API, panel, simulador y firmware | HU-36 | API + Front + BD | Hecho |
| `/health` con estados y mensaje claro si falta una variable | HU-35 | API | Hecho |
| Documentación de la rúbrica (este directorio) | — | Docs | Hecho |

### Velocidad

Puntos comprometidos en el sprint 5: HU-05 (5) + HU-10 (8) + HU-35 (8) + HU-36 (8) = 29, todos cerrados.
El burndown diario se lleva en el tablero del equipo (puntos restantes al
cierre de cada día); no se reconstruye aquí porque el historial de commits no
registra cuándo se movió cada tarjeta.

## 2.4 Planning poker

**Procedimiento usado:** cada integrante tiene las cartas 1, 2, 3, 5, 8, 13,
21 y ☕. Se lee la historia y sus criterios, cada quien vota a la vez, si hay
diferencia de más de dos cartas hablan el voto más alto y el más bajo y se
vuelve a votar; la tercera ronda decide por mayoría. Herramienta sugerida:
[planningpokeronline.com](https://planningpokeronline.com) o cartas físicas.

**Plantilla de registro** (una fila por historia; la llena el equipo en la
sesión y queda como evidencia):

| HU | Propuesta | Voto JP | Voto Fernando | Voto Cristian | Ronda | Acordado |
|---|---|---|---|---|---|---|
| HU-05 Consultar vuelos | 5 | | | | | |
| HU-10 Reservar hotel | 8 | | | | | |
| HU-11 Reservar paquete | 8 | | | | | |
| HU-13 Pagar reserva | 5 | | | | | |
| HU-36 Telemetría IoT | 8 | | | | | |
| … | | | | | | |

> Los votos no se inventan aquí: son de cada integrante. La columna
> "Propuesta" es la del cálculo de §2.2.

## 2.5 Tareas asignadas

La asignación siguió la [matriz de rotación](../matriz-rotacion.md) del
bootcamp: cada semana cada integrante tuvo una capa distinta y su PR de
pruebas. Resumen por integrante (detalle semana a semana en la matriz y en
[`docs/testing/README.md`](../testing/README.md)):

| Integrante | Tareas a su cargo (evidencia) |
|---|---|
| Juan Pablo Castillo Velásquez | Product Owner; backend y frontend del producto; PR #2–#44; E2E de login, `ProtectedRoute`, BD (S5), API (S6) |
| Fernando Gutiérrez (@Fervelop) | HU-01 login por correo (PR #23); E2E filtro de paquetes; API (S2); `CardPayment` (S3); BD (S4); E2E (S5); E2E buscar y ver hotel (S7); cobertura y CI de integración (S8) — 13 commits |
| Cristian Sinisterra (@cristiansini-dev) | Frontend del login (PR #24–#25); 10 historias de usuario iniciales (ago); E2E contacto como invitado; E2E en CI (S2); `Newsletter` y filtros (S3); API (S4); Front con MSW (S5); BD en Docker (S6); E2E registro de cuenta (S7) — 23 commits |

Tablero: las tareas de cada sprint se llevaron como issues y ramas (`feature/HU-*`, `test/semana-*`, `mejora/*`); los defectos, como issues con etiquetas de severidad y estado ([`09-ejecucion-y-defectos.md`](09-ejecucion-y-defectos.md)).
