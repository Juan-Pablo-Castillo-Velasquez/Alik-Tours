# HU-06 — Consultar la guía de uso

| Campo | Valor |
| --- | --- |
| **ID** | HU-06 |
| **Actor** | Visitante / Cliente |
| **Módulo** | Ayuda |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | Botón flotante «¿Cómo funciona?» en todo el sitio |
| **API** | — (solo frontend) |

## Historia

**Como** usuario del sitio,  
**quiero** abrir una guía paso a paso que me explique cómo reservar y cómo usar mi perfil,  
**para** resolver mis dudas sin tener que escribirle a un asesor.

## Criterios de aceptación

### CA-06.1 — Acceso permanente
- **Dado** que estoy en cualquier página pública o en mi perfil,
- **cuando** miro la esquina inferior derecha,
- **entonces** veo el botón «¿Cómo funciona?».

### CA-06.2 — Dos recorridos
- **Dado** que abro la guía,
- **cuando** se abre el panel,
- **entonces** puedo elegir entre «Cómo reservar» y «Tu perfil» y avanzar con Anterior / Siguiente.

### CA-06.3 — Atajos
- **Dado** que un paso tiene atajo (ej. «Ver paquetes»),
- **cuando** hago clic,
- **entonces** voy a esa pantalla y la guía se cierra.

### CA-06.4 — Contexto
- **Dado** que estoy en mi perfil,
- **cuando** abro la guía,
- **entonces** se abre directamente el recorrido «Tu perfil».

### CA-06.5 — Primera visita
- **Dado** que nunca he abierto la guía,
- **cuando** entro al sitio,
- **entonces** el botón muestra un indicador animado que desaparece al abrirla.

## Notas

No aparece en el panel de administración.

---

← [HU-05](HU-05_consultar_vuelos.md) · [Índice](README.md) · [HU-07](HU-07_registro_y_verificacion.md) →
