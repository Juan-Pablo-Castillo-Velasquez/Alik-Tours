# HU-28 — Gestionar ofertas aéreas

| Campo | Valor |
| --- | --- |
| **ID** | HU-28 |
| **Actor** | Administrador |
| **Módulo** | Productos |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /admin › Vuelos |
| **API** | POST/PUT/DELETE /api/vuelos · PATCH /api/vuelos/{id}/estado · GET /api/vuelos/{id}/pasajeros |

## Historia

**Como** administrador,  
**quiero** registrar ofertas aéreas con ruta, horarios, equipaje, condiciones, precios y cupos,  
**para** vender tiquetes sueltos o dentro de paquetes.

## Criterios de aceptación

### CA-28.1 — Estados
- **Dado** que creo una oferta,
- **cuando** la publico,
- **entonces** pasa de borrador a publicada y se ve en Vuelos; puedo pausarla o marcarla agotada.

### CA-28.2 — Pasajeros
- **Dado** que la oferta tiene reservas,
- **cuando** consulto pasajeros,
- **entonces** veo la lista para emitir con la aerolínea.

### CA-28.3 — Sin datos inventados
- **Dado** que no tengo confirmado un dato (ej. número de vuelo),
- **cuando** lo dejo vacío,
- **entonces** la vista pública no lo muestra.

---

← [HU-27](HU-27_gestionar_paquetes.md) · [Índice](README.md) · [HU-29](HU-29_gestionar_reservas_y_pagos.md) →
