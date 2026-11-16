# HU-03 — Ver la ficha de un hotel y sus habitaciones

| Campo | Valor |
| --- | --- |
| **ID** | HU-03 |
| **Actor** | Visitante |
| **Módulo** | Catálogo |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /hotel/:id |
| **API** | GET /api/hoteles/{id} · GET /api/hoteles/{id}/fechas-ocupadas · GET /api/hoteles/{id}/similares |

## Historia

**Como** viajero,  
**quiero** ver toda la información de un hotel: fotos, servicios, políticas y cada tipo de habitación,  
**para** elegir la habitación que mejor se ajusta a mi viaje antes de reservar.

## Criterios de aceptación

### CA-03.1 — Galería y descripción
- **Dado** que abro un hotel,
- **cuando** carga la ficha,
- **entonces** veo la portada, la galería, la descripción, la ubicación y los servicios marcados como incluidos o con costo.

### CA-03.2 — Habitaciones
- **Dado** que el hotel tiene habitaciones publicadas,
- **cuando** reviso la sección de habitaciones,
- **entonces** veo por cada una nombre, fotos, capacidad, tipo de cama, vista, tamaño, servicios y precio por noche.

### CA-03.3 — Políticas
- **Dado** que bajo en la ficha,
- **cuando** llego a políticas,
- **entonces** veo horario de entrada y salida, política de cancelación, niños, mascotas e impuestos.

### CA-03.4 — Hoteles ocultos
- **Dado** que un hotel está oculto desde el panel,
- **cuando** intento abrirlo como visitante,
- **entonces** recibo 'Hotel no encontrado'.

### CA-03.5 — Similares
- **Dado** que hay otros hoteles en la misma ciudad,
- **cuando** llego al final de la ficha,
- **entonces** veo sugerencias de hoteles de esa ciudad.

---

← [HU-02](HU-02_buscar_hoteles.md) · [Índice](README.md) · [HU-04](HU-04_explorar_paquetes.md) →
