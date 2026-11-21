# 5. Diagrama de arquitectura

AlekTours aplica lo visto en las formaciones previas: **arquitectura por
capas** en el backend (rutas → esquemas → servicios → repositorios → modelos),
**SPA** con componentes y servicios en el frontend, **API REST** con JWT,
contenedores Docker, CI/CD y servicios gestionados en la nube. Detalle y
decisiones: [`docs/referencia-tecnica/architecture.md`](../referencia-tecnica/architecture.md)
y [`docs/conceptos/patrones-arquitectonicos.md`](../conceptos/patrones-arquitectonicos.md).

## 1. Vista de contexto

```mermaid
flowchart LR
    U["Visitante / Cliente<br/>(navegador o celular)"]
    E["Equipo Alik Tours<br/>(asesor, administrador)"]
    D["Dispositivo IoT<br/>(vehículo de traslado)"]
    S(("AlekTours"))
    MAIL["Brevo<br/>(correo)"]
    IMG["Cloudinary<br/>(imágenes)"]
    WA["WhatsApp<br/>(enlace wa.me)"]
    SEN["Sentry<br/>(errores)"]

    U -- HTTPS --> S
    E -- HTTPS --> S
    D -- "HTTPS + X-Device-Key" --> S
    S --> MAIL
    S --> IMG
    S --> SEN
    U -.-> WA
```

## 2. Despliegue

```mermaid
flowchart TB
    subgraph Cliente["Navegador"]
        SPA["React 18 + Vite + Tailwind<br/>(SPA)"]
    end

    subgraph Vercel["Vercel (CDN)"]
        STATIC["Archivos estáticos<br/>vercel.json: rewrites + cabeceras de seguridad"]
    end

    subgraph Render["Render (contenedor Docker)"]
        API["FastAPI + Uvicorn (4 workers)<br/>/health · /docs"]
        MW["Middlewares: CORS, GZip,<br/>límite de intentos, logs"]
    end

    subgraph Datos["Servicios de datos"]
        PG[("PostgreSQL 16<br/>Neon")]
        RD[("Redis<br/>Upstash")]
    end

    subgraph Externos["Servicios externos"]
        BR["Brevo API"]
        CL["Cloudinary"]
        SE["Sentry"]
    end

    IOT["ESP32 / simulador<br/>iot/"]
    GH["GitHub Actions<br/>lint · pruebas · E2E · Docker"]

    SPA -- "descarga" --> STATIC
    SPA -- "REST JSON + JWT" --> API
    IOT -- "POST /api/iot/lecturas" --> API
    API --- MW
    API -- "SQLAlchemy" --> PG
    API -- "caché L2 + rate limit" --> RD
    API --> BR & CL & SE
    GH -- "push a main" --> Render
    GH -- "push a main" --> Vercel
```

## 3. Capas del backend

```mermaid
flowchart LR
    R["routes/<br/>HTTP, permisos,<br/>códigos de estado"] --> S["schemas/<br/>Pydantic:<br/>validación"]
    R --> SV["services/<br/>reglas de negocio<br/>(pagos, correo)"]
    SV --> RP["repositories/<br/>consultas,<br/>bloqueos de fila"]
    R --> RP
    RP --> M["models/<br/>SQLAlchemy"]
    M --> DB[("PostgreSQL")]
    C["core/<br/>config, seguridad JWT,<br/>caché, búsqueda,<br/>errores"] -.-> R & SV & RP
```

## 4. Capas del frontend

```mermaid
flowchart LR
    P["pages/<br/>rutas de react-router"] --> CO["components/<br/>UI, reserva, admin,<br/>temporada"]
    P --> H["hooks/ y context/<br/>sesión, tema, favoritos,<br/>cotización"]
    CO --> SV["services/<br/>un archivo por recurso"]
    H --> SV
    SV --> API["api/v1/api.ts<br/>apiFetch: token, errores,<br/>sesión vencida"]
    API -- HTTPS --> B["Backend"]
```

## 5. Decisiones que vienen de formaciones previas

| Concepto | Cómo se aplica |
|---|---|
| Separación por capas y responsabilidad única | Rutas sin SQL; repositorios sin HTTP; esquemas solo validan |
| Patrón repositorio + dobles de prueba | `tests/fakes.py` y `test_dobles_repositorio.py` prueban reglas sin base de datos |
| Seguridad (OWASP Top 10) | JWT con secreto fuerte, roles verificados en BD, límites de intentos, errores sin filtraciones, archivos privados con permiso ([`owasp-top-10.md`](../conceptos/owasp-top-10.md)) |
| Normalización y modelo relacional | 55 tablas con FK y CHECK; migraciones Alembic ([MER/MR](01b-modelo-de-datos.md)) |
| Accesibilidad (WCAG) | Roles ARIA, foco visible, contraste verificado por pruebas ([`accesibilidad-aria-wcag.md`](../conceptos/accesibilidad-aria-wcag.md)) |
| Contenedores e infraestructura como código | `Dockerfile` multi-etapa, `docker-compose*.yml`, workflows de GitHub |
| IoT | Dispositivo → HTTP/JSON → API → base de datos → panel ([`06-iot.md`](06-iot.md)) |
