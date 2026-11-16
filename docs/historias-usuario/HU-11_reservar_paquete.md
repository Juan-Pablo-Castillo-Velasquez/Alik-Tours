# HU-11 — Reservar un paquete turístico

| Campo | Valor |
| --- | --- |
| **ID** | HU-11 |
| **Actor** | Cliente |
| **Módulo** | Reservas |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /package/:id/reservar |
| **API** | POST /api/reservas/cotizar · POST /api/reservas |

## Historia

**Como** cliente,  
**quiero** reservar un paquete eligiendo la salida, los viajeros y las opciones (alojamiento, vuelo, actividades),  
**para** comprar un plan completo sin coordinar cada parte por separado.

## Criterios de aceptación

### CA-11.1 — Salida
- **Dado** que el paquete tiene salidas programadas,
- **cuando** elijo una,
- **entonces** veo cuántos cupos quedan y no puedo pedir más de esos.

### CA-11.2 — Viajeros
- **Dado** que indico adultos, niños e infantes,
- **cuando** cambio las cantidades,
- **entonces** el precio se recalcula con la tarifa de cada uno y respeta el mínimo y máximo de viajeros.

### CA-11.3 — Vuelo
- **Dado** que el vuelo es opcional o a cotizar,
- **cuando** lo elijo,
- **entonces** se suma al total; si es a cotizar, la reserva queda con vuelo pendiente de cotización.

### CA-11.4 — Datos de viajeros
- **Dado** que confirmo,
- **cuando** envío,
- **entonces** se guardan los datos de cada viajero como aparecen en su documento.

### CA-11.5 — Lo vendido no cambia
- **Dado** que la agencia edita el paquete después,
- **cuando** consulto mi reserva,
- **entonces** veo las condiciones con las que compré (foto de lo vendido).

---

← [HU-10](HU-10_reservar_hotel.md) · [Índice](README.md) · [HU-12](HU-12_reservar_vuelo.md) →
