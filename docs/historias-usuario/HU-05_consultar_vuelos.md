# HU-05 — Consultar ofertas de vuelos

| Campo | Valor |
| --- | --- |
| **ID** | HU-05 |
| **Actor** | Visitante |
| **Módulo** | Vuelos |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /vuelos · /vuelos/:id |
| **API** | GET /api/vuelos?origen=&destino=&fecha_desde=&aerolinea= · GET /api/vuelos/{id} |

## Historia

**Como** viajero,  
**quiero** ver las ofertas aéreas de la agencia filtrando por origen, destino, fecha y aerolínea,  
**para** encontrar un tiquete a buen precio sin tener que buscar en cada aerolínea.

## Criterios de aceptación

### CA-05.1 — Solo ofertas vigentes
- **Dado** que entro a Vuelos,
- **cuando** carga la página,
- **entonces** solo veo ofertas publicadas con salida desde hoy y vigencia activa.

### CA-05.2 — Filtros
- **Dado** que elijo origen o destino,
- **cuando** aplico el filtro,
- **entonces** la lista muestra solo las ofertas que coinciden.

### CA-05.3 — Detalle
- **Dado** que abro una oferta,
- **cuando** carga el detalle,
- **entonces** veo horarios, escalas, equipaje de mano y de bodega, condiciones de cambio y cancelación, precio por adulto, niño e infante y sillas disponibles.

## Notas

Las ofertas las registra la agencia con lo que confirma el proveedor; no hay conexión en tiempo real con aerolíneas.

---

← [HU-04](HU-04_explorar_paquetes.md) · [Índice](README.md) · [HU-06](HU-06_guia_de_uso.md) →
