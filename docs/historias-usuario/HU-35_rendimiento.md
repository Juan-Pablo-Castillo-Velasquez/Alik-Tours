# HU-35 — Navegar el sitio con rapidez

| Campo | Valor |
| --- | --- |
| **ID** | HU-35 |
| **Actor** | Visitante / Cliente |
| **Módulo** | Plataforma |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | Todo el sitio |
| **API** | Caché en Redis + memoria del servidor · caché de 60 s en el navegador · compresión GZip |

## Historia

**Como** usuario del sitio,  
**quiero** que el catálogo cargue rápido, incluso desde el celular,  
**para** no abandonar el sitio por esperar.

## Criterios de aceptación

### CA-35.1 — Catálogo en caché
- **Dado** que otra persona ya consultó los hoteles,
- **cuando** los consulto,
- **entonces** la respuesta sale del caché sin ir a la base de datos.

### CA-35.2 — Volver atrás
- **Dado** que regreso a una página que ya vi hace menos de un minuto,
- **cuando** navego,
- **entonces** se muestra al instante.

### CA-35.3 — Datos al día
- **Dado** que un administrador edita un producto,
- **cuando** lo consulto después,
- **entonces** veo el cambio en segundos.

### CA-35.4 — Redis caído
- **Dado** que Redis no responde,
- **cuando** uso el sitio,
- **entonces** todo sigue funcionando desde la base de datos, sin esperas largas.

## Notas

Ver backend/app/core/cache.py y .github/workflows/mantener-backend-activo.yml.

---

← [HU-34](HU-34_configuracion_agencia.md) · [Índice](README.md)
