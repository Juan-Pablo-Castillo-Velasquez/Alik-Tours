# 1. Documentación general y diagramas

Índice de la documentación del proyecto y los diagramas que la resumen. Los
diagramas están en Mermaid: GitHub los dibuja directamente al abrir el archivo.

| Artefacto | Dónde |
|---|---|
| Requisitos funcionales (RF) y no funcionales (RNF) | [`docs/requisitos/RFs`](../requisitos/RFs), [`docs/requisitos/RNFs`](../requisitos/RNFs), [`restricciones.md`](../requisitos/restricciones.md) |
| Historias de usuario (35, con criterios de aceptación) | [`docs/historias-usuario/`](../historias-usuario/README.md) |
| Casos de uso | §1 de este documento |
| Diagrama de clases UML | §2 de este documento y [`01b-modelo-de-datos.md`](01b-modelo-de-datos.md) §2 |
| MER (entidad-relación) | [`01b-modelo-de-datos.md`](01b-modelo-de-datos.md) §3 (55 tablas, generado desde los modelos) |
| MR (modelo relacional) | [`01b-modelo-de-datos.md`](01b-modelo-de-datos.md) §1 |
| Diccionario de datos | [`docs/referencia-tecnica/database-schema.md`](../referencia-tecnica/database-schema.md), [`tablas.md`](../referencia-tecnica/tablas.md) |
| Diagramas de secuencia y actividad | §3 y §4 de este documento |
| Arquitectura | [`05-arquitectura.md`](05-arquitectura.md) |
| API | [`docs/referencia-tecnica/api-endpoints.md`](../referencia-tecnica/api-endpoints.md) y Swagger en `/docs` |
| Manual de usuario | [`docs/manual-usuario/`](../manual-usuario/README.md) |

## 1. Diagrama de casos de uso

Actores: **Visitante** (sin cuenta), **Cliente**, **Asesor** (empleado),
**Administrador**, el **dispositivo IoT** del vehículo y los servicios externos
(correo Brevo, imágenes Cloudinary).

```mermaid
flowchart LR
    V([Visitante])
    C([Cliente])
    A([Asesor])
    AD([Administrador])
    IOT([Dispositivo IoT])
    MAIL([Servicio de correo])

    subgraph Sitio["AlekTours — sitio público"]
        UC1(Buscar hoteles, paquetes y vuelos)
        UC2(Ver ficha de hotel, paquete o vuelo)
        UC3(Registrarse y verificar correo)
        UC4(Iniciar sesión / recuperar contraseña)
        UC5(Escribir a la agencia: contacto, WhatsApp)
        UC6(Reservar hotel)
        UC7(Reservar paquete)
        UC8(Reservar vuelo)
        UC9(Pagar reserva y descargar comprobante)
        UC10(Solicitar cancelación)
        UC11(Chatear con un asesor)
        UC12(Reseñar estadía y publicar en la comunidad)
        UC13(Gestionar perfil, favoritos y preferencias)
    end

    subgraph Panel["AlekTours — panel"]
        UC20(Gestionar reservas y pagos)
        UC21(Crear reserva para un cliente)
        UC22(Atender cancelaciones y mensajes)
        UC23(Gestionar hoteles, paquetes y vuelos)
        UC24(Gestionar usuarios, roles y permisos)
        UC25(Banners, temas y configuración)
        UC26(Ver dashboard comercial)
        UC27(Moderar reseñas y comunidad)
        UC28(Ver telemetría de vehículos)
        UC29(Registrar dispositivo IoT)
    end

    UC30(Enviar lectura de telemetría)

    V --> UC1 & UC2 & UC3 & UC4 & UC5
    C --> UC1 & UC2 & UC6 & UC7 & UC8 & UC9 & UC10 & UC11 & UC12 & UC13
    A --> UC20 & UC21 & UC22 & UC26
    AD --> UC20 & UC21 & UC22 & UC23 & UC24 & UC25 & UC26 & UC27 & UC28 & UC29
    IOT --> UC30
    UC6 & UC7 & UC8 -. include .-> UC9
    UC3 -. include .-> MAIL
    UC9 -. extend: comprobante .-> MAIL
    UC30 -. alimenta .-> UC28
```

Cada caso de uso tiene su historia de usuario con criterios de aceptación
(`Dado / cuando / entonces`) en [`docs/historias-usuario/`](../historias-usuario/README.md):
UC1→HU-02/04/05, UC6→HU-10, UC7→HU-11, UC8→HU-12, UC9→HU-13 y HU-20,
UC10→HU-15, UC11→HU-16, UC20→HU-29, UC23→HU-26/27/28, UC24→HU-33, UC26→HU-32.

### Especificación del caso de uso principal: UC6 Reservar hotel

| Campo | Contenido |
|---|---|
| Actor principal | Cliente (con sesión y correo verificado) |
| Precondición | El hotel está publicado y tiene al menos una habitación disponible |
| Flujo básico | 1. Elige hotel, habitación, fechas y huéspedes. 2. El sistema bloquea las noches ocupadas y valida capacidad. 3. Confirma sus datos de viajero. 4. Revisa el desglose (`POST /api/reservas/cotizar`). 5. Acepta términos y confirma (`POST /api/reservas`). 6. Paga total o abono (`POST /api/reservas/{id}/pagar`). 7. Ve la confirmación con el código `AT-000123`. |
| Flujos alternos | 2a. Fechas cruzadas con otra reserva → 409 y aviso. 2b. Más huéspedes que la capacidad → no deja continuar. 6a. Pago rechazado → la reserva queda pendiente y puede pagar después. |
| Postcondición | Reserva en estado `pendiente` o `confirmada`, historial y notificación al cliente y al panel |
| Reglas | El precio lo calcula el backend; el navegador no suma precios. Reserva idempotente (`client_msg_id`) para no duplicar con doble clic |

## 2. Diagrama de clases (dominio de reservas)

Vista resumida con las operaciones de negocio principales. El diagrama con
todos los atributos de las 14 entidades centrales está en
[`01b-modelo-de-datos.md`](01b-modelo-de-datos.md#2-diagrama-de-clases-uml-entidades-centrales).

```mermaid
classDiagram
    direction LR
    class Usuario {
        +username
        +correo_electronico
        +verificado
        +roles()
    }
    class Cliente {
        +nombre
        +cedula
        +celular
    }
    class Reserva {
        +estado
        +fecha_inicio
        +fecha_fin
        +precio_total()
        +total_pagado()
        +saldo_pendiente()
    }
    class ReservaConcepto {
        +tipo
        +descripcion
        +subtotal
    }
    class Pago {
        +monto
        +estado
        +numero_comprobante
    }
    class Producto {
        <<abstract>>
        +precio()
    }
    class Hotel
    class Habitacion {
        +precio_noche
        +capacidad
    }
    class Paquete {
        +precio_base
        +noches
    }
    class OfertaVuelo {
        +precio_adulto
        +cupos
    }
    class DispositivoIoT {
        +nombre
        +clave_hash
        +estado()
    }
    class LecturaIoT {
        +latitud
        +longitud
        +temperatura_c
    }
    Usuario "0..1" --> "0..1" Cliente
    Cliente "1" --> "*" Reserva
    Reserva "1" *-- "*" ReservaConcepto : desglose
    Reserva "1" --> "*" Pago
    Producto <|-- Habitacion
    Producto <|-- Paquete
    Producto <|-- OfertaVuelo
    Hotel "1" *-- "*" Habitacion
    Paquete "*" --> "*" Hotel
    Paquete "*" --> "*" OfertaVuelo
    Reserva "*" --> "1..*" Producto : reserva
    DispositivoIoT "1" *-- "*" LecturaIoT
```

> `Producto` es una abstracción de análisis (en el código cada producto es su
> propia tabla y la reserva lo referencia por `tipo_producto`).

## 3. Diagrama de secuencia: reservar y pagar

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    participant F as Frontend (React)
    participant API as API FastAPI
    participant R as ReservaRepository
    participant DB as PostgreSQL
    participant M as Correo (Brevo)

    C->>F: Elige producto, fechas y viajeros
    F->>API: POST /api/reservas/cotizar
    API->>R: calcular conceptos y disponibilidad
    R->>DB: SELECT tarifas, cupos y cruces de fechas
    DB-->>R: datos
    R-->>API: conceptos + total + advertencias
    API-->>F: 200 cotización
    C->>F: Acepta términos y confirma
    F->>API: POST /api/reservas (client_msg_id)
    API->>R: crear (bloqueo de fila, verificación de cupos)
    R->>DB: INSERT reserva, conceptos, viajeros, historial
    API-->>F: 201 reserva pendiente
    API-)M: notificación "reserva creada"
    C->>F: Paga (total o abono)
    F->>API: POST /api/reservas/{id}/pagar
    API->>DB: INSERT pago, la reserva pasa a confirmada si queda saldada
    API-->>F: 200 pago + comprobante FAC-000123
    F-->>C: Confirmación con código AT-000123
```

## 4. Diagrama de actividad: estados de una reserva

```mermaid
stateDiagram-v2
    [*] --> pendiente: reserva creada
    pendiente --> confirmada: pago aprobado / asesor confirma
    pendiente --> cancelada: cliente o asesor cancela
    confirmada --> cancelada: solicitud de cancelación aprobada
    confirmada --> finalizada: pasó la fecha de fin
    cancelada --> [*]
    finalizada --> [*]
```

## 5. Diagrama de despliegue

Ver [`05-arquitectura.md`](05-arquitectura.md#2-despliegue).
