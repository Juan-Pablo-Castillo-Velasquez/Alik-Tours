# HU-19 — Configurar mis preferencias de viaje

| Campo | Valor |
| --- | --- |
| **ID** | HU-19 |
| **Actor** | Cliente |
| **Módulo** | Perfil |
| **Prioridad** | Baja |
| **Estado** | Implementada |
| **Pantalla** | /preferences · /profile › Preferencias |
| **API** | POST /api/preferencias-cliente · GET /api/preferencias-cliente/{id_cliente} · GET .../{id_cliente}/sugerencias |

## Historia

**Como** cliente,  
**quiero** contar con quién viajo, mi presupuesto, el clima, el ritmo y el transporte que prefiero,  
**para** recibir recomendaciones a mi medida.

## Criterios de aceptación

### CA-19.1 — Cuestionario
- **Dado** que respondo el cuestionario,
- **cuando** lo guardo,
- **entonces** mis preferencias quedan en mi perfil.

### CA-19.2 — Edición
- **Dado** que cambian mis gustos,
- **cuando** edito,
- **entonces** se actualizan.

---

← [HU-18](HU-18_favoritos.md) · [Índice](README.md) · [HU-20](HU-20_comprobantes.md) →
