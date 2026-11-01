# Repo.io — Lakehouse-Native MDM Architecture

> Nahdet Misr Publishing Group — Enterprise Master Data Management
> Last reviewed: **1 Nov 2026**

Repo.io is a lakehouse-native Master Data Management platform. It unifies
master data from SAP C4C, SAP ERP, SQL Server and spreadsheet sources into
governed golden records that are served to apps, BI and AI agents.

The repo tree mirrors OpenMetadata, but the runtime stack is extended with
**Apache Iceberg** (catalog + index + table), **Apache Kafka** (event bus),
**Apache Spark Structured Streaming** (processing) and **FastAPI** (push
ingest), on top of the Dropwizard REST backend and React UI.

---

## 1. Reference stack

| Layer                 | Technology                                           | Module                             |
|-----------------------|------------------------------------------------------|------------------------------------|
| Push ingest API       | **FastAPI** (Python 3.11)                            | `ingestion/fastapi/`               |
| Batch / pull ingest   | Python SDK — SAP C4C, ERP, SQL Server, Excel         | `ingestion/src/metadata/`          |
| Event bus             | **Apache Kafka** (Redpanda in dev)                   | `docker/kafka/`                    |
| Stream processing     | **Apache Spark** Structured Streaming                | `repoio-stream/` *(new)*           |
| Catalog + storage     | **Apache Iceberg** REST catalog + Index + Table      | `repoio-catalog/` *(new)*          |
| Query engines         | Trino, Spark SQL (ad-hoc)                            | —                                  |
| REST / GraphQL app    | **Dropwizard 4** (Java 17), JDBI3, Jersey            | `repoio-service/`                  |
| Entity schemas        | JSON Schema (OpenAPI 3.1)                            | `repoio-spec/`                     |
| Java client SDK       | OpenAPI-generated                                    | `repoio-sdk/`, `repoio-clients/`   |
| UI                    | React 18 + TypeScript + Ant Design 5                 | `repoio-ui/`                       |
| Shared UI primitives  | TS component library                                 | `repoio-ui-core-components/`       |
| AI agent interface    | **MCP** server (JDK)                                 | `repoio-mcp/`                      |
| Pipelines             | Airflow DAGs (Managed APIs)                          | `repoio-airflow-apis/`             |
| Infra                 | **Kubernetes operator** (CRD: `Repository`)          | `repoio-k8s-operator/`             |
| Distribution          | Docker images + Helm charts                          | `repoio-dist/`, `docker/`          |
| Metadata store        | Postgres 15 (control-plane) + Iceberg (data-plane)   | —                                  |

The 12 Maven modules and 2 Python packages the scaffold already carries
cover **12 of 15** boxes above. The remaining 3 — `repoio-catalog`,
`repoio-stream` and `ingestion/fastapi/` — are the new work this plan
authorises.

---

## 2. The two reference diagrams, mapped

### 2.1 Index in Apache Iceberg → `repoio-catalog`

```
┌──────────────────────── Query Engines ────────────────────────┐
│   Spark  ·  Trino  ·  DuckDB  ·  repoio-service (JDBC/REST)   │
└──────────────────────────────┬────────────────────────────────┘
                               │
                   ┌───────────▼───────────┐
                   │   Iceberg REST Catalog │   repoio-catalog
                   └───────┬───────────┬────┘
                           │           │
          ┌────────────────▼─┐     ┌───▼──────────────────┐
          │   Iceberg Index  │     │    Iceberg Table     │
          │  (NEW · leaf-    │     │  (data + manifests)  │
          │   file key→row)  │     │                      │
          └──────┬───────────┘     └───────────┬──────────┘
                 │                             │
         Index Storage                 Table Storage
         golden_id → file, row         Parquet + manifests
```

| Table             | Purpose                                                   | Indexed on             |
|-------------------|-----------------------------------------------------------|------------------------|
| `raw_customer`    | Every record as received, append-only                     | `source_id`            |
| `staged_customer` | Standardised + enriched records                           | `source_id`            |
| `matched_pairs`   | Splink match candidates with scores                       | `pair_id`              |
| `golden_customer` | One row per surviving entity (served to apps)             | `master_id`            |
| `change_log`      | Every field-level change with provenance                  | `master_id`, `ts`      |
| `audit`           | Who did what, when                                        | `actor`, `ts`          |

The **Iceberg Index** is critical: a Golden Record lookup by `master_id`
walks the index leaf files instead of scanning Parquet, so SAP C4C and the
UI both get sub-100ms reads.

### 2.2 FastAPI → Kafka → Spark pipeline → `ingestion/fastapi/` + `repoio-stream/`

```
┌─────────────────────────────────────────────────────────────────┐
│  Source systems                                                 │
│  SAP C4C (push)   ·   SAP ERP (pull)   ·   SQL Server (pull)    │
│       │                   │                     │               │
│       ▼                   ▼                     ▼               │
│  ┌──────────┐      ┌─────────────┐       ┌─────────────┐        │
│  │ FastAPI  │      │ Airflow DAG │       │ Airflow DAG │        │
│  │ (ingest) │      │ (SDK pull)  │       │ (SDK pull)  │        │
│  └────┬─────┘      └──────┬──────┘       └──────┬──────┘        │
│       │                   │                     │               │
│       └───────────────────┴───────┬─────────────┘               │
│                                   ▼                             │
│                           ┌──────────────┐                      │
│                           │    Kafka     │  topic: raw.customer │
│                           └──────┬───────┘                      │
│                                  │                              │
│                                  ▼                              │
│                     ┌────────────────────────┐                  │
│                     │ Spark Structured       │  repoio-stream   │
│                     │  Streaming jobs:       │                  │
│                     │  · standardise         │                  │
│                     │  · DQ (Great Expect.)  │                  │
│                     │  · Splink match        │                  │
│                     │  · survivorship        │                  │
│                     └──────┬──────┬──────────┘                  │
│                            │      │                             │
│                     writes │      │ emits                       │
│                            ▼      ▼                             │
│                ┌─────────────┐  ┌──────────────┐                │
│                │  Iceberg    │  │  Kafka       │  topic:        │
│                │  (golden,   │  │              │  changes.cust. │
│                │   change)   │  │              │                │
│                └─────────────┘  └──────────────┘                │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                  ┌──────────────────────────────────┐
                  │  repoio-service (REST / GraphQL) │
                  │  repoio-mcp (AI agents)          │
                  │  repoio-ui (React console)       │
                  │  BI tools (Power BI via Trino)   │
                  └──────────────────────────────────┘
```

Kafka topics (one subject per entity):

| Topic                          | Produced by           | Consumed by                      |
|--------------------------------|-----------------------|----------------------------------|
| `raw.<entity>`                 | FastAPI, Airflow      | Spark standardise                |
| `staged.<entity>`              | Spark standardise     | Spark match                      |
| `matched.<entity>`             | Spark match           | Spark survivorship               |
| `golden.<entity>`              | Spark survivorship    | repoio-service, external apps    |
| `changes.<entity>`             | Spark survivorship    | Audit log, outbox for SAP C4C    |

---

## 3. Entity coverage (Phase 1)

| Entity              | Owner (Nahdet Misr) | Golden record uses                     |
|---------------------|---------------------|----------------------------------------|
| **Customer**        | Sales / Marketing   | SAP C4C, CRM, campaigns, loyalty       |
| **Vendor**          | Procurement         | SAP ERP, payments                      |
| **Product (Book)**  | Publishing          | ISBN registry, warehouse, bookshops    |
| **Author**          | Publishing          | Contracts, royalties                   |
| **Employee**        | HR                  | SAP SuccessFactors sync                |
| **Store / Outlet**  | Retail              | POS, inventory                         |

`repoio-spec/src/main/resources/json/schema/entity/` holds the JSON
Schemas; `repoio-service` and `repoio-ui` are generated from them.

---

## 4. Milestones

| M   | Scope                                                                                                | Deliverable                                                       | Status  |
|-----|------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------|---------|
| M0  | Scaffold (12 modules, folder tree, pom.xml, Makefile, CI)                                            | repo tree matches OpenMetadata, `make bootstrap` works            | ✅ done |
| M1  | Entity model + REST — Customer, Vendor, Product, GoldenRecord, ChangeRequest                         | Dropwizard app runs locally against Postgres, OpenAPI generated   | next    |
| M2  | **Iceberg catalog + raw + staged tables** · **Kafka** · **FastAPI push ingest** for SAP C4C          | `docker-compose up` brings up Kafka+Iceberg; C4C events land raw  |         |
| M3  | **Spark Structured Streaming** — standardise, DQ (Great Expectations), **Splink match**, survivorship | Golden Customer records written to Iceberg, change_log populated  |         |
| M4  | UI — Dashboard (configurable KPIs), Entity pages, Golden Record view, Change Requests, Pipeline runs | React console at `/`, parent at record level, admin KPI builder   |         |
| M5  | **MCP server** + Entra ID auth + role-based access                                                   | AI agents can read/write golden records with per-user scopes      |         |
| M6  | Production hardening — k8s operator, monitoring (OTel), backup, DR                                   | Helm chart deployed to staging on AKS                             |         |

---

## 5. Why Iceberg Index

The upcoming **Iceberg Index** feature stores a leaf-file index per table
keyed on columns we choose. For MDM, the natural key is `master_id` (or
`customer_id`, `product_isbn` …), and the index gives us:

- O(1) point lookups from `repoio-service` and `repoio-mcp` — no Parquet
  scan, no secondary cache to invalidate.
- Fast joins between `golden_customer` and `change_log` on `master_id`.
- A single source of truth for both batch (Spark) and interactive (REST)
  reads, so BI and the UI never diverge.

Rolling our own secondary index on Postgres or Elasticsearch would double
the storage and introduce consistency lag. The Iceberg Index removes that.

---

## 6. What goes where — module-by-module

```
repoio-spec/            JSON Schemas (one per entity + shared types)
repoio-sdk/             Java client (generated from spec)
repoio-clients/         External system clients (SAP, SF)
repoio-service/         Dropwizard app · REST · GraphQL · auth · workflow
repoio-mcp/             MCP server · tool registry · agent policies
repoio-ui/              React console (Discover · Workbench · Admin)
repoio-ui-core-components/  Shared TS components (Table, Form, Diff, Lineage)
repoio-k8s-operator/    CRDs: Repository, Pipeline, IcebergCatalog
repoio-integration-tests/   Cross-module e2e
repoio-shaded-deps/     Shaded Elasticsearch / OpenSearch
repoio-dist/            Assembly · Docker images · Helm
repoio-airflow-apis/    Pull-ingest DAGs, DQ runs, housekeeping

repoio-stream/          NEW · Spark Structured Streaming jobs (Scala/PySpark)
repoio-catalog/         NEW · Iceberg REST catalog, table DDL, index config

ingestion/              Python workspace
  src/metadata/         SAP C4C, ERP, SQL Server, Excel connectors
  src/metadata/sdk/     Python SDK (parallel to repoio-sdk)
  fastapi/              NEW · push-ingest endpoints, outbox consumer
  pipelines/            YAML configs
  tests/

common/                 Shared Java utilities
bootstrap/sql/          Flyway migrations (Postgres control plane only)
docker/                 Compose stacks: dev, iceberg, kafka, spark, trino
docs/                   This document and ADRs
openspec/               Human-reviewable spec changes
scripts/                CI / housekeeping scripts
tooling/                Codemods, generators
```

---

## 7. Next step

Pick **one** of M1, M2 to start on this week:

- **M1** (Entity + REST) — safe, no new infra; validates `repoio-service`,
  `repoio-spec`, `repoio-ui` and the schema → SDK → UI flow against real
  Customer and Golden Record use cases.
- **M2** (Iceberg + Kafka + FastAPI) — proves the new lakehouse stack
  end-to-end on dev; needs `docker-compose` for Iceberg REST, Kafka
  (Redpanda), Spark and Trino.

Each milestone lives in a dedicated spec under
[`openspec/changes/`](../../openspec/changes/) once started.
