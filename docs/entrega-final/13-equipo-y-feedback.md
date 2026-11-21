# 13. Feedback de equipo, trabajo dividido y asignación de tareas

## 13.1 Equipo y roles

| Integrante | GitHub | Rol principal |
|---|---|---|
| Juan Pablo Castillo Velásquez | @Juan-Pablo-Castillo-Velasquez | Product Owner, fundador de Alik Tours; desarrollo full stack |
| Fernando Gutiérrez | @Fervelop | Desarrollo y pruebas (capas rotativas) |
| Cristian Sinisterra | @cristiansini-dev | Desarrollo, historias de usuario y pruebas (capas rotativas) |

## 13.2 Cómo se dividió el trabajo

1. **Producto por historias de usuario:** cada HU en su rama `feature/HU-NN`
   con su responsable (ver [`02-scrum.md` §2.5](02-scrum.md#25-tareas-asignadas)).
2. **Pruebas por capas que rotan cada semana** (Front, API, BD, E2E), con la
   regla de que quien revisa un PR trabajó otra capa esa semana:
   [`matriz-rotacion.md`](../matriz-rotacion.md).
3. **Defectos** asignados como issues con severidad y estado
   ([`09-ejecucion-y-defectos.md`](09-ejecucion-y-defectos.md)).

## 13.3 Evidencia del repositorio (datos reales, `git log --all`)

| Integrante | Commits (todas las ramas) | Commits de pruebas | Aportes destacados |
|---|---|---|---|
| Juan Pablo Castillo | 349 (sumando sus tres correos y formas del nombre) | 97 | Backend y frontend del producto, despliegue, auditoría de seguridad, ecosistema de reservas, dashboards, IoT |
| Fernando Gutiérrez | 14 | 8 | HU-01 login por correo (PR #23), E2E de filtros y de buscar hotel, API de pagos, `CardPayment`, BD de pruebas, job de integración con PostgreSQL en CI |
| Cristian Sinisterra | 23 | 9 | Frontend del login (PR #24–#25), 10 historias de usuario iniciales, E2E de contacto y registro, E2E en CI, MSW, BD en Docker |

> Las cifras salen de `git log --all --format='%an|%ae'` y
> `git shortlog -sn --all -- backend/tests e2e '*.test.*'` el 20 nov 2026.
> Miden commits, no esfuerzo: parte del trabajo (revisiones, pruebas manuales,
> reuniones con la agencia) no deja commits.

## 13.4 Feedback del equipo (cada integrante escribe el suyo)

> Esta sección la llena cada integrante con su propia opinión; no se completa
> por otra persona. Sugerencia: 5 minutos por persona al cierre del último
> sprint, formato retrospectiva.

### Juan Pablo Castillo Velásquez

- **Qué salió bien:**
- **Qué se puede mejorar:**
- **Qué aprendí:**
- **Feedback para Fernando:**
- **Feedback para Cristian:**

### Fernando Gutiérrez

- **Qué salió bien:**
- **Qué se puede mejorar:**
- **Qué aprendí:**
- **Feedback para Juan Pablo:**
- **Feedback para Cristian:**

### Cristian Sinisterra

- **Qué salió bien:**
- **Qué se puede mejorar:**
- **Qué aprendí:**
- **Feedback para Juan Pablo:**
- **Feedback para Fernando:**

## 13.5 Retrospectiva del equipo (acuerdos)

| Seguir haciendo | Dejar de hacer | Empezar a hacer |
|---|---|---|
| | | |
