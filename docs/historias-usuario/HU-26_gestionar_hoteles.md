# HU-26 — Gestionar hoteles y habitaciones

| Campo | Valor |
| --- | --- |
| **ID** | HU-26 |
| **Actor** | Administrador |
| **Módulo** | Productos |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /admin › Hoteles |
| **API** | POST/PUT/DELETE /api/hoteles · /api/hoteles/{id}/imagen · /galeria · /habitaciones |

## Historia

**Como** administrador,  
**quiero** crear y editar hoteles con su ficha completa, fotos, servicios y habitaciones,  
**para** ofrecer información completa y actualizada a los clientes.

## Criterios de aceptación

### CA-26.1 — Ficha
- **Dado** que creo o edito un hotel,
- **cuando** guardo,
- **entonces** se actualiza la ficha pública en segundos (se limpia el caché).

### CA-26.2 — Fotos
- **Dado** que subo portada y galería,
- **cuando** las guardo,
- **entonces** se publican en Cloudinary y se ven en la ficha.

### CA-26.3 — Habitaciones
- **Dado** que agrego una habitación,
- **cuando** lleno su ficha y fotos,
- **entonces** aparece en la ficha del hotel si está publicada.

### CA-26.4 — Ocultar
- **Dado** que un hotel no debe venderse,
- **cuando** lo oculto,
- **entonces** deja de verse en el sitio pero sigue en el panel.

### CA-26.5 — Integridad
- **Dado** que el hotel tiene reservas,
- **cuando** intento eliminarlo,
- **entonces** el sistema lo impide y sugiere ocultarlo.

---

← [HU-25](HU-25_moderar_resenas_y_comunidad.md) · [Índice](README.md) · [HU-27](HU-27_gestionar_paquetes.md) →
