# Change · Lakehouse foundation (M2)

Author: Mohamed · Status: **proposed** · Target: M2

## Summary

Introduce Apache Iceberg (REST catalog + Index + Table), Apache Kafka
(event bus) and FastAPI (push-ingest API) as the data plane for Repo.io.
Keep Postgres as the control plane for governance metadata only.

See [docs/architecture/README.md](../../../docs/architecture/README.md)
for the full reference.

## Why

1. Golden-record lookups need sub-100ms latency to serve SAP C4C and the
   UI without a secondary cache. The Iceberg Index gives us that from
   the data plane itself.
2. Our source systems (SAP C4C webhooks, SAP ERP batch, SQL Server CDC,
   spreadsheets) have very different cadences. Kafka decouples them from
   the matching/survivorship work.
3. We want the same tables Spark writes to be the ones Trino and
   Power BI read. Iceberg is the only catalog that gives us both without
   a copy step.

## What changes

- New modules: `repoio-catalog`, `repoio-stream`, `ingestion/fastapi`
- `docker/` gains compose stacks for Iceberg REST, Kafka (Redpanda in dev),
  Spark, Trino
- `repoio-service` learns to read golden records via the Iceberg Index
  (no new write path yet)
- `repoio-spec` adds the first entity (`Customer`) if M1 hasn't shipped it
- CI publishes Iceberg + Spark images alongside the existing service image

## Non-goals

- No change to the Dropwizard REST surface users already have
- No live-sync back to SAP C4C in this change (that's the outbox in M3)
- No UI changes (M4)

## Rollout

1. Dev `docker-compose up` runs the whole stack locally
2. Staging on AKS behind an internal VNet
3. Production after a 2-week shadow run against SAP C4C
