# CLAUDE.md — Repo.io Agent Operating Manual

You are an AI engineering agent working on **Repo.io**, the lakehouse-native
Master Data Management platform for Nahdet Misr Publishing Group. This file
is your operating manual. Read it fully at the start of every session — it
is short on purpose so that you can.

The architecture source of truth is the root README (`README.md` — the
Repo.io architecture document, installed from this kit's
`README_repoio_openui5.md`).
If anything in this file conflicts with the README, the README wins — and you
must report the conflict so this file can be corrected.

---

## 1. Session startup checklist

Run through this before writing any code:

1. Read this file fully.
2. Identify the **current milestone**: check the milestone table in the root
   README and recent git history. If still ambiguous, ask the user — do not
   guess.
3. Read the acceptance criteria for that milestone in `docs/milestone-plan.md`.
4. Read the skill file(s) listed for it in the routing table (§5) under
   `.claude/skills/<skill-name>/SKILL.md`.
5. Confirm an approved spec exists under `openspec/changes/` for the current
   milestone. If it does not, the first deliverable is the spec itself —
   never implement ahead of a spec.

## 2. Project snapshot

Repo.io unifies master data from SAP C4C, SAP ERP, SQL Server and
spreadsheets into governed golden records served to applications, BI and AI
agents. The repo tree mirrors OpenMetadata; the runtime adds Iceberg, Kafka,
Spark Structured Streaming, FastAPI and a Jena ontology service.

- **Repo state:** M0 (scaffold, 12 modules, pom, Makefile, CI) is complete.
  M1–M9 are pending. Work milestone by milestone, in order.
- **Phase 1 entities:** Customer, Vendor, Product (Book), Author, Employee,
  Store/Outlet. `repoio-spec` owns their JSON Schemas.
- **Two planes, cleanly split:** Postgres 15 is the *control plane*
  (metadata, workflow state, scripts, audit). Apache Iceberg is the *data
  plane* (raw / staged / matched / golden / change_log / audit tables).
  Never store golden records in Postgres; never put operational metadata in
  Iceberg.

## 3. Module map

| Module | Responsibility |
|--------|----------------|
| `repoio-spec/` | JSON Schemas (OpenAPI 3.1) — one per entity + shared types |
| `repoio-sdk/` | Java client SDK generated from the spec |
| `repoio-clients/` | External system clients (SAP, SuccessFactors) + write-back adapters (C4C, ERP) |
| `repoio-service/` | Dropwizard 4 app — REST, GraphQL, auth, workflow, templates & reference-data APIs |
| `repoio-mcp/` | MCP server — tool registry, agent policies |
| `repoio-ui/` | OpenUI5 console (Discover · Workbench · Admin); today holds the React migration baseline and `design-reference/` (approved HTML prototypes) |
| `repoio-ui5-components/` | *(planned)* Reusable OpenUI5 controls (Table, Form, Diff, Lineage) |
| `repoio-ui-core-components/` | React component library — migration baseline only, no new work |
| `repoio-python-runtime/` | *(planned)* Isolated Python execution workers / kernels |
| `repoio-export-worker/` | *(planned)* Node render worker for broadcast exports — ECharts SSR, headless Chromium PDF, PPTX, XLSX (ADR-0003) |
| `repoio-stream/` | Spark Structured Streaming jobs (standardise → DQ → match → survivorship) |
| `repoio-catalog/` | Iceberg REST catalog, table DDL, index config |
| `repoio-ontology/` | *(planned)* Jena RDF/OWL ontology, SPARQL, SHACL, reasoning |
| `repoio-k8s-operator/` | CRDs: Repository, Pipeline, IcebergCatalog |
| `repoio-integration-tests/` | Cross-module end-to-end tests |
| `repoio-shaded-deps/` | Shaded Elasticsearch / OpenSearch |
| `repoio-dist/` | Assembly, Docker images, Helm charts |
| `repoio-airflow-apis/` | Pull-ingest DAGs, DQ runs, housekeeping |
| `ingestion/src/metadata/` | SAP C4C, ERP, SQL Server, Excel connectors (Python SDK) |
| `ingestion/fastapi/` | Push-ingest endpoints, outbox consumer |
| `bootstrap/sql/` | Flyway migrations — Postgres control plane only |
| `docker/` | Compose stacks: dev, iceberg, kafka, spark, trino |
| `openspec/` | Human-reviewable spec changes — one per milestone |
| `docs/` | Architecture, ADRs, milestone plan |

## 4. Non-negotiable technology choices

These decisions are confirmed. Do not substitute, do not "upgrade", do not
introduce a parallel technology without an approved ADR.

| Layer | Technology |
|-------|------------|
| Java service | **Dropwizard 4** (Java 17), JDBI3, Jersey |
| Push ingest API | **FastAPI** (Python 3.11) |
| Event bus | **Apache Kafka** (Redpanda in dev) |
| Stream processing | **Apache Spark Structured Streaming** |
| Catalog + tables | **Apache Iceberg v3** REST catalog + Index + Tables |
| Query engines | Trino, Spark SQL |
| Entity schemas | JSON Schema (OpenAPI 3.1) |
| Frontend | **OpenUI5** (Apache 2.0 edition) |
| Console shell | **sap.tnt.ToolPage + sap.tnt.ToolHeader + sap.tnt.SideNavigation (with search)** — theme **sap_fiori_3** (Quartz Light) |
| Entity matching | **Splink** |
| Data quality | **Great Expectations** |
| Workflow engine | **Flowable** (behind an adapter) |
| Ontology | **Apache Jena** (Fuseki, TDB2, SHACL, bounded reasoning) |
| Broadcast export rendering | **Node** worker: ECharts server-side rendering, headless Chromium (PDF), `pptxgenjs`, `exceljs` (ADR-0003); mail via corporate SMTP relay |
| AI agent interface | **MCP** server (JDK) |
| Metadata store | Postgres 15 (control plane) + Iceberg (data plane) |

Explicit traps to avoid:

- **Dropwizard, not Spring Boot.** Never scaffold Spring controllers or
  add Spring dependencies.
- **OpenUI5, not SAPUI5, not React.** React is the migration baseline only.
  Some SAP-licensed controls and themes exist only in SAPUI5 — before
  designing a screen around a control, verify it ships in the OpenUI5
  distribution; if not, document the exception. The console shell is
  `sap.tnt` (ToolPage / ToolHeader / SideNavigation with search) on the
  `sap_fiori_3` theme — verified to ship in OpenUI5; do not replace it
  with a hand-built shell or a different theme.
- **The Repo.io flow designer is the designer only; Flowable is the
  engine** (ADR-0002 replaced bpmn-js). Never execute workflow logic in
  the browser or in `repoio-service`; scripts compile to service tasks
  that call the isolated workers, never to BPMN `scriptTask`.
- **Splink owns matching, Great Expectations owns DQ.** Do not hand-roll
  either, and do not embed matching logic into ingestion.
- **Jena reasoning is deliberately bounded.** Never promise or attempt full
  OWL 2 DL reasoning; keep the reasoner behind an adapter.
- **Iceberg is pinned to spec v3.** The v3 features used: deletion vectors
  (MERGE-heavy survivorship), row lineage, optional variant type. The
  point-lookup **Index is NOT part of v3** — it stays an upcoming feature
  that must be benchmarked (M2). Verify the pinned Spark/Trino/REST
  catalog versions support v3 before writing DDL.
- **Kafka topic naming is fixed:** `raw.<entity>`, `staged.<entity>`,
  `matched.<entity>`, `golden.<entity>`, `changes.<entity>` — one subject
  per entity, produced/consumed exactly as the README maps them.

## 5. Milestone → skills routing

**Before writing code for any task, read the skill file whose domain
matches.** This table is the routing — it tells you which skills to load at
each milestone. If a task spans domains, load every relevant skill. If no
skill matches, work from the root README and say so in your report.

| Milestone | Work | Skills to load (`.claude/skills/…`) | Acceptance criteria |
|-----------|------|--------------------------------------|---------------------|
| **M1** | Entity model + REST: Customer, Vendor, Product, GoldenRecord, ChangeRequest | `repoio-entity-model` | `docs/milestone-plan.md` §M1 |
| **M2** | Iceberg catalog + raw/staged tables · Kafka · FastAPI push ingest for SAP C4C | `repoio-ingestion` **and** `repoio-iceberg-catalog` | §M2 |
| **M3** | Spark streaming: standardise, DQ, Splink match, survivorship | `repoio-streaming-mdm` | §M3 |
| **M4** | OpenUI5 foundation + incremental migration from React | `repoio-ui5-frontend` | §M4 |
| **M5** | MCP server + Entra ID auth + role-based access | `repoio-mcp-identity` | §M5 |
| **M6** | Production hardening: k8s operator, OTel, backup, DR, Helm on AKS | `repoio-platform-ops` | §M6 |
| **M7** | Workflow Designer: BPMN authoring + Flowable execution | `repoio-workflow-python` (§ M7 part) | §M7 |
| **M8** | Python Workspace: editor, scripts, isolated execution | `repoio-workflow-python` (§ M8 part) | §M8 |
| **M9** | Connections hub (admin-managed integrations, tokens) + workflow-driven write-back to C4C/ERP + data-platform federation | `repoio-integrations` | §M9 |
| any | Request templates / reference data / domain scoping / role→domain visibility | `repoio-templates-refdata` | §M1/M4/M5 items |
| any | Console screens / UX flows / persona journeys (any area) | read `docs/user-journey.md`, then the matching domain skill | journey file |
| any | Ontology / semantics / SPARQL / SHACL work (`repoio-ontology`) | `repoio-ontology` | § Ontology |

Routing rules:

1. Load the skill **before** implementing, not after discovering problems.
2. A skill's domain wins over general knowledge — e.g. for anything under
   `repoio-ui/`, the `repoio-ui5-frontend` skill is the authority.
3. Cross-cutting work (e.g. an end-to-end test in
   `repoio-integration-tests/`) loads every skill it touches.

## 6. Hard rules (guardrails)

These exist because agent-generated code fails in predictable ways. Every
rule has a reason — understand it, then follow it.

1. **Nothing is "done" until verified.** Run the actual build/test commands
   and show their output. Claiming completion from code inspection alone is
   the single worst failure mode an agent can make here.
2. **No mock or stub data in tests or implementations** unless the user
   explicitly asks for it in that task. Mocked connectors that silently
   pass are worse than failing tests.
3. **Be honest about status.** A planned feature stays "planned". Never
   mark, imply, or report a milestone or module as implemented when it is
   not. Keep the root README milestone table accurate after every change.
4. **Spec before code.** Every milestone gets a reviewed spec under
   `openspec/changes/` before implementation starts.
5. **Contracts are spec-first.** `repoio-spec` JSON Schemas and OpenAPI are
   the API contract; update them in the same change as the implementation,
   and never break a contract without an approved versioning decision.
6. **Respect the separation of concerns:**
   - MDM answers *which records are the same entity* (`repoio-service`,
     `repoio-stream`).
   - Ontology answers *what concepts mean* (`repoio-ontology` links to
     canonical entity IDs; it never duplicates the catalog).
   - Catalog answers *where the asset lives* (`repoio-catalog`).
   - Workflow answers *which process runs* (Flowable).
   - The **UI never owns entity definitions or business rules** — it
     consumes APIs.
7. **Pin dependencies.** Never upgrade a dependency as a side effect of
   another task. Versions are pinned, builds are reproducible, production
   `pip install` at runtime is forbidden.
8. **Python execution invariants** (M8, non-negotiable): user-submitted
   Python never runs inside the FastAPI, Dropwizard or UI containers — only
   in disposable, resource-limited worker containers; no Docker socket or
   host path mounts; default no outbound network; package allowlists from
   approved registries only.
9. **Agents never bypass authorization.** MCP tools and SPARQL endpoints
   are permission-filtered per user. No unrestricted endpoint may serve an
   AI agent, and no shared "agent identity" replaces per-user scopes.
10. **No invented secrets, hosts, ports or credentials.** Use environment
    placeholders and ask the user for real values.
11. **When blocked or unsure, stop and ask.** Silently changing an
    architecture decision is never acceptable — surface it, propose
    options, let the human decide.
12. **Don't fight the planes.** Postgres = control plane, Iceberg = data
    plane (see §2). Adding a "quick" secondary index on Postgres or
    Elasticsearch for golden records re-creates the exact problem the
    Iceberg Index is meant to remove — raise it instead of doing it.
13. **Connection tokens are secret-store material, never database
    columns.** The `connections` registry holds references; Vault / Azure
    Key Vault holds the tokens (see the `repoio-integrations` skill). A
    leaked registry table must never mean leaked credentials. Likewise:
    write-back to C4C/ERP happens only through workflows containing a
    Write-back Task — never through an automatic consumer of
    `changes.<entity>`.
14. **Templates and reference data are domain-scoped.** One template
    belongs to exactly one domain; the closed domain enum is the Entity
    list in README §3 (Customer, Vendor, Product, Author, Employee,
    Store). A domain holds one or more repositories (ADR-0001), each
    with one assigned model version, fed by every business line's
    sources; a source may feed several repositories. The Templates catalog is filtered **server-side** by the
    user's role→domain grants — hiding rows in the UI is presentation,
    not authorization.
    Reference-data lists are filtered by the selected target system at
    the API level: C4C values must never reach an ERP-targeted request.
15. **Relationships are governed first-class data, steward-edited.**
    The relationship type catalog (README §2.3 seed catalog) is the
    only source of relationship types — never invent a type per
    screen. Creating and editing links is a steward RBAC action in
    exactly two modes: per record through the Relationship builder,
    or bulk upload (CSV/XLSX, per-row validation, batch request) on
    the Relationships list — both submit relationship change requests
    (a match confirmation writes `same_as`); free-typed, UI-local or
    direct-write relationship edits are forbidden, and there is no
    delete path. Types and instances live in the control plane and
    materialize into the RDF graph via the ontology track.
16. **Feeds & announcements are awareness, never authority.** The
    `activity` table is a control-plane read-model over events that
    already exist (CR transitions, `changes.<entity>`, match
    confirmations) — never build a new event pipeline for it. The
    `announcements` table lives in the control plane with
    draft → audience → publish window → retire (README §2.7). Feed
    and announcement APIs are permission-filtered server-side; nothing
    in Feeds or on the Home strip writes master data, requests or
    workflows, and the audit trail — not the feed — stays the forensic
    record.

## 7. Verification protocol

Before reporting any task as complete:

1. **Discover real commands** from the Makefile, CI config and module
   READMEs — do not assume commands that were never shown to run.
2. Typical verification per area:
   - Java (`repoio-*`): `mvn -q verify` (or module equivalent) + OpenAPI
     generation succeeds.
   - Python (`ingestion/`): `pytest` + linting configured for that module.
   - Infra (`docker/`, `repoio-dist/`): `docker compose config` minimum;
     `up` where the task is about runtime behavior.
   - UI (`repoio-ui/`): production build inside Docker, plus a screen
     parity check against the React baseline.
3. Run the milestone's acceptance checklist in `docs/milestone-plan.md`.
4. **Report in this format:**
   - What was implemented (files, modules).
   - What was verified, with the exact commands and their results.
   - What was **not** verified and why.
   - Assumptions made and decisions that need human confirmation.

If verification cannot run in the current environment, say so explicitly —
an honest "not verified" is acceptable; an unverified "done" is not.

## 8. Working conventions

- **Commits:** conventional style, module-scoped —
  `feat(repoio-service): add golden record review endpoint`.
  One module boundary per change; cross-module work is split into
  reviewable commits.
- **Decisions:** accepted deviations from the kit live in
  `docs/decisions/` (ADR-0001: a domain holds one or more repositories;
  ADR-0002: the Repo.io flow designer replaces bpmn-js, Flowable stays;
  ADR-0003: broadcast exports render in a Node worker, attachment size
  policy proposed).
- **Docs:** every module gets a README following
  `docs/module-readme-template.md` — update it when adding entry points,
  config or commands.
- **UX:** approved HTML prototypes in `repoio-ui/design-reference/` are
  the visual contract for each page (see its README); the persona
  journeys in `docs/user-journey.md` are the UX contract for console screens — build and test screens against them,
  and update the file in the same change when a journey changes.
- **Language:** code, comments, commit messages, specs and docs in English.
  The product UI must support Arabic RTL and English LTR as first-class
  directions.
- **README alignment:** when a milestone's status changes, update the root
  README milestone table in the same change.

## 9. Known risks that should shape decisions

- **Iceberg Index is an upcoming feature.** Sub-100 ms golden-record point
  lookups depend on it. In M2, build a benchmark harness and measure; if
  the target is missed, propose a fallback (caching/serving layer) instead
  of quietly letting M4 depend on an unproven read path.
- **OpenUI5 control coverage.** Verify every required control/theme exists
  in the OpenUI5 distribution before building a screen on it.
- **Match quality is a product metric.** M3 must deliver precision/recall
  evaluation on labelled pairs, not just a running pipeline.
- **Operational weight.** The stack (Kafka, Spark, Iceberg, Trino, Airflow,
  Jena, Flowable, workers) is real operational load — prefer boring,
  standard deployment patterns over clever ones.

## 10. If you don't know

Ask. List your assumptions in the task report. An agent that asks one good
question is worth more than one that guesses three times.
