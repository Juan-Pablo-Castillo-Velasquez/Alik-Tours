# HU-29 — Gestionar reservas y pagos

| Campo | Valor |
| --- | --- |
| **ID** | HU-29 |
| **Actor** | Asesor / Administrador |
| **Módulo** | Operaciones |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /admin › Reservas · Crear reserva · Pagos |
| **API** | GET /api/reservas · POST /api/reservas · PUT /api/reservas/{id} · POST /api/pagos/{id}/confirmar |

## Historia

**Como** asesor,  
**quiero** ver todas las reservas, crear reservas para clientes que llaman o escriben, registrar notas internas y confirmar pagos,  
**para** atender a los clientes por cualquier canal.

## Criterios de aceptación

### CA-29.1 — Listado
- **Dado** que abro Reservas,
- **cuando** filtro por estado,
- **entonces** veo las reservas con cliente, producto, total y saldo.

### CA-29.2 — Reserva asistida
- **Dado** que un cliente reserva por teléfono,
- **cuando** la creo desde «Crear reserva»,
- **entonces** queda con canal «empleado» o «teléfono».

### CA-29.3 — Pagos
- **Dado** que un cliente pagó por transferencia,
- **cuando** confirmo el pago,
- **entonces** se actualiza el saldo y el cliente recibe notificación.

### CA-29.4 — Notas internas
- **Dado** que escribo una nota interna,
- **cuando** la guardo,
- **entonces** solo la ve el equipo, nunca el cliente.

---

← [HU-28](HU-28_gestionar_vuelos.md) · [Índice](README.md) · [HU-30](HU-30_atender_cancelaciones.md) →
