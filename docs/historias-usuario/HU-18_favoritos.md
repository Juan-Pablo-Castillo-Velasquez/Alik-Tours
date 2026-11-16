# HU-18 — Guardar hoteles favoritos

| Campo | Valor |
| --- | --- |
| **ID** | HU-18 |
| **Actor** | Cliente |
| **Módulo** | Perfil |
| **Prioridad** | Baja |
| **Estado** | Implementada |
| **Pantalla** | Corazón en tarjetas de hotel · /profile › Favoritos |
| **API** | GET/POST /api/favoritos · DELETE /api/favoritos/{id_hotel} |

## Historia

**Como** cliente,  
**quiero** marcar hoteles como favoritos,  
**para** compararlos y reservarlos después sin volver a buscarlos.

## Criterios de aceptación

### CA-18.1 — Marcar
- **Dado** que veo un hotel,
- **cuando** toco el corazón,
- **entonces** queda guardado en Favoritos.

### CA-18.2 — Quitar
- **Dado** que ya es favorito,
- **cuando** toco el corazón otra vez,
- **entonces** sale de la lista.

### CA-18.3 — Sin sesión
- **Dado** que no tengo sesión,
- **cuando** toco el corazón,
- **entonces** el sitio me invita a iniciar sesión.

---

← [HU-17](HU-17_notificaciones.md) · [Índice](README.md) · [HU-19](HU-19_preferencias.md) →
