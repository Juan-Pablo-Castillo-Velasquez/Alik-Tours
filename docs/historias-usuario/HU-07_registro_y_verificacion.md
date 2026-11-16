# HU-07 — Registrarme y verificar mi correo

| Campo | Valor |
| --- | --- |
| **ID** | HU-07 |
| **Actor** | Visitante |
| **Módulo** | Cuentas |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | Modal «Crear cuenta» |
| **API** | POST /auth/register · POST /auth/verify-email-code · POST /auth/resend-verification |

## Historia

**Como** visitante,  
**quiero** crear una cuenta con mis datos y confirmar mi correo,  
**para** poder reservar, pagar y hablar con un asesor.

## Criterios de aceptación

### CA-07.1 — Registro
- **Dado** que lleno nombre, apellido, documento, correo, celular y contraseña y acepto términos y privacidad,
- **cuando** envío el formulario,
- **entonces** se crea mi cuenta y recibo un código de verificación por correo.

### CA-07.2 — Verificación
- **Dado** que recibí el código,
- **cuando** lo escribo,
- **entonces** mi correo queda verificado y puedo iniciar sesión.

### CA-07.3 — Reenvío
- **Dado** que no me llegó el código,
- **cuando** pido reenviarlo,
- **entonces** recibo uno nuevo.

### CA-07.4 — Correo repetido
- **Dado** que el correo ya está registrado,
- **cuando** intento registrarme,
- **entonces** el sistema me avisa y no crea otra cuenta.

---

← [HU-06](HU-06_guia_de_uso.md) · [Índice](README.md) · [HU-08](HU-08_inicio_sesion.md) →
