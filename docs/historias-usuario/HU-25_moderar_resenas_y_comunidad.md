# HU-25 — Moderar reseñas y publicaciones

| Campo | Valor |
| --- | --- |
| **ID** | HU-25 |
| **Actor** | Asesor / Administrador |
| **Módulo** | Comunidad |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /admin › Comunidad y videos |
| **API** | GET /api/comunidad/admin/publicaciones · /api/comunidad/admin/publicaciones/{id}/moderar · /api/resenas/admin/{id}/responder · /api/resenas/admin/{id}/visibilidad |

## Historia

**Como** asesor de la agencia,  
**quiero** aprobar, rechazar u ocultar publicaciones, ocultar comentarios y responder u ocultar reseñas,  
**para** mantener la comunidad segura y responder a los clientes.

## Criterios de aceptación

### CA-25.1 — Pendientes
- **Dado** que hay publicaciones nuevas,
- **cuando** abro el módulo,
- **entonces** veo las pendientes con sus fotos o video.

### CA-25.2 — Decisión
- **Dado** que reviso una publicación,
- **cuando** la apruebo o rechazo con motivo,
- **entonces** el cliente ve el resultado.

### CA-25.3 — Responder reseñas
- **Dado** que un cliente dejó una reseña,
- **cuando** respondo,
- **entonces** la respuesta aparece públicamente bajo la reseña.

### CA-25.4 — Videos propios
- **Dado** que tengo un video de la agencia,
- **cuando** lo subo,
- **entonces** aparece en «Lo que hacemos» y, si lo marco, en el inicio.

---

← [HU-24](HU-24_contacto_y_corporativo.md) · [Índice](README.md) · [HU-26](HU-26_gestionar_hoteles.md) →
