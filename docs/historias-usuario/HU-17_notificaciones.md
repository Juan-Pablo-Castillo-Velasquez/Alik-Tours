# HU-17 — Recibir notificaciones

| Campo | Valor |
| --- | --- |
| **ID** | HU-17 |
| **Actor** | Cliente |
| **Módulo** | Comunicación |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | Campana del menú |
| **API** | GET /api/notificaciones |

## Historia

**Como** cliente,  
**quiero** ver avisos de lo que pasa con mis reservas, pagos y mensajes,  
**para** enterarme a tiempo sin revisar cada pantalla.

## Criterios de aceptación

### CA-17.1 — Campana
- **Dado** que hay avisos nuevos,
- **cuando** miro el menú,
- **entonces** la campana muestra cuántos hay sin leer.

### CA-17.2 — Ir al detalle
- **Dado** que hago clic en una notificación,
- **cuando** se abre,
- **entonces** me lleva a la pestaña o reserva correspondiente.

---

← [HU-16](HU-16_chat_con_asesor.md) · [Índice](README.md) · [HU-18](HU-18_favoritos.md) →
