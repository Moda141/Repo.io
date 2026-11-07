---
name: repoio-platform-ops
description: Use when working on Repo.io production hardening and infrastructure — the Kubernetes operator and CRDs, Helm charts, Docker images and compose stacks, OpenTelemetry monitoring, backup and disaster recovery, or any M6 work deploying to AKS. Trigger on tasks touching repoio-k8s-operator, repoio-dist, docker/ stacks, k8s manifests, Helm, OTel/tracing/metrics, health checks, backup/DR, or staging/production deployment questions.
---

# Repo.io Platform & Operations (M6)

## What this domain owns

- `repoio-k8s-operator/` — operator with CRDs: `Repository`,
  `Pipeline`, `IcebergCatalog`.
- `repoio-dist/` — assembly, Docker images, Helm charts.
- `docker/` — compose stacks: dev, iceberg, kafka, spark, trino.
- OpenTelemetry instrumentation, monitoring, backup, DR, AKS staging.

## Service topology to keep honest

| Container | Responsibility |
|-----------|----------------|
| `repoio-ui` | OpenUI5 static assets via Nginx — nothing else |
| `repoio-service` | Dropwizard REST/GraphQL, auth, control-plane APIs |
| `repoio-mcp` | MCP tools and agent policies |
| `ingestion-fastapi` | Push ingestion |
| `repoio-python-runtime` | Isolated Python workers, scaled independently |
| `repoio-catalog` | Iceberg REST catalog |
| `repoio-stream` | Spark Structured Streaming jobs |
| `kafka` / `postgres` / `trino` / `spark` / `airflow` | Infrastructure |

## Non-negotiables

1. **Internal ports stay internal.** Backend services are exposed only
   through a reverse proxy / API gateway; service ports are not
   NodePort-ed or LoadBalancer-ed into the world.
2. **The UI container is static.** No Python deps, no DB credentials, no
   API keys in the frontend image — ever.
3. **Backups are proven by restore.** A backup that has never been
   restored in a test is a hope, not a backup. DR runbooks include an
   actual restore exercise: Postgres control plane, Iceberg data (via
   catalog + object storage snapshots), Kafka topic config, Jena TDB2 if
   ontology is deployed.
4. **No secrets in images or manifests.** Secrets come from the platform
   secret store; images are scanned in CI; base images are pinned by
   digest, not `latest`.
5. **The operator is the deployment API.** CRDs are how Repo.io instances
   are declared; ad-hoc kubectl apply of raw manifests is the bypass to
   eliminate, not the mechanism to document.
6. **Observability is not optional.** OTel traces/metrics on
   `repoio-service`, `repoio-mcp`, `ingestion-fastapi`, streaming jobs;
   health and readiness probes on every container; alerts for consumer
   lag, checkpoint failures, DLQ growth.

## Implementation notes

- Compose stacks in `docker/` remain the dev truth — CI should run the
  same stacks.
- Helm chart values separate dev/staging/prod; staging on AKS is the M6
  exit target.
- `make bootstrap` and CI are the canonical entry points — extend them
  instead of adding parallel scripts.

## Verification (must pass before "done")

- `helm install` to staging AKS succeeds; the operator reconciles a
  `Repository` CR into running services (the M6 exit condition).
- `docker compose config` validates every stack; changed stacks boot.
- A backup-and-restore drill on staging data completes with data intact.
- Dashboards show traces/metrics for the core services; killing a
   consumer container triggers the expected alert.

## Common pitfalls

- "DR documented" without a restore test.
- Probes that always pass (health endpoint that never checks
  dependencies).
- Resource limits missing on streaming/worker containers — the first
  production incident.
- Exposing Trino/Postgres/Kafka "temporarily" for debugging and
  forgetting.
