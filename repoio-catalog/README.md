# repoio-catalog

Apache Iceberg REST catalog and table definitions for Repo.io.

## Scope

- **Iceberg REST catalog** config (dev + staging + prod)
- **Table DDL** for the MDM data model:
  - `raw.<entity>` — append-only raw records
  - `staged.<entity>` — standardised + enriched
  - `matched_pairs` — Splink candidate pairs with scores
  - `golden.<entity>` — surviving records (served to apps)
  - `change_log` — field-level provenance
  - `audit` — who did what, when
- **Iceberg Index** declarations on `master_id` for sub-100ms point lookups
- Partitioning, sort orders, snapshot retention

## Why Iceberg

- Single source of truth for batch (Spark) and interactive (REST) reads
- Time travel: every golden record change is a snapshot we can `AS OF`
- Index removes the need for a secondary cache (Postgres / Elasticsearch)
  that would otherwise lag the data plane

## Layout (to be filled during M2)

```
src/main/
  java/com/nahdetmisr/repoio/catalog/
    CatalogConfig.java           # Dropwizard config binding
    TableRegistry.java           # DDL loader
  resources/
    tables/
      raw-customer.ddl.sql
      golden-customer.ddl.sql
      change-log.ddl.sql
    index/
      golden-customer.index.yml  # Iceberg Index on master_id
```
