---
name: repoio-iceberg-catalog
description: Use when working on the Repo.io lakehouse data plane — the Iceberg REST catalog (repoio-catalog), table DDL, the Iceberg Index configuration, Trino/Spark query access, or any M2 work on raw/staged/matched/golden/change_log/audit tables. Trigger on tasks mentioning Iceberg, Trino, Parquet/manifests, point lookups by master_id, table partitioning or the sub-100ms golden record read path.
---

# Repo.io Iceberg Catalog & Data Plane (M2)

## What this domain owns

- `repoio-catalog/` — Iceberg REST catalog service, table DDL, index
  configuration.
- The six MDM tables and their index keys (fixed contract):

| Table | Purpose | Indexed on |
|-------|---------|------------|
| `raw_customer` | Every record as received, append-only | `source_id` |
| `staged_customer` | Standardised + enriched | `source_id` |
| `matched_pairs` | Splink candidates with scores | `pair_id` |
| `golden_customer` | One row per surviving entity | `master_id` |
| `change_log` | Field-level changes with provenance | `master_id`, `ts` |
| `audit` | Who did what, when | `actor`, `ts` |

- Query engines: Trino and Spark SQL; `repoio-service` reads via
  JDBC/REST through the catalog.

## Non-negotiables

0. **Iceberg is pinned to spec v3.** Use v3 for every table Repo.io owns.
   The v3 features in play: **deletion vectors** (the big win for
   MERGE/UPDATE-heavy survivorship on `golden_customer`), **row lineage**
   (row-level provenance complementing `change_log`), and the variant
   type (optional, semi-structured source fields). Two consequences:
   - The point-lookup **Index is NOT part of the v3 spec** — it is a
     separate upcoming feature. Pinning v3 does not deliver the sub-100 ms
     path; the M2 benchmark requirement stands unchanged.
   - **Engine support matrix first:** before writing any DDL, verify the
     pinned Spark and Trino versions and the chosen REST catalog
     implementation all support v3 — deletion-vector support in particular
     matured unevenly across engines. Record the matrix in the module
     README.
1. **Postgres stays control plane.** Table *metadata about* datasets may
   live in Postgres; the table *rows* never do. Equally: do not build a
   secondary index on Postgres or Elasticsearch for golden records — the
   Iceberg Index exists precisely to remove the double-storage and
   consistency-lag problem. If you believe you need one, raise it as a
   decision, don't build it.
2. **Iceberg Index is the point-lookup path.** A Golden Record lookup by
   `master_id` must walk index leaf files, not scan Parquet. The target is
   sub-100 ms reads for the UI and SAP C4C consumers.
3. **Index is an upcoming feature — benchmark it.** Because the read path
   of M4+ depends on it, M2 must include a benchmark harness measuring
   point-lookup latency at realistic table sizes. If the target is
   missed, report it and propose a fallback (serving cache) as an explicit
   decision. Never silently let M4 build on an unmeasured path.
4. **One source of truth for batch and interactive.** Spark (batch) and
   REST (interactive) read the same tables through the same catalog —
   never fork a "serving copy".
5. **Append-only means append-only.** `raw_*` tables are never updated in
   place. Corrections flow through the pipeline into new versions.

## Implementation notes

- DDL for the six tables lives in `repoio-catalog/` as versioned
  configuration, applied by the catalog service or bootstrap job — not
  hand-run scripts.
- Choose partition/sort strategy per table around the indexed key
  (`master_id` for golden, `source_id` for raw/staged) and document the
  rationale in the DDL file.
- `docker/` has compose stacks for iceberg, trino, spark — extend those
  rather than inventing new ones.
- Trino is the BI path (Power BI via Trino); keep query patterns in mind
  when designing column layout.

## Verification (must pass before "done")

- `docker compose up` (iceberg + trino stacks) starts clean; DDL applies
  idempotently.
- Write/read round-trip through the REST catalog from both Spark and
  Trino.
- Point lookup by `master_id` on a seeded `golden_customer` returns in
  the measured latency band — the benchmark harness output is part of the
  deliverable.
- Rewriting DDL does not corrupt existing data (schema evolution rules).

## Common pitfalls

- Falling back to full Parquet scans "temporarily" — temporary forever.
- Copying golden rows into Postgres for read speed (see §2 of CLAUDE.md —
  this re-creates the exact problem the architecture removes).
- Skipping the benchmark because "the docs say it's fast".
- Letting each engine create tables its own way — the catalog is the
  single owner of DDL.
