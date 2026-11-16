# HU-30 — Atender solicitudes de cancelación

| Campo | Valor |
| --- | --- |
| **ID** | HU-30 |
| **Actor** | Asesor / Administrador |
| **Módulo** | Operaciones |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /admin › Solicitudes de cancelación |
| **API** | GET /api/solicitudes-cancelacion · /api/solicitudes-cancelacion/{id}/resolver |

## Historia

**Como** asesor,  
**quiero** aprobar o rechazar las solicitudes de cancelación,  
**para** aplicar las condiciones de cada producto.

## Criterios de aceptación

### CA-30.1 — Bandeja
- **Dado** que hay solicitudes,
- **cuando** abro el módulo,
- **entonces** veo cada una con reserva, cliente y motivo.

### CA-30.2 — Aprobar
- **Dado** que apruebo,
- **cuando** confirmo,
- **entonces** la reserva queda cancelada, se liberan cupos y el cliente recibe correo.

### CA-30.3 — Rechazar
- **Dado** que rechazo,
- **cuando** indico el motivo,
- **entonces** el cliente lo ve en su perfil.

---

← [HU-29](HU-29_gestionar_reservas_y_pagos.md) · [Índice](README.md) · [HU-31](HU-31_promociones_y_temas.md) →
