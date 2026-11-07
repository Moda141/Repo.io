---
name: repoio-integrations
description: Use when working on Repo.io connections and source write-back — the connections registry and admin hub (Databricks, Snowflake, Data Fabric, SQL Server, C4C, ERP), secret-store token handling, connection health checks, the workflow-driven Write-back Task, C4C/ERP write-back adapters, or data-platform federation via the Iceberg REST catalog. Trigger on tasks about "integration URL and access token", registering data platforms, write-back to source systems, or any M9 work.
---

# Repo.io Integrations — Connections Hub & Write-back (M9)

## What this domain owns

- **Connections registry** (Postgres control plane): name, type, endpoint
  URL, auth method, secret reference, status, health. Types include
  `sap_c4c`, `sap_erp`, `sqlserver`, `databricks`, `snowflake`,
  `data_fabric`, and future platforms.
- **Connections admin UI** (OpenUI5, Admin area): create/edit/test
  connections, health status, audit trail.
- **Secret store integration** — where the actual tokens live.
- **Write-back Task** — the workflow node that triggers source write-back.
- **Write-back adapters** in `repoio-clients/`: SAP C4C (OData) and SAP
  ERP (OData/RFC).
- **Data-platform federation** — Databricks / Snowflake / Fabric reading
  golden tables from the Iceberg REST catalog.

## Design decisions already made — do not re-litigate

1. **Write-back is workflow-driven.** A ChangeRequest reaches a source
   system only when its approved workflow definition includes a
   Write-back Task node. There is no automatic consumer of
   `changes.<entity>` that writes to sources — that topic is
   informational (audit/outbox feed). If a task asks for "automatic
   write-back on every change", that is a workflow-definition change, not
   a new consumer.
2. **Tokens never touch Postgres.** The `connections` table stores a
   secret-store *reference* (and at most a masked hint like last-4 for
   display). The token itself lives in Vault / Azure Key Vault. This is
   the single most audited rule in this domain — a leaked connections
   table must never equal leaked credentials.
3. **The workflow engine never talks to source systems.** Flowable invokes
   `repoio-service`; `repoio-service` calls the adapter in
   `repoio-clients`. Keep the engine ignorant of endpoints, tokens and
   source APIs.
4. **Federation is the preferred serving mode for data platforms.**
   Databricks / Snowflake / Fabric should read Repo.io golden tables
   directly from the Iceberg REST catalog (zero-copy). Build a
   per-platform export pipeline only when federation is impossible and
   the reason is documented.

## Write-back flow (the happy path to implement)

```
ChangeRequest approved
  → workflow containing Write-back Task reaches that node
  → Flowable calls repoio-service write-back API (ChangeRequest id+version)
  → repoio-service loads connection (by reference) + field allowlist
  → adapter in repoio-clients writes to C4C / ERP
  → result + audit recorded; workflow continues or routes to review
```

Non-negotiable details:

- **Idempotency:** keyed by `(ChangeRequest id, version)`. A workflow
  retry must not double-write the source.
- **Conflict check before write:** compare the current source value with
  the last ingested value. Source changed since the match → route to
  review, never overwrite silently.
- **Field allowlists per source system:** which golden fields may be
  written back is versioned configuration. Writing a field outside the
  allowlist is a bug, not a convenience.
- **Every attempt audited:** who approved, what workflow version, what
  fields, what the source returned, when.

## Connections hub details

- **Admin UI** (OpenUI5, Admin area): connection list with health, CRUD
  forms with per-type fields, a **Test connection** action, and an audit
  trail of every connection change. RBAC action: `administer
  connections` — separate from other admin grants; an admin who can
  manage users does not automatically manage connections.
- **Per-type auth config:** each connection type declares its auth scheme
  (PAT, OAuth2, service principal, key pair) and validation rules.
  Don't invent one generic blob for all types.
- **Health checks:** periodic (configurable interval) + on-demand test.
  Failures surface in the admin console and in alerting (M6 monitoring).
- **Source connections** (C4C, ERP, SQL Server) feed ingestion connectors
  and write-back adapters — one connection record serves both directions,
  no duplicated credential config.
- **Ingest mode for data platforms:** a Databricks/Snowflake/Fabric
  connection can also act as a *source* (pull master data) — connector in
  the Python SDK + Airflow DAG configured through the connection record.
- **Federation mode:** the connection record documents the granted
  identity and the Iceberg REST catalog endpoint the platform reads
  from. Access grants to the catalog are enforced at the catalog layer.

## Verification (must pass before "done")

- A connection created via the admin UI stores its token in the secret
  store and only a reference in Postgres — **verify by inspecting the
  `connections` table directly: no token material anywhere**.
- Test connection returns real success/failure against a live endpoint
  (not a canned OK).
- A workflow with a Write-back Task writes an approved ChangeRequest's
  fields to the target adapter (integration test against a stubbed C4C/
  ERP service that records calls).
- The same workflow retried does not double-write (idempotency key).
- A ChangeRequest approved through a workflow **without** the node
  produces zero source writes.
- The conflict path: source value changed since match → item lands in
  review, no overwrite.
- A field outside the allowlist is refused by the write-back API.
- A user without `administer connections` cannot create/edit/delete or
  see token material.
- Federation check: the external platform's reader identity can query the
  Iceberg REST catalog and an ungranted identity cannot.

## Common pitfalls

- Storing the token in Postgres "temporarily" for the test-connection
  feature — resolve the secret at call time instead.
- A write-back consumer bolted onto `changes.<entity>` — authority lives
  in the workflow only.
- Letting Flowable hold connection credentials in process variables.
- One shared connection secret for ingest and write-back when the
  business required different scopes (check the connection's granted
  scopes before reusing).
- Building export pipelines to Databricks/Snowflake before confirming
  federation actually can't work — the default answer is federation.
