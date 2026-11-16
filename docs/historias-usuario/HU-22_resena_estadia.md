# HU-22 — Dejar una reseña de mi estadía

| Campo | Valor |
| --- | --- |
| **ID** | HU-22 |
| **Actor** | Cliente |
| **Módulo** | Reseñas |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /profile › Mis Reservas › Dejar reseña |
| **API** | POST /api/resenas · PUT /api/resenas/{id} · GET /api/resenas/mias |

## Historia

**Como** cliente que se hospedó en un hotel reservado con Alik Tours,  
**quiero** calificar de 1 a 5 estrellas y comentar mi experiencia, opcionalmente con foto,  
**para** ayudar a otros viajeros a decidir.

## Criterios de aceptación

### CA-22.1 — Solo lo que reservé
- **Dado** que tengo una reserva de hotel a mi nombre,
- **cuando** dejo la reseña,
- **entonces** queda asociada a ese hotel.

### CA-22.2 — Una por reserva
- **Dado** que ya reseñé esa reserva,
- **cuando** intento otra,
- **entonces** el sistema me permite editar la existente en lugar de duplicarla.

### CA-22.3 — Promedio real
- **Dado** que se publica mi reseña,
- **cuando** otro visitante ve el hotel,
- **entonces** la calificación promedio y el número de reseñas incluyen la mía.

### CA-22.4 — Respuesta de la agencia
- **Dado** que la agencia responde,
- **cuando** veo mi reseña,
- **entonces** aparece la respuesta pública de Alik Tours.

## Notas

Las reseñas solo las escriben clientes reales: no se publican reseñas creadas por la agencia.

---

← [HU-21](HU-21_mi_cuenta.md) · [Índice](README.md) · [HU-23](HU-23_comunidad.md) →
