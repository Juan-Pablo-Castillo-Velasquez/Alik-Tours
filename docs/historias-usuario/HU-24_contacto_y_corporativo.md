# HU-24 — Contactar a la agencia y pedir planes corporativos

| Campo | Valor |
| --- | --- |
| **ID** | HU-24 |
| **Actor** | Visitante |
| **Módulo** | Comercial |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /contact · /corporate |
| **API** | POST /api/contacto · POST /api/solicitudes-corporativas |

## Historia

**Como** visitante o empresa,  
**quiero** enviar un mensaje o una solicitud de viaje corporativo sin necesidad de cuenta,  
**para** que un asesor me contacte.

## Criterios de aceptación

### CA-24.1 — Contacto
- **Dado** que lleno el formulario de contacto,
- **cuando** lo envío,
- **entonces** el equipo lo recibe y yo veo una confirmación.

### CA-24.2 — Corporativo
- **Dado** que represento una empresa,
- **cuando** envío la solicitud,
- **entonces** queda registrada en el panel en Empresas y contactos.

### CA-24.3 — Validación
- **Dado** que dejo campos obligatorios vacíos o un correo inválido,
- **cuando** envío,
- **entonces** veo qué campo corregir.

---

← [HU-23](HU-23_comunidad.md) · [Índice](README.md) · [HU-25](HU-25_moderar_resenas_y_comunidad.md) →
