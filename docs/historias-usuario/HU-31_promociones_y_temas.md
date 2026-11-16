# HU-31 — Gestionar promociones, banners y temas de temporada

| Campo | Valor |
| --- | --- |
| **ID** | HU-31 |
| **Actor** | Administrador |
| **Módulo** | Comercial |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /admin › Promociones y banners · Temas de temporada |
| **API** | /api/banners (CRUD, /reordenar, /{id}/activo) · /api/temas · PUT /api/temas/{id}/activar |

## Historia

**Como** administrador,  
**quiero** publicar banners de promociones y cambiar el tema visual por temporada,  
**para** impulsar ventas en fechas especiales.

## Criterios de aceptación

### CA-31.1 — Banners
- **Dado** que creo un banner con imagen y vigencia,
- **cuando** lo activo,
- **entonces** aparece en el inicio durante la vigencia.

### CA-31.2 — Temas
- **Dado** que activo un tema (ej. Halloween o Navidad),
- **cuando** confirmo,
- **entonces** todo el sitio cambia de colores y adornos.

---

← [HU-30](HU-30_atender_cancelaciones.md) · [Índice](README.md) · [HU-32](HU-32_dashboard.md) →
