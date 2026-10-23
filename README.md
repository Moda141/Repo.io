# Repo.io — Master Data Platform (M0 skeleton)

Master Data Management tool that complements OpenMetadata (governance). Full design: [`docs/design.md`](docs/design.md) (Arabic).

## What works in M0

- FastAPI backend: login (lockout after 3 failures, 30 s block, 1 h session JWT), personal access tokens, bot tokens
  (no expiry, rotate), source-record mirror, customer search, catalog source summary, health check.
- **Tickets with templates:** stewards/admins create a template (domain, fields, each field mandatory or optional);
  users submit requests against it. Mandatory fields and field types are validated server-side.
- Demo data: ~200 synthetic Arabic customer records across `C4C`, `S4HANA`, `CRM` with intentional duplicates
  and ground-truth ids (`payload._truth_entity`) for evaluating Splink in M2.
- Worker (Arq) stub, React UI shell with the 9 tabs (Catalog, Tickets and Settings are functional), MCP server with read tools.
- UI follows OpenMetadata's layout and default theme palette as a design reference; the logo and the Repo.io name are ours.

Not yet built: matching/golden records (M2/M3), Tasks/DQ/SQL Editor (M4), Roles & Policies, Preferences (M5),
Data Insights (M5.5), connectors (M1), Alembic migrations (M1; M0 uses `create_all`).

## Run

```bash
cp .env.example .env        # then edit secrets
docker compose up --build
```

- UI: http://localhost:8080 — API docs: http://localhost:8000/docs — MCP: http://localhost:8001/mcp
- Sign in with `MDM_ADMIN_EMAIL` / `MDM_ADMIN_PASSWORD` (defaults `admin@example.com` / `admin123`, development only).

## Enable the MCP server

1. Sign in and create a bot (admin): `POST /api/v1/bots` with `{"name": "mcp", "role": "viewer"}`; copy the returned token (shown once).
2. Put it in `.env` as `MDM_MCP_TOKEN=...` and run `docker compose up -d mcp`.
3. Point an MCP client at `http://localhost:8001/mcp`. Tools: `get_health`, `search_customers`, `list_sources`.

## Develop / test

```bash
cd backend && pip install -r requirements.txt && pytest -q   # tests run on SQLite
cd frontend && npm install && npm run dev                   # proxies /api to localhost:8000
```

## Security notes

Change `MDM_JWT_SECRET` and the admin password before any shared deployment. Tokens are stored as SHA-256 hashes only.
Never commit `.env`.
