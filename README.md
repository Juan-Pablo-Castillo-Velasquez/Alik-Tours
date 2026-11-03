<p align="center">
  <img
    src="https://ghrb.waren.build/banner?header=AlekTours&subheader=Agencia%20de%20viajes%20%7C%20Hoteles%20%7C%20Reservas%20%7C%20Experiencias&bg=1A0A10-7A173F&color=FFFFFF&subheadercolor=F3B3C9&headerfont=Playfair%20Display&subheaderfont=Inter"
    alt="AlekTours"
    width="100%"
  />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-9E315C?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Version-Development-6E1738?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-9E315C?style=for-the-badge" alt="License">
</p>

<p align="center">
  <strong>Plataforma moderna para descubrir destinos, reservar hoteles y gestionar experiencias de viaje.</strong>
</p>

<p align="center">
  <a href="#características">Características</a>
  •
  <a href="#arquitectura">Arquitectura</a>
  •
  <a href="#instalación">Instalación</a>
  •
  <a href="#api">API</a>
  •
  <a href="#contribución">Contribución</a>
</p>

---

# AlekTours

AlekTours es una plataforma web orientada a la gestión integral de servicios turísticos.

El sistema permite centralizar la gestión de hoteles, habitaciones, reservas, paquetes turísticos, usuarios, servicios y procesos relacionados con la experiencia del viajero.

El proyecto está construido bajo una arquitectura desacoplada entre frontend y backend, utilizando una API REST desarrollada con FastAPI, PostgreSQL como sistema de persistencia y Docker Compose para la administración del entorno.

---

# Stack tecnológico

<p align="center">

<img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=111827" alt="React">

<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">

<img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite">

<img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">

<img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">

<img src="https://img.shields.io/badge/SQLAlchemy-D71F00?style=flat-square" alt="SQLAlchemy">

<img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">

<img src="https://img.shields.io/badge/Alembic-1F2937?style=flat-square" alt="Alembic">

<img src="https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis">

<img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">

</p>

---

# Características

| Módulo          | Funcionalidad                                  |
| --------------- | ---------------------------------------------- |
| Usuarios        | Registro, autenticación, perfiles y roles      |
| Hoteles         | Gestión de hoteles y habitaciones              |
| Reservas        | Creación, consulta, confirmación y cancelación |
| Paquetes        | Gestión de paquetes turísticos                 |
| Servicios       | Administración de servicios turísticos         |
| Pagos           | Gestión y seguimiento de pagos                 |
| Notificaciones  | Correos transaccionales                        |
| Seguridad       | JWT, hashing y control de acceso               |
| API             | REST + OpenAPI                                 |
| Infraestructura | Docker Compose                                 |
| Base de datos   | PostgreSQL                                     |
| Caché           | Redis                                          |
| Administración  | pgAdmin                                        |
| Email testing   | Mailpit                                        |

---

# Arquitectura

AlekTours utiliza una arquitectura por capas que separa la presentación, los endpoints, la lógica de negocio y el acceso a datos.

```mermaid
flowchart TB

    USER["Usuario"]

    subgraph FRONTEND["Frontend"]
        UI["React + TypeScript"]
        VITE["Vite"]
    end

    subgraph BACKEND["Backend"]
        ROUTES["Routes"]
        SCHEMAS["Pydantic Schemas"]
        SERVICES["Business Services"]
        REPOSITORIES["Repositories"]
        MODELS["SQLAlchemy Models"]
        SECURITY["Authentication / JWT"]
    end

    subgraph DATABASE["Persistencia"]
        POSTGRES[("PostgreSQL")]
    end

    USER --> UI
    UI --> VITE
    VITE -->|"HTTP / REST"| ROUTES

    ROUTES --> SCHEMAS
    ROUTES --> SERVICES
    ROUTES --> SECURITY

    SERVICES --> REPOSITORIES
    REPOSITORIES --> MODELS
    MODELS --> POSTGRES

    SECURITY --> POSTGRES

    classDef primary fill:#7A173F,color:#fff,stroke:#B83B68,stroke-width:2px;
    classDef secondary fill:#241019,color:#fff,stroke:#9E315C,stroke-width:1px;
    classDef database fill:#3B1728,color:#fff,stroke:#C24A78,stroke-width:2px;

    class USER,UI,VITE primary;
    class ROUTES,SCHEMAS,SERVICES,REPOSITORIES,MODELS,SECURITY secondary;
    class POSTGRES database;
```

---

# Arquitectura por capas

```mermaid
flowchart LR

    A["HTTP Request"] --> B["Route"]

    B --> C["Schema"]

    C --> D["Service"]

    D --> E["Repository"]

    E --> F["SQLAlchemy"]

    F --> G[("PostgreSQL")]

    G --> F
    F --> E
    E --> D
    D --> B
    B --> H["HTTP Response"]

    classDef layer fill:#241019,color:#fff,stroke:#9E315C,stroke-width:2px;
    classDef database fill:#3B1728,color:#fff,stroke:#C24A78,stroke-width:2px;

    class A,B,C,D,E,F,H layer;
    class G database;
```

Esta separación permite mantener responsabilidades claras:

* `Routes`: entrada HTTP.
* `Schemas`: validación y serialización.
* `Services`: lógica de negocio.
* `Repositories`: acceso a datos.
* `Models`: representación ORM.
* `PostgreSQL`: persistencia.

---

# Flujo de autenticación

El sistema utiliza autenticación basada en JWT.

```mermaid
sequenceDiagram

    participant U as Usuario
    participant F as Frontend
    participant A as API
    participant S as Auth Service
    participant DB as PostgreSQL

    U->>F: Ingresa credenciales
    F->>A: POST /auth/login
    A->>S: Validar credenciales
    S->>DB: Buscar usuario
    DB-->>S: Datos del usuario
    S->>S: Verificar contraseña
    S->>S: Generar JWT
    S-->>A: Access Token
    A-->>F: Token
    F-->>U: Sesión iniciada

    U->>F: Solicita recurso protegido
    F->>A: Request + Bearer Token
    A->>S: Validar JWT
    S-->>A: Token válido
    A-->>F: Recurso solicitado
    F-->>U: Información
```

---

# Flujo de reservas

```mermaid
sequenceDiagram

    participant C as Cliente
    participant F as Frontend
    participant API as FastAPI
    participant RS as Reservation Service
    participant HR as Hotel Repository
    participant RR as Reservation Repository
    participant DB as PostgreSQL
    participant M as Mailpit / SMTP

    C->>F: Selecciona hotel
    F->>API: Consultar disponibilidad

    API->>RS: Verificar disponibilidad
    RS->>HR: Consultar habitaciones
    HR->>DB: Query
    DB-->>HR: Habitaciones disponibles
    HR-->>RS: Disponibilidad
    RS-->>API: Resultado
    API-->>F: Habitaciones disponibles

    C->>F: Confirma reserva
    F->>API: Crear reserva

    API->>RS: Procesar reserva
    RS->>RR: Crear reserva
    RR->>DB: INSERT
    DB-->>RR: Reserva creada

    RS->>M: Enviar confirmación
    M-->>C: Email de confirmación

    RS-->>API: Reserva confirmada
    API-->>F: Confirmación
    F-->>C: Reserva realizada
```

---

# Modelo de dominio

La relación general entre algunas de las entidades principales puede representarse mediante:

```mermaid
erDiagram

    USUARIO {
        int id PK
        string nombre
        string email
        string password_hash
        string rol
        boolean activo
    }

    HOTEL {
        int id PK
        string nombre
        string ciudad
        string descripcion
        decimal precio
        float calificacion
    }

    HABITACION {
        int id PK
        int hotel_id FK
        string tipo
        decimal precio
        boolean disponible
    }

    RESERVA {
        int id PK
        int usuario_id FK
        int hotel_id FK
        int habitacion_id FK
        date fecha_entrada
        date fecha_salida
        string estado
        decimal total
    }

    PAQUETE {
        int id PK
        string nombre
        string descripcion
        decimal precio
        int duracion
    }

    SERVICIO {
        int id PK
        string nombre
        string descripcion
        decimal precio
    }

    PAGO {
        int id PK
        int reserva_id FK
        decimal monto
        string estado
        string metodo
    }

    USUARIO ||--o{ RESERVA : realiza

    HOTEL ||--o{ HABITACION : contiene

    HOTEL ||--o{ RESERVA : recibe

    HABITACION ||--o{ RESERVA : utiliza

    RESERVA ||--o| PAGO : genera

    PAQUETE }o--o{ SERVICIO : incluye
```

> El diagrama representa conceptualmente el dominio del sistema. La estructura definitiva debe mantenerse sincronizada con los modelos y migraciones actuales de la aplicación.

El sistema completo tiene 41 tablas organizadas por dominio (usuarios y seguridad, hoteles, servicios, paquetes, reservas y pagos, entre otros). Cada una está explicada en [`docs/referencia-tecnica/tablas.md`](docs/referencia-tecnica/tablas.md).

---

# Infraestructura Docker

El entorno de desarrollo utiliza Docker Compose para ejecutar los principales servicios.

```mermaid
flowchart TB

    DEV["Developer"]

    subgraph DOCKER["Docker Compose"]

        FRONT["Frontend<br/>React + Vite"]

        BACK["Backend<br/>FastAPI"]

        DB[("PostgreSQL")]

        CACHE[("Redis")]

        PGADMIN["pgAdmin"]

        MAIL["Mailpit"]
    end

    DEV --> FRONT

    FRONT -->|"HTTP"| BACK

    BACK --> DB

    BACK --> CACHE

    PGADMIN --> DB

    BACK --> MAIL

    classDef main fill:#7A173F,color:#fff,stroke:#B83B68,stroke-width:2px;
    classDef service fill:#241019,color:#fff,stroke:#9E315C,stroke-width:2px;
    classDef database fill:#3B1728,color:#fff,stroke:#C24A78,stroke-width:2px;

    class DEV main;
    class FRONT,BACK,PGADMIN,MAIL service;
    class DB,CACHE database;
```

---

# Estructura del proyecto

```text
proyectoalectoursDocker/
│
├── .github/
│   └── workflows/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   │
│   ├── alembic/
│   │   └── versions/
│   │
│   ├── Dockerfile
│   └── requirements.txt
│
├── alecktourfrondend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── docs/
│
├── db_schema.sql
├── docker-compose.yml
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENCE
└── README.md
```

---

# Instalación

## Requisitos

El único requisito real para levantar el proyecto es tener **Docker** y
**Docker Compose** instalados. Git es necesario para clonar el
repositorio. Node.js/pnpm y Python solo hacen falta si vas a trabajar en
el frontend o el backend **fuera** de Docker (ver [Desarrollo
local](#desarrollo-local) más abajo) — no son necesarios para levantar el
proyecto con Docker.

* Git
* Docker
* Docker Compose

---

## Clonar el repositorio

```bash
git clone https://github.com/Juan-Pablo-Castillo-Velasquez/proyectoalectoursDocker.git

cd proyectoalectoursDocker
```

---

# Variables de entorno

**No es necesario crear ningún archivo `.env` para levantar el proyecto.**
`backend/.env.example` ya está versionado en el repositorio y
`docker-compose.yml` lo carga automáticamente como valores por defecto
seguros para desarrollo local (mismas credenciales que el servicio
`postgres` de este mismo archivo, Mailpit como SMTP, Redis local, etc.),
así que `docker compose up --build` funciona con un solo comando en una
copia recién clonada del repositorio.

Si querés sobreescribir algún valor sin tocar archivos versionados
(por ejemplo, credenciales de un proveedor de correo real), creá
`backend/.env` — es opcional y, si existe, sus valores tienen prioridad
sobre los de `backend/.env.example`. Las variables mínimas que vas a
querer revisar/sobreescribir en un entorno real son:

```env
DATABASE_URL=postgresql+psycopg2://admin:admin123@postgres:5432/alektours_db

SECRET_KEY=change_this_secret_key
ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=30

REDIS_URL=redis://redis:6379/0

MAIL_USERNAME=your_email@example.com
MAIL_PASSWORD=your_password
MAIL_FROM=noreply@alectours.com
MAIL_PORT=1025
MAIL_SERVER=mailpit

MAIL_FROM_NAME=AlecTours
MAIL_STARTTLS=False
MAIL_SSL_TLS=False
```

Las credenciales reales nunca deben almacenarse en el repositorio.

---

# Ejecutar con Docker

**El único comando necesario para levantar todo el proyecto** (backend,
frontend, base de datos, Redis, Mailpit y pgAdmin) en una copia recién
clonada es:

```bash
docker compose up --build
```

Esto construye las imágenes, levanta los servicios en el orden correcto
(el backend espera a que Postgres esté saludable antes de arrancar) y
aplica automáticamente las migraciones de Alembic (incluyendo los datos
semilla) al iniciar el contenedor del backend — no hace falta ningún
paso manual adicional.

Para levantarlo en segundo plano:

```bash
docker compose up --build -d
```

Comprobar el estado:

```bash
docker compose ps
```

Visualizar logs:

```bash
docker compose logs -f
```

Logs del backend:

```bash
docker compose logs -f backend
```

---

# Migraciones

Las migraciones de Alembic se aplican **automáticamente** al iniciar el
contenedor del backend (ver `backend/entrypoint.sh`) — no es necesario
ejecutar `alembic upgrade head` a mano. Los siguientes comandos son solo
para consultar el estado o crear nuevas migraciones durante el
desarrollo:

Consultar la migración actual:

```bash
docker compose exec backend alembic current
```

Consultar historial:

```bash
docker compose exec backend alembic history
```

Crear una migración:

```bash
docker compose exec backend alembic revision --autogenerate -m "descripcion"
```

---

# Desarrollo local

## Backend

```bash
cd backend

pip install -r requirements.txt

uvicorn app.main:app --reload
```

## Frontend

```bash
cd alecktourfrondend

pnpm install

pnpm dev
```

---

# Pruebas

Suite construida en el Bootcamp Testing ADSO. Estrategia completa en
[`docs/estrategia-pruebas.md`](docs/estrategia-pruebas.md) y rotación del
grupo en [`docs/matriz-rotacion.md`](docs/matriz-rotacion.md).

| Parte | Comando | Qué corre |
|---|---|---|
| Frontend | `cd alecktourfrondend && pnpm test` | Vitest + Testing Library + MSW, con umbral de cobertura |
| Backend | `cd backend && pytest` | Unitarias y de API (SQLite en memoria), con umbral de cobertura |
| E2E | `cd e2e && pnpm test` | Playwright (ver [`e2e/README.md`](e2e/README.md)) |

## Integración con PostgreSQL real

Los tests de `backend/tests/integration/` se saltan si no existe
`TEST_DATABASE_URL`. Para correrlos contra la BD de pruebas (puerto 5433,
nunca la de desarrollo):

```bash
# 1. Levantar la BD de pruebas (vacía)
docker compose -f docker-compose.test.yml up -d --wait

# 2. Crear el esquema con las migraciones y correr la integración (desde backend/)
export DATABASE_URL=postgresql+psycopg2://alektours:alektours@localhost:5433/alektours_test
export TEST_DATABASE_URL=$DATABASE_URL
alembic upgrade head && pytest tests/integration

# 3. Apagarla y borrar sus datos
docker compose -f docker-compose.test.yml down -v
```

En PowerShell (Windows), el paso 2 es:

```powershell
$env:DATABASE_URL="postgresql+psycopg2://alektours:alektours@localhost:5433/alektours_test"
$env:TEST_DATABASE_URL=$env:DATABASE_URL
alembic upgrade head; pytest tests/integration
```

# API

FastAPI genera automáticamente la documentación OpenAPI.

## Swagger UI

```text
http://localhost:8000/docs
```

## ReDoc

```text
http://localhost:8000/redoc
```

---

# Servicios

| Servicio | URL                       | Propósito         |
| -------- | ------------------------- | ----------------- |
| Frontend | `localhost:5173`          | Aplicación web    |
| Backend  | `localhost:8000`          | API REST          |
| Swagger  | `localhost:8000/docs`     | Documentación     |
| ReDoc    | `localhost:8000/redoc`    | Documentación     |
| PostgreSQL | `localhost:5432`        | Base de datos     |
| Redis    | `localhost:6379`         | Caché             |
| pgAdmin  | `localhost:5050`          | Administración DB |
| Mailpit  | `localhost:8025`          | Pruebas de correo (bandeja web) |

---

# Contribución

Las contribuciones son bienvenidas.

El flujo recomendado es:

```mermaid
gitGraph
    commit id: "main"

    branch feature
    checkout feature

    commit id: "Implementación"
    commit id: "Pruebas"
    commit id: "Documentación"

    checkout main
    merge feature
```

Crear una rama:

```bash
git checkout main
git pull origin main

git checkout -b feature/nueva-funcionalidad
```

Realizar cambios:

```bash
git add .
git commit -m "feat: agregar nueva funcionalidad"
```

Subir la rama:

```bash
git push origin feature/nueva-funcionalidad
```

Posteriormente crear un Pull Request.

Consulta [`CONTRIBUTING.md`](CONTRIBUTING.md) para las reglas completas de contribución.

---

# Conventional Commits

Se recomienda utilizar:

```text
feat: nueva funcionalidad

fix: corrección de errores

refactor: modificación interna

docs: documentación

test: pruebas

chore: mantenimiento

perf: rendimiento

style: formato
```

Ejemplos:

```bash
git commit -m "feat: agregar gestión de reservas"

git commit -m "fix: corregir disponibilidad de habitaciones"

git commit -m "refactor: separar lógica de reservas"

git commit -m "docs: actualizar arquitectura"
```

---

# Seguridad

El proyecto utiliza mecanismos como:

* JWT.
* Hashing de contraseñas.
* Validación mediante Pydantic.
* Control de acceso.
* Variables de entorno.
* Separación de credenciales.
* Protección de información sensible.

Nunca subir:

```text
.env
*.pem
*.key
credentials.json
tokens
passwords
secret keys
```

Para reportar una vulnerabilidad, consultar [`SECURITY.md`](SECURITY.md).

---

# Documentación

La documentación adicional está disponible en:

```text
docs/
```

Documentos principales:

* [`CONTRIBUTING.md`](CONTRIBUTING.md)
* [`SECURITY.md`](SECURITY.md)
* [`db_schema.sql`](db_schema.sql)

Referencia técnica (`docs/referencia-tecnica/`):

* [`tablas.md`](docs/referencia-tecnica/tablas.md): para qué sirve cada tabla de la base de datos.
* [`database-schema.md`](docs/referencia-tecnica/database-schema.md): esquema detallado, índices y migraciones.
* [`architecture.md`](docs/referencia-tecnica/architecture.md): arquitectura del sistema.
* [`api-endpoints.md`](docs/referencia-tecnica/api-endpoints.md): endpoints de la API.
* [`design-system.md`](docs/referencia-tecnica/design-system.md): sistema de diseño.

Otras guías:

* [`docs/setup/con-docker.md`](docs/setup/con-docker.md) y [`docs/setup/sin-docker.md`](docs/setup/sin-docker.md): puesta en marcha.
* [`docs/requisitos/`](docs/requisitos/): requisitos funcionales, no funcionales e historias de usuario.
* [`docs/conceptos/`](docs/conceptos/): accesibilidad, OWASP Top 10 y patrones arquitectónicos.

---

# Roadmap

```mermaid
timeline
    title Evolución de AlekTours

    Desarrollo inicial : Arquitectura base
                      : Frontend
                      : Backend
                      : PostgreSQL

    Integración : Autenticación
                : Reservas
                : Hoteles
                : Paquetes

    Optimización : Pruebas automatizadas
                 : Seguridad
                 : Rendimiento
                 : CI/CD

    Producción : Observabilidad
               : Escalabilidad
               : Integraciones externas
```

---

# Estado

<p align="center">

<img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=111827" alt="Frontend">

<img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="Backend">

<img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="Database">

<img src="https://img.shields.io/badge/Infrastructure-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">

</p>

---

# Licencia

Este proyecto se distribuye bajo los términos definidos en [`LICENCE`](LICENCE).

---

# Repositorio

[GitHub — AlekTours](https://github.com/Juan-Pablo-Castillo-Velasquez/proyectoalectoursDocker)

---

<p align="center">
  <strong>AlekTours</strong>
</p>

<p align="center">
  Plataforma de gestión turística y reservas.
</p>
