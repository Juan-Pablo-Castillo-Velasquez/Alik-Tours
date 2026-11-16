# HU-23 — Publicar en la comunidad viajera

| Campo | Valor |
| --- | --- |
| **ID** | HU-23 |
| **Actor** | Cliente |
| **Módulo** | Comunidad |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /comunidad |
| **API** | GET/POST /api/comunidad/publicaciones · POST /api/comunidad/publicaciones/{id}/comentarios |

## Historia

**Como** viajero,  
**quiero** compartir fotos (hasta 4) o un video corto de mi viaje con un texto y comentar las publicaciones de otros,  
**para** inspirar a otros viajeros e inspirarme con sus experiencias.

## Criterios de aceptación

### CA-23.1 — Publicar
- **Dado** que tengo sesión,
- **cuando** subo fotos o un video con título, destino y texto,
- **entonces** la publicación queda pendiente de moderación.

### CA-23.2 — Moderación
- **Dado** que un asesor aprueba mi publicación,
- **cuando** entro a la comunidad,
- **entonces** la veo publicada.

### CA-23.3 — Comentarios
- **Dado** que veo una publicación aprobada,
- **cuando** comento,
- **entonces** mi comentario aparece de inmediato; el equipo puede ocultarlo si incumple las normas.

### CA-23.4 — Videos de la agencia
- **Dado** que entro a la comunidad,
- **cuando** bajo a «Lo que hacemos»,
- **entonces** veo los videos propios de Alik Tours.

---

← [HU-22](HU-22_resena_estadia.md) · [Índice](README.md) · [HU-24](HU-24_contacto_y_corporativo.md) →
