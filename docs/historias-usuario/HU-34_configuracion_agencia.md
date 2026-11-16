# HU-34 — Configurar los datos de la agencia

| Campo | Valor |
| --- | --- |
| **ID** | HU-34 |
| **Actor** | Administrador |
| **Módulo** | Administración |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /admin › Configuración |
| **API** | GET /api/configuracion · PUT /api/configuracion/{id} |

## Historia

**Como** administrador,  
**quiero** editar los datos de contacto, WhatsApp, redes y textos legales de la agencia,  
**para** que el sitio muestre siempre la información correcta sin tocar código.

## Criterios de aceptación

### CA-34.1 — Edición
- **Dado** que cambio el WhatsApp,
- **cuando** guardo,
- **entonces** el botón de WhatsApp del sitio usa el nuevo número.

---

← [HU-33](HU-33_usuarios_y_roles.md) · [Índice](README.md) · [HU-35](HU-35_rendimiento.md) →
