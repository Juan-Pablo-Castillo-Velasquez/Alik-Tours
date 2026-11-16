# HU-14 — Consultar mis reservas

| Campo | Valor |
| --- | --- |
| **ID** | HU-14 |
| **Actor** | Cliente |
| **Módulo** | Perfil |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /profile › Mis Reservas |
| **API** | GET /api/reservas/cliente/{id} · GET /api/reservas/{id} |

## Historia

**Como** cliente,  
**quiero** ver todas mis reservas, su estado y el detalle de cada una,  
**para** saber en qué va cada viaje y qué me falta por pagar.

## Criterios de aceptación

### CA-14.1 — Listado y filtros
- **Dado** que entro a Mis Reservas,
- **cuando** carga la pestaña,
- **entonces** veo mis reservas con estado, fechas, total y saldo, y puedo filtrarlas.

### CA-14.2 — Calendario
- **Dado** que tengo un viaje próximo,
- **cuando** abro la vista de calendario,
- **entonces** veo el cronograma del viaje.

### CA-14.3 — Detalle
- **Dado** que abro una reserva,
- **cuando** se abre el detalle,
- **entonces** veo lo comprado, viajeros, pagos e historial de cambios.

### CA-14.4 — Hablar de la reserva
- **Dado** que tengo una duda sobre una reserva,
- **cuando** elijo «Hablar de esta reserva»,
- **entonces** se abre el chat con el asesor con la reserva referenciada.

---

← [HU-13](HU-13_pagar_reserva.md) · [Índice](README.md) · [HU-15](HU-15_cancelar_reserva.md) →
