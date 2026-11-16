# HU-16 — Chatear con un asesor

| Campo | Valor |
| --- | --- |
| **ID** | HU-16 |
| **Actor** | Cliente |
| **Módulo** | Comunicación |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /profile › Mensajes · botón de chat |
| **API** | GET /api/mensajes/me · POST /api/mensajes/me/enviar · GET /api/mensajes/no-leidos |

## Historia

**Como** cliente,  
**quiero** escribirle a un asesor desde el sitio y adjuntar archivos,  
**para** resolver dudas sobre mis viajes sin salir de la plataforma.

## Criterios de aceptación

### CA-16.1 — Acceso
- **Dado** que tengo sesión,
- **cuando** toco el botón de chat,
- **entonces** se abre la pestaña Mensajes de mi perfil.

### CA-16.2 — Sin sesión
- **Dado** que no tengo cuenta,
- **cuando** toco el botón de chat,
- **entonces** puedo escribir por WhatsApp, crear una cuenta o usar el formulario de contacto.

### CA-16.3 — Adjuntos
- **Dado** que necesito enviar un documento,
- **cuando** adjunto el archivo,
- **entonces** el asesor lo recibe en el chat.

### CA-16.4 — No leídos
- **Dado** que el asesor me respondió,
- **cuando** navego por el sitio,
- **entonces** veo el contador de mensajes sin leer.

---

← [HU-15](HU-15_cancelar_reserva.md) · [Índice](README.md) · [HU-17](HU-17_notificaciones.md) →
