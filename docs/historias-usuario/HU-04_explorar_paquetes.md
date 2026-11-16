# HU-04 — Explorar paquetes turísticos

| Campo | Valor |
| --- | --- |
| **ID** | HU-04 |
| **Actor** | Visitante |
| **Módulo** | Catálogo |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /packages · /package/:id |
| **API** | GET /api/paquetes · GET /api/paquetes/{id}/detalle |

## Historia

**Como** viajero,  
**quiero** ver los paquetes con su itinerario día a día, qué incluyen y qué no, y las fechas de salida,  
**para** comparar planes completos y saber exactamente qué estoy comprando.

## Criterios de aceptación

### CA-04.1 — Listado
- **Dado** que entro a Paquetes,
- **cuando** carga la página,
- **entonces** veo los paquetes activos con portada, duración, destino, ciudad de salida y precio por persona.

### CA-04.2 — Detalle completo
- **Dado** que abro un paquete,
- **cuando** carga la ficha,
- **entonces** veo galería, itinerario por día, qué incluye y qué no incluye, hotel(es), vuelos asociados y condiciones.

### CA-04.3 — Salidas y cupos
- **Dado** que el paquete tiene salidas programadas,
- **cuando** reviso las fechas,
- **entonces** veo cada salida con los cupos disponibles.

### CA-04.4 — Exclusiones antes de comprar
- **Dado** que el paquete tiene exclusiones,
- **cuando** leo la ficha,
- **entonces** las exclusiones se muestran antes de reservar (Ley 1480).

---

← [HU-03](HU-03_ver_ficha_hotel.md) · [Índice](README.md) · [HU-05](HU-05_consultar_vuelos.md) →
