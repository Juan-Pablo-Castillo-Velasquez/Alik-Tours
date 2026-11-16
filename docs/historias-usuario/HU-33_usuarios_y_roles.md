# HU-33 — Gestionar usuarios, roles y permisos

| Campo | Valor |
| --- | --- |
| **ID** | HU-33 |
| **Actor** | Administrador |
| **Módulo** | Administración |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /admin › Usuarios · Roles y permisos · Actividad |
| **API** | GET/POST/PUT /api/usuarios · /api/roles · /api/permisos |

## Historia

**Como** administrador,  
**quiero** crear usuarios del equipo, asignar roles y permisos, desactivar cuentas y revisar la actividad,  
**para** controlar quién puede hacer qué en el panel.

## Criterios de aceptación

### CA-33.1 — Roles
- **Dado** que asigno el rol asesor a un empleado,
- **cuando** guardo,
- **entonces** solo ve los módulos que su rol permite.

### CA-33.2 — Desactivar
- **Dado** que desactivo una cuenta,
- **cuando** el usuario intenta usarla,
- **entonces** su sesión se cierra y no puede volver a entrar.

### CA-33.3 — Actividad
- **Dado** que reviso la actividad,
- **cuando** abro el módulo,
- **entonces** veo las acciones recientes del sistema.

---

← [HU-32](HU-32_dashboard.md) · [Índice](README.md) · [HU-34](HU-34_configuracion_agencia.md) →
