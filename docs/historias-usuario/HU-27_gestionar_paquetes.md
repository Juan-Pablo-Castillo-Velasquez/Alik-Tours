# HU-27 — Gestionar paquetes turísticos

| Campo | Valor |
| --- | --- |
| **ID** | HU-27 |
| **Actor** | Administrador |
| **Módulo** | Productos |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /admin › Paquetes turísticos |
| **API** | POST/PUT/DELETE /api/paquetes · /api/paquetes/{id}/imagen · /galeria |

## Historia

**Como** administrador,  
**quiero** armar paquetes con itinerario, inclusiones, exclusiones, salidas, hoteles, vuelos y precios por tipo de viajero,  
**para** vender planes completos y claros.

## Criterios de aceptación

### CA-27.1 — Ficha comercial
- **Dado** que creo un paquete,
- **cuando** defino duración, noches, destino, categoría, vigencia y precios,
- **entonces** queda disponible para reservar si está activo.

### CA-27.2 — Itinerario e inclusiones
- **Dado** que agrego días e ítems de qué incluye / qué no,
- **cuando** guardo,
- **entonces** se muestran en ese orden en la ficha.

### CA-27.3 — Salidas
- **Dado** que programo salidas con cupos,
- **cuando** guardo,
- **entonces** los clientes solo pueden reservar en esas fechas y hasta agotar cupos.

### CA-27.4 — Desactivar
- **Dado** que un paquete ya no se vende,
- **cuando** lo elimino,
- **entonces** queda desactivado (no se borra) para conservar el historial.

---

← [HU-26](HU-26_gestionar_hoteles.md) · [Índice](README.md) · [HU-28](HU-28_gestionar_vuelos.md) →
