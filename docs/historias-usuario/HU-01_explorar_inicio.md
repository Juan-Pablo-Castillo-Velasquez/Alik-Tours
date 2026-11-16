# HU-01 — Explorar la página de inicio

| Campo | Valor |
| --- | --- |
| **ID** | HU-01 |
| **Actor** | Visitante |
| **Módulo** | Catálogo |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | / |
| **API** | GET /api/promociones/destacados · GET /api/banners · GET /api/resenas/destacadas · GET /api/temas/activo |

## Historia

**Como** visitante del sitio,  
**quiero** ver en la página de inicio las promociones, destinos, paquetes destacados, vuelos y opiniones de otros viajeros,  
**para** decidir rápidamente si Alik Tours tiene un viaje para mí.

## Criterios de aceptación

### CA-01.1 — Contenido comercial
- **Dado** que entro a la página de inicio,
- **cuando** carga la página,
- **entonces** veo el buscador, los banners de promociones vigentes, paquetes destacados, vuelos y las reseñas destacadas (4 y 5 estrellas).

### CA-01.2 — Tema de temporada
- **Dado** que el administrador activó un tema de temporada (ej. Navidad),
- **cuando** visito el sitio,
- **entonces** los colores y adornos del sitio corresponden a ese tema.

### CA-01.3 — Accesos rápidos
- **Dado** que estoy en el inicio,
- **cuando** uso el menú,
- **entonces** puedo ir a Paquetes, Vuelos, Comunidad, Testimonios, Contacto y a iniciar sesión o registrarme.

## Notas

El contenido del inicio se cachea en el servidor (Redis) y en el navegador para que cargue rápido.

---

[Índice](README.md) · [HU-02](HU-02_buscar_hoteles.md) →
