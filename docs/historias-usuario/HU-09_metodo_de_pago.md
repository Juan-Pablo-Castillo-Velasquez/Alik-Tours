# HU-09 — Registrar un método de pago

| Campo | Valor |
| --- | --- |
| **ID** | HU-09 |
| **Actor** | Cliente |
| **Módulo** | Perfil |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /profile › Métodos de Pago |
| **API** | GET/POST/DELETE /api/metodos-pago-guardados |

## Historia

**Como** cliente nuevo,  
**quiero** guardar un método de pago (tarjeta, Nequi o PayPal),  
**para** pagar mis reservas más rápido.

## Criterios de aceptación

### CA-09.1 — Obligatorio para cuentas nuevas
- **Dado** que mi cuenta es nueva y no tengo métodos guardados,
- **cuando** entro a mi perfil,
- **entonces** solo puedo usar la pestaña Métodos de Pago hasta registrar uno.

### CA-09.2 — Datos protegidos
- **Dado** que guardo una tarjeta,
- **cuando** se registra,
- **entonces** solo se muestran los últimos dígitos, nunca el número completo.

### CA-09.3 — Eliminar
- **Dado** que ya no uso un método,
- **cuando** lo elimino,
- **entonces** desaparece de mi lista.

---

← [HU-08](HU-08_inicio_sesion.md) · [Índice](README.md) · [HU-10](HU-10_reservar_hotel.md) →
