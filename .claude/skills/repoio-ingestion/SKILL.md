---
name: repoio-ingestion
description: Use when working on Repo.io data ingestion — the FastAPI push-ingest API, the outbox consumer, Airflow pull DAGs, SAP C4C / SAP ERP / SQL Server / Excel connectors, or Kafka topic production (raw.<entity>). Trigger on tasks touching ingestion/fastapi, ingestion/src/metadata, repoio-airflow-apis, docker/kafka, source connectors, or any "get data from system X into Repo.io" request.
---

# Repo.io Ingestion — Push & Pull (M2)

## What this domain owns

- `ingestion/fastapi/` — push-ingest endpoints (Python 3.11, FastAPI) and
  the outbox consumer for SAP C4C callbacks.
- `ingestion/src/metadata/` — pull connectors: SAP C4C, SAP ERP, SQL
  Server, Excel; `ingestion/src/metadata/sdk/` is the Python SDK.
- `repoio-airflow-apis/` — scheduled pull DAGs, DQ runs, housekeeping.
- `docker/kafka/` — event bus (Redpanda acceptable in dev only).
- `ingestion/pipelines/` — YAML pipeline configs.

## Data flow to respect

```
SAP C4C (push) → FastAPI ─┐
SAP ERP (pull)  → Airflow ├─→ Kafka raw.<entity> → Spark (M3)
SQL Server (pull)→ Airflow┘
```

Push and pull converge on the **same** `raw.<entity>` topic. One subject
per entity. Downstream stages subscribe; they never call connectors.

## Non-negotiables

1. **Raw first, always.** Every received record lands append-only in
   `raw.<entity>` (Kafka → Iceberg `raw_customer` etc.) exactly as
   received, with `source_id` and provenance. Standardisation and matching
   are M3 concerns — never inside ingestion.
2. **Ingest is thin.** Validate schema shape, attach provenance (source,
   timestamp, extraction id), produce to Kafka. Business logic,
   deduplication beyond idempotency, and survivorship do not belong here.
3. **Idempotency.** Re-delivery must be safe: key events by
   `(source_system, source_id, extraction_ts)` and make consumers
   idempotent. An Airflow retry or a C4C replay must not create duplicate
   raw records with new ids.
4. **Connector credentials** come from the environment/secret store —
   never hardcoded, never committed. Use placeholders and ask.
5. **Topic discipline.** Producers write only `raw.<entity>`. Creating
   ad-hoc topics or writing directly to `staged.`/`golden.` from ingestion
   breaks the whole pipeline contract.
6. **No user Python here.** Never execute user-submitted code in the
   FastAPI process (that is M8's isolated workers, see the
   `repoio-workflow-python` skill).

## Implementation notes

- FastAPI endpoints: validate the entity payload against the JSON Schema
  from `repoio-spec` (generate or share the Python SDK's models), reject
  with precise errors, then produce to Kafka and return an accepted
  receipt (source_id + offset).
- The outbox consumer polls the source's outbox (C4C pattern) and
  produces to Kafka with at-least-once + idempotency keys.
- Airflow DAGs: one DAG per source-entity pair, config-driven from
  `ingestion/pipelines/` YAML — no per-source hardcoded schedules buried
  in Python.
- Airflow 3.4 line (patch pinned). Every DAG file lives in
  `dags/<domain>/<repository>/<sync|dq>/`, or in `analytics/` /
  `platform/` for cross-cutting jobs. DAG ID = path joined with `__`;
  tags `domain:`, `repo:`, `kind:`. Deploy-generated flow DAGs hold only
  the flow ID (ADR-0005).
- Dev runs Redpanda; anything environment-specific stays in
  `docker/kafka/` compose files.

## Verification (must pass before "done")

- `pytest` for the FastAPI app and connectors (testcontainers for Kafka,
  real broker in dev compose — no mocked producer that always "succeeds").
- `docker compose up` brings Kafka + Iceberg; a test C4C event posted to
  the push endpoint lands in `raw.customer` (the M2 exit condition).
- Replay the same event twice → no duplicate logical record.
- Connector auth errors surface clearly (no swallowed exceptions).

## Common pitfalls

- Doing matching/standardisation at ingest time — reject the temptation,
  M3 owns it.
- Mocking the Kafka producer in tests so failures can never be caught.
- Hardcoding SAP endpoint URLs or credentials in DAG code.
- Inventing new topic names instead of `raw.<entity>`.
