# ADR-0008 — SQL Server change capture through Change Tracking

- Status: **accepted** (2026-11-14, Mohamed)
- Amends:
  - `docs/milestone-plan.md` M2 (change-capture decision);
  - CLAUDE.md §8 decisions list;
  - skill `repoio-ingestion`.
- Does not change:
  - SQL Server stays a **pull** source through Airflow (README §1);
  - push and pull converge on the same `raw.<entity>` topic;
  - raw first, thin ingest, idempotent re-delivery;
  - no new technology on the stack: log-based CDC (Debezium on Kafka
    Connect) still needs its own decision.

## Context

The SQL Server pull DAG must read only what changed since the last run,
including deletes, so a record removed at the source does not stay
alive in the golden layer. The options were a change column
(`modified_at` / `rowversion`), SQL Server Change Tracking, and full
SQL Server CDC (the mechanism Debezium reads).

## Decision

1. SQL Server change capture uses **Change Tracking**, enabled by the DBA
   on the source database and on each tracked table.
2. The DAG keeps the last synchronised version per table, reads
   `CHANGETABLE(CHANGES …)` for keys and operations (insert, update,
   delete), and joins back to the table for current values. Deletes are
   emitted to `raw.<entity>` as delete events with provenance.
3. Before each run the DAG compares its stored version with
   `CHANGE_TRACKING_MIN_VALID_VERSION`. If the version has fallen out of
   retention, the run stops and asks for a **governed re-initialisation**,
   never a silent full reload.
4. Retention is set longer than any expected outage (proposed 7 days;
   the final value is agreed with the DBA).
5. Access uses a read-only login with `VIEW CHANGE TRACKING` on the
   tracked tables; credentials live in the secret store.

## Fallback

For a table where Change Tracking cannot be enabled, or that has no
primary key, the DAG pulls on a `rowversion` column, and deletes for
that table are found through a periodic key reconciliation. Each
fallback table is listed in the module README with its reason.

## Consequences

- No schema changes to source application tables in the normal case.
- Intermediate changes between two runs are not kept; the golden layer
  needs current state, and the source history is out of scope.
- The DBA prerequisites (enable Change Tracking, retention, login) are
  confirmed before the SQL Server DAG is built.
