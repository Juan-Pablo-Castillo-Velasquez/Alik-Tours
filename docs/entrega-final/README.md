# Entrega final — AlekTours

**Equipo:** Juan Pablo Castillo Velásquez · Fernando Gutiérrez · Cristian Sinisterra
**Programa:** Tecnólogo en Análisis y Desarrollo de Software (ADSO) · **Fecha:** 20 nov 2026
**Producción:** frontend en Vercel ([alik-tours.vercel.app](https://alik-tours.vercel.app)), API en Render, PostgreSQL en Neon

Cada criterio de la rúbrica con el documento y la evidencia que lo cumple.

| # | Criterio | Documento | Evidencia principal |
|---|---|---|---|
| 1 | Documentación general (diagramas, modelos, MER, MR, UML, casos de uso, diagramas de clases) | [01 Documentación y diagramas](01-documentacion-y-diagramas.md) · [01b Modelo de datos](01b-modelo-de-datos.md) | Casos de uso, clases, secuencia y estados; MER y MR de las 55 tablas generados desde los modelos; 36 HU; RF/RNF |
| 2 | Scrum (backlog, sprints, HU puntuadas, tareas asignadas, planning poker) | [02 Scrum](02-scrum.md) | Backlog de 36 HU con puntos, 6 sprints con fechas y PR reales, sprint backlog, asignación por integrante, procedimiento y plantilla de planning poker |
| 3 | Backend inicia sin errores ni secciones pendientes (mensajes de error, estados, variables de entorno) | [03 Arranque del backend](03-arranque-del-backend.md) | Mensaje claro si falta una variable, `/health` con `ok` / `degradado` / `error`, contrato de errores; pruebas en `test_salud_y_configuracion_api.py` |
| 4 | Variables de entorno y despliegue (back y front) | [04 Despliegue y variables](04-despliegue-y-variables.md) | Tabla completa de variables de Render y Vercel, entornos separados, pasos de despliegue y verificación |
| 5 | Diagrama de arquitectura | [05 Arquitectura](05-arquitectura.md) | Contexto, despliegue, capas de backend y frontend, decisiones de formaciones previas |
| 6 | Bonificación IoT | [06 IoT](06-iot.md) | Prototipo ESP32 + simulador, `POST /api/iot/lecturas`, panel con alertas, protocolo explicado, salida real de una corrida |
| 7 | Plan de pruebas | [07 Plan de pruebas](07-plan-de-pruebas.md) | Alcance, 6 niveles, ambiente de pruebas separado (PostgreSQL en 5433 sin volumen, SQLite en memoria), criterios de entrada y salida |
| 8 | Informe de pruebas unitarias (≥ 20 casos) | [08 Informe de unitarias](08-informe-pruebas-unitarias.md) | 455 casos unitarios en verde; 27 casos distintos documentados con entrada, esperado y resultado |
| 9 | Reporte de ejecución + defectos con severidad y estado | [09 Ejecución y defectos](09-ejecucion-y-defectos.md) | 955 pruebas en verde; 24 defectos como [issues etiquetados](https://github.com/Juan-Pablo-Castillo-Velasquez/Alik-Tours/issues?q=label%3Adefecto) (#45–#68) |
| 10 | Front-end (pantallas, enrutamiento, navegación, colores, UX, UI) | [10 Front-end](10-frontend.md) | Mapa de 31 rutas, paleta clara/oscura, capturas, decisiones de UX y accesibilidad |
| 11 | README con sección de pruebas; API del 4.º backend documentada | [11 README y API](11-readme-y-api.md) | [`README.md` › Pruebas](../../README.md#pruebas), [referencia de 221 operaciones](../referencia-tecnica/api-referencia-completa.md), [`openapi.json`](../referencia-tecnica/openapi.json) |
| 12 | Manejo del repositorio con ramas y commits | [12 Repositorio](12-repositorio.md) | 39 ramas por tipo, 31 PR, Conventional Commits, CI en cada PR |
| 13 | Feedback de equipo, trabajo dividido y asignación | [13 Equipo y feedback](13-equipo-y-feedback.md) | Reparto con datos del repositorio, matriz de rotación y plantilla de feedback que llena cada integrante |
| 14 | Reflexión de los 4 backends; deuda técnica priorizada | [14 Reflexión y deuda técnica](14-reflexion-backends-y-deuda-tecnica.md) | Comparación FastAPI / Express / Spring Boot / Django y 12 deudas con prioridad P1–P3 |

## Pendiente de completar por el equipo

- **Ficha** del grupo en [`estrategia-pruebas.md`](../estrategia-pruebas.md) y [`matriz-rotacion.md`](../matriz-rotacion.md).
- **Votos del planning poker** en la plantilla de [02 Scrum §2.4](02-scrum.md#24-planning-poker).
- **Feedback personal** de cada integrante en [13 Equipo §13.4](13-equipo-y-feedback.md#134-feedback-del-equipo-cada-integrante-escribe-el-suyo).

## Regenerar lo que se genera

```bash
cd backend
python scripts/generar_modelo_datos.py     # MER, MR y clases (01b)
python scripts/generar_referencia_api.py   # referencia de la API y openapi.json
```
