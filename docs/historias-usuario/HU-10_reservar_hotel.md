# HU-10 — Reservar un hotel

| Campo | Valor |
| --- | --- |
| **ID** | HU-10 |
| **Actor** | Cliente |
| **Módulo** | Reservas |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /checkout/:id |
| **API** | POST /api/reservas/cotizar · POST /api/reservas |

## Historia

**Como** cliente,  
**quiero** reservar una habitación en 4 pasos: fechas y huéspedes, datos del viajero, revisión y pago,  
**para** asegurar mi alojamiento con el precio que vi.

## Criterios de aceptación

### CA-10.1 — Fechas ocupadas
- **Dado** que abro el calendario,
- **cuando** elijo fechas,
- **entonces** las noches ya reservadas aparecen bloqueadas.

### CA-10.2 — Capacidad
- **Dado** que elijo más huéspedes de los que admite la habitación,
- **cuando** intento continuar,
- **entonces** el sistema no me deja y me explica el límite.

### CA-10.3 — Resumen
- **Dado** que llego a Revisar reserva,
- **cuando** veo el resumen,
- **entonces** aparece el desglose de noches, precio, impuestos y total.

### CA-10.4 — Términos
- **Dado** que no he aceptado los términos,
- **cuando** intento confirmar,
- **entonces** no se crea la reserva.

### CA-10.5 — Sin duplicados
- **Dado** que hago doble clic en Confirmar,
- **cuando** se envía dos veces,
- **entonces** solo se crea una reserva (clave de idempotencia).

## Notas

La reserva queda Pendiente y el cliente recibe un correo de confirmación.

---

← [HU-09](HU-09_metodo_de_pago.md) · [Índice](README.md) · [HU-11](HU-11_reservar_paquete.md) →
