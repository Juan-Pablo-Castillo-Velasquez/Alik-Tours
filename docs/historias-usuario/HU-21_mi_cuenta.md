# HU-21 — Gestionar mi cuenta

| Campo | Valor |
| --- | --- |
| **ID** | HU-21 |
| **Actor** | Cliente |
| **Módulo** | Perfil |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /profile › Mi Cuenta |
| **API** | PUT /api/clientes/{id} · POST /api/usuarios/me/foto · PUT /api/usuarios/me/password |

## Historia

**Como** cliente,  
**quiero** actualizar mis datos personales, mi foto y mi contraseña,  
**para** mantener mi información al día.

## Criterios de aceptación

### CA-21.1 — Datos
- **Dado** que cambio mi celular o dirección,
- **cuando** guardo,
- **entonces** se actualizan y se usan en mis próximas reservas.

### CA-21.2 — Foto
- **Dado** que subo una foto de perfil,
- **cuando** la guardo,
- **entonces** aparece en el menú y en mis publicaciones.

### CA-21.3 — Contraseña
- **Dado** que cambio mi contraseña,
- **cuando** confirmo con la actual,
- **entonces** la nueva queda activa.

---

← [HU-20](HU-20_comprobantes.md) · [Índice](README.md) · [HU-22](HU-22_resena_estadia.md) →
