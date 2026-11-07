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
| POST/PUT | `/api/hoteles/` | Admin — ficha completa y `servicios` con estado |
| GET | `/api/hoteles/?todos=true` | Staff — incluye hoteles ocultos |

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

| Ficha del hotel | políticas y servicios por estado, vaciar datos, web inválida → 422, hotel oculto fuera del sitio y visible en el panel, habitación oculta no reservable en línea, máximo de adultos | ✅ |

Suite completa del backend: 454 pruebas en verde (incluye las 425 anteriores, sin cambios). Frontend (Vitest): 257 pruebas, cobertura ≥ 80 %, con pruebas nuevas de `useCotizacion` y `PagoDeReserva`.

## 7. Entregas (todas publicadas en `main` tras CI verde)

| Parte | PR | Contenido |
|---|---|---|
| 1 | #40 | Backend: vuelos, paquetes completos, cotizador, desglose congelado, viajeros, estados. Migración `f5b9d2e7a1c3` |
| 2 | #41 | Panel: módulo Vuelos y formulario de paquetes por pasos |
| 3 | #42 | Web: reservar paquete, pagar reserva existente, ficha de paquete, checkout de hotel con adultos/niños |
| 4 | #43 | Panel: crear reserva (hotel/paquete/vuelo) y detalle comercial; ficha completa del hotel y de la habitación. Migración `a7c3e9b2d4f6` |

## 8. Arquitectura final

```
Hotel ─1:N─ Habitacion ─1:N─ ImagenHabitacion
  │  └─N:M─ Caracteristica (hotel_caracteristicas: estado incluido/de_pago/no_disponible)
  └─N:M─ Paquete (paquete_hotel, noches)
Paquete ─1:N─ ItinerarioDia · PaqueteInclusion · SalidaPaquete · ImagenPaquete
        ─N:M─ Servicio (paquete_servicios: incluido u opcional)
        ─N:M─ OfertaVuelo (paquete_vuelos)
Reserva ─N:1─ Cliente · Paquete? · SalidaPaquete? · OfertaVuelo?
        ─1:N─ ReservaConcepto (desglose congelado) · ViajeroReserva · ReservaHabitacion
                · ReservaServicio · Pago · HistorialReserva
        └─ snapshot_producto (JSON: lo vendido al momento de reservar)
```

Flujo único de precio: `SeleccionProducto` → `cotizacion_service.cotizar()` → (a) `/reservas/cotizar` para mostrar, (b) `crear_con_cotizacion` para guardar con bloqueo de filas. El pago (`/reservas/{id}/pagar`) cobra `precio_total`, que en reservas nuevas es la suma del desglose congelado.

## 9. Matriz de trazabilidad

| Requisito | Implementación | Prueba | Resultado |
|---|---|---|---|
| Vuelos gestionables desde administración | `vuelo_route.py`, `ModuleVuelos.tsx` | `TestVuelosAdmin` | ✅ |
| Filtros y paginación reales de vuelos | `/api/vuelos/admin` (estado, texto, origen, destino, aerolínea, fechas) | `test_crear_listar_filtrar_y_publicar` | ✅ |
| No inventar disponibilidad aérea | Aviso "ofertas gestionadas por la agencia"; horas opcionales | Revisión de pantallas | ✅ |
| Vuelo incluido / opcional / cotización / sin | `Paquete.modalidad_vuelo` + cotizador | Escenarios E y F | ✅ |
| Alojamiento incluido / opcional / sin | `Paquete.modalidad_alojamiento` + cotizador | Escenarios B, C, D | ✅ |
| No cobrar dos veces lo incluido | Conceptos incluidos en $0 | C y E (`subtotal == 0`) | ✅ |
| Cliente reserva sin opcionales | Opcionales solo si se eligen | B y D (sin hotel) | ✅ |
| Itinerario por días e incluye/no incluye | `itinerario_paquete`, `paquete_inclusiones` | B (detalle y snapshot) | ✅ |
| Salidas con cupos sin sobreventa | `salidas_paquete` + `FOR UPDATE` | H `test_cupos_de_salida_no_se_sobrevenden` | ✅ |
| Sillas de vuelo sin sobreventa | `ofertas_vuelo.cupos` + `FOR UPDATE` | H `test_sillas_del_vuelo_no_se_sobrevenden` | ✅ |
| Última habitación: solo una reserva | `_verificar_disponibilidad` con `FOR UPDATE` | H `test_la_ultima_habitacion...` | ✅ |
| Precios calculados en backend | `cotizacion_service` | A–H | ✅ |
| Cambio de precio durante el checkout | `precio_esperado` → 409 | G `test_precio_esperado_distinto...` | ✅ |
| Doble envío | `clave_idempotencia` | H `test_doble_envio...` | ✅ |
| Precio histórico congelado | `reserva_conceptos` + `snapshot_producto` | G `test_precio_congelado...` | ✅ |
| Transiciones de estado válidas + historial | `TRANSICIONES_RESERVA` | G | ✅ |
| Notas internas ocultas al cliente | `ReservaDetailAdminResponse` | G | ✅ |
| Documentos protegidos | Enmascarados al cliente; manifiesto solo staff | E | ✅ |
| Descuentos solo autorizados | `descuento` solo staff, con motivo en historial | G | ✅ |
| Reserva de paquete del cliente de principio a fin | `ReservarPaquete.tsx` + `PagoDeReserva` | B–F (API) + tests de `PagoDeReserva` y `useCotizacion` (Vitest) | ✅ API / ⚠️ pantalla sin E2E |
| Reserva administrativa completa | `ModuleCrearReserva.tsx` | G (API) | ✅ API / ⚠️ pantalla sin E2E |
| Pagos simulados identificados | Aviso "modo de prueba" en `PagoDeReserva` | Vitest `PagoDeReserva` | ✅ |
| Ficha completa del hotel y servicios por estado | Migración `a7c3e9b2d4f6`, `FichaHotelCampos.tsx` | `TestFichaCompletaDelHotel` | ✅ |
| Hotel/habitación ocultos | `publicado` / `publicada` | `TestFichaCompletaDelHotel` | ✅ |
| Capacidad adultos/niños de la habitación | Cotizador | `test_habitacion_oculta...` | ✅ |
| Migraciones seguras y reversibles | Solo agregan; up/down/up probados | PostgreSQL 16 local con datos de prueba | ✅ |

## 10. Pendiente y riesgos

- **Sin E2E de las pantallas nuevas** (reservar paquete, crear reserva del panel, vuelos): la lógica está cubierta por el API y Vitest, pero conviene un recorrido manual tras publicar.
- **Datos por completar** (no se inventan): ofertas aéreas reales; paquetes 5 y 6 tienen el vuelo como "servicio" (recrearlo como oferta y cambiar la modalidad); hoteles 9 y 10 sin habitaciones; ciudades mal escritas ("bgotoa"); itinerarios e inclusiones de cada paquete; políticas y servicios de cada hotel.
- **Servicios de hotel anteriores** quedan como "Disponible" (sin decir si cobran) hasta que el admin confirme su estado.
- **Moneda**: todo en COP; no hay conversión de divisas.
- **Inventario**: habitaciones físicas (una unidad por número), no por cantidad.
- **Facturación**: el comprobante sigue siendo un comprobante de pago interno, no factura electrónica DIAN.

## 11. Publicación y reversión

- Publicación: PR → CI verde (lint, backend, frontend, integración, E2E, Docker) → `main` (Render corre `alembic upgrade head` al arrancar; Vercel publica el frontend).
- Reversión de código: revertir los commits en `main`.
- Reversión de base de datos: `alembic downgrade e4a2c8f1b6d9` (deshace las dos migraciones; borra solo lo agregado). Ojo: borra también el desglose y los viajeros de las reservas nuevas — hacer respaldo antes.
