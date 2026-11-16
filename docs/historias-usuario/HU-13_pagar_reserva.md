# HU-13 — Pagar una reserva

| Campo | Valor |
| --- | --- |
| **ID** | HU-13 |
| **Actor** | Cliente |
| **Módulo** | Pagos |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /pagar/:id |
| **API** | POST /api/reservas/{id}/pagar · GET /api/pagos/reserva/{id} |

## Historia

**Como** cliente con una reserva pendiente,  
**quiero** pagar en línea con Nequi o PayPal, o pedir pago asistido por un asesor,  
**para** confirmar mi viaje.

## Criterios de aceptación

### CA-13.1 — Métodos
- **Dado** que abro Pagar,
- **cuando** veo las opciones,
- **entonces** puedo pagar con Nequi, PayPal o elegir que un asesor me contacte.

### CA-13.2 — Abonos
- **Dado** que pago una parte,
- **cuando** se registra el pago,
- **entonces** veo lo pagado y el saldo pendiente.

### CA-13.3 — Estados
- **Dado** que el pago se confirma,
- **cuando** reviso la reserva,
- **entonces** pasa a Confirmada y recibo una notificación.

### CA-13.4 — No pagable
- **Dado** que la reserva está cancelada o finalizada,
- **cuando** intento pagar,
- **entonces** el sistema no lo permite.

## Notas

Por ahora los pagos son asistidos por asesor; no hay pasarela de pago real.

---

← [HU-12](HU-12_reservar_vuelo.md) · [Índice](README.md) · [HU-14](HU-14_mis_reservas.md) →
