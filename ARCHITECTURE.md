# Repo.io Architecture

Last updated: November 2026

Repo.io reuses the OpenMetadata layered architecture, re-targeted at
Master Data Management.

```
┌──────────────────── repoio-ui (React) ───────────────────────┐
│   84px icon rail · 19 screens · Discover · Workbench · Admin │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST / WebSocket
┌───────────────────────────▼──────────────────────────────────┐
│          repoio-service (Java 17 · Dropwizard · JDBI3)        │
│  Domains · Repositories · Models · Matching · Survivorship    │
│   Change Requests · Workflows · Quality · Audit · Lineage     │
└──────────┬───────────────┬────────────┬────────────┬─────────┘
     ┌─────▼───┐    ┌──────▼─────┐  ┌───▼─────┐  ┌───▼──────┐
     │Postgres │    │Elastic     │  │Airflow  │  │Kafka     │
     └─────────┘    └────────────┘  └─────────┘  └──────────┘
                            ▲
┌───────────────────────────┴──────────────────────────────────┐
│                     ingestion (Python)                        │
│   SAP C4C · SAP ERP · SQL Server · Excel/CSV connectors       │
│         Splink matching · DQ tests · OpenMetadata sync        │
└───────────────────────────────────────────────────────────────┘
```

See [docs/architecture/](docs/architecture) for details.
