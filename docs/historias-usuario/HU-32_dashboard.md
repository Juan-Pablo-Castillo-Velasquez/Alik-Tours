# HU-32 — Consultar el dashboard de indicadores

| Campo | Valor |
| --- | --- |
| **ID** | HU-32 |
| **Actor** | Administrador / Asesor |
| **Módulo** | Operaciones |
| **Prioridad** | Media |
| **Estado** | Implementada |
| **Pantalla** | /admin › Dashboard |
| **API** | GET /api/dashboard/resumen |

## Historia

**Como** administrador,  
**quiero** ver indicadores de reservas, ingresos, cancelaciones y productos más vendidos,  
**para** tomar decisiones con datos.

## Criterios de aceptación

### CA-32.1 — Resumen
- **Dado** que abro el dashboard,
- **cuando** carga,
- **entonces** veo KPIs y gráficas actualizadas.

### CA-32.2 — Accesos rápidos
- **Dado** que quiero actuar,
- **cuando** uso los accesos rápidos,
- **entonces** voy a crear reserva, registrar hotel, crear paquete o ver clientes.

### CA-32.3 — Dashboard del asesor
- **Dado** que soy asesor,
- **cuando** abro el dashboard,
- **entonces** veo total de reservas, pendientes, confirmadas, canceladas, pagos pendientes e ingresos registrados de toda la agencia, las reservas recientes, la actividad del equipo, los viajes próximos, una gráfica de 14 días y mis propios indicadores de chat.

### CA-32.4 — Alertas
- **Dado** que entraron reservas hoy o hay reservas pendientes,
- **cuando** abro el dashboard,
- **entonces** aparece una alerta que me lleva a Reservas ya filtrado.

---

← [HU-31](HU-31_promociones_y_temas.md) · [Índice](README.md) · [HU-33](HU-33_usuarios_y_roles.md) →
