# HU-15 — Solicitar la cancelación de una reserva

| Campo | Valor |
| --- | --- |
| **ID** | HU-15 |
| **Actor** | Cliente |
| **Módulo** | Reservas |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /profile › Mis Reservas › Solicitar cancelación |
| **API** | POST /api/solicitudes-cancelacion |

## Historia

**Como** cliente,  
**quiero** solicitar la cancelación de una reserva indicando el motivo,  
**para** que la agencia la revise según las condiciones de lo que compré.

## Criterios de aceptación

### CA-15.1 — Solicitud
- **Dado** que mi reserva está pendiente o confirmada,
- **cuando** solicito la cancelación con un motivo,
- **entonces** queda una solicitud pendiente de revisión.

### CA-15.2 — Respuesta
- **Dado** que un asesor aprueba o rechaza,
- **cuando** se resuelve,
- **entonces** recibo notificación y correo; si se aprueba, la reserva queda Cancelada y se liberan los cupos.

### CA-15.3 — Una a la vez
- **Dado** que ya tengo una solicitud abierta para esa reserva,
- **cuando** intento otra,
- **entonces** el sistema no la duplica.

---

← [HU-14](HU-14_mis_reservas.md) · [Índice](README.md) · [HU-16](HU-16_chat_con_asesor.md) →
