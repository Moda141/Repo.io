# Repo.io — Master Data Platform (M1: ingestion)

Master Data Management tool that complements OpenMetadata (governance). Full design: [`docs/design.md`](docs/design.md) (Arabic).

## What works in M1 (ingestion)

- **Connectors** (`backend/app/connectors`): CSV folder, SQL databases (PostgreSQL, MySQL, SQL Server, Oracle; SQLite dev-only),
  SAP C4C (OData v2). Each implements the same SPI: `test_connection`, `discover`, `iterate` (full or incremental by cursor).
  Connection passwords are Fernet-encrypted at rest and never returned by the API.
- **Pipeline:** connector -> `mdm.raw.<system>.<entity>` -> normalizer (Arabic names, phones, emails) -> `mdm.source.normalized`
  -> ingest-writer -> PostgreSQL, plus `mdm.match.requests` (consumed from M2) and `mdm.dlq`. At-least-once and idempotent:
  replays are no-ops, unchanged rows are not rewritten, bad rows go to `ingest_error` + DLQ without stopping the run.
- **Deletes** are detected only on complete full snapshots, and skipped (with a warning) if more than 50% of active records
  would be removed. **Incremental** sync uses a watermark that advances only when the whole run succeeded.
- **Schema drift** is recorded on every Discover; changes touching a registered mapping are flagged.
- **Catalog tab:** services (test, discover, CSV upload), tables (register as master source + column mapping), sync runs, records.
- `MDM_INGEST_BUS=inline` runs the same pipeline in-process (tests, tiny deployments); `kafka` uses the `kafka` + `consumers` services.
- Alembic migrations run at API startup (baseline `0001`). Databases created by M0 (`create_all`) have no migration history:
  recreate the dev database (`docker compose down -v`).

### Tested vs. not tested

Tested (33 tests, SQLite): the whole pipeline through `InlineBus`, connectors (C4C against a mocked OData server, SQL via SQLite),
API validation, secret handling, path/SSRF guards. **Not tested:** the Kafka path end to end (no broker in the build environment),
`docker compose up`, a real C4C tenant (entity set and field names must come from your tenant's `$metadata`),
PostgreSQL `default_transaction_read_only` for the SQL connector.

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
Data Insights (M5.5), S/4HANA and REST connectors (M6).

## Install (like OpenMetadata: one file, prebuilt images)

```bash
curl -sL -o docker-compose.yml https://raw.githubusercontent.com/Moda141/Repo.io/main/docker-compose.release.yml
docker compose up -d
```
Windows PowerShell: `Invoke-WebRequest -Uri https://raw.githubusercontent.com/Moda141/Repo.io/main/docker-compose.release.yml -OutFile docker-compose.yml`.
Then open http://localhost:8080. Images are published to `ghcr.io/moda141/repo-io-{api,ui,mcp}` by
`.github/workflows/publish-images.yml`; the packages must be set to **public** once (GitHub > Packages > Package settings).
This path has not been run yet (the workflow has to run once on GitHub first).

## Run from source

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
