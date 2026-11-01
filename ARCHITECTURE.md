# Repo.io Architecture

> Nahdet Misr Publishing Group — Enterprise MDM
> Last reviewed: **1 Nov 2026**

Repo.io is a **lakehouse-native Master Data Management platform**. The
repository tree mirrors OpenMetadata, and the runtime stack adds
Apache Iceberg (catalog + index + table), Apache Kafka, Apache Spark
Structured Streaming and FastAPI on top of a Dropwizard REST backend and
React UI.

```
┌──────────────────────── Serving ────────────────────────┐
│  repoio-ui (React) · repoio-service (Dropwizard REST)   │
│  repoio-mcp (AI agents) · Trino / Spark SQL (BI)        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                 Apache Iceberg catalog                  │  repoio-catalog
│   raw · staged · matched · golden · change_log · audit  │
│                 ─ Iceberg Index on master_id ─          │
└──────────────────────────▲──────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────┐
│           Spark Structured Streaming jobs               │  repoio-stream
│   standardise · DQ (Great Expect.) · Splink · survive   │
└──────────────────────────▲──────────────────────────────┘
                           │
                     ┌─────┴─────┐
                     │   Kafka   │   raw.*  staged.*  matched.*
                     └─────▲─────┘   golden.*  changes.*
                           │
         ┌─────────────────┴──────────────────┐
         │                                    │
   ┌─────▼─────┐                      ┌───────▼────────┐
   │  FastAPI  │  SAP C4C push        │  Airflow DAGs  │  SAP ERP · SQL Server
   │ (ingest/) │                      │ (repoio-airflow│  Excel · CSV · Drives
   └───────────┘                      │  -apis)        │
                                      └────────────────┘
```

See [**docs/architecture/README.md**](docs/architecture/README.md) for:

- The two reference diagrams (Iceberg Index · FastAPI→Kafka→Spark) mapped
  box-by-box to our modules
- Full Kafka topic contract
- Entity coverage for Phase 1 (Customer, Vendor, Product, Author, Employee, Store)
- Milestones M0 → M6
- Module-by-module breakdown of what goes where
