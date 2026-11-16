# HU-08 — Iniciar sesión y recuperar mi contraseña

| Campo | Valor |
| --- | --- |
| **ID** | HU-08 |
| **Actor** | Cliente |
| **Módulo** | Cuentas |
| **Prioridad** | Alta |
| **Estado** | Implementada |
| **Pantalla** | Modal «Iniciar sesión» · /reset-password |
| **API** | POST /auth/login · POST /auth/forgot-password · POST /auth/reset-password |

## Historia

**Como** cliente registrado,  
**quiero** entrar con mi correo y contraseña, y recuperarla si la olvido,  
**para** acceder a mis reservas desde cualquier dispositivo.

## Criterios de aceptación

### CA-08.1 — Ingreso
- **Dado** que mis datos son correctos y mi correo está verificado,
- **cuando** inicio sesión,
- **entonces** entro al sitio con mi nombre en el menú.

### CA-08.2 — Datos incorrectos
- **Dado** que la contraseña es incorrecta,
- **cuando** intento entrar,
- **entonces** veo un mensaje de error sin revelar cuál dato falló; tras varios intentos se limita temporalmente.

### CA-08.3 — Recuperación
- **Dado** que olvidé mi contraseña,
- **cuando** la solicito con mi correo,
- **entonces** recibo un enlace para definir una nueva.

### CA-08.4 — Sesión vencida
- **Dado** que mi sesión expiró o la cuenta fue desactivada,
- **cuando** hago una acción,
- **entonces** el sitio me pide iniciar sesión de nuevo.

---

← [HU-07](HU-07_registro_y_verificacion.md) · [Índice](README.md) · [HU-09](HU-09_metodo_de_pago.md) →
