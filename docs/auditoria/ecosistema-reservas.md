# Ecosistema de vuelos, hoteles, paquetes y reservas — Auditoría y diseño

Fecha: 2026-11-06 · Rama: `feature/ecosistema-reservas`

Documento vivo: la **Fase 1** (auditoría) refleja el estado del sistema
ANTES de esta mejora; las secciones siguientes se completan a medida que
se implementa cada fase. Nada se marca como hecho sin su prueba.

## 1. Inventario de datos en producción (solo lectura)

Consultado con los endpoints públicos (workflow `diagnostico-render`, sin
escribir nada) el 2026-11-06:

| Dato | Valor |
|---|---|
| Paquetes | 10, todos activos. 9 con hotel(es) vinculado(s) y noches; 1 (id 10) sin hotel |
| Paquetes con "condiciones" / "no incluye" | 0 / 0 |
| Paquetes con fotos propias | 0 |
| Paquetes 5 y 6 | Tienen un **vuelo modelado como servicio incluido** ("Vuelo Bogota - San Andres", "Transporte aereo Neiva - La Macarena") |
| Hoteles | 12 (2 sin habitaciones: ids 9 y 10 — los paquetes 2, 5 y 7 usan esos hoteles) |
| Hoteles con descripción / políticas | 1 / 0 |
| Ciudades mal escritas | hotel 12 "bgotoa", hotel 11 "Bogotá" vs "Bogota" |
| Tipos de habitación | 10 |

## 2. Diagnóstico (Fase 1)

| Módulo | Estado actual | Problema | Solución | Riesgo en producción |
|---|---|---|---|---|
| Vuelos | **No existe.** Solo `Paquete.ciudad_salida` (texto) y vuelos cargados como "servicios" | No se pueden registrar ofertas aéreas, cupos, pasajeros ni asociarlas a paquetes | Tabla `ofertas_vuelo` (gestionadas por la agencia, sin API externa), `paquete_vuelos`, API admin con filtros y paginación, manifiesto de pasajeros | Bajo: tablas nuevas |
| Hoteles | Nombre, estrellas, ciudad, país, dirección, contacto, descripción, políticas (texto), portada, galería, características sí/no | Sin tipo de alojamiento, región, web, check-in/out, políticas estructuradas; servicios solo "disponible sí/no" | Fase hotel: campos nuevos opcionales y estado por servicio (incluido / de pago / no disponible / no informado) | Bajo |
| Habitaciones | Unidad física por número, precio/noche, estado, tipo con capacidad, ficha completa y fotos (PR #38/#39) | Sin capacidad adultos/niños ni política de cancelación propia | Fase hotel | Bajo |
| Relación hotel–habitación | FK con cascade, `UNIQUE(hotel, número)` | Correcta | — | — |
| Paquetes | Nombre, descripción, días, precio base, activo, ciudad de salida, condiciones, no incluye (texto), hoteles con noches, servicios incluidos/opcionales, fotos | Sin noches, destino propio, vigencia, itinerario por días, incluye/no incluye estructurado, salidas con cupos, precio por niño/infante, unidad de precio, modalidad de alojamiento ni de vuelo | Columnas nuevas + `itinerario_paquete`, `paquete_inclusiones`, `salidas_paquete`, `paquete_vuelos`; validación de coherencia | Bajo: todo nullable/con default. Ajuste de datos reversible: paquetes con hotel → `modalidad_alojamiento='incluido'` (así se mostraban) |
| Reserva de hotel (web) | Checkout de 4 pasos; backend valida disponibilidad con `FOR UPDATE`, capacidad y precio × noches; idempotencia | Sin adultos/niños, sin desglose congelado, sin datos de huéspedes | Flujo nuevo con `tipo_producto='hotel'` y desglose | Bajo (el flujo anterior sigue funcionando) |
| Reserva de paquete (web) | **No existe.** "Personalizar" solo enlaza a la ficha | El cliente no puede comprar un paquete | Página de reserva de paquete + cotizador en backend | — |
| Reserva de paquete (panel) | Se crea con `id_paquete` + fechas | **Bug crítico: el total queda en $0** (`precio_total` solo suma habitaciones y servicios) y la reserva **no se puede pagar** (422 "no hay nada que cobrar") | Cotizador en backend que agrega el precio del paquete como concepto | Corrige datos nuevos; las reservas viejas no se tocan |
| Precios | Habitación: backend. Paquete en panel: estimado en el navegador (`precio_base × personas`) que no se guardaba | Precio de paquete calculado solo en el frontend | `POST /api/reservas/cotizar` y el mismo cálculo al crear; `precio_esperado` detecta cambios de precio (409) | — |
| Desglose / histórico | `precio_acordado` por habitación y servicio | No hay línea de paquete, vuelo, cargos ni descuentos; cambios de precio del producto no afectan (bien) pero tampoco hay fotografía de lo vendido | `reserva_conceptos` + `snapshot_producto` (JSON) | — |
| Viajeros | Solo `numero_personas` | No hay datos de pasajeros/huéspedes | `viajeros_reserva` (documento enmascarado al cliente, nunca en logs) | Datos personales: acceso solo dueño y staff |
| Estados de reserva | pendiente, confirmada, cancelada, finalizada; el admin podía pasar de cualquiera a cualquiera y el cambio no quedaba en el historial | Transiciones inválidas posibles; sin trazabilidad del cambio manual | Transiciones validadas (cancelada y finalizada son finales) + registro en historial | Bajo |
| Cambios de reservas confirmadas | `PUT /reservas/{id}` permitía cambiar paquete, fechas y personas sin recalcular | Cambio económico silencioso | Reservas con desglose congelado: 409 al cambiar producto/fechas/personas | Bajo |
| Pagos | Simulados (Nequi/PayPal/tarjeta/PSE), monto siempre del backend, `FOR UPDATE`, transiciones validadas, comprobante con número propio (no DIAN) | Correcto | Se reutiliza tal cual: `precio_total` ahora sale del desglose | — |
| Notas internas | Notas en el historial | El historial lo ve el cliente en algunos lugares | `notas_internas` en la reserva, nunca enviadas al cliente | — |
| Cupos | Habitaciones: por unidad física con bloqueo | Paquetes y vuelos sin cupos | Cupos por salida y por oferta aérea, verificados con `FOR UPDATE` | — |

## 3. Modelo comercial (Fase 2)

- **Productos independientes**: hotel (habitaciones), paquete, vuelo (solo si la oferta tiene `venta_independiente`).
- **Paquete** con `modalidad_alojamiento` (`sin` / `incluido` / `opcional`) y `modalidad_vuelo` (`sin` / `incluido` / `opcional` / `cotizacion`).
- **Opcionales**: alojamiento, vuelo y servicios con `incluido = false` (precio por persona).
- **Regla**: lo incluido aparece en el desglose con valor $0; lo opcional solo se cobra si se elige; la cotización de vuelo no suma hasta que la agencia la confirma.
- **Unidades de precio**: `por_persona` (adulto = `precio_base`, niño = `precio_nino` o tarifa de adulto, infante = `precio_infante` obligatorio para aceptarlos) o `por_paquete`. Habitación: por noche. Vuelo: por pasajero según tipo + cargos por pasajero.

## 4. Nuevas tablas y relaciones (Fase 8 / 10)

Migración `f5b9d2e7a1c3_ecosistema_reservas` (reversible, solo agrega):

- `ofertas_vuelo` — oferta aérea gestionada por la agencia.
- `paquete_vuelos` (N:M paquete–oferta).
- `itinerario_paquete` (1:N), `paquete_inclusiones` (1:N), `salidas_paquete` (1:N).
- `paquetes` + noches, destino, vigencia, modalidades, unidad de precio, precios por tipo de viajero, mínimo/máximo.
- `reservas` + tipo de producto, adultos/niños/infantes, salida, oferta aérea, estado del vuelo, solicitudes especiales, notas internas, `snapshot_producto`.
- `reserva_conceptos` (desglose congelado) y `viajeros_reserva`.

## 5. Endpoints

| Método | Ruta | Quién |
|---|---|---|
| GET | `/api/vuelos` | Público (publicadas y vigentes, filtros) |
| GET | `/api/vuelos/admin` | Staff (filtros, estado, búsqueda, paginación) |
| GET | `/api/vuelos/{id}` | Público si publicada; staff siempre |
| POST/PUT/DELETE | `/api/vuelos[/{id}]` | Admin |
| PATCH | `/api/vuelos/{id}/estado` | Admin |
| POST | `/api/vuelos/{id}/imagen` | Admin |
| GET | `/api/vuelos/{id}/reservas`, `/api/vuelos/{id}/pasajeros` | Staff |
| POST | `/api/reservas/cotizar` | Público (descuentos solo staff) |
| POST | `/api/reservas` | Cliente/staff — flujo nuevo con `tipo_producto` |
| GET | `/api/reservas/{id}` | Dueño (documentos enmascarados, sin notas internas) / staff |
| PUT | `/api/reservas/{id}/notas-internas` | Staff |
| POST | `/api/reservas/{id}/cotizacion-vuelo` | Admin |
| PUT | `/api/reservas/{id}` | Admin — ahora con transiciones válidas e historial |
| POST/PUT | `/api/paquetes` | Admin — ahora con itinerario, inclusiones, salidas, vuelos y modalidades |

## 6. Pruebas (Fase 12)

`backend/tests/api/test_ecosistema_reservas_api.py` — escenarios A a H:

| Escenario | Prueba | Resultado |
|---|---|---|
| A. Hotel independiente | cotiza, reserva con `precio_esperado`, paga (simulado) y cobra el total del backend; capacidad excedida → 422 | ✅ |
| B. Paquete sin vuelo ni hotel | itinerario e inclusiones, niños con tarifa propia, fecha de regreso según noches, snapshot; no acepta habitaciones ni vuelo | ✅ |
| C. Hotel incluido | alojamiento en $0, total = solo paquete | ✅ |
| D. Hotel opcional | sin hotel / con hotel cambia el total; noches fuera del paquete → 422 | ✅ |
| E. Vuelo incluido | vuelo en $0, exige datos de todos los pasajeros, documentos enmascarados al cliente, manifiesto para staff | ✅ |
| F. Vuelo opcional y cotización | suma tarifa + cargos, advierte impuestos no incluidos; cotización no suma hasta confirmar y se confirma una sola vez | ✅ |
| G. Reserva administrativa | descuento con motivo en historial, notas internas ocultas al cliente, estado inicial confirmado; cliente no puede descontar; precio congelado; transiciones inválidas → 409; cambio de precio → 409 | ✅ |
| H. Integridad | cupos de salida y sillas de vuelo no se sobrevenden; última habitación solo una vez; vuelo solo-paquete no se vende suelto; doble envío → una sola reserva; coherencia del paquete | ✅ |

Suite completa del backend: 450 pruebas en verde (más las 425 anteriores sin cambios).

## 7. Pendiente (se completa en las siguientes entregas)

- Panel: módulo de vuelos, formulario de paquetes por pasos, crear reserva por tipo, detalle de reserva con desglose/viajeros/vuelo.
- Web: reserva de paquete para el cliente, pago de una reserva existente, ficha de paquete con itinerario/incluye/vuelo.
- Ficha completa del hotel.
- Datos a revisar por la agencia: paquetes 5 y 6 (vuelo como servicio), hoteles 9 y 10 sin habitaciones, ciudades mal escritas.

## 8. Publicación y reversión

- Publicación: PR → CI verde → `main` (Render corre `alembic upgrade head` al arrancar).
- Reversión de código: revertir el merge en `main`.
- Reversión de base de datos: `alembic downgrade e4a2c8f1b6d9` (borra solo lo agregado; probado arriba/abajo/arriba en PostgreSQL 16 con los datos de prueba).
