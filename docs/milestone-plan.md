# Repo.io Milestone Plan — Acceptance Criteria

This is the definition of done for every milestone. A milestone is
complete only when **every** item in its checklist is verifiably true.
Verify with real commands and real output — see the verification protocol
in `CLAUDE.md` §7.

Status legend: `[ ]` pending · `[x]` done. Update this file and the root
README milestone table together, in the same change.

Prerequisite for every milestone: an approved spec under
`openspec/changes/<milestone-id>/` **before** implementation begins.

---

## M0 — Scaffold ✅ (context, already complete)

12 modules, folder tree mirroring OpenMetadata, `pom.xml`, `Makefile`, CI.
`make bootstrap` works. Do not re-do M0 work; extend it.

---

## M1 — Entity model + REST

**Scope:** Customer, Vendor, Product, GoldenRecord, ChangeRequest entity
models; Dropwizard REST service; OpenAPI generation; domain-scoped
request templates + reference data registry.
**Skills:** `repoio-entity-model`, `repoio-templates-refdata`

- [ ] JSON Schemas exist in `repoio-spec/.../json/schema/entity/` for all
      five API entities, validated by CI.
- [ ] OpenAPI 3.1 artifact generated from the spec and committed.
- [ ] `repoio-sdk` regenerated from the spec; generated code compiles and
      is separated from hand-written code.
- [ ] Flyway migrations apply forward-only to Postgres (control plane
      only — no golden-record row tables).
- [ ] Dropwizard app boots locally against Postgres: health endpoint,
      auth wiring, CRUD round-trip per entity.
- [ ] ChangeRequest API supports its full state flow (draft → review →
      approved/rejected), with transitions audited.
- [ ] Request-template schema and registry: domain-scoped (one template
      per domain, closed domain enum = Entity list in README §3 — the
      entity types; a domain holds one or more repositories —
      ADR-0001), versioned,
      author/approve/publish as separate RBAC actions; pre-fill fields
      validated against `repoio-spec` entity schemas.
- [ ] Reference-data schema and registry: entries assigned to (domain,
      source/target system); the lists API filters by domain + system —
      full lists are never sent to the client.
- [ ] Relationship type catalog schema + registry API: types defined
      per (from_domain → to_domain) pair with inverse, cardinality and
      attribute definitions — seeded from the README §2.3 catalog;
      relationship instances follow the governed ChangeRequest path
      (instance data arrives with M3 golden records — until then the
      API is contract-complete, never fake data).
- [ ] Repository registry per domain: a domain holds one or more
      repositories, each with exactly one assigned model version;
      source→repository and field→model-attribute mappings are
      queryable (they drive the Domains, repository and data-source
      pages) — ADR-0001.
- [ ] Role→domain mapping table in the control plane (configuration, not
      code) — feeds server-side template visibility.
- [ ] ChangeRequest creation from a template records the template
      id+version and the user-selected workflow id+version in its audit
      trail.
- [ ] GoldenRecord API serves reads from the Iceberg path (or a stub
      returning 501 with a tracking issue until M2 lands — never fake
      data).
- [ ] Integration tests run against real Postgres (testcontainers), not
      mocks; `mvn -q verify` green.
- [ ] Spec under `openspec/changes/` reviewed and approved.
- [ ] Module READMEs updated (see `docs/module-readme-template.md`).

**Exit gate:** the M1 deliverable from the root README — "Dropwizard app
runs locally against Postgres, OpenAPI generated" — demonstrated end to
end, plus the checklist above.

---

## M2 — Lakehouse ingestion path

**Scope:** Iceberg catalog + raw + staged tables · Kafka · FastAPI push
ingest for SAP C4C.
**Skills:** `repoio-ingestion` **and** `repoio-iceberg-catalog`

- [ ] Iceberg version pinned to **spec v3** for Repo.io-owned tables;
      engine support matrix verified (pinned Spark + Trino + REST catalog
      versions all support v3, deletion vectors especially) and recorded
      in the module README.
- [ ] Iceberg REST catalog service (`repoio-catalog/`) runs with versioned
      DDL for `raw_customer`, `staged_customer` (+ stubs for the other
      four tables).
- [ ] Kafka (Redpanda in dev) running via compose; topics `raw.customer`,
      `staged.customer` created with documented retention.
- [ ] FastAPI push endpoint validates payloads against the entity JSON
      Schema and produces to `raw.customer` with provenance and
      idempotency keys.
- [ ] Outbox consumer pattern implemented for SAP C4C callbacks.
- [ ] Airflow DAG scaffolding for pull sources (ERP, SQL Server) —
      config-driven from `ingestion/pipelines/` YAML.
- [ ] **Benchmark harness exists for Iceberg Index point lookups** by
      `master_id` at realistic row counts, with measured latency recorded
      in the milestone report. If the sub-100 ms target is missed, a
      written fallback proposal (serving cache) accompanies the report.
      M4 must not be planned on an unmeasured read path.
- [ ] End-to-end dev test: `docker compose up` → post a C4C event to the
      push endpoint → it lands in the `raw.customer` topic and the
      `raw_customer` table.
- [ ] Replay of the same event creates no duplicate logical record.
- [ ] No connector credentials committed; secrets via environment.

**Exit gate:** "docker-compose up brings up Kafka+Iceberg; C4C events land
raw" — demonstrated, plus the benchmark harness output.

---

## M3 — MDM processing

**Scope:** Spark Structured Streaming — standardise, DQ (Great
Expectations), Splink match, survivorship.
**Skills:** `repoio-streaming-mdm`

- [ ] Four separate streaming jobs (standardise, DQ, match, survivorship)
      each with its own checkpoint location; state is bounded and sized.
- [ ] `staged_customer` populated by standardise from `raw.customer`.
- [ ] Great Expectations suite runs between standardise and match;
      failures route to a review/dead-letter path — never dropped, never
      blocking.
- [ ] Splink configured for Customer matching; `matched_pairs` stores
      scored candidates with `pair_id`.
- [ ] Survivorship rules are versioned configuration, not code; per-field
      decisions write to `change_log` with provenance (source, timestamp,
      rule version).
- [ ] `golden_customer` rows written to Iceberg; `changes.customer`
      emitted to Kafka as the outbox/audit contract.
- [ ] **Match quality report on labelled pairs: precision/recall
      measured and recorded** — with the pair set and thresholds
      documented. Acceptance thresholds agreed with the business owner,
      not invented.
- [ ] Known-duplicate test pair merges; known-distinct pair does not.
- [ ] Job restart from checkpoint produces no duplicate golden rows.
- [ ] End-to-end dev run: event → raw → staged → matched → golden with
      visible `change_log` entries.

**Exit gate:** "Golden Customer records written to Iceberg, change_log
populated" — demonstrated, plus the match-quality report.

---

## M4 — OpenUI5 foundation

**Scope:** incremental migration from React to OpenUI5; Dashboard, Entity
pages, Golden Record, Change Requests, Pipeline runs, Templates catalog.
**Skills:** `repoio-ui5-frontend`, `repoio-templates-refdata`

- [ ] UI5 Tooling (`@ui5/cli`, `ui5-tooling-modules`) set up; production
      build works inside Docker.
- [ ] App shell, routing, theme, auth integration and **RTL/LTR both
      working** — Arabic and English each render correctly on every
      shipped screen.
- [ ] Console shell = Tool Page Layout: `sap.tnt.ToolPage` +
      `sap.tnt.ToolHeader` + `sap.tnt.SideNavigation` with its search
      field (per `docs/ui-pages.md` §Shell & theme), theme
      `sap_fiori_3` (Quartz Light) applied at bootstrap; the
      navigation tree is served by the same role-filtered APIs as
      page content; expanded and collapsed-rail modes both verified in
      RTL and LTR.
- [ ] `repoio-ui5-components/` started with at least the shared Table and
      Form controls.
- [ ] Migration order documented screen-by-screen with parity
      checklists; first screens (Dashboard + one entity page) migrated
      and passing functional testing against the React baseline.
- [ ] Screens implement the journeys in `docs/user-journey.md` — at
      minimum J1 (dashboard), J2 (golden record), J3 (request from
      template) and J4 (approval), plus J10 pipeline-runs where shipped
      — each journey walkthrough passes in RTL and LTR both.
- [ ] Templates catalog page (entry: "New request" from Dashboard /
      Inbox): renders exactly what the server-filtered API returns — a
      user with one domain grant sees only that domain's templates,
      grouped by domain (verified via the API, not just the UI).
- [ ] Request form: user selects from the applicable published workflows
      (the template does not hard-bind one); reference lists re-filter
      when the selected target system changes — in RTL and LTR both.
- [ ] Duplicate check in the request form: when the template enables
      `match_check`, potential matches against existing golden records
      are surfaced; the user confirms "not a duplicate" or links the
      request to the existing record — verified at the API level.
- [ ] Relationships screens (Relationships list + Relationship builder
      per `docs/ui-pages.md`): type dropdown filtered by the from→to
      domain pair, record pickers scoped to granted domains, live
      validation (cycle / duplicate / self-link), submit creates a
      relationship change request visible in Open change requests —
      verified at the API level, RTL and LTR both.
- [ ] Steward bulk upload on the Relationships list: CSV/XLSX of
      (from, to, type, action, attributes) rows validated per row
      (pair validity, record existence, cycle / duplicate /
      self-link) with a per-row report; accepted rows submit as one
      batch relationship change request; rejected rows never enter
      it; re-upload is idempotent; steward RBAC enforced at the API
      (a non-steward upload is denied, not hidden).
- [ ] Feeds page (Activity + Announcements tabs), the Home
      announcements strip, and Administration → Announcements
      authoring (audience, publish window, pinned, retire) — served
      by permission-filtered APIs over a control-plane activity table
      fed from existing platform events; a user without a domain
      grant sees no events from it — verified at the API level.
- [ ] Editing an existing relationship (attributes, endpoints) or
      retiring it submits a change request — no direct write path and
      no delete button, verified by attempting both at the API.
- [ ] Existing API contracts preserved — no endpoint changes required by
      the UI migration (any needed change goes through `repoio-spec`).
- [ ] No business rules or entity definitions introduced in the UI.
- [ ] No React islands inside OpenUI5 screens; no SAPUI5-only controls
      used without a documented exception decision.
- [ ] OpenUI5 console served at `/` from the static-assets Nginx
      container.

**Exit gate:** "SAPUI5 console at `/`" (now OpenUI5), existing features
and API contracts preserved — demonstrated via the parity checklist.

---

## M5 — MCP and identity

**Scope:** MCP server + Entra ID auth + role-based access.
**Skills:** `repoio-mcp-identity`, `repoio-templates-refdata`

- [ ] MCP server (`repoio-mcp/`) runs with a tool registry and agent
      policy layer.
- [ ] Entra ID token validation (issuer, audience, claims→roles mapping
      from deployment config).
- [ ] Per-user scopes enforced: an agent reads/writes golden records only
      within the initiating user's permissions.
- [ ] Role→tool grant matrix is versioned configuration.
- [ ] Negative tests: invalid/expired token rejected; ungranted tool →
      denial (not degraded data).
- [ ] Every allowed and denied action audited with initiating identity.
- [ ] No unrestricted endpoint (including SPARQL) reachable by agents.
- [ ] Agent writes follow the governed path (ChangeRequest flow) per the
      approved spec.
- [ ] Template visibility enforced server-side with real identities: a
      user without a domain grant receives no templates for it from the
      API — verified with a direct call, and the template-authoring role
      (granted by Admin, typically to master data stewards) rejects
      non-holders on author/publish.

**Exit gate:** "AI agents can read/write golden records with per-user
scopes" — demonstrated with both the happy path and the denials.

---

## M6 — Production hardening

**Scope:** k8s operator, monitoring (OTel), backup, DR.
**Skills:** `repoio-platform-ops`

- [ ] `repoio-k8s-operator/` reconciles CRDs (`Repository`, `Pipeline`,
      `IcebergCatalog`) on a real cluster.
- [ ] Helm chart (`repoio-dist/`) parameterized for dev/staging/prod;
      internal service ports private; ingress only via the gateway.
- [ ] OTel traces + metrics on `repoio-service`, `repoio-mcp`,
      `ingestion-fastapi`, streaming jobs; dashboards + alerts (consumer
      lag, checkpoint failure, DLQ growth).
- [ ] Health/readiness probes on every container; resource limits set on
      streaming and worker containers.
- [ ] Backup jobs for Postgres, object storage/Iceberg, Kafka topic
      config, TDB2 (if ontology deployed) — **and a restore drill
      executed successfully on staging data**.
- [ ] Images pinned by digest, scanned in CI; no secrets in images or
      manifests.
- [ ] Helm chart deployed to staging on AKS.

**Exit gate:** "Helm chart deployed to staging on AKS" — with the restore
drill's evidence attached.

---

## M7 — Workflow capability

**Scope:** BPMN authoring, workflow definitions, validation, versioning,
service integration; execution delegated to the runtime.
**Skills:** `repoio-workflow-python` (Part 1)

- [ ] Repo.io flow designer (ADR-0002) as an OpenUI5 control: step
      cards, "+" insert, automatic layout, RTL; clean destroy.
- [ ] Flow model → BPMN 2.0 compiler in `repoio-service`, with tests
      (every node type, every branch ends, no `scriptTask`).
- [ ] Repo.io-specific property panels (approvers, conditions,
      ownership, validation) in OpenUI5 forms.
- [ ] Definitions persist through Repo.io APIs to the control plane with
      versions; published versions immutable.
- [ ] Flowable integrated **behind an adapter**; edition/license/
      deployment model confirmed and recorded as an ADR.
- [ ] A designed workflow executes end-to-end: approvals, task state,
      retries, audit history.
- [ ] Workflow events published to Kafka where async integration is
      configured.
- [ ] `repoio-service` remains the auth/governance façade — no business
      logic pushed into the engine.
- [ ] Write-back Task node type available in the designer palette
      (execution and adapters ship with M9 — see the `repoio-integrations`
      skill).
- [ ] Workflows tagged with applicable entity/domain so request forms
      can offer the right published workflows (see the
      `repoio-templates-refdata` skill).
- [ ] Journey J7 (design & publish a workflow) in `docs/user-journey.md`
      passes end to end, including the validate → version → publish
      separation.

**Exit gate:** "Users can design and publish governed workflows; execution
delegated to a workflow runtime" — demonstrated end to end.

---

## M8 — Python Workspace

**Scope:** code editor, scripts/notebooks, isolated execution, logs and
data preview.
**Skills:** `repoio-workflow-python` (Part 2)

- [ ] Monaco editor embedded in OpenUI5: script explorer, tabs, run
      controls, output/logs/errors panel, DataFrame/sample preview.
- [ ] Script metadata, versions, dependency manifests, run metadata and
      audit stored in the control plane; large outputs in approved object
      storage.
- [ ] `repoio-python-runtime/` workers: disposable containers with CPU/
      memory/disk/time limits; no Docker socket or host mounts; default
      no outbound network (allowlist config).
- [ ] Dependency flow: pinned manifest → approval → build from approved
      registry → scan → immutable image. No production runtime
      `pip install`.
- [ ] RBAC actions separated (author, approve, execute, publish,
      administer), mapped to deployment-configured roles, enforced at API
      **and** worker boundaries — including workflow-triggered runs.
- [ ] Python Script Task invocable from a published workflow via the
      secured worker integration (never executed inside Flowable).
- [ ] Negative tests: unpermitted execution denied; out-of-allowlist
      package rejected; worker kill mid-run leaves no orphaned state.
- [ ] Audit records initiating identity + script version for every run.
- [ ] Journey J8 (develop & run a governed Python task) in
      `docs/user-journey.md` passes end to end, including the manifest →
      approval → image dependency flow.

**Exit gate:** "Data engineers can develop and run approved Python data
tasks without executing code in API processes" — demonstrated, including
the denials.

---

## M9 — Connections hub & workflow-driven write-back

**Scope:** connections registry + admin UI, secret-store integration,
C4C/ERP write-back adapters, Write-back Task execution, data-platform
federation (Databricks, Snowflake, Data Fabric).
**Skills:** `repoio-integrations` (routing: after M7 — workflows must
exist first, since write-back is workflow-driven)

- [ ] `connections` registry in the Postgres control plane: name, type
      (`sap_c4c`, `sap_erp`, `sqlserver`, `databricks`, `snowflake`,
      `data_fabric`, …), endpoint URL, auth method, status, health.
- [ ] **Token storage verified by direct table inspection: no token
      material in Postgres anywhere** — secrets in Vault / Azure Key
      Vault; registry holds references (+ masked display hint only).
- [ ] Secret store choice confirmed (Vault vs Azure Key Vault) and auth
      schemes per connection type (PAT, OAuth2, service principal, key
      pair) documented.
- [ ] Connections admin UI (OpenUI5, Admin area): list with health,
      per-type CRUD forms, working **Test connection** action, audit
      trail of every connection change.
- [ ] RBAC: `administer connections` is a separate action — a user
      without it can neither modify connections nor see token material.
- [ ] Periodic health checks run; failures surface in the admin console
      and alerting.
- [ ] Source connections (C4C, ERP, SQL Server) feed ingestion connectors
      and write-back adapters from the same connection record — no
      duplicated credential config.
- [ ] Write-back Task executes: an approved ChangeRequest whose workflow
      contains the node writes to the target via `repoio-clients` adapter
      (integration test against a stubbed C4C/ERP service recording
      calls).
- [ ] **Negative path:** a ChangeRequest approved through a workflow
      *without* the Write-back node produces zero source writes.
- [ ] Idempotency: workflow retry does not double-write (keyed by
      ChangeRequest id + version).
- [ ] Conflict path: source value changed since match → routed to review,
      no silent overwrite.
- [ ] Field allowlists per source system enforced — out-of-allowlist
      fields refused by the write-back API.
- [ ] Every write-back attempt audited (who, workflow version, fields,
      source response, timestamp).
- [ ] Federation: an external platform's granted identity reads golden
      tables through the Iceberg REST catalog; an ungranted identity
      cannot. Any non-federation export pipeline is justified in writing.
- [ ] Data-platform ingest mode: a Databricks/Snowflake/Fabric connection
      usable as a pull source (connector + Airflow DAG).
- [ ] Journey J9 (administer connections & write-back) in
      `docs/user-journey.md` passes end to end, including the masked-token
      behavior and the Test connection action.

**Exit gate:** admins manage connections (URL + token in the secret
store) from the admin UI; approved ChangeRequests write back to C4C/ERP
only via workflows containing a Write-back Task — demonstrated with the
happy path, the no-node negative path, and the conflict path.

---

## Ontology track (parallel-capable, post-M1)

**Scope:** `repoio-ontology/` V1 per the architecture section 2.3.
**Skills:** `repoio-ontology`

- [ ] Namespace strategy, ontology ownership and version approval
      process documented (the "remaining details" from the README).
- [ ] Jena + Fuseki + TDB2 deployed via compose; secured SPARQL
      endpoint behind Repo.io authn/authz.
- [ ] Bounded RDFS/OWL profile documented; reasoner behind an adapter.
- [ ] SHACL shapes for agreed business constraints, versioned.
- [ ] Relationship types and instances materialized into the RDF graph:
      types as object properties, instances as triples over canonical
      entity IDs; the Ontology Explorer renders instance edges with
      their change-request provenance.
- [ ] Turtle/RDF-XML import/export round-trips.
- [ ] Links from concepts to canonical entity IDs / glossary / KPIs /
      catalog assets.
- [ ] Benchmark: Jena/Fuseki/TDB2 against expected graph size, query
      patterns and concurrency before production sizing.
- [ ] MCP semantic tools are permission-filtered.

**Exit gate:** V1 scope delivered with the benchmark results recorded.
