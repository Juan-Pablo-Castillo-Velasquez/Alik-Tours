# Referencia completa de la API

> Generada por `backend/scripts/generar_referencia_api.py` desde el OpenAPI
> real de FastAPI (no editar a mano). Documentación interactiva: `/docs`
> (Swagger UI) y `/redoc` del backend. Esquema importable en Postman:
> [`openapi.json`](openapi.json).

**221 operaciones en 28 módulos** · versión 1.0.0.

Autenticación: `JWT` = cabecera `Authorization: Bearer <token>` de
`POST /auth/login` (el rol requerido —cliente, empleado o admin— se valida
en el servidor contra la base de datos). `*` = parámetro obligatorio.
Errores: ver el contrato en `docs/entrega-final/03-arranque-del-backend.md`.

## Módulos

- [Auth](#auth) (7)
- [Banners](#banners) (7)
- [Clientes y Empleados](#clientes-y-empleados) (14)
- [Comunidad](#comunidad) (17)
- [Configuración](#configuración) (4)
- [Contacto](#contacto) (1)
- [Dashboard](#dashboard) (2)
- [Destinos](#destinos) (6)
- [Empresas y Contactos](#empresas-y-contactos) (4)
- [Favoritos](#favoritos) (4)
- [General](#general) (1)
- [Hoteles](#hoteles) (26)
- [IoT](#iot) (5)
- [Mensajes](#mensajes) (8)
- [Métodos de pago guardados](#métodos-de-pago-guardados) (5)
- [Notificaciones](#notificaciones) (5)
- [Permisos](#permisos) (1)
- [Preferencias](#preferencias) (4)
- [Promociones](#promociones) (2)
- [Reservas, Paquetes y Pagos](#reservas,-paquetes-y-pagos) (41)
- [Reseñas](#reseñas) (10)
- [Roles](#roles) (5)
- [Salud](#salud) (1)
- [Servicios](#servicios) (6)
- [Solicitudes de cancelación](#solicitudes-de-cancelación) (5)
- [Temas](#temas) (11)
- [Usuarios](#usuarios) (8)
- [Vuelos](#vuelos) (11)

## Auth

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `POST` | `/auth/forgot-password` | Forgot Password | Pública | — | `PasswordResetRequest` | 200, 422 |
| `POST` | `/auth/login` | Login | Pública | — | `UsuarioLogin` | 200, 422 |
| `POST` | `/auth/register` | Register | Pública | — | `UsuarioCreate` | 201, 422 |
| `POST` | `/auth/resend-verification` | Reenvía el correo de verificación. Antes, si el primer correo no | Pública | — | `ResendVerificationRequest` | 200, 422 |
| `POST` | `/auth/reset-password` | Reset Password Endpoint | Pública | — | `PasswordResetConfirm` | 200, 422 |
| `POST` | `/auth/verify-email` | Verify Email | Pública | `token`* | — | 200, 422 |
| `POST` | `/auth/verify-email-code` | Verifica la cuenta con el código de 6 dígitos que llegó en el mismo | Pública | — | `VerifyEmailCodeRequest` | 200, 422 |

## Banners

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/banners/` | Listado completo (incluye inactivos/fuera de vigencia) para | JWT | — | — | 200, 422 |
| `POST` | `/api/banners/` | Create Banner | JWT | — | `Body_create_banner_api_banners__post` | 201, 422 |
| `GET` | `/api/banners/activos` | Solo banners activos y dentro de su rango de vigencia, en orden — | Pública | `tipo` | — | 200, 422 |
| `PUT` | `/api/banners/reordenar` | Reordenar Banners | JWT | — | `application/json` | 200, 422 |
| `PUT` | `/api/banners/{banner_id}` | Update Banner | JWT | `banner_id`* | `Body_update_banner_api_banners__banner_id__put` | 200, 422 |
| `DELETE` | `/api/banners/{banner_id}` | Delete Banner | JWT | `banner_id`* | — | 200, 422 |
| `PATCH` | `/api/banners/{banner_id}/activo` | Toggle Activo Banner | JWT | `banner_id`* | `BannerActivoUpdate` | 200, 422 |

## Clientes y Empleados

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/clientes` | Get Clientes | JWT | `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/clientes` | Create Cliente | JWT | — | `ClienteCreate` | 201, 422 |
| `GET` | `/api/clientes/{cliente_id}` | Get Cliente | JWT | `cliente_id`* | — | 200, 422 |
| `PUT` | `/api/clientes/{cliente_id}` | Update Cliente | JWT | `cliente_id`* | `ClienteUpdate` | 200, 422 |
| `DELETE` | `/api/clientes/{cliente_id}` | Delete Cliente | JWT | `cliente_id`* | — | 200, 422 |
| `PUT` | `/api/clientes/{cliente_id}/cambiar-contrasena` | Cambiar Contrasena | JWT | `cliente_id`* | `CambiarContrasenaRequest` | 200, 422 |
| `GET` | `/api/clientes/{cliente_id}/metodos-pago` | Métodos de pago guardados de un cliente, para que el admin pueda | JWT | `cliente_id`* | — | 200, 422 |
| `GET` | `/api/empleados` | Get Empleados | JWT | `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/empleados` | Create Empleado | JWT | — | `EmpleadoCreate` | 201, 422 |
| `GET` | `/api/empleados/activos/lista` | Get Empleados Activos | JWT | `skip`, `limit` | — | 200, 422 |
| `GET` | `/api/empleados/{empleado_id}` | Get Empleado | JWT | `empleado_id`* | — | 200, 422 |
| `PUT` | `/api/empleados/{empleado_id}` | Update Empleado | JWT | `empleado_id`* | `EmpleadoUpdate` | 200, 422 |
| `DELETE` | `/api/empleados/{empleado_id}` | Delete Empleado | JWT | `empleado_id`* | — | 200, 422 |
| `PUT` | `/api/usuarios/{usuario_id}/vincular-cliente` | Vincular Cliente | JWT | `usuario_id`* | `VincularClienteRequest` | 200, 422 |

## Comunidad

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `PUT` | `/api/comunidad/admin/comentarios/{id_comentario}` | Admin Ocultar Comentario | JWT | `id_comentario`* | `OcultarComentario` | 200, 422 |
| `GET` | `/api/comunidad/admin/publicaciones` | Admin Listar Publicaciones | JWT | `estado` | — | 200, 422 |
| `DELETE` | `/api/comunidad/admin/publicaciones/{id_publicacion}` | Admin Borrar Publicacion | JWT | `id_publicacion`* | — | 200, 422 |
| `PUT` | `/api/comunidad/admin/publicaciones/{id_publicacion}/moderar` | Admin Moderar | JWT | `id_publicacion`* | `ModerarPublicacion` | 200, 422 |
| `GET` | `/api/comunidad/admin/videos` | Admin Listar Videos | JWT | — | — | 200, 422 |
| `POST` | `/api/comunidad/admin/videos` | Admin Subir Video | JWT | — | `Body_admin_subir_video_api_comunidad_admin_videos_post` | 201, 422 |
| `PUT` | `/api/comunidad/admin/videos/{id_video}` | Admin Editar Video | JWT | `id_video`* | `VideoAgenciaUpdate` | 200, 422 |
| `DELETE` | `/api/comunidad/admin/videos/{id_video}` | Admin Borrar Video | JWT | `id_video`* | — | 200, 422 |
| `DELETE` | `/api/comunidad/comentarios/{id_comentario}` | El autor borra su comentario (cliente o miembro del equipo). Sus | JWT | `id_comentario`* | — | 200, 422 |
| `GET` | `/api/comunidad/firma-subida` | Firma Subida | JWT | `destino`* | — | 200, 422 |
| `GET` | `/api/comunidad/mis-publicaciones` | Todas las publicaciones del cliente, en cualquier estado (para que vea | JWT | — | — | 200, 422 |
| `GET` | `/api/comunidad/publicaciones` | Publicaciones aprobadas, la más reciente primero. Con sesión marca | JWT | `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/comunidad/publicaciones` | Crea una publicación en estado 'pendiente' (la revisa el equipo antes | JWT | — | `Body_crear_publicacion_api_comunidad_publicaciones_post` | 201, 422 |
| `DELETE` | `/api/comunidad/publicaciones/{id_publicacion}` | El autor puede borrar su publicación en cualquier momento. | JWT | `id_publicacion`* | — | 200, 422 |
| `POST` | `/api/comunidad/publicaciones/{id_publicacion}/comentarios` | Comentar | JWT | `id_publicacion`* | `ComentarioCreate` | 201, 422 |
| `GET` | `/api/comunidad/videos` | Listar Videos Agencia | JWT | `id_paquete`, `inicio` | — | 200, 422 |
| `POST` | `/api/comunidad/videos/{id_video}/comentarios` | Comentar Video | JWT | `id_video`* | `ComentarioCreate` | 201, 422 |

## Configuración

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/configuracion` | Lista todos los parámetros del sistema guardados. Cacheada 300s — | JWT | — | — | 200, 422 |
| `POST` | `/api/configuracion` | Crear Configuracion | JWT | — | `ConfiguracionCreate` | 201, 422 |
| `PUT` | `/api/configuracion/{id_config}` | Actualizar Configuracion | JWT | `id_config`* | `ConfiguracionUpdate` | 200, 422 |
| `DELETE` | `/api/configuracion/{id_config}` | Eliminar Configuracion | JWT | `id_config`* | — | 200, 422 |

## Contacto

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `POST` | `/api/contacto` | Enviar Contacto | Pública | — | `ContactoRequest` | 200, 422 |

## Dashboard

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/dashboard/resumen` | Get Dashboard Resumen | JWT | — | — | 200, 422 |
| `GET` | `/api/dashboard/resumen-empleado` | KPIs propios del empleado (asesor) que llama -- sección "Mis KPIs" | JWT | — | — | 200, 422 |

## Destinos

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/destinos/` | Get Destinos | Pública | `q`, `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/destinos/` | Create Destino | JWT | — | `DestinoCreate` | 201, 422 |
| `GET` | `/api/destinos/sugerencias` | Autocompletado liviano usado por el buscador de destinos del Hero. | Pública | `q`, `limit` | — | 200, 422 |
| `GET` | `/api/destinos/{destino_id}` | Get Destino | Pública | `destino_id`* | — | 200, 422 |
| `PUT` | `/api/destinos/{destino_id}` | Update Destino | JWT | `destino_id`* | `DestinoUpdate` | 200, 422 |
| `DELETE` | `/api/destinos/{destino_id}` | Delete Destino | JWT | `destino_id`* | — | 200, 422 |

## Empresas y Contactos

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/solicitudes-corporativas` | Listar Solicitudes Corporativas | JWT | `estado`, `limit` | — | 200, 422 |
| `POST` | `/api/solicitudes-corporativas` | Recibe el formulario 'Solicita una cotización' de /corporate — sin | Pública | — | `SolicitudCorporativaCreate` | 201, 422 |
| `PUT` | `/api/solicitudes-corporativas/{id_solicitud}` | Actualizar Estado Solicitud | JWT | `id_solicitud`* | `SolicitudCorporativaUpdate` | 200, 422 |
| `DELETE` | `/api/solicitudes-corporativas/{id_solicitud}` | Eliminar Solicitud Corporativa | JWT | `id_solicitud`* | — | 200, 422 |

## Favoritos

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/favoritos` | Lista completa de hoteles favoritos del cliente autenticado, con los | JWT | — | — | 200, 422 |
| `POST` | `/api/favoritos` | Agregar Favorito | JWT | — | `FavoritoCreate` | 201, 422 |
| `GET` | `/api/favoritos/ids` | Solo los id_hotel favoritos: liviano, pensado para pintar el corazón | JWT | — | — | 200, 422 |
| `DELETE` | `/api/favoritos/{id_hotel}` | Quitar Favorito | JWT | `id_hotel`* | — | 204, 422 |

## General

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/` | Root | Pública | — | — | 200 |

## Hoteles

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/hoteles/` | Obtiene lista de hoteles. Cacheada 2 min (30s si se filtra por fechas, | JWT | `skip`, `limit`, `fecha_checkin`, `fecha_checkout`, `q`, `todos` | — | 200, 422 |
| `POST` | `/api/hoteles/` | Crea un hotel y, opcionalmente, sus habitaciones en UNA transacción: | JWT | — | `HotelCreate` | 201, 422 |
| `GET` | `/api/hoteles/caracteristicas` | Obtiene todas las características disponibles | Pública | — | — | 200 |
| `POST` | `/api/hoteles/caracteristicas` | Crea una nueva característica | JWT | — | `CaracteristicaCreate` | 201, 422 |
| `GET` | `/api/hoteles/destinos-sugeridos` | Sugerencias de destino para el buscador (SearchBar.tsx), respaldadas | Pública | `q`, `limit` | — | 200, 422 |
| `GET` | `/api/hoteles/habitaciones/{habitacion_id}` | Obtiene detalles de una habitación | Pública | `habitacion_id`* | — | 200, 422 |
| `PUT` | `/api/hoteles/habitaciones/{habitacion_id}` | Actualiza una habitación existente | JWT | `habitacion_id`* | `HabitacionUpdate` | 200, 422 |
| `DELETE` | `/api/hoteles/habitaciones/{habitacion_id}` | Elimina una habitación | JWT | `habitacion_id`* | — | 200, 422 |
| `POST` | `/api/hoteles/habitaciones/{habitacion_id}/imagenes` | Agrega una foto propia a la habitación (se ve en "Ver detalles" de | JWT | `habitacion_id`* | `Body_subir_foto_habitacion_api_hoteles_habitaciones__habitacion_id__imagenes_post` | 201, 422 |
| `PATCH` | `/api/hoteles/habitaciones/{habitacion_id}/imagenes/{id_imagen}` | Pie de foto y/o marcarla como portada de la habitación. | JWT | `habitacion_id`*, `id_imagen`* | `ImagenHabitacionUpdate` | 200, 422 |
| `DELETE` | `/api/hoteles/habitaciones/{habitacion_id}/imagenes/{id_imagen}` | Borrar Foto Habitacion | JWT | `habitacion_id`*, `id_imagen`* | — | 200, 422 |
| `GET` | `/api/hoteles/tipos-habitacion` | Catálogo de tipos de habitación (Individual, Doble, Suite, etc.) — | Pública | — | — | 200 |
| `POST` | `/api/hoteles/tipos-habitacion` | Crea un nuevo tipo de habitación | JWT | — | `TipoHabitacionCreate` | 201, 422 |
| `GET` | `/api/hoteles/{hotel_id}` | Obtiene detalles completos de un hotel con sus habitaciones y características | JWT | `hotel_id`* | — | 200, 422 |
| `PUT` | `/api/hoteles/{hotel_id}` | Actualiza un hotel existente | JWT | `hotel_id`* | `HotelUpdate` | 200, 422 |
| `DELETE` | `/api/hoteles/{hotel_id}` | Elimina un hotel | JWT | `hotel_id`* | — | 200, 422 |
| `POST` | `/api/hoteles/{hotel_id}/caracteristicas/{caracteristica_id}` | Añade una característica a un hotel | JWT | `hotel_id`*, `caracteristica_id`*, `disponible` | — | 200, 422 |
| `DELETE` | `/api/hoteles/{hotel_id}/caracteristicas/{caracteristica_id}` | Elimina una característica de un hotel | JWT | `hotel_id`*, `caracteristica_id`* | — | 200, 422 |
| `GET` | `/api/hoteles/{hotel_id}/fechas-ocupadas` | Fechas ya reservadas (reservas activas) de cada habitación del hotel | Pública | `hotel_id`* | — | 200, 422 |
| `POST` | `/api/hoteles/{hotel_id}/galeria` | Agrega una foto a la galería del hotel (distinta de la portada, ver | JWT | `hotel_id`* | `Body_subir_foto_galeria_hotel_api_hoteles__hotel_id__galeria_post` | 201, 422 |
| `DELETE` | `/api/hoteles/{hotel_id}/galeria/{id_imagen}` | Elimina una foto de la galería del hotel (y su archivo real, en | JWT | `hotel_id`*, `id_imagen`* | — | 200, 422 |
| `GET` | `/api/hoteles/{hotel_id}/habitaciones` | Obtiene habitaciones de un hotel | Pública | `hotel_id`*, `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/hoteles/{hotel_id}/habitaciones` | Crea una nueva habitación en un hotel | JWT | `hotel_id`* | `HabitacionCreate` | 201, 422 |
| `GET` | `/api/hoteles/{hotel_id}/habitaciones/disponibles` | Obtiene habitaciones disponibles de un hotel | Pública | `hotel_id`*, `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/hoteles/{hotel_id}/imagen` | Sube/reemplaza la foto principal del hotel. Antes Hotel no tenía | JWT | `hotel_id`* | `Body_subir_imagen_hotel_api_hoteles__hotel_id__imagen_post` | 200, 422 |
| `GET` | `/api/hoteles/{hotel_id}/similares` | Hoteles de la misma ciudad (excluyendo este) para la sección | Pública | `hotel_id`*, `limit` | — | 200, 422 |

## IoT

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/iot/dispositivos` | Listar Dispositivos | JWT | — | — | 200, 422 |
| `POST` | `/api/iot/dispositivos` | Crear Dispositivo | JWT | — | `DispositivoIoTCrear` | 201, 422 |
| `PATCH` | `/api/iot/dispositivos/{id_dispositivo}/activo` | Cambiar Activo | JWT | `id_dispositivo`*, `activo`* | — | 200, 422 |
| `GET` | `/api/iot/dispositivos/{id_dispositivo}/lecturas` | Lecturas De Dispositivo | JWT | `id_dispositivo`*, `limite` | — | 200, 422 |
| `POST` | `/api/iot/lecturas` | Recibir Lectura | Dispositivo (`X-Device-Key`) | — | `LecturaIoTEntrada` | 201, 422 |

## Mensajes

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `POST` | `/api/mensajes/enviar` | Enviar Como Admin | JWT | — | `Body_enviar_como_admin_api_mensajes_enviar_post` | 201, 422 |
| `GET` | `/api/mensajes/hilos` | Clientes con hilo, ordenados por mensaje más reciente, paginados y | JWT | `search`, `skip`, `limit` | — | 200, 422 |
| `GET` | `/api/mensajes/hilos/{id_cliente}` | Get Hilo Admin | JWT | `id_cliente`*, `after_id`, `before_id` | — | 200, 422 |
| `PATCH` | `/api/mensajes/leido` | Un solo endpoint para ambos roles -- bandeja compartida: cualquier | JWT | — | `MarcarLeidoRequest` | 200, 422 |
| `GET` | `/api/mensajes/me` | El id_cliente SIEMPRE se resuelve del propio token, nunca de un | JWT | `after_id`, `before_id` | — | 200, 422 |
| `POST` | `/api/mensajes/me/enviar` | Enviar Como Cliente | JWT | — | `Body_enviar_como_cliente_api_mensajes_me_enviar_post` | 201, 422 |
| `GET` | `/api/mensajes/no-leidos` | Nunca se cachea -- mismo criterio ya establecido para conteos de | JWT | — | — | 200, 422 |
| `GET` | `/api/mensajes/{id_mensaje}/adjunto` | Adjunto (imagen o PDF) de un mensaje, solo para el cliente dueño del | JWT | `id_mensaje`* | — | 200, 422 |

## Métodos de pago guardados

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/metodos-pago-guardados` | Listar Metodos Guardados | JWT | — | — | 200, 422 |
| `POST` | `/api/metodos-pago-guardados` | Guardar Metodo Pago | JWT | — | `MetodoPagoGuardadoCreate` | 201, 422 |
| `PUT` | `/api/metodos-pago-guardados/{id_metodo_guardado}` | Edita un método guardado (lápiz en el perfil): alias, tipo, últimos 4, | JWT | `id_metodo_guardado`* | `MetodoPagoGuardadoUpdate` | 200, 422 |
| `DELETE` | `/api/metodos-pago-guardados/{id_metodo_guardado}` | Eliminar Metodo Guardado | JWT | `id_metodo_guardado`* | — | 204, 422 |
| `POST` | `/api/metodos-pago-guardados/{id_metodo_guardado}/verificar` | Verifica la clave de confirmación de un método guardado antes de usarlo | JWT | `id_metodo_guardado`* | `VerificarClaveRequest` | 200, 422 |

## Notificaciones

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/notificaciones` | Listar Notificaciones | JWT | `solo_no_leidas`, `limit` | — | 200, 422 |
| `PUT` | `/api/notificaciones/leer-todas` | Marcar Todas Leidas | JWT | — | — | 200, 422 |
| `GET` | `/api/notificaciones/no-leidas/conteo` | Contar No Leidas | JWT | — | — | 200, 422 |
| `DELETE` | `/api/notificaciones/{id_notificacion}` | Eliminar Notificacion | JWT | `id_notificacion`* | — | 200, 422 |
| `PUT` | `/api/notificaciones/{id_notificacion}/leer` | Marcar Leida | JWT | `id_notificacion`* | — | 200, 422 |

## Permisos

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/permisos` | Catálogo completo de permisos que el backend conoce, agrupable por | JWT | — | — | 200, 422 |

## Preferencias

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `POST` | `/api/preferencias-cliente/` | Create Preferencia | JWT | — | `PreferenciaCreate` | 201, 422 |
| `GET` | `/api/preferencias-cliente/{cliente_id}` | Get Preferencia | JWT | `cliente_id`* | — | 200, 422 |
| `GET` | `/api/preferencias-cliente/{cliente_id}/sugerencias` | Recomienda paquetes activos según las preferencias guardadas del cliente | JWT | `cliente_id`*, `limit` | — | 200, 422 |
| `GET` | `/api/preferencias-cliente/{cliente_id}/sugerencias-hoteles` | Recomienda hoteles según las preferencias guardadas del cliente | JWT | `cliente_id`*, `limit` | — | 200, 422 |

## Promociones

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/promociones/destacados` | Get Destacados | Pública | — | — | 200 |
| `GET` | `/api/promociones/seleccion-casa` | Get Seleccion Casa | Pública | — | — | 200 |

## Reservas, Paquetes y Pagos

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/historial-reservas/recientes` | Feed de 'Actividad reciente' para el Dashboard y el módulo de Actividad | JWT | `limit` | — | 200, 422 |
| `GET` | `/api/metodos-pago` | Obtiene todos los métodos de pago disponibles. Cacheada 300s — lista | Pública | — | — | 200 |
| `POST` | `/api/metodos-pago` | Crea un nuevo método de pago | JWT | — | `MetodoPagoCreate` | 201, 422 |
| `GET` | `/api/pagos` | Obtiene lista de pagos. Cacheada 60s — mismo criterio de TTL corto que | JWT | `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/pagos` | Crea un nuevo pago | JWT | — | `PagoCreate` | 201, 422 |
| `GET` | `/api/pagos/estado/{estado}` | Obtiene pagos por estado | JWT | `estado`*, `skip`, `limit` | — | 200, 422 |
| `GET` | `/api/pagos/reserva/{reserva_id}` | Obtiene pagos de una reserva | JWT | `reserva_id`* | — | 200, 422 |
| `GET` | `/api/pagos/{pago_id}` | Obtiene detalles de un pago | JWT | `pago_id`* | — | 200, 422 |
| `PUT` | `/api/pagos/{pago_id}` | Actualiza un pago desde el panel. Un cambio de estado pasa por las | JWT | `pago_id`* | `PagoUpdate` | 200, 422 |
| `DELETE` | `/api/pagos/{pago_id}` | Elimina un pago. Un pago aprobado (o con comprobante emitido) no se | JWT | `pago_id`* | — | 200, 422 |
| `GET` | `/api/pagos/{pago_id}/comprobante` | Comprobante de pago SOLO para el dueño de la reserva o el equipo. | JWT | `pago_id`* | — | 200, 422 |
| `POST` | `/api/pagos/{pago_id}/comprobante` | Adjunta un comprobante externo (imagen o PDF) a un pago — por ejemplo | JWT | `pago_id`* | `Body_subir_comprobante_pago_api_pagos__pago_id__comprobante_post` | 200, 422 |
| `DELETE` | `/api/pagos/{pago_id}/comprobante` | Quita el comprobante adjunto de un pago (por ejemplo si se subió por | JWT | `pago_id`* | — | 200, 422 |
| `POST` | `/api/pagos/{pago_id}/confirmar` | Confirma un pago que quedo 'procesando' (PSE/Nequi) — simula que el | JWT | `pago_id`* | — | 200, 422 |
| `GET` | `/api/paquetes` | Obtiene lista de paquetes activos (o todos, si incluir_inactivos=true). | Pública | `skip`, `limit`, `incluir_inactivos` | — | 200, 422 |
| `POST` | `/api/paquetes` | Crea un nuevo paquete turístico, opcionalmente vinculado a hotel(es) | JWT | — | `PaqueteCreate` | 201, 422 |
| `GET` | `/api/paquetes/populares` | Get Paquetes Populares | Pública | `limit` | — | 200, 422 |
| `GET` | `/api/paquetes/{paquete_id}` | Obtiene detalles de un paquete | Pública | `paquete_id`* | — | 200, 422 |
| `PUT` | `/api/paquetes/{paquete_id}` | Actualiza un paquete existente | JWT | `paquete_id`* | `PaqueteUpdate` | 200, 422 |
| `DELETE` | `/api/paquetes/{paquete_id}` | Desactiva un paquete | JWT | `paquete_id`* | — | 200, 422 |
| `GET` | `/api/paquetes/{paquete_id}/detalle` | Igual que GET /paquetes/{id} pero enriquecido con los destinos, hoteles | Pública | `paquete_id`* | — | 200, 422 |
| `POST` | `/api/paquetes/{paquete_id}/galeria` | Agrega una foto a la galería del paquete (distinta de la portada, ver | JWT | `paquete_id`* | `Body_subir_foto_galeria_paquete_api_paquetes__paquete_id__galeria_post` | 201, 422 |
| `DELETE` | `/api/paquetes/{paquete_id}/galeria/{id_imagen}` | Elimina una foto de la galería del paquete (y su archivo real). | JWT | `paquete_id`*, `id_imagen`* | — | 200, 422 |
| `POST` | `/api/paquetes/{paquete_id}/imagen` | Sube/reemplaza la portada del paquete (Paquete.imagen_url) -- antes | JWT | `paquete_id`* | `Body_subir_imagen_paquete_api_paquetes__paquete_id__imagen_post` | 200, 422 |
| `GET` | `/api/paquetes/{paquete_id}/similares` | Paquetes con destino real parecido (mismo ciudad de algún hotel | Pública | `paquete_id`*, `limit` | — | 200, 422 |
| `GET` | `/api/reservas` | Obtiene lista de reservas. Cacheada solo 60s (más corto que | JWT | `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/reservas` | Crea una nueva reserva. | JWT | — | `ReservaCreate` | 201, 422 |
| `GET` | `/api/reservas/buscar` | Listado del panel paginado y filtrado en la base de datos. Lo ven | JWT | `q`, `estado`, `estado_pago`, `canal`, `tipo_producto`, `id_empleado`, `sin_asesor`, `id_cliente`, `fecha_desde`, `fecha_hasta`, `orden`, `direccion`, `pagina`, `por_pagina`, `con_totales` | — | 200, 422 |
| `GET` | `/api/reservas/cliente/{cliente_id}` | Obtiene reservas de un cliente | JWT | `cliente_id`*, `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/reservas/cotizar` | Calcula el desglose y el total de una reserva SIN crearla (lo usan | JWT | — | `SeleccionProducto` | 200, 422 |
| `GET` | `/api/reservas/estado/{estado}` | Obtiene reservas por estado | JWT | `estado`*, `skip`, `limit` | — | 200, 422 |
| `GET` | `/api/reservas/{reserva_id}` | Detalle completo: producto, desglose, viajeros, vuelo, pagos. | JWT | `reserva_id`* | — | 200, 422 |
| `PUT` | `/api/reservas/{reserva_id}` | Actualiza una reserva existente | JWT | `reserva_id`* | `ReservaUpdate` | 200, 422 |
| `DELETE` | `/api/reservas/{reserva_id}` | Elimina una reserva | JWT | `reserva_id`* | — | 200, 422 |
| `POST` | `/api/reservas/{reserva_id}/cotizacion-vuelo` | La agencia confirma el precio del vuelo que el cliente pidió cotizar. | JWT | `reserva_id`* | `CotizacionVueloInput` | 200, 422 |
| `GET` | `/api/reservas/{reserva_id}/habitaciones` | Obtiene habitaciones asociadas a una reserva | JWT | `reserva_id`* | — | 200, 422 |
| `GET` | `/api/reservas/{reserva_id}/historial` | Obtiene historial de cambios de una reserva | JWT | `reserva_id`* | — | 200, 422 |
| `POST` | `/api/reservas/{reserva_id}/notas` | Nota interna del asesor sobre una reserva (ej. 'llamé al cliente, | JWT | `reserva_id`* | `NotaInternaCreate` | 200, 422 |
| `PUT` | `/api/reservas/{reserva_id}/notas-internas` | Actualizar Notas Internas | JWT | `reserva_id`* | `NotasInternasUpdate` | 200, 422 |
| `POST` | `/api/reservas/{reserva_id}/pagar` | Inicia el pago de una reserva (100% simulado, sin pasarela real). El | JWT | `reserva_id`* | `PagarRequest` | 200, 422 |
| `GET` | `/api/reservas/{reserva_id}/servicios` | Obtiene servicios asociados a una reserva | JWT | `reserva_id`* | — | 200, 422 |

## Reseñas

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/resenas` | Listado público y paginado de las reseñas visibles (cualquier | Pública | `skip`, `limit`, `calificacion` | — | 200, 422 |
| `POST` | `/api/resenas` | Crear Resena | JWT | — | `ResenaCreate` | 201, 422 |
| `GET` | `/api/resenas/admin/todas` | Admin Listar Resenas | JWT | `filtro` | — | 200, 422 |
| `PUT` | `/api/resenas/admin/{id_resena}/responder` | Respuesta pública de la agencia. Se le avisa al cliente. | JWT | `id_resena`* | `RespuestaAgencia` | 200, 422 |
| `PUT` | `/api/resenas/admin/{id_resena}/visibilidad` | Ocultar una reseña del sitio (spam, datos personales, lenguaje | JWT | `id_resena`* | `VisibilidadResena` | 200, 422 |
| `GET` | `/api/resenas/destacadas` | Endpoint público (sin auth) para la sección de Testimonios del home. | Pública | — | — | 200 |
| `GET` | `/api/resenas/hotel/{id_hotel}` | Get Resenas Hotel | Pública | `id_hotel`* | — | 200, 422 |
| `GET` | `/api/resenas/mias` | Las reseñas del cliente (también las ocultas por el equipo), con la | JWT | — | — | 200, 422 |
| `PUT` | `/api/resenas/{id_resena}` | El autor corrige su reseña (estrellas y/o texto). Queda marcada como editada. | JWT | `id_resena`* | `ResenaUpdate` | 200, 422 |
| `DELETE` | `/api/resenas/{id_resena}` | Borrar Resena | JWT | `id_resena`* | — | 200, 422 |

## Roles

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/roles` | Get Roles | JWT | — | — | 200, 422 |
| `POST` | `/api/roles` | Crear Rol | JWT | — | `RolCreate` | 201, 422 |
| `DELETE` | `/api/roles/{rol_id}` | Eliminar Rol | JWT | `rol_id`* | — | 200, 422 |
| `GET` | `/api/roles/{rol_id}/permisos` | Obtener Permisos Rol | JWT | `rol_id`* | — | 200, 422 |
| `PUT` | `/api/roles/{rol_id}/permisos` | Reemplaza por completo el conjunto de permisos de un rol (mismo | JWT | `rol_id`* | `AsignarPermisosRequest` | 200, 422 |

## Salud

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/health` | Liveness/readiness check real (consulta la base de datos, no un valor | Pública | — | — | 200 |

## Servicios

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/servicios/` | Get Servicios | Pública | `id_destino`, `id_categoria`, `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/servicios/` | Create Servicio | JWT | — | `ServicioCreate` | 201, 422 |
| `GET` | `/api/servicios/categorias` | Get Categorias | Pública | — | — | 200 |
| `GET` | `/api/servicios/{servicio_id}` | Get Servicio | Pública | `servicio_id`* | — | 200, 422 |
| `PUT` | `/api/servicios/{servicio_id}` | Update Servicio | JWT | `servicio_id`* | `ServicioUpdate` | 200, 422 |
| `DELETE` | `/api/servicios/{servicio_id}` | Delete Servicio | JWT | `servicio_id`* | — | 200, 422 |

## Solicitudes de cancelación

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/clientes/{cliente_id}/actividad` | Feed de notificaciones del cliente autenticado (campana del sitio | JWT | `cliente_id`*, `limit` | — | 200, 422 |
| `GET` | `/api/clientes/{cliente_id}/solicitudes-cancelacion` | Historial de solicitudes de cancelación del cliente autenticado. | JWT | `cliente_id`*, `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/reservas/{reserva_id}/solicitud-cancelacion` | Registra una solicitud de cancelación para una reserva. Normalmente la | JWT | `reserva_id`* | `SolicitudCancelacionCreate` | 201, 422 |
| `GET` | `/api/solicitudes-cancelacion` | Cola de solicitudes de cancelación para el panel de admin (y del | JWT | `estado`, `skip`, `limit` | — | 200, 422 |
| `PUT` | `/api/solicitudes-cancelacion/{id_solicitud}/resolver` | Aprueba o rechaza una solicitud de cancelación, con nota del admin. | JWT | `id_solicitud`* | `SolicitudCancelacionResolve` | 200, 422 |

## Temas

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/temas/` | Get Temas Admin | JWT | — | — | 200, 422 |
| `POST` | `/api/temas/` | Create Tema | JWT | — | `TemaCreate` | 201, 422 |
| `GET` | `/api/temas/activo` | El tema vigente ahora mismo -- lo consume el frontend en el arranque | Pública | — | — | 200 |
| `GET` | `/api/temas/{clave}/galeria` | Imágenes reales de la temporada `clave` gestionadas directo en | Pública | `clave`*, `limite` | — | 200, 422 |
| `PUT` | `/api/temas/{id_tema}` | Update Tema | JWT | `id_tema`* | `TemaUpdate` | 200, 422 |
| `DELETE` | `/api/temas/{id_tema}` | Delete Tema | JWT | `id_tema`* | — | 200, 422 |
| `PUT` | `/api/temas/{id_tema}/activar` | Activar Tema | JWT | `id_tema`* | — | 200, 422 |
| `POST` | `/api/temas/{id_tema}/imagen` | Sube (o reemplaza) la imagen decorativa real del tema -- ej. una | JWT | `id_tema`* | `Body_subir_imagen_tema_api_temas__id_tema__imagen_post` | 200, 422 |
| `DELETE` | `/api/temas/{id_tema}/imagen` | Quita la imagen decorativa del tema -- vuelve a depender solo del | JWT | `id_tema`* | — | 200, 422 |
| `POST` | `/api/temas/{id_tema}/video` | Sube (o reemplaza) el video decorativo del fondo del Hero para este | JWT | `id_tema`* | `Body_subir_video_tema_api_temas__id_tema__video_post` | 200, 422 |
| `DELETE` | `/api/temas/{id_tema}/video` | Quita el video decorativo del tema -- el Hero vuelve a caer en el | JWT | `id_tema`* | — | 200, 422 |

## Usuarios

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/usuarios` | Admin Get Usuarios | JWT | — | — | 200, 422 |
| `POST` | `/api/usuarios` | Admin Create Usuario | JWT | — | `UsuarioAdminCreate` | 201, 422 |
| `GET` | `/api/usuarios/me` | Get Me | JWT | — | — | 200, 422 |
| `POST` | `/api/usuarios/me/foto` | Subir Foto Perfil | JWT | — | `Body_subir_foto_perfil_api_usuarios_me_foto_post` | 200, 422 |
| `DELETE` | `/api/usuarios/me/foto` | Eliminar Foto Perfil | JWT | — | — | 200, 422 |
| `PUT` | `/api/usuarios/me/password` | Cambio de contraseña de la cuenta ya autenticada (por token), no de | JWT | — | `CambiarPasswordRequest` | 200, 422 |
| `PUT` | `/api/usuarios/{usuario_id}` | Admin Update Usuario | JWT | `usuario_id`* | `UsuarioAdminUpdate` | 200, 422 |
| `DELETE` | `/api/usuarios/{usuario_id}` | Admin Delete Usuario | JWT | `usuario_id`* | — | 200, 422 |

## Vuelos

| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |
|---|---|---|---|---|---|---|
| `GET` | `/api/vuelos` | Ofertas publicadas y vigentes (salida desde hoy). Cacheado 60 s | Pública | `origen`, `destino`, `fecha_desde`, `fecha_hasta`, `aerolinea`, `solo_independientes`, `skip`, `limit` | — | 200, 422 |
| `POST` | `/api/vuelos` | Crear Oferta | JWT | — | `OfertaVueloCreate` | 201, 422 |
| `GET` | `/api/vuelos/admin` | Listar Ofertas Admin | JWT | `estado`, `q`, `origen`, `destino`, `fecha_desde`, `fecha_hasta`, `aerolinea`, `pagina`, `por_pagina` | — | 200, 422 |
| `GET` | `/api/vuelos/buscar` | Buscador público de /vuelos: filtra en la base de datos, sin tildes ni | Pública | `q`, `origen`, `destino`, `fecha_desde`, `fecha_hasta`, `aerolinea`, `trayecto`, `solo_directos`, `precio_max`, `orden`, `pagina`, `por_pagina` | — | 200, 422 |
| `GET` | `/api/vuelos/{id_oferta}` | Obtener Oferta | JWT | `id_oferta`* | — | 200, 422 |
| `PUT` | `/api/vuelos/{id_oferta}` | Editar Oferta | JWT | `id_oferta`* | `OfertaVueloUpdate` | 200, 422 |
| `DELETE` | `/api/vuelos/{id_oferta}` | Eliminar Oferta | JWT | `id_oferta`* | — | 200, 422 |
| `PATCH` | `/api/vuelos/{id_oferta}/estado` | Cambiar Estado Oferta | JWT | `id_oferta`* | `EstadoOfertaUpdate` | 200, 422 |
| `POST` | `/api/vuelos/{id_oferta}/imagen` | Subir Imagen Oferta | JWT | `id_oferta`* | `Body_subir_imagen_oferta_api_vuelos__id_oferta__imagen_post` | 200, 422 |
| `GET` | `/api/vuelos/{id_oferta}/pasajeros` | Manifiesto de pasajeros de las reservas activas de esta oferta (solo | JWT | `id_oferta`* | — | 200, 422 |
| `GET` | `/api/vuelos/{id_oferta}/reservas` | Reservas De Oferta | JWT | `id_oferta`* | — | 200, 422 |
