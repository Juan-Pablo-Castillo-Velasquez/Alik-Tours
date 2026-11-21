# HU-36 — Ver la telemetría de los vehículos de traslado

| Campo | Valor |
| --- | --- |
| **ID** | HU-36 |
| **Actor** | Administrador · Dispositivo IoT |
| **Módulo** | IoT (prototipo) |
| **Prioridad** | Baja (bonificación) |
| **Estado** | Implementada (prototipo) |
| **Pantalla** | /admin › Telemetría IoT |
| **API** | POST /api/iot/lecturas · GET/POST /api/iot/dispositivos · PATCH /api/iot/dispositivos/{id}/activo · GET /api/iot/dispositivos/{id}/lecturas |

## Historia

**Como** administrador,  
**quiero** ver la posición, la temperatura de cabina, los pasajeros y la batería de cada vehículo de traslado,  
**para** saber si el traslado va bien y reaccionar ante una alerta.

## Criterios de aceptación

### CA-36.1 — Registro del dispositivo
- **Dado** que registro un dispositivo en el panel,
- **cuando** se crea,
- **entonces** veo su clave una sola vez y el servidor solo guarda su hash.

### CA-36.2 — Envío de lecturas
- **Dado** que el dispositivo envía una lectura con su clave en `X-Device-Key`,
- **cuando** los valores están en rango,
- **entonces** se guarda (201) y el dispositivo queda "En línea"; sin clave o con clave falsa recibe 401 y con valores imposibles 422.

### CA-36.3 — Alertas
- **Dado** que la cabina supera 28 °C, la velocidad 100 km/h o la batería baja de 15 %,
- **cuando** llega la lectura,
- **entonces** la respuesta y el panel muestran la alerta.

### CA-36.4 — Desactivar
- **Dado** que desactivo un dispositivo,
- **cuando** intenta enviar otra lectura,
- **entonces** el servidor la rechaza con 401.

Protocolo y prototipo: [`docs/entrega-final/06-iot.md`](../entrega-final/06-iot.md).

---
← [HU-35](HU-35_rendimiento.md)
