# 8. Informe de pruebas unitarias automatizadas

**Fecha de ejecución:** 20 nov 2026 · **Rama:** `entrega/rubrica-final` ·
**Resultado:** 455 casos unitarios automatizados, **455 aprobados, 0 fallidos**.

| Suite | Herramienta | Comando | Casos | Aprobados | Tiempo |
|---|---|---|---|---|---|
| Unitarias backend (`backend/tests/unit`, 7 archivos, 39 funciones de prueba) | pytest 9 | `cd backend && pytest tests/unit --no-cov` | 99 | 99 | 0,98 s |
| Unitarias y de componentes frontend (46 archivos) | Vitest + Testing Library + MSW | `cd alecktourfrondend && pnpm test` | 356 | 356 | ver CI |

Cobertura al cerrar (suite completa): **backend 86,16 %** (umbral 81 %),
**frontend 92,87 % de líneas y 92,97 % de ramas** (umbral 80 %). Un descenso por
debajo del umbral hace fallar el CI.

## 8.1 Casos de prueba (27 distintos)

Cada caso es una función de prueba distinta (no variaciones de la misma).
Los casos parametrizados se cuentan una vez aunque ejecuten varias entradas.

| ID | Módulo | Caso (archivo :: prueba) | Entrada | Resultado esperado | Resultado |
|---|---|---|---|---|---|
| UT-01 | Pagos | `test_reglas_de_pago.py::TestTransicionesDePago::test_un_estado_final_no_cambia_nunca` | 15 combinaciones estado final → nuevo estado | `ValueError`: un pago pagado/rechazado/cancelado no cambia | ✅ |
| UT-02 | Pagos | `…::test_procesando_no_puede_volver_a_pendiente` | procesando → pendiente | Rechazado | ✅ |
| UT-03 | Pagos | `…::TestPagoAsincrono::test_pse_y_nequi_quedan_procesando_hasta_confirmar` | método `pse`, `nequi` | Estado `procesando` | ✅ |
| UT-04 | Pagos | `…::TestSimularRechazo::test_datos_de_prueba_deciden_el_rechazo` | 12 tarjetas/cuentas de prueba | Rechaza solo los datos marcados como de rechazo | ✅ |
| UT-05 | Pagos | `…::TestNumeroComprobante::test_rellena_con_ceros_hasta_seis_cifras` | 1, 45, 999999, 1000000 | `FAC-000001` … `FAC-1000000` | ✅ |
| UT-06 | Pagos | `…::TestTotalPagado::test_suma_solo_los_pagos_aprobados` | pagos aprobados, rechazados y pendientes | Suma solo los aprobados | ✅ |
| UT-07 | Pagos (dobles) | `test_dobles_repositorio.py::…::test_una_transicion_invalida_no_toca_la_bd_ni_notifica` | Transición inválida con repositorio doble | No hay commit ni notificación | ✅ |
| UT-08 | Pagos (dobles) | `…::test_aprobar_confirma_la_reserva_numera_el_comprobante_y_deja_historial` | Aprobar un pago pendiente | Reserva confirmada + comprobante + historial | ✅ |
| UT-09 | Registro (dobles) | `…::TestRegistroDeUsuario::test_guarda_la_contrasena_hasheada_y_sin_verificar` | Usuario nuevo | Hash bcrypt, `verificado = False` | ✅ |
| UT-10 | Esquemas | `test_limites_de_esquemas.py::…::test_regla_de_contrasena_igual_a_la_del_formulario` | `Abc123`, `Ab123`, `abc123`, `ABC123`, `Abcdef`, `""` | Solo `Abc123` es válida | ✅ |
| UT-11 | Esquemas | `…::test_usuario_de_51_caracteres_se_rechaza` | Usuario de 51 caracteres | `ValidationError` | ✅ |
| UT-12 | Esquemas | `…::test_numero_de_habitacion_de_20_es_valido_y_de_21_no` | 20 y 21 caracteres | Válido / inválido (valor límite) | ✅ |
| UT-13 | BD | `…::test_el_motor_de_la_bd_no_escribe_el_sql_en_el_log_por_defecto` | Configuración por defecto | `echo = False` | ✅ |
| UT-14 | Validadores | `test_validadores.py::TestCelular::test_normaliza_y_acepta_celulares_validos` | `300 123 4567`, `+57 300…`, `+1 202…` | Normalizados (`3001234567`, `+12025550143`) | ✅ |
| UT-15 | Validadores | `…::TestFechaValida::test_rechaza_anios_fuera_del_rango` | 1, 1899, 2101, 9999 | Rechazados | ✅ |
| UT-16 | Caché | `test_cache_dos_niveles.py::test_cortocircuito_no_reintenta_redis_caido` | Redis que falla | Un solo intento; mientras dura el cortocircuito no vuelve a tocar Redis y la memoria local sigue funcionando | ✅ |
| UT-17 | Correo | `test_mail_logs.py::test_oculta_el_usuario_del_correo` | `juanpablo@gmail.com` | En el log: `ju***@gmail.com` | ✅ |
| UT-18 | IoT | `test_simulador_iot.py::test_lecturas_del_simulador_cumplen_el_esquema` | 20 lecturas normales y 20 con calor | Todas válidas para `LecturaIoTEntrada`; con calor > 28 °C | ✅ |
| UT-19 | Front · Sesión | `AuthContext.test.tsx` › si el usuario guardado está corrupto, descarta la sesión en vez de romper la app | `localStorage` con JSON inválido | Sin sesión, sin error | ✅ |
| UT-20 | Front · Rutas | `ProtectedRoute.test.tsx` › sin sesión manda al inicio y abre el modal de login una sola vez | Ruta privada sin token | Redirección + modal una vez | ✅ |
| UT-21 | Front · HTTP | `api.test.ts` › antepone /api, manda el token guardado y devuelve el JSON | `apiFetch('/hoteles')` con MSW | URL `/api/hoteles`, cabecera `Authorization` | ✅ |
| UT-22 | Front · Accesibilidad | `contrasteWcag.test.ts` › convierte un hex… / rechaza `#fff` | Colores de los temas | Contraste calculado según WCAG | ✅ |
| UT-23 | Front · Formularios | `validacionFormulario.test.ts` › obligatorio: vacío o solo espacios no pasa | `"   "` | Error de campo obligatorio | ✅ |
| UT-24 | Front · Filtros | `DateRangeFilter.test.tsx` › cada extremo tiene su nombre y limita al otro (desde <= hasta) | Rango de fechas | `min`/`max` cruzados | ✅ |
| UT-25 | Front · Reserva | `Confirmation.test.tsx` › `codigoReserva` sale del id real de la reserva | 57, 1234567 | `AT-000057`, `AT-1234567` (DEF-19) | ✅ |
| UT-26 | Front · IoT | `ModuleIoT.test.tsx` › muestra el estado, la última lectura y las alertas de cada vehículo | Dispositivo con 30,1 °C | "En línea", alerta y enlace a la posición | ✅ |
| UT-27 | Front · WhatsApp | `whatsapp.test.ts` › normaliza `+57 322 812 7104` a `573228127104` | Números con espacios y prefijo | Formato `wa.me` | ✅ |

Técnicas aplicadas: **valores límite** (UT-11, UT-12, UT-15), **partición de
equivalencia** (UT-04, UT-10, UT-14), **tabla de transición de estados**
(UT-01 a UT-03), **dobles de prueba** — fakes y mocks — (UT-07 a UT-09, UT-16,
UT-21 con MSW) y patrón **Arrange / Act / Assert** en todos.

## 8.2 Cómo se reproduce

```bash
cd backend && pytest tests/unit --no-cov -v            # 99 casos
cd backend && pytest                                    # suite completa + cobertura (umbral 81 %)
cd alecktourfrondend && pnpm test                       # 356 casos + cobertura (umbral 80 %)
```

Evidencia en CI: workflow **tests** de GitHub Actions (`.github/workflows/tests.yml`), que
publica el reporte de cobertura de cada ejecución.
