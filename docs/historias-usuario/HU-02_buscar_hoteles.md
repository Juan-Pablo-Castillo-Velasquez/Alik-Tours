# HU-02 — Buscar hoteles por destino y fechas

| Campo | Valor |
| --- | --- |
| **ID** | HU-02 |
| **Actor** | Visitante |
| **Módulo** | Catálogo |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | /search |
| **API** | GET /api/hoteles/destinos-sugeridos · GET /api/hoteles/?q=&fecha_checkin=&fecha_checkout= |

## Historia

**Como** viajero,  
**quiero** buscar hoteles escribiendo un destino y eligiendo mis fechas,  
**para** ver solo los hoteles que tienen habitaciones disponibles cuando quiero viajar.

## Criterios de aceptación

### CA-02.1 — Sugerencias de destino
- **Dado** que escribo en el buscador,
- **cuando** llevo al menos una letra,
- **entonces** veo sugerencias de ciudades donde hay hoteles reales.

### CA-02.2 — Filtro por disponibilidad
- **Dado** que elegí fecha de llegada y de salida,
- **cuando** busco,
- **entonces** solo aparecen hoteles con al menos una habitación libre en ese rango.

### CA-02.3 — Fechas inválidas
- **Dado** que la fecha de salida es igual o anterior a la de llegada,
- **cuando** busco,
- **entonces** el sistema no busca y me indica el error.

### CA-02.4 — Tarjetas de resultado
- **Dado** que hay resultados,
- **cuando** veo la lista,
- **entonces** cada hotel muestra foto, estrellas, ciudad, calificación de clientes y precio desde.

---

← [HU-01](HU-01_explorar_inicio.md) · [Índice](README.md) · [HU-03](HU-03_ver_ficha_hotel.md) →
