# Contributing to Alik tours

Thanks for your interest in contributing! This document outlines the workflow and conventions used in this project.

## Project structure

This is a monorepo with two main parts:

```
proyectoalectoursDocker/
├── alecktourfrondend/   # React + TypeScript + Vite frontend
├── backend/             # FastAPI + SQLAlchemy backend
├── docs/                # Technical documentation
├── docker-compose.yml   # Full local environment (DB, mail, API, frontend)
└── db_schema.sql        # Database schema reference
```

## Getting started

1. Clone the repository and check out `main`:
```bash
   git clone https://github.com/Juan-Pablo-Castillo-Velasquez/proyectoalectoursDocker.git
   cd proyectoalectoursDocker
```
2. Start the full stack with Docker — no manual setup needed, `backend/.env.example` already ships safe local defaults and is loaded automatically:
```bash
   docker compose up --build
```
3. (Optional) To override any default value locally without touching a tracked file, copy it to `backend/.env` — anything in there takes priority over `.env.example`:
```bash
   cp backend/.env.example backend/.env
```
4. Frontend: http://localhost:5173 · Backend docs: http://localhost:8000/docs

## Branching model — GitHub Flow

`main` must always be in a deployable state. All work happens on short-lived branches created from `main`.

### Branch naming

Use `<type>/<short-description>`, lowercase, hyphen-separated:

| Type | Use for | Example |
|------|---------|---------|
| `feature/` | New functionality | `feature/hotel-search-filters` |
| `fix/` | Bug fixes | `fix/mysql-connection-string` |
| `refactor/` | Code restructuring, no behavior change | `refactor/service-layer` |
| `chore/` | Maintenance, config, dependencies | `chore/backend-improvements` |
| `docs/` | Documentation only | `docs/update-documentation` |
| `test/` | Test-only additions | `test/auth-flow` |

Keep each branch focused on a single, describable change.

### Workflow

```bash
git checkout main
git pull origin main
git checkout -b feature/your-branch-name

# ...make your changes...

git add .
git commit -m "feat(scope): short description"
git push -u origin feature/your-branch-name
```

Then open a Pull Request against `main`. Once reviewed and merged, delete the branch:

```bash
git checkout main
git pull origin main
git branch -d feature/your-branch-name
git push origin --delete feature/your-branch-name
```

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Examples:
```
feat(auth): add password reset endpoint
fix(hotel): correct availability filter logic
docs(readme): update local setup instructions
chore(deps): bump fastapi to 0.115.0
```

## Code style

**Backend (FastAPI)**
- Follow the existing layered architecture: `routes → services → repositories → models/schemas`.
- New endpoints should go through a service, not call repositories directly from a route.
- Add type hints to all function signatures.
- Never commit real credentials — use `backend/.env` (gitignored) and keep `.env.example` up to date with new variables.

**Frontend (React + TypeScript)**
- Use one package manager consistently (`pnpm`) — do not commit both `package-lock.json` and `pnpm-lock.yaml`.
- Keep components typed; avoid `any`.
- Group service calls by entity (e.g. `hotel.service.ts`, `cliente.service.ts`).

## Tests

- Backend tests live under `backend/tests/`. Run them with:
```bash
  cd backend
  pytest
```
- New features that touch business logic should include at least a basic test.

## Pull Requests

- Keep PRs small and scoped to one branch's purpose.
- Write a clear PR description: what changed and why.
- Make sure the app still runs via `docker compose up --build` before requesting review.

## Questions

Open an issue or reach out directly to the maintainer.