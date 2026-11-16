# HU-12 — Reservar un vuelo

| Campo | Valor |
| --- | --- |
| **ID** | HU-12 |
| **Actor** | Cliente |
| **Módulo** | Reservas |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /vuelos/:id/reservar |
| **API** | POST /api/reservas/cotizar · POST /api/reservas |

## Historia

**Como** cliente,  
**quiero** reservar sillas de una oferta aérea para mí y mis acompañantes,  
**para** asegurar el tiquete antes de que se agoten las sillas.

## Criterios de aceptación

### CA-12.1 — Sillas
- **Dado** que la oferta controla cupos,
- **cuando** pido más sillas de las libres,
- **entonces** el sistema me indica cuántas quedan.

### CA-12.2 — Pasajeros
- **Dado** que reservo,
- **cuando** lleno los datos,
- **entonces** debo registrar a cada pasajero con su documento.

### CA-12.3 — Emisión asistida
- **Dado** que la reserva se crea,
- **cuando** la consulto,
- **entonces** queda pendiente hasta que un asesor confirme la emisión con la aerolínea.

---

← [HU-11](HU-11_reservar_paquete.md) · [Índice](README.md) · [HU-13](HU-13_pagar_reserva.md) →
