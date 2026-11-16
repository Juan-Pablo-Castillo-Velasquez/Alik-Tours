# HU-20 — Descargar mis comprobantes

| Campo | Valor |
| --- | --- |
| **ID** | HU-20 |
| **Actor** | Cliente |
| **Módulo** | Perfil |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /profile › Comprobantes |
| **API** | GET /api/pagos/reserva/{id} (el PDF se genera en el navegador, ComprobantePDF.tsx) |

## Historia

**Como** cliente,  
**quiero** descargar el comprobante de mis pagos y reservas en PDF,  
**para** tener soporte de lo que pagué.

## Criterios de aceptación

### CA-20.1 — Lista
- **Dado** que tengo pagos registrados,
- **cuando** abro Comprobantes,
- **entonces** veo cada pago con fecha, valor y estado.

### CA-20.2 — PDF
- **Dado** que elijo un comprobante,
- **cuando** lo descargo,
- **entonces** obtengo un PDF con los datos de la agencia, la reserva y el pago.

---

← [HU-19](HU-19_preferencias.md) · [Índice](README.md) · [HU-21](HU-21_mi_cuenta.md) →
