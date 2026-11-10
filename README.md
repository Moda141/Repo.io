# Repo.io — Lakehouse-Native MDM Architecture

> Nahdet Misr Publishing Group — Enterprise Master Data Management
> Last reviewed: **7 Nov 2026**

Repo.io is a lakehouse-native Master Data Management platform. It unifies
master data from SAP C4C, SAP ERP, SQL Server and spreadsheet sources into
governed golden records that are served to apps, BI and AI agents.
Approved changes flow back to source systems (SAP C4C, SAP ERP) through
workflow-driven write-back, and admins manage external integrations
(Databricks, Snowflake, Data Fabric, …) through a connections hub where
tokens live in a secret store — see §2.4 and §2.5. Change requests start
from domain-scoped request templates, with reference lists filtered by
the selected target system — see §2.6.

The repo tree mirrors OpenMetadata, while the runtime stack is extended with
**Apache Iceberg** (catalog + tables + indexing), **Apache Kafka** (event bus),
**Apache Spark Structured Streaming** (processing) and **FastAPI** (push
ingest). The target frontend direction is **OpenUI5** as the primary UI
framework, with specialized JavaScript libraries embedded where needed.
The platform retains the existing Dropwizard REST backend, MCP interface,
Airflow ingestion and lakehouse services.

The confirmed UI direction is a **full migration from React to OpenUI5**.
Migrate screen by screen, but OpenUI5 is the final frontend architecture.

---

## 1. Reference stack

| Layer                 | Technology                                           | Module                             |
|-----------------------|------------------------------------------------------|------------------------------------|
| Push ingest API       | **FastAPI** (Python 3.11)                            | `ingestion/fastapi/`               |
| Batch / pull ingest   | Python SDK — SAP C4C, ERP, SQL Server, Excel         | `ingestion/src/metadata/`          |
| Event bus             | **Apache Kafka** (Redpanda in dev)                   | `docker/kafka/`                    |
| Stream processing     | **Apache Spark** Structured Streaming                | `repoio-stream/` *(new)*           |
| Catalog + storage     | **Apache Iceberg v3** REST catalog + Index + Table | `repoio-catalog/` *(new)*          |
| Ontology / semantics  | **Apache Jena** (RDF, OWL/RDFS, SPARQL, SHACL, inference) | `repoio-ontology/` *(new)*       |
| Query engines         | Trino, Spark SQL (ad-hoc)                            | —                                  |
| REST / GraphQL app    | **Dropwizard 4** (Java 17), JDBI3, Jersey            | `repoio-service/`                  |
| Entity schemas        | JSON Schema (OpenAPI 3.1)                            | `repoio-spec/`                     |
| Java client SDK       | OpenAPI-generated                                    | `repoio-sdk/`, `repoio-clients/`   |
| Source write-back     | Workflow-driven adapters — SAP C4C (OData), ERP (OData/RFC) | `repoio-clients/`            |
| Connections registry  | Admin-managed integrations · secret-store tokens (Vault / Key Vault) | `repoio-service/` (control plane) |
| UI (target)           | **OpenUI5** — MVC, routing, models, data binding     | `repoio-ui/`                       |
| UI5 shared components | Reusable OpenUI5 controls / custom controls          | `repoio-ui5-components/` *(new)*   |
| UI integrations       | BPMN.js, Monaco Editor, ECharts, Cytoscape.js        | `repoio-ui/` integrations          |
| Python execution      | Isolated worker containers for workflow Script steps (ADR-0004) | `repoio-python-runtime/` *(new)* |
| AI agent interface    | **MCP** server (JDK)                                 | `repoio-mcp/`                      |
| Pipelines             | Airflow DAGs (Managed APIs)                          | `repoio-airflow-apis/`             |
| Infra                 | **Kubernetes operator** (CRD: `Repository`)          | `repoio-k8s-operator/`             |
| Distribution          | Docker images + Helm charts                          | `repoio-dist/`, `docker/`          |
| Ontology store        | Jena TDB2 RDF dataset                                 | `repoio-ontology/` *(new)*         |
| Metadata store        | Postgres 15 (control-plane) + Iceberg (data-plane)   | —                                  |

The existing scaffold remains the baseline. The target additions in this
revision are `repoio-catalog`, `repoio-stream`, `ingestion/fastapi/`, the
OpenUI5 frontend migration, reusable UI5 components, and an isolated Python
execution capability. These are planned additions; their presence in this
README does not imply that they have already been implemented.

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
                  │  repoio-ui (OpenUI5 console)     │
                  │  BI tools (Power BI via Trino)   │
                  │  Databricks / Snowflake / Fabric │
                  │    (federation via Iceberg, §2.5)│
                  └──────────────────────────────────┘
                        │
                        ▼ workflow Write-back Task (§2.4)
                  ┌──────────────────────────────────┐
                  │  SAP C4C / SAP ERP write-back    │
                  │  adapters (repoio-clients)       │
                  └──────────────────────────────────┘
```

Kafka topics (one subject per entity):

| Topic                          | Produced by           | Consumed by                      |
|--------------------------------|-----------------------|----------------------------------|
| `raw.<entity>`                 | FastAPI, Airflow      | Spark standardise                |
| `staged.<entity>`              | Spark standardise     | Spark match                      |
| `matched.<entity>`             | Spark match           | Spark survivorship               |
| `golden.<entity>`              | Spark survivorship    | repoio-service, external apps    |
| `changes.<entity>`             | Spark survivorship    | Audit log; write-back is workflow-driven (§2.4) |

---

### 2.3 Ontology and semantic layer → `repoio-ontology/`

**Decision: add a dedicated ontology capability, with Apache Jena as the
initial open-source technology choice.**

The ontology layer represents business meaning and semantic relationships
across Repo.io entities and data assets. It complements, but does not replace,
the MDM model, OpenMetadata/catalog metadata, Iceberg tables or the workflow
engine.

Target responsibilities:
- Define and version business concepts, classes, properties and relationships
  using RDF/RDFS and a controlled OWL profile.
- Represent semantic relationships across Customer, Account, Product,
  Vendor, Business Unit, Golden Record, Data Product, Data Asset, KPI and
  Business Glossary terms.
- Provide SPARQL query and update capabilities through a secured endpoint.
- Apply SHACL shapes for graph/data validation.
- Support configured inference/reasoning for supported rules and ontology
  profiles.
- Maintain ontology versions, namespaces, provenance and change history.
- Expose semantic context to Repo.io APIs, governed-data agents and MCP tools.

**Proposed implementation**
- `repoio-ontology/`: Repo.io integration service, ontology lifecycle,
  authorization, versioning and API façade.
- Apache Jena: RDF model APIs, ontology APIs, SPARQL, SHACL and inference.
- Jena Fuseki: SPARQL HTTP endpoint for query/update operations.
- TDB2: persistent RDF dataset storage for the initial deployment.
- OpenUI5: ontology browser/editor and relationship management screens.
- Cytoscape.js: optional graph visualization embedded in OpenUI5.

**Integration boundaries**
- `repoio-service` remains the system-of-record API for Repo.io business
  entities and permissions. The ontology service stores semantic
  representations and links back to canonical Repo.io entity identifiers.
- `repoio-catalog` remains responsible for Iceberg catalog/table metadata;
  ontology references may link business concepts to catalog assets.
- OpenMetadata remains the governance/catalog capability where already
  adopted; ontology should integrate with its glossary, domains, ownership
  and asset references rather than duplicate its catalog.
- Flowable orchestrates ontology-related approval workflows when required;
  it is not the ontology store or reasoning engine.
- `repoio-mcp` exposes authorized semantic search and SPARQL-backed tools
  to AI agents. Agents must use permission-filtered APIs and must not bypass
  Repo.io authorization by querying an unrestricted endpoint.

**V1 scope**
- Ontology namespaces, classes, object/data properties and relationships.
- Import/export in standard RDF serializations such as Turtle and RDF/XML.
- Versioned ontology changes with review/approval and audit.
- SPARQL read/query API behind Repo.io authentication and authorization.
- SHACL validation for agreed business constraints.
- A deliberately bounded RDFS/OWL reasoning profile; document supported
  constructs and performance limits.
- Links from ontology concepts to Repo.io entity IDs, glossary terms,
  KPIs and catalog assets.

Do not promise complete OWL 2 DL reasoning from the initial Jena setup.
If advanced description-logic reasoning becomes a requirement, evaluate a
dedicated OWL reasoner (for example HermiT through OWLAPI) separately and
benchmark it against the actual ontology and data volumes. Keep reasoning
behind an adapter so the engine can be changed without changing Repo.io APIs.

**Important separation of concerns**
- MDM answers: “Which records represent the same real-world entity?”
- Ontology answers: “What do these concepts mean, and how are they related?”
- Catalog answers: “Where is the data asset, and what metadata describes it?”
- Workflow answers: “What process, approval and execution steps should run?”
- Iceberg answers: “How are analytical/master data tables stored and queried?”

**Seed relationship catalog (Phase 1).** A relationship type is defined
per (From type → To type) with a cardinality; From and To may be the
same type, so same-entity relationships are first-class:

- Customer → Customer: `parent_of` / `subsidiary_of` (school groups,
  bookstore chains), `member_of`, `same_as` (confirmed match)
- Product → Product: `part_of_series` (book series), `edition_of`,
  `bundle_component`, `alternative_to`, `same_as` (one book mastered
  from two source systems)
- Customer → Vendor: `same_party` (a bookshop that is also a supplier)
- Vendor → Product: `supplies`

Instance-level links are created only by governed actions — never
free-typed in the UI. Two paths exist: a steward match confirmation
writes `same_as` (identity resolution), and the **Relationship
builder** (console: Business operation → Relationships) writes business
links — the steward picks the type, both golden records and the type's
attributes; the platform validates (hierarchy cycle detection,
duplicate pair+type, cardinality) and submits the link as a
relationship change request; workflow approval writes it to the
records' relationship sets. Relationship authoring is a steward RBAC
action in two modes: per record through the builder, or **bulk
upload** on the Relationships list — a CSV/XLSX of rows validated per
row (pair validity, record existence, cycles, duplicates) whose
accepted rows submit as one batch relationship change request;
rejected rows never enter the batch and re-upload is idempotent.
Types and instances live in the Postgres
control plane from day one and are materialized into the RDF graph
when the ontology track lands (types as object properties, instances
as triples over canonical entity IDs). The Ontology Explorer manages
the relationship *types*; the Relationships list manages the
instances; a record's detail view shows its own links.

### 2.4 Source write-back — workflow-driven → `repoio-service` + `repoio-clients`

**Decision: write-back to source systems (SAP C4C, SAP ERP) is triggered
by workflow definitions, not by an automatic consumer of
`changes.<entity>`.**

- A ChangeRequest flows back to a source only when its approved workflow
  includes a **Write-back Task** node. Workflows without the node never
  write to source systems.
- The Write-back Task declares: target system (C4C or ERP), entity, field
  mapping, conflict policy and retry behavior — all versioned with the
  workflow definition.
- Execution: Flowable invokes `repoio-service`, which calls the target
  adapter in `repoio-clients` (C4C OData, ERP OData/RFC). The workflow
  engine never talks to source systems directly.
- Conflict policy: before writing, compare the current source value with
  the last ingested value; if the source changed since the match, route to
  review instead of overwriting.
- Field-level allowlists per source system define which golden fields may
  be written back — versioned configuration, not code.
- Every attempt, result and conflict is audited. Writes are idempotent,
  keyed by ChangeRequest id and version.
- `changes.<entity>` remains the audit/outbox event feed; downstream
  consumers treat it as informational. Write-back authority lives in the
  workflow, nowhere else.

### 2.5 Connections hub — admin-managed integrations

Admins register external systems and data platforms as **connections** in
the control plane instead of editing environment variables per deploy.

- `connections` registry (Postgres control plane): name, type (`sap_c4c`,
  `sap_erp`, `sqlserver`, `databricks`, `snowflake`, `data_fabric`, …),
  endpoint URL, auth method, secret reference, status, health.
- **Tokens are never stored in Postgres.** Secrets live in the secret
  store (Vault / Azure Key Vault); the registry holds only a reference and
  a masked hint for display.
- Admin UI (OpenUI5, Admin area): create/edit/test connections, view
  health status, and an audit trail of every connection change. RBAC
  action: `administer connections`, separate from other admin grants.
- Source connections (C4C, ERP, SQL Server) feed the ingestion connectors
  and the write-back adapters.
- Data-platform connections (Databricks, Snowflake, Data Fabric) support
  two modes:
  1. **Ingest** — pull master data from platform tables as another source
     (connector + Airflow DAG, configured through a connection record).
  2. **Federation (preferred for serving)** — the platform reads Repo.io
     golden tables directly from the Iceberg REST catalog: zero-copy, no
     duplicated storage, no per-platform export pipelines. The connection
     record documents the granted identity and endpoint.
- Periodic health checks per connection; failures surface in the admin
  console and in alerting.

### 2.6 Request templates & reference data — domain-scoped

**Decision: request templates are scoped to exactly one domain, and the
Templates catalog each user sees is filtered by their role's domain
grants. Reference data is assigned by domain and by source/target
system, and the reference lists in request forms follow the selected
target system.**

- A domain is a master-data entity type — Customer, Vendor, Product,
  Author, Employee, Store (the Entity list in §3) — and nothing else.
  **A domain holds one or more repositories** (ADR-0001). A repository
  is a governed mastering scope inside the domain — for example Customer
  holds *Customer Master*, *Distribution partners* and *School accounts*
  — with exactly one assigned model version (attributes, match rules,
  survivorship) and its own golden records. A data source may feed
  several repositories, and a source field may map to attributes in more
  than one repository's model. The business line stays a property of
  the source record, never a domain. The Owner column in §3 is stewardship
  governance metadata, not a domain. One template belongs to one domain;
  cross-domain templates are explicitly rejected.
- **Visibility is enforced server-side.** The templates API returns only
  the domains granted to the calling user's role; the OpenUI5 Templates
  list page renders what the API returns. Hiding rows in the UI is
  presentation, not authorization.
- Template authoring is a dedicated role the Admin grants — typically to
  master data stewards. Author, approve and publish are separate RBAC
  actions; published templates are immutable, and every change is a new
  version with audit.
- A template pre-fills a request (fields validated against the
  `repoio-spec` entity schema) but does **not** hard-bind a workflow: at
  request creation the user selects from the applicable published
  workflows.
- Reference data (code lists, picklists) entries are assigned to a
  (domain, source-or-target system) pair — SAP C4C, SAP ERP, SQL Server,
  … In request forms, the reference lists shown are filtered by the
  selected target system: values valid for C4C never leak into an
  ERP-targeted request.
- Templates are the front door of the governed chain: template →
  request → workflow (§2.4) → optional write-back to C4C/ERP. The
  end-to-end user journeys for this chain — and for every other console
  area — are documented in `docs/user-journey.md`.

### 2.7 Activity feeds & announcements — awareness, never authority

**Decision: Feeds (Activity + Announcements tabs) are served from two
Postgres control-plane tables — an `activity` read-model over events
that already exist, and an `announcements` table with its own
lifecycle. Neither is a write path and neither replaces the audit
trail.**

- `activity` is an append-only read-model fed from events the platform
  already emits: ChangeRequest transitions, `changes.<entity>` topics,
  match confirmations, workflow completions, relationship and
  reference-data changes. **No new event pipeline** — a projection
  writer fans existing events into the table.
- `announcements` are authored in Administration → Announcements:
  draft → audience (all users, a role, a domain) → publish window
  (from / until) → publish; pinned flag, retire. Author / publish /
  retire are RBAC actions (Admin or a steward granted the action),
  audited like every governed artifact. Pinned announcements also
  render as a strip on Home.
- Serving is permission-filtered server-side like every other API: a
  feed event about a record in a domain the caller holds no grant for
  is never returned — hiding rows client-side is presentation, not
  authorization.
- The feed is the awareness layer only. The audit trail remains the
  forensic record of state changes; the notification tray remains the
  personal, actionable channel (approval needed, request rejected).
  Nothing in Feeds can mutate master data, requests or workflows.

### 2.8 Analytics — reports, studio and broadcasts

> **Status: proposed** (prototype screens exist under
> `repoio-ui/design-reference/openui5-prototype`, journey J14). The
> components marked *open* below need an ADR before implementation.

**Decision: reports and stories are governed definitions in the
control plane; their data is read from the data plane through Trino
with the caller's own grants; broadcasts are scheduled by Airflow and
rendered per recipient. The UI sends a definition, never SQL, and
never defines a measure.**

#### Reports list, analytical list report and Analytics studio (read path)

```
┌──────────── repoio-ui (OpenUI5) ────────────┐
│  Reports list   ·   Analytical list (ALP)   │
│  Analytics studio (story designer, Builder) │
│  charts: EChart wrapper (Apache ECharts)    │
└──────┬──────────────────────────┬───────────┘
       │ definitions (CRUD,       │ query request:
       │ versions, variants)      │ {report/tile, measure ids, dimension,
       │                          │  filters, page} — never SQL
       ▼                          ▼
┌──────────────────────── repoio-service (Dropwizard) ────────────────────────┐
│  Reports API                          Query API                             │
│  · reports, report_versions,          · resolve measure ids → KPI catalog   │
│    variants, favorites                · compile to SQL over the report's    │
│  · save on a published story            governed view                       │
│    = new draft version                · inject the caller's role→domain     │
│  · retire → pauses its broadcasts       grant predicate (row filter)        │
│                                       · aggregate in the engine, page rows  │
│  KPI catalog (read-only to the UI)    · cache per (definition version,      │
│  · measure formula, unit, owner         grant set), short TTL               │
└──────┬───────────────────────────────────────┬──────────────────────────────┘
       │ JDBI3                                 │ JDBC
       ▼                                       ▼
┌──────────────── Postgres 15 ───────────┐   ┌──────────── Trino ─────────────┐
│ control plane:                         │   │ governed views over Iceberg:   │
│ reports · report_versions · variants   │   │ golden.<entity> · dq.results · │
│ kpi_catalog · report_favorites         │   │ cr.change_requests · matched.* │
│ broadcasts · broadcast_runs (below)    │   │ wb.writeback_log · ops.*       │
└────────────────────────────────────────┘   └───────────────┬────────────────┘
                                                             ▼
                                                   Iceberg tables (data plane)
```

- **Definitions** (layout, tiles, chart type, measure ids, dimension,
  filters, variants) are versioned control-plane rows. Publishing a
  story or report follows the same draft → published → retired
  lifecycle as workflows.
- **Measures come only from the KPI catalog.** The studio and the ALP
  pick measure ids; the formula, unit and owner live in the catalog.
  A screen that computes a KPI locally is wrong (CLAUDE.md §6.6).
- **Authorization is server-side.** The Query API adds the caller's
  role→domain grants to every query; the list API filters reports the
  same way. Hiding rows in the UI is presentation, not authorization.
- **Read only.** Nothing in Analytics writes master data, requests or
  workflows. Golden records are never copied into Postgres for
  reporting (CLAUDE.md §6.12).

#### Broadcasts (scheduled distribution)

```
┌──── repoio-ui: Broadcasts page ────┐
│ list · Start now · Pause · Resume  │
│ new broadcast dialog               │
└──────────────┬─────────────────────┘
               │ REST
               ▼
┌──────── repoio-service: Broadcasts API ────────┐      ┌──── Postgres ─────────────┐
│ CRUD · validate recipients against grants      │─────▶│ broadcasts                │
│ (warn: no grant on the report's domain)        │      │ broadcast_recipients      │
│ Start now → enqueue a run                      │      │ broadcast_runs (per run + │
└──────────────┬─────────────────────────────────┘      │  per-recipient outcome)   │
               │ due schedules (cron, Africa/Cairo)     └───────────────────────────┘
               ▼
┌──── Airflow DAG broadcast_dispatch (repoio-airflow-apis) ────┐
│ picks due broadcasts → calls the service to start a run      │
│ idempotency key = broadcast id + schedule slot               │
└──────────────┬───────────────────────────────────────────────┘
               ▼
┌──── repoio-service: run (one per recipient) ─────────────────┐
│ 1. resolve the recipient's grants (Entra ID groups → domains)│
│    no grant on the report's domain → outcome "skipped"       │
│ 2. same Query API path, evaluated AS THE RECIPIENT           │
│    (no shared broadcast identity, no owner's grants)         │
└──────────────┬───────────────────────────────────────────────┘
               ▼
┌──── Export worker (Node, ADR-0003) ──────────┐
│ XLSX · CSV · PDF (stories: PDF · PPTX) · ZIP │
│ isolated, no inbound network, platform code  │
└──────────────┬───────────────────────────────┘
               │ generated in memory per run, attached, never stored
               ▼
┌──── Mail adapter: corporate SMTP relay ──────────────────────┐
│ subject + message + attachment + console link                │
│ the link requires sign-in; no anonymous "view" link          │
└──────────────┬───────────────────────────────────────────────┘
               ▼
 broadcast_runs (sent / skipped / failed per recipient) → audit trail
 + activity read-model (§2.7) · failures retry at the next slot or
   with Start now
```

- **Per-recipient rendering is the rule.** A broadcast never sends data
  the recipient cannot see in the console; recipients without a grant
  are skipped and reported in the run (list shows "Sent · N skipped").
- **Scheduling uses Airflow**, which the platform already runs
  (`repoio-airflow-apis`); no second scheduler. Pause / resume toggle
  the schedule; a run that is in flight finishes.
- **Mail goes through the corporate SMTP relay, configured by an Admin
  in Administration → System configuration.** The settings are host,
  port, TLS, sender address, authentication and the maximum message size
  (default 10 MB). They are control-plane settings, changed with an
  audit entry; the password is a secret-store reference, never a column
  (CLAUDE.md §6.13). A "send test email" check validates them. No values
  are set until the relay details are known (CLAUDE.md §6.10).
- **Exports are generated, not stored.** Each run renders the file in
  memory from live governed data, attaches it and discards it; there is
  no export file store and no file retention. `broadcast_runs` keeps
  only run metadata and per-recipient outcomes (no file content).
- **Recipients are Entra ID users only.** External addresses are not
  allowed, since there are no grants to evaluate for them; the
  recipient picker only offers directory users.

**Confirmed (10 Nov 2026):** SMTP relay for mail; exports generated per
run and never stored; Entra ID recipients only.

**Export rendering — ADR-0003 (accepted):** a Node render worker
(`repoio-export-worker/`, planned) renders charts with server-side
ECharts (same chart options as the console), PDF through headless
Chromium (correct Arabic shaping and RTL), PPTX with `pptxgenjs` and
XLSX with `exceljs`. It only renders data the service already queried as
the recipient: no database or Trino access, no grants, no storage.

**Attachment size — ADR-0003 Part B (accepted):** the limit equals the
relay's maximum message size, set to 10 MB (about 7 MB raw after
base64), a pre-flight size estimate, a 100,000-row cap per
broadcast, automatic ZIP for CSV only, and otherwise a **link-only**
email to the live report (outcome `linkOnly`), decided per recipient.
Never split across emails, never stored for linking.

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
Schemas; `repoio-service` exposes the APIs and `repoio-ui` consumes them.
The UI must not become the owner of entity definitions or business rules.
The Entity column above is the single source of the domain enum used by
request templates and reference data (§2.6): the domain axis is the
entity type, not the organizational owner. Each domain holds one or more
repositories (§2.6, ADR-0001) — the Owner column names the
stewardship team that governs the domain. No second domain list exists
anywhere.

---

## 4. Milestones

| M   | Scope                                                                                                | Deliverable                                                       | Status  |
|-----|------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------|---------|
| M0  | Scaffold (12 modules, folder tree, pom.xml, Makefile, CI)                                            | repo tree matches OpenMetadata, `make bootstrap` works            | ✅ done |
| M1  | Entity model + REST — Customer, Vendor, Product, GoldenRecord, ChangeRequest · domain-scoped request templates + reference data registry | Dropwizard app runs locally against Postgres, OpenAPI generated   | next    |
| M2  | **Iceberg catalog + raw + staged tables** · **Kafka** · **FastAPI push ingest** for SAP C4C          | `docker-compose up` brings up Kafka+Iceberg; C4C events land raw  |         |
| M3  | **Spark Structured Streaming** — standardise, DQ (Great Expectations), **Splink match**, survivorship | Golden Customer records written to Iceberg, change_log populated  |         |
| M4  | UI foundation — incremental migration from React to **OpenUI5**; Dashboard, Entity pages, Golden Record, Change Requests, Pipeline runs, Templates catalog (role-filtered, grouped by domain) + request form with reference lists and duplicate check | OpenUI5 console at `/`; existing features and API contracts preserved | planned |
| M5  | **MCP server** + Entra ID auth + role-based access                                                   | AI agents can read/write golden records with per-user scopes      |         |
| M6  | Production hardening — k8s operator, monitoring (OTel), backup, DR                                   | Helm chart deployed to staging on AKS                             |         |
| M7  | Workflow Designer — BPMN editor, workflow definitions, validation, versioning and service integration | Users can design and publish governed workflows; execution delegated to a workflow runtime | planned |
| M8  | Python runtime for workflow Script steps — isolated workers, approved pinned image, RBAC, audit (no workspace screen, ADR-0004) | Script steps of published workflows run in isolated workers as the requesting user, never in API processes | planned |
| M9  | **Connections hub + workflow-driven write-back** — connections registry & admin UI, secret-store integration, C4C/ERP write-back adapters, Write-back Task in the Workflow Designer, data-platform federation | Admins manage connections with tokens in the secret store; approved ChangeRequests write back to C4C/ERP only via workflows containing a Write-back Task | planned |

---

## 5. Why Iceberg Index

**Iceberg version: v3.** The platform pins spec v3 for the tables it
owns. The v3 features that matter to Repo.io: deletion vectors (MERGE/
UPDATE-heavy survivorship on `golden_customer`), row lineage (row-level
provenance complementing `change_log`) and the variant type (optional,
for semi-structured source fields). Note: the **Index is a separate
upcoming feature, not part of the v3 spec** — pinning v3 does not by
itself deliver the point-lookup path below; verify engine support for
v3 features (Spark, Trino, REST catalog) before DDL lands.

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
repoio-clients/         External system clients (SAP, SF) · write-back adapters (C4C, ERP)
repoio-service/         Dropwizard app · REST · GraphQL · auth · workflow
repoio-mcp/             MCP server · tool registry · agent policies
repoio-ui/              OpenUI5 console (Discover · Workbench · Admin)
repoio-ui5-components/  NEW · shared OpenUI5 controls (Table, Form, Diff, Lineage)
repoio-python-runtime/  NEW · isolated Python execution workers / kernels
repoio-export-worker/   NEW · Node render worker for broadcast exports (ADR-0003)
repoio-k8s-operator/    CRDs: Repository, Pipeline, IcebergCatalog
repoio-integration-tests/   Cross-module e2e
repoio-shaded-deps/     Shaded Elasticsearch / OpenSearch
repoio-dist/            Assembly · Docker images · Helm
repoio-airflow-apis/    Pull-ingest DAGs, DQ runs, housekeeping, broadcast dispatch (proposed, §2.8)

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

## 7. Target UI architecture — OpenUI5 + specialist libraries

### 7.1 OpenUI5 is the application framework

OpenUI5 is the primary frontend framework for the target Repo.io console.
It owns the application shell, navigation, routing, MVC structure, data
models, binding, lifecycle and standard enterprise controls.

**Licensing note:** OpenUI5 is the open-source (Apache 2.0) edition of UI5.
It shares the framework core, MVC, data binding, routing and theming model
with SAPUI5, and it ships full RTL support for Arabic. A small subset of
SAP-licensed controls and themes is available only in SAPUI5; build Repo.io
screens on controls available in the OpenUI5 distribution and document any
exception explicitly.

Use native OpenUI5 controls first for common application UI:
- Application shell, side navigation, pages and breadcrumbs.
- Forms, inputs, tables, dialogs, tabs and notifications.
- Entity pages, Golden Record views, review queues and admin screens.
- Accessibility, responsive behavior, theming and Arabic RTL / English LTR.

The current React application is the migration baseline. Migrate screen by
screen and keep existing API contracts and business behavior intact until
each replacement screen passes functional testing. Do not run two competing
frontend frameworks inside the same screen unless there is a documented
technical reason.

The console's user journeys — per persona, across every area (Discover,
requests, approvals, stewardship, workflow designer, admin) — are specified in `docs/user-journey.md`; build and test each
screen against its journey there.

### 7.2 Third-party libraries are embedded capabilities

OpenUI5 does not prevent the use of other JavaScript libraries. Add a
specialist library only when OpenUI5 does not provide the required capability
or when a specialist library is materially better for that job.

| Capability | Candidate library | Repo.io use |
|------------|-------------------|-------------|
| Workflow designer | **Repo.io flow designer** (OpenUI5, no library — ADR-0002) | Step-card workflow authoring, compiled to BPMN 2.0 for Flowable |
| Code editor | **Monaco Editor** | Python, SQL, JSON and configuration editing |
| Charts | **Apache ECharts** | Data quality, profiling and operational dashboards |
| Graph visualization | **Cytoscape.js** | Data lineage, relationships and entity networks |
| Lightweight editor alternative | **CodeMirror 6** | Smaller embedded code-editing surfaces |

Integration rules:
1. Prefer native OpenUI5 controls for standard UI elements.
2. Encapsulate each third-party library in a reusable OpenUI5 custom control,
   wrapper or dedicated page component.
3. Keep library-specific DOM and event handling inside that wrapper and
   respect the OpenUI5 rendering and destruction lifecycle.
4. Load npm packages through the selected UI5 Tooling-compatible build
   approach (for example, `ui5-tooling-modules` where appropriate).
5. Include the required CSS, assets, workers and licensing notices.
6. Pin compatible versions and test production builds inside Docker.
7. Do not introduce React solely to host a third-party JavaScript library.

### 7.3 Workflow Designer and execution

The Workflow Designer is an authoring experience, not the workflow engine.

- **Designer:** the Repo.io flow designer (ADR-0002) — an OpenUI5 canvas of
  step cards (Begin, Template, Validation, Approval, Script, Write-back,
  Notification, Condition, End) with "+" to add a step on a path. It saves a
  JSON flow model; publishing compiles it to BPMN 2.0 for the engine.
- **Configuration:** OpenUI5 forms/panels provide Repo.io-specific task
  properties, approvers, conditions, ownership and validation.
- **Persistence:** save workflow definitions, versions and metadata through
  Repo.io APIs and the control-plane database.
- **Execution:** a backend workflow runtime executes published definitions,
  manages task state, retries, approvals and audit history.
- **Events:** publish relevant workflow events through Kafka where
  asynchronous integration is required.

**Decision: integrate a dedicated workflow engine, with Flowable as the
initial candidate.** The flow designer is the authoring component only; it
does not execute workflows. Flowable owns BPMN process execution, task
lifecycle, timers, retries and runtime state. `repoio-service` remains the
Repo.io integration/governance layer for authentication, authorization,
business context, API façade and audit integration. Add an adapter boundary
so Repo.io is not tightly coupled to one engine's APIs. Confirm the selected
Flowable edition, license and deployment model before production adoption.

### 7.4 Python runtime (no Python Workspace screen — ADR-0004)

There is **no Python Workspace screen in Phase 1** (ADR-0004). Custom
Python is written in the **Script** step of the flow designer
(ADR-0002), versioned with the workflow and test-run from the step.
Exploration happens in the data platform (Databricks through the Iceberg
REST catalog), matching / DQ tuning in their configuration screens, and
bulk fixes through bulk-upload change requests.

**Runtime**
- `repoio-python-runtime` runs Script steps in disposable, isolated worker
  containers with CPU, memory, disk and execution-time limits.
- Flowable invokes Script steps through a secured Repo.io worker/API
  integration as the requesting user; it never executes Python inside the
  engine. The initiating identity and script version are audited.
- Workers read/write data only through explicitly granted identities and
  approved connectors; default no outbound network; no Docker socket or
  host path mounts.
- Packages come from an approved, pinned runtime image: pinned manifest →
  approval → build from approved registries → scan → immutable image. No
  `pip install` at run time.
- Author, approve, execute, publish and administer permissions stay
  separate RBAC actions, enforced at the API and worker boundaries.
- Never execute user-submitted Python inside the FastAPI ingestion
  process, Dropwizard process or UI container.

Notebooks / a script workspace may be revisited by a new ADR if a
recurring need appears that the homes above do not cover.

### 7.5 Docker deployment view

The target deployment keeps UI, APIs, streaming and user-code execution as
separate services. A local development Compose profile may include:

| Container / service | Responsibility |
|---------------------|----------------|
| `repoio-ui` | OpenUI5 static assets served by Nginx |
| `repoio-service` | Dropwizard REST / GraphQL, auth and control-plane APIs |
| `repoio-mcp` | MCP tools and AI-agent access policies |
| `ingestion-fastapi` | Push ingestion endpoints |
| `repoio-python-runtime` | Isolated Python execution workers; scale independently |
| `repoio-catalog` | Iceberg REST catalog and catalog configuration |
| `repoio-stream` | Spark Structured Streaming jobs |
| `kafka` | Event bus (Redpanda may be used in development) |
| `postgres` | Control-plane metadata and operational state |
| `trino` / `spark` | Query and processing engines |
| `airflow` | Scheduled batch / pull ingestion DAGs |

The UI container should serve static frontend assets only. It should not
contain Python execution dependencies or direct database credentials.
Expose backend services through a reverse proxy/API gateway, and keep
internal service ports private in production.

### 7.6 Suggested frontend package dependencies

Candidate dependencies (confirm versions and compatibility during
implementation; do not install all packages blindly):

```bash
# OpenUI5 application tooling
npm install --save-dev @ui5/cli
npm install --save-dev ui5-tooling-modules

# Specialist UI capabilities
npm install monaco-editor
npm install echarts
npm install cytoscape
```

Use OpenUI5's own controls for standard UI. The packages above are
capability-specific additions, not replacements for the OpenUI5 framework.
Check each dependency's current license, maintenance status, security
posture, bundle size and compatibility before adoption.

---

## 8. Module-by-module target layout

```text
repoio-spec/                 JSON Schemas (one per entity + shared types)
repoio-sdk/                  Java client (generated from spec)
repoio-clients/              External system clients (SAP, SF) · write-back adapters (C4C, ERP)
repoio-service/              Dropwizard app · REST · GraphQL · auth · workflow APIs
repoio-mcp/                  MCP server · tool registry · agent policies
repoio-ui/                   OpenUI5 console (Discover · Workbench · Admin)
repoio-ui5-components/       NEW · reusable OpenUI5 controls and wrappers
repoio-k8s-operator/         CRDs: Repository, Pipeline, IcebergCatalog
repoio-integration-tests/    Cross-module e2e
repoio-shaded-deps/          Shaded Elasticsearch / OpenSearch
repoio-dist/                 Assembly · Docker images · Helm
repoio-airflow-apis/         Pull-ingest DAGs, DQ runs, housekeeping

repoio-stream/               Spark Structured Streaming jobs (Scala/PySpark)
repoio-catalog/               Iceberg REST catalog, table DDL, index config
repoio-python-runtime/       NEW · isolated Python workers / optional kernels
repoio-ontology/             NEW · RDF/OWL ontology, SPARQL, SHACL, reasoning

ingestion/
  src/metadata/               SAP C4C, ERP, SQL Server, Excel connectors
  src/metadata/sdk/           Python SDK (parallel to repoio-sdk)
  fastapi/                    Push-ingest endpoints, outbox consumer
  pipelines/                  YAML configs
  tests/

docker/                       Compose stacks: dev, iceberg, kafka, spark, trino
bootstrap/sql/                 Flyway migrations (Postgres control plane only)
docs/                          Architecture, ADRs and operational guides
openspec/                      Human-reviewable spec changes
scripts/                        CI / housekeeping
tooling/                        Codemods, generators
```

---

## 9. Implementation sequence and decisions

Recommended order:

1. **M1 — Entity model + REST:** validate schemas, APIs, Customer and Golden
   Record use cases before expanding the UI. Add the domain-scoped
   request-template and reference-data schemas to `repoio-spec`.
2. **M2 — Lakehouse ingestion path:** prove FastAPI / Airflow → Kafka →
   Spark → Iceberg end-to-end.
3. **M3 — MDM processing:** standardisation, Great Expectations, Splink
   matching, survivorship, change log and audit.
4. **M4 — OpenUI5 foundation:** establish UI5 Tooling, routing, shell,
   theme, RTL/LTR, authentication integration and reusable controls; then
   migrate existing screens incrementally. Include the role-filtered
   Templates catalog (grouped by domain), the request form with
   target-system-filtered reference lists, and the potential-match
   duplicate check.
5. **M5 — MCP and identity:** Entra ID, role-based access and per-user
   agent scopes. Server-side role→domain template visibility lands with
   the identity work.
6. **M6 — Production hardening:** Kubernetes operator, OTel, backup, DR
   and deployment automation.
7. **M7 — Workflow capability:** BPMN authoring first, then engine selection,
   workflow persistence, execution, approvals and audit.
8. **M8 — Python runtime:** isolated execution workers for workflow Script
   steps and the approved package image; no workspace screen (ADR-0004).
9. **M9 — Connections & write-back:** connections registry with admin UI
   and secret-store tokens, C4C/ERP write-back adapters and the Write-back
   Task in the Workflow Designer, and data-platform federation through the
   Iceberg REST catalog. Requires M7 — write-back is workflow-driven.

### Confirmed architecture decisions

- **Frontend:** fully migrate React to OpenUI5. React is only the migration
  baseline and is not the target frontend architecture.
- **Workflow:** integrate a dedicated workflow engine; Flowable is the
  initial candidate. The Repo.io flow designer (ADR-0002) authors and
  compiles to BPMN 2.0; it never executes.
- **Python:** v1 runs Python only as Script steps inside workflows, in
  isolated workers. No Python Workspace screen and no notebooks
  (ADR-0004).
- **Python packages:** support controlled package configuration using pinned
  dependencies, approved registries, scanning and reproducible environments.
- **Python permissions:** author, approve, execute, publish and administer
  are separate actions mapped to configurable Repo.io roles. Actual role
  names and grants depend on each deployment's RBAC configuration.
- **Ontology:** add a dedicated ontology/semantic service using Apache Jena
  as the initial technology choice, with Fuseki/SPARQL, TDB2 persistence,
  SHACL validation and a bounded reasoning profile.
- **Write-back:** source write-back (SAP C4C, SAP ERP) is workflow-driven —
  a ChangeRequest writes back only when its approved workflow includes a
  Write-back Task node. `changes.<entity>` stays informational.
- **Connections:** admins manage source and data-platform connections
  (Databricks, Snowflake, Data Fabric, …) in a control-plane registry with
  URL + token; tokens live in the secret store, never in Postgres.
- **Request templates:** domain-scoped — one template per domain, no
  cross-domain sharing; the Templates catalog is server-side filtered by the
  user's role→domain grants; authoring is a dedicated role granted by the
  Admin (typically master data stewards); the user selects from applicable
  published workflows at request creation.
- **Reference data:** code lists are assigned by (domain, source/target
  system); reference lists in request forms are filtered by the selected
  target system.

### Remaining implementation details

- Verify the engine support matrix for Iceberg v3 features before DDL
  lands: the pinned Spark and Trino versions, and the chosen REST catalog
  implementation, must all support v3 — deletion-vector support in
  particular matured unevenly across engines.
- Confirm the secret store (Vault vs Azure Key Vault) and the supported
  auth scheme per connection type (PAT, OAuth2, service principal, key
  pair) for the target data platforms.

- OpenUI5 is Apache 2.0 licensed, which resolves the former SAPUI5 runtime
  licensing dependency. Remaining checks: verify that every required control,
  library and theme is available in the OpenUI5 distribution (some
  SAP-licensed controls and themes ship only with SAPUI5), and decide between
  CDN and self-hosted distribution for the intended Repo.io deployment model.
- Confirm the Flowable edition/version, license and deployment topology.
- Define package registry/mirror, approval policy, image build process and
  environment retention policy.
- Define detailed RBAC grants for configured roles and workflow service
  identities.
- Define ontology namespace strategy, ontology ownership, version approval,
  supported OWL profile, reasoning limits and links to OpenMetadata/catalog
  assets.
- Benchmark Jena/Fuseki/TDB2 against expected graph size, query patterns and
  concurrency before production sizing.
- Author, Employee and Store are domains (§3) but have no JSON Schema in
  M1 scope; templates for those domains cannot be validated until their
  schemas land. Decide which milestone adds them.

Each milestone should live in a dedicated spec under
[`openspec/changes/`](../../openspec/changes/) before implementation. Keep
the architecture document aligned with actual delivery status; mark planned
components as planned until they are implemented and tested.

---

## Developer quick links

- Developer setup: [DEVELOPER.md](DEVELOPER.md) · contributing:
  [CONTRIBUTING.md](CONTRIBUTING.md)
- Agent operating manual: [CLAUDE.md](CLAUDE.md) · execution plan:
  [docs/milestone-plan.md](docs/milestone-plan.md) · journeys:
  [docs/user-journey.md](docs/user-journey.md) · page map:
  [docs/ui-pages.md](docs/ui-pages.md)
- Architecture decisions: [docs/decisions/](docs/decisions/)
- UI design reference and prototypes:
  [repoio-ui/design-reference/](repoio-ui/design-reference/README.md)

Apache 2.0 — see [LICENSE](LICENSE). Repository layout based on
[OpenMetadata](https://github.com/open-metadata/OpenMetadata).
