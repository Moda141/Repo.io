# Repo.io — User Journeys (platform-wide)

> Companion to the root README (the architecture source of truth).
> This file adds what the README deliberately does not hold: the
> persona-level, step-by-step experience of using the Repo.io console.
> On any conflict, the README wins — report the conflict, then fix this
> file.

**Scope:** human users of the OpenUI5 console (Discover · Workbench ·
Admin). AI-agent interaction via MCP is a machine interface, not a user
journey — it is owned by M5 and the `repoio-mcp-identity` skill.

---

## 1. Personas

| Persona | Who (Nahdet Misr context) | What they do in Repo.io |
|---------|---------------------------|--------------------------|
| **Requester** | Business user in a domain team — Sales Ops, Procurement, Publishing (product/author), HR, Retail | Creates change requests from templates; tracks their progress |
| **Approver** | Line manager or domain owner | Acts on ChangeRequests from the Inbox; approves / rejects with comment |
| **Data Steward** | Master data steward | Reviews potential matches, curates golden records, authors request templates, builds governed relationships |
| **Data Engineer** | Data / platform engineer | Monitors pipelines and DQ, develops governed Python tasks |
| **Admin** | Platform administrator | Manages connections, roles/domain grants, platform health |
| **Consumer** | Apps, BI, external platforms | Reads golden records via API / Trino / Iceberg federation — mostly outside the console; listed to keep serving paths honest |

One human may hold several personas (a steward is often also an
approver). Visibility always follows the roles in their token — never
the persona label in this file.

## 2. Cross-cutting UX rules (apply to every journey)

1. **Authorization is server-side, everywhere.** The UI renders what
   the API returns for the caller's roles — hiding rows client-side is
   presentation, not authorization.
2. **RTL is first-class.** Arabic RTL and English LTR must both work on
   every screen in every journey; a journey passes only in both
   directions.
3. **No hardcoded strings** — i18n resource bundles only.
4. **Every state change is audited** (who, what, when, which version) —
   the UI never claims an action that the audit trail cannot confirm.
5. **The UI owns nothing**: entity definitions, domains, reference
   lists, workflow rules all come from APIs.
6. **Empty / loading / error states are part of the journey** — each
   screen must handle all three gracefully (e.g. "no templates match
   your grants" is a valid, friendly state, not a blank page).
7. **The console shell is locked:** a Tool Page Layout —
   `sap.tnt.ToolPage` + `sap.tnt.SideNavigation` with its built-in
   search — on the **Quartz Light** theme (`sap_fiori_3`). Navigation
   items render from the same server-filtered APIs as page content;
   the shell is presentation and owns no authority.
8. **People are avatars with a quick view, never a name in text.** An
   owner, approver, requester or "run as" is rendered as an avatar;
   hovering or focusing opens a quick view (name, role, team, contact).
   The name lives in the tooltip and the quick view, not in the cell.
   A non-person owner (an app registration) is a square app avatar with
   its name as the tooltip.

### Page names

Journeys use task language; the console page names are fixed in
`docs/ui-pages.md`. Mapping: Dashboard = **Home** · Discover =
**Explore** · Inbox = **Awaiting my approval** (+ the top-bar inbox
badge) · Pipeline runs = **Data jobs** · review queue = **Match
detection** · Connections hub = **Connections**.

## 3. Journey map → milestones

| # | Journey | Persona(s) | Lands with |
|---|---------|------------|------------|
| J1 | Sign in & land on the Dashboard | all | M4 (UI), M5 (Entra ID auth) |
| J2 | Discover & inspect a golden record | Requester, Approver, Consumer | M4 |
| J3 | Create a change request from a template | Requester | M1 (APIs), M4 (UI) |
| J4 | Approve or reject a request | Approver | M1 (state flow), M4 (UI), M7 (workflow execution) |
| J5 | Review a potential match | Data Steward | M3 (match data), M4+ (queue UI) |
| J6 | Author & publish a request template | Data Steward | M1 (registry), M4 (UI) |
| J7 | Design & publish a workflow | Data Steward, Admin | M7 |
| J8 | *Retired — no Python Workspace screen (ADR-0004)* | — | — |
| J9 | Administer connections & write-back | Admin | M9 |
| J10 | Monitor pipelines & data quality | Data Engineer | M2/M3 (jobs), M4 (runs UI) |
| J11 | Browse the ontology | Data Steward, Approver | Ontology track |
| J12 | Build & govern entity relationships | Data Steward | M1 (type catalog + CR path), M4 (builder + list UI), Ontology track (RDF materialization) |
| J13 | Stay informed: feeds & announcements | all | M4 (feeds page, Home strip, authoring UI) |
| J14 | Analyse & broadcast reports | Data Analyst, Data Steward, Manager | M4 (reports, studio, broadcasts UI); reports API + governed views (M5 grants) |
| J15 | Configure a data sync (replication flow) | Data Engineer | M2 (pull / push ingest, raw layer), M4 (UI) |
| J16 | Manage API access (tokens, webhooks, MCP) | Admin, Data Engineer, Consumer | M5 (identity, tokens, MCP), M4 (UI) |

A journey is "available" only when its milestone's acceptance criteria
in `docs/milestone-plan.md` pass — never before.

---

## J1 — Sign in & land on the Dashboard

1. User signs in (SSO / Entra ID in M5; local auth in earlier dev
   milestones) and lands on the Dashboard.
2. Dashboard shows: golden-record counts per domain, open requests
   assigned to them, recent approvals, pipeline health summary.
3. The Inbox badge counts requests awaiting their action (as
   requester or approver).
4. Primary entry points: **New request** (→ J3), **Discover** (→ J2),
   **Inbox** (→ J4).
5. Language switch (Arabic ↔ English) flips RTL/LTR live; choice is
   remembered per user.

*Edge cases:* no grants at all → the dashboard explains who to contact,
not an error. Session expiry mid-action → the draft is preserved where
the API supports it.

## J2 — Discover & inspect a golden record

1. User opens **Discover** and browses or searches entities (Customer,
   Vendor, Product, Author, Employee, Store) within their granted
   domains.
2. Results list shows canonical name/code, source count, last change
   timestamp.
3. Opening a record shows the **golden record view**: attributes,
   contributing source records, match confidence, lineage, and the
   field-level **change history** with provenance (source, timestamp,
   rule version).
4. The user sees *why* each field holds its value — survivorship
   decisions are visible, not magic.
5. If the record needs a correction, the path is explicit: **Request a
   change** (→ J3, pre-filled with this record). Golden records are
   never edited inline.

*Edge cases:* search with no results → suggestions (spellings, filters);
record under stewardship review → banner showing review state.

## J3 — Create a change request from a template

1. User opens **New request** (Dashboard / Inbox) and lands on the
   **Templates catalog**.
2. The catalog shows only the templates the user's role grants allow —
   filtered server-side, grouped by domain.
3. Selecting a template opens the request form, pre-filled from the
   template; fields validate against the `repoio-spec` entity schema,
   and reference-list fields are dropdowns served by the
   (domain, selected target system) reference-data API — governed
   values are never free-typed. Switching the target system re-filters
   the lists live.
4. **Duplicate check** (creation templates with `match_check` enabled):
   the form surfaces potential matches against existing golden records;
   the user confirms "not a duplicate" or links the request to the
   existing record. Submitting with an unresolved flagged match is
   rejected or routed to review.
5. At submission the user selects one of the template's **applicable
   published workflows** (the template never hard-binds one).
6. Submit → ChangeRequest created; confirmation shows the request id,
   the selected workflow, and the expected approvers.
7. The request records template id+version and workflow id+version in
   its audit trail.

*Edge cases:* form validation errors inline per field; no published
applicable workflow → the template explains the gap instead of
dead-ending; reference list empty for the (domain, system) pair →
message to contact the steward, never a silent empty dropdown.

## J4 — Approve or reject a request

1. The approver opens their **Inbox** and sees requests awaiting them,
   with requester, domain, entity and age.
2. Opening a request shows the requested change as a **diff against
   the current golden values**, plus the requester's justification.
3. Approve or **Reject with a comment** (comment mandatory on
   rejection).
4. The next step follows the selected workflow: next approver, or
   execution.
5. On final approval: the change flows through the governed MDM path
   into the golden record — and, **only when the workflow contains a
   Write-back Task** (§2.4), back to SAP C4C / SAP ERP. Write-back
   conflicts (source changed since match) route to review, never a
   silent overwrite.
6. The requester sees the outcome in their own Inbox view of the
   request; every transition is audited.

*Edge cases:* request modified since it landed in the Inbox → the
approver sees the new version and old approval is void; delegation is
a role grant question, not a UI shortcut.

## J5 — Review a potential match

1. The Data Steward opens the **review queue** of potential matches
   (scored pairs from Splink, ordered by score).
2. Opening a pair shows the two records side by side with field-level
   comparison and the match score breakdown.
3. Decision: **confirm match** (records merge under survivorship
   rules), or **reject** (records stay distinct). Either way a note may
   be added.
4. Decisions feed back into match-quality evaluation (M3 metric) —
   steward decisions are ground truth, not just clicks.
5. Every decision is audited with the pair id and score.

*Edge cases:* records merged in error are recoverable via change
history (unmerge is a governed change, not an undo button).

## J6 — Author & publish a request template

1. The Data Steward (holding the template-authoring role the Admin
   granted) opens template authoring in the Workbench.
2. Draft: domain (the closed enum from README §3 — the entity type),
   pre-fill fields validated against `repoio-spec`, `match_check`
   on/off, applicable workflows.
3. **Author → Approve → Publish are separate RBAC actions**; a second
   steward approves before publish.
4. Publishing freezes the version; edits create version N+1 while
   version N remains retrievable for existing requests.
5. Archiving hides a template from new requests without breaking
   requests already created from it.
6. Visibility check before publish: preview which roles will see the
   template in their catalog (server-side rules, shown read-only).
7. **Reference-list maintenance rides the same authoring duty:** the
   steward maintains governed code lists per (domain, source/target
   system) in Reference data management — add, version, activate — so
   request forms (J3) always render governed values.

*Edge cases:* cross-domain or multi-domain template → rejected by the
API, and the UI explains why; pre-fill field invalid against the
current entity schema → blocked at save with the schema rule cited.

## J7 — Design & publish a workflow

1. The designer opens the **Workflow Designer** — the Repo.io flow
   designer (ADR-0002): step cards on a canvas, "+" on any path to add a
   step, properties in a panel beside it, a minimap for large flows. It
   starts with **Begin** and **Template**: exactly one request template,
   chosen from the published templates the user can see; the workflow's
   domain is that template's. **New** starts from a blank canvas or as a
   **copy** of an existing workflow (a new draft v1; the original is
   unchanged).
2. The workflow is **pinned to a template version**. When a newer
   template version is published, the Template step says so; **Review
   upgrade** lists what changed (renamed / removed / added fields) and
   the steps that use them. Upgrading migrates renamed fields in
   mappings, scripts, conditions and validations; removed fields are
   flagged by validation, never dropped silently.
3. Compose with steps:
   - **Approval** — named people (one or more) or a team, any one or
     all; or **parallel groups** (every group decides at the same time;
     all must approve; one rejection rejects). SLA with reminder and
     escalation to a person or team. Controls: **return for rework**
     (the requester edits and resubmits to the same step, up to a
     maximum), **segregation of duties** (the requester is never an
     approver of their own request), **out-of-office delegation** (the
     approver's delegate gets the task). Branches *approved* /
     *rejected*.
   - **Validation** — a data quality rule (Great Expectations) on the
     template's fields, or a duplicate check (Splink) against the chosen
     source (the domain's golden records or a source connection) with a
     threshold; branches *passed* / *failed*.
   - **Script** — choose the language (Python, or read-only SQL) and
     write the code in the step, with the template's field names offered;
     runs in the isolated workers as the requester (M8).
   - **Write-back** — source system, then map template fields to the
     target system's allowlisted fields in the side panel's **Mapping**
     section, with optional **transformations** per target field
     (constant, combine two fields, truncate, upper case, trim, default
     if empty) previewed on a sample request; code lists translated by
     reference data; conflict → review (execution M9).
   - **Notification** — in-app alert and/or email to the requester,
     earlier approvers, teams or people; subject and message in
     **Arabic and English** (each recipient gets their language; both
     are required). Awareness only.
   - **Condition** — branch on a template field or on an **output of an
     earlier step** (validation result / score, approval decision /
     approver / returns, script status, write-back status); **End**
     (completed / rejected / cancelled).
4. Every branch ends in an End by construction; removing a step removes
   its side branch after a confirmation.
5. **Test run** — pick a sample request, the requester and each
   approval's decision; the canvas highlights the path the request
   takes, and the panel lists every step's outcome (rules that fail,
   who approves after segregation of duties and delegation, escalation,
   the notifications in both languages) and the **write-back payload
   preview** (values after transformations and code translation, length
   warnings). Nothing is written, sent or approved. In the product the
   test run calls the workflow service; scripts run in the workers.
6. **Validate** runs definition checks (no template, no approver,
   fewer than two parallel groups, a missing message in either
   language, missing rule or comparison source, unmapped key fields,
   fields or step outputs that do not exist).
7. **Compare** the draft with another saved version: added and changed
   steps are marked on the canvas, with what changed per step.
8. **Submit for publishing**: the version is read-only and goes to the
   **domain owner** for approval, or to the **data governance board**
   when the owner designed the workflow. Approval publishes it (the
   previous published version is retired); sending it back makes it a
   draft again. Published workflows are immutable; running instances
   keep their version. The flow compiles to BPMN 2.0 for Flowable on
   publish; "Export BPMN" shows the result.
9. **Runs** shows the published version on the canvas with per-step
   numbers from the engine history (started, failed, waiting, average
   time, SLA breaches) and the requests waiting at a selected approval.
10. Tag the workflow with entity/domain so request forms (J3) can offer
    it as applicable.

*Edge cases:* deleting a node running instances rely on → blocked on
the published version, allowed in a new draft; unpublish stops *new*
selections, never running instances; a parallel group or approver
left with nobody after segregation of duties escalates; a test run of
a script other than the known sample is not simulated in the browser.

## J8 — Retired (ADR-0004)

There is no Python Workspace screen. Custom Python is written and
test-run in the **Script** step of the flow designer (J7) and runs in
`repoio-python-runtime` isolated workers as the requesting user, with
packages from the approved pinned image (no run-time `pip install`).
Exploration belongs in the data platform; bulk fixes go through
bulk-upload change requests.

## J9 — Administer connections & write-back

1. The Admin (holding `administer connections`) opens the
   **Connections hub** in the Admin area.
2. Register a connection: name, type (`sap_c4c`, `sap_erp`,
   `sqlserver`, `databricks`, `snowflake`, `data_fabric`, …), endpoint
   URL, auth method.
3. The token is **entered once and stored in the secret store** (Vault
   / Azure Key Vault); the registry keeps only a reference and a masked
   hint. Token material never appears in the UI again, in Postgres, or
   in logs.
4. **Test connection** verifies live health; periodic health checks
   surface failures in the console and alerting.
5. Source connections feed ingestion connectors and write-back
   adapters from the same record — one credential config per system.
6. Data-platform connections default to **federation**: the platform
   reads golden tables through the Iceberg REST catalog under a granted
   identity — zero-copy, no export pipeline.
7. Every connection change lands in the audit trail (who, what, when).

*Edge cases:* secret store unreachable → connection save fails safely
(no plaintext fallback anywhere); connection in use by a running
workflow → deletion blocked, deprecate instead.

## J10 — Monitor pipelines & data quality

1. The Data Engineer opens **Pipeline runs**: ingestion batches,
   streaming jobs, checkpoints, consumer lag.
2. A failing run shows its stage (standardise / DQ / match /
   survivorship), the error, and the affected records.
3. **DQ failures route to a review / dead-letter path** — never
   dropped silently, never blocking the whole stream.
4. DQ suites and results are inspectable per run (Great Expectations
   results surfaced, not summarized away).
5. A Folders panel groups jobs as domain → repository → kind (sync,
   stream, dq) and platform → kind, the same tree as the Airflow
   Folders panel (ADR-0005); choosing a folder filters the runs.
   The runs list filters by job, type, run-as user, time range, status,
   run ID and error code, and shows finished runs over time and the top
   error types. A run opens a monitor view: the job and its runs on one
   side, the run's tasks, objects, messages and metrics on the other.
6. Airflow-orchestrated runs (pull ingest, DQ runs, housekeeping) link
   to the DAG run and to each task in Airflow. The link base comes from
   the Airflow connection; Airflow applies its own access rules. DAGs sit
   in the same domain → repository folders as the console (ADR-0005).

*Edge cases:* DLQ growth alert leads here; replaying a batch is an
explicit governed action with an idempotency guarantee, not a button
that "runs it again".

## J11 — Browse the ontology

1. The user opens the **ontology browser**: business concepts, their
   properties and relationships (Cytoscape.js graph embedded in
   OpenUI5).
2. A concept page shows its meaning, links to canonical Repo.io entity
   IDs, glossary terms, KPIs and catalog assets.
3. SPARQL-backed search runs through the permission-filtered endpoint —
   never an unrestricted query interface.
4. Ontology changes are versioned, reviewed and audited like every
   other governed artifact.

## J12 — Build & govern entity relationships

Steward-only by design: creating, editing and retiring relationship
links are steward RBAC actions (relationship-authoring role granted by
Admin); every other role reads.

**Mode 1 — per record (Relationship builder):**

1. The Data Steward opens the **Relationship builder** (Business
   operation → Relationships; also reachable from any golden record's
   "Add relationship" action, pre-filled with that record).
2. Picks the relationship **type** — the dropdown offers only types
   valid for the chosen from→to domain pair, served by the type
   catalog managed in the Ontology Explorer (seed catalog: README
   §2.3). System-written types (`same_as`, match links) are never
   offered.
3. Picks the **from** and **to** golden records through search pickers
   scoped to granted domains — a user granted only `customer` cannot
   build a Product → Product link.
4. Fills the type's attributes (effective dates, share %, role,
   notes) — attributes are defined on the type, never free-typed.
5. The **validation strip** runs live: hierarchy cycle detection
   (A → B → C → A is refused with the path shown), duplicate active
   pair+type check, self-link block, cardinality limits.
6. Submit creates a **relationship change request** — the same state
   machine as any change request: selected workflow, diff-view
   approvals, audit trail. On final approval the edge is written to
   the records' relationship sets and, once the ontology track lands,
   materialized into the RDF graph (Ontology Explorer + record detail
   then show it).

**Mode 2 — bulk upload (Relationships list):**

7. For hierarchy loads and migrations the steward uploads a CSV/XLSX
   of rows (from_master_id, to_master_id, relationship_type, action =
   create|retire, attributes) from the Relationships list.
8. The platform returns a **per-row validation report** (row number,
   accepted / rejected, reason): type valid for the pair, both records
   exist and sit in granted domains, no cycles, no duplicates, no
   self-links. Rejected rows never enter the batch — the steward
   fixes the file and re-uploads (idempotent, no double rows).
9. Accepted rows submit as **one batch relationship change request**
   through a selected workflow; its detail shows per-row outcomes,
   and rows that fail at write-back are marked and re-runnable —
   never silently dropped.

**Editing & retiring:** from the Relationships list or the record's
relationship panel, editing a link (attributes, endpoints) or retiring
it opens the same builder pre-filled and still goes through a change
request — never a delete button.

*Edge cases:* a cross-domain link requires grants on both domains; a
pending request on the same pair+type blocks a second one; batch size
limits are configurable and enforced at the API, not just the UI.

## J13 — Stay informed: feeds & announcements

1. Any user opens **Feeds**: the **Activity** tab shows an event
   stream filtered to their granted domains — record created, merged
   or changed, request submitted / approved / rejected, match
   confirmed, relationship added or retired, workflow completed.
2. The stream is filterable by domain and event type; a user follows
   a domain or a record to keep its events on top. Events without a
   grant never render — server-side, not client-side.
3. The **Announcements** tab lists active and recent announcements;
   pinned ones also render as a strip on Home.
4. An Admin (or a steward granted the action) authors an announcement
   in **Administration → Announcements**: draft → audience (all
   users, a role, a domain) → publish window (from / until) →
   publish. Publishing is audited; retiring removes it from Feeds and
   Home without deleting the history.
5. Nothing here replaces the audit log (forensic) or the notification
   tray (personal, actionable) — Feeds is the awareness layer, backed
   by existing platform events, no new event pipeline.

*Edge cases:* a grant is revoked → events from that domain disappear
from the feed on the next load; an announcement past its window
auto-hides; an empty feed is a friendly state ("no activity yet in
your domains"), not a blank page.

## J14 — Analyse & broadcast reports

*Architecture: root README §2.8 (proposed) and ADR-0003 (export rendering, attachment size).*

1. A user opens **Analytics → Reports**: the same explorer layout as
   the workflows list (collections, facets for type / domain / status
   with counts, full-width table, Previous / Next paging). Only
   reports over domains the user is granted are listed — server-side.
2. An **analytical list** report opens as a Fiori ALP: visual filters
   in the header (selecting a bar, slice or point filters everything
   below; a compact filter bar is the alternative), a main chart with
   "view by" and chart type, chart / chart + table / table modes, and
   the record table. Variants (Standard, saved filter sets) are
   per report; a changed variant shows "*". Rows come from the
   report's governed view filtered by the viewer's grants.
3. A **story** opens in the **Analytics studio** (SAP Analytics Cloud
   pattern): page tabs, a grid canvas of chart tiles, and in Designer
   mode a **Builder** panel for the selected tile — data source,
   chart structure (column, bar, line, donut, stacked, numeric),
   measure and dimension, colour palette, filters. Measures come from
   the governed KPI catalog; the studio never defines formulas. Each
   tile has a "⋯" menu: sort, rank (top N), linked analysis, compare
   to previous period, show / hide labels and legend, duplicate,
   export data, full screen, pin to Home, remove.
4. Saving a published story creates a new draft version; the published
   version stays live until the draft is published.
5. **Analytics → Broadcasts** (SAP C4C broadcast flow): new broadcast
   = object type (report / story) → name → object → view or page →
   email subject and message → recipients → format (Excel, CSV, PDF;
   PDF or PowerPoint for stories) → ZIP → link (sign-in required) →
   schedule (none, daily, weekly, monthly; day, time, start date,
   Africa/Cairo). The list supports Start now, Pause, Resume, Edit and
   Delete, and shows last run (sent / sent with skipped recipients /
   failed) and next run.

*Edge cases:* a recipient without a grant on the report's domain is
skipped and reported (the dialog warns before saving) — a broadcast
never sends data the recipient cannot see in the console; stories are
rendered per recipient with their own grants; links in the email
require sign-in (no anonymous "view without logging in"); only Entra ID
users can be recipients; the attachment is generated per run and never
stored; a file over the relay limit is sent as a link-only email to the
live report (ADR-0003 Part B: 10 MB relay limit); retiring a
report pauses its broadcasts; a failed run is retried at the next
scheduled run or with Start now.

## J15 — Configure a data sync (replication flow)

*Pattern: SAP Datasphere replication flows. Connection = how to reach the
system (J9); sync = what to bring and when; job run = each execution (J10).*

1. The Data Engineer opens **Integration hub → Data sync**: the explorer
   list of replication flows (a Folders tree domain → repository → sync,
   the same as the Airflow Folders panel, ADR-0005; facets: source
   connection, status; last run; delta interval). Tables use SAP icons, never vendor
   logos.
2. **New replication flow** opens an empty canvas with a Source panel and
   a Target panel, following the Datasphere steps:
   - **Select Source Connection:** a compact picker over the connections
     registry, showing health. Credentials are never shown.
   - **Select Source Container:** a C4C OData service, an S/4HANA schema
     or CDS, a SQL Server schema, or an upload folder.
   - **Select Target:** a Repo.io repository. Its model version is the
     target container (in Datasphere this is the space).
   - **Add Source Objects:** browse the container, select objects, **Next**
     to review the target entity proposed for each, then **Add
     Selection**.
3. Each replication object is a row: source object → target entity.
   - The row's additional options (…) can map it to another entity of the
     domain.
   - **Rename is disabled**, since targets are model entities.
4. Selecting an object switches the properties panel to that object, as
   Datasphere does.
   - **General:** the source object and the target entity.
   - **Projections:** one projection per object, added with **Add**. The
     projection dialog has a name and two tabs:
     - **Filter:** pick source columns in the column list, then set their
       expressions.
     - **Mapping:** source columns → model fields in the field mapper,
       with auto-map. Unmapped required fields are listed.

     Apply needs a name and complete filters. Without a projection,
     columns map by name.
   - **Settings:**
     - **Load Type:** "Initial only" or "Initial and delta". Change
       detection comes from the source type: a watermark column, change
       data capture, or a full load per upload.
     - **Delete All Before Loading** reloads raw only. It never deletes
       golden records; rows missing from the source are flagged for
       stewards.
   - **Last run:** initial, delta and rejected record counts.
5. The properties panel shows:
   - **General:** business name, technical name, status, owner.
   - **Run settings:** delta load interval in hours and minutes, or "On
     each upload" for files.
   - The target settings icon shows the fixed target behaviour: delta
     capture in raw, and rejected rows go to Quarantine.
6. Saving a new flow asks for its business and technical name; the
   technical name is fixed after that.
7. **Validate** lists the errors and warnings. **Deploy** is blocked while
   errors remain; it creates the ingest job (an Airflow pull DAG in
   `dags/<domain>/<repository>/sync/`, ADR-0005, or an
   upload endpoint). **Run** starts a run, and the monitor button opens
   that job's runs in Job runs.
8. Editing a deployed flow marks it "Changes not deployed". The job keeps
   the deployed version until the next deploy.

*Edge cases:*
- Rows land in `raw.<entity>` exactly as delivered. Transformations and
  code-list translation belong to standardisation in `repoio-stream`, not
  the sync.
- Rows that fail model validation go to Quarantine.
- A flow can be deleted only if it was never deployed.

## J16 — Manage API access (tokens, webhooks, MCP)

*Pattern: the inbound side of the Integration hub. Connections (J9) is
how Repo.io reaches other systems; API management is how other systems
reach Repo.io.*

1. The Admin (holding `administer API access`) opens **Integration hub
   → API management**. The page is Admin-only; other users never see
   it in the navigation, and its APIs reject them server-side.
2. **API catalog:** the interfaces open to the caller — REST and
   GraphQL for golden records, the SQL endpoint through Trino, MCP —
   by domain and version, each with its status. Opening one renders
   its spec from `repoio-spec`.
   - **Try it** runs the call with the caller's own identity and
     grants.
   - **Download OpenAPI** gives the contract file.
3. **Access tokens — only the Admin generates tokens:**
   - A user who needs API access (e.g. a Data Engineer connecting
     Power BI or Databricks) asks the Admin; users have no
     token-generation screen anywhere in the console.
   - **New token:** owner (a named user or an app registration, never
     empty), name, scopes (read golden records, query SQL, MCP),
     expiry (a maximum is set by deployment config). The value is
     shown **once** to the Admin, then only a masked hint; it is stored
     in the secret store, never in Postgres or logs. The token acts
     with its owner's identity and grants, not the Admin's.
   - The list shows scopes, created, expires, last used; **Revoke**
     takes effect immediately.
   - **App registrations** (Admin): an Entra ID service principal for a
     system consumer (Power BI, a Databricks job). It is approved by
     the Admin and receives roles and domain grants like any user.
   - A token never carries more than its owner's grants; when a grant
     is removed, the token loses it too.
4. **Webhooks:**
   - **New subscription:** destination URL, events
     (`golden.<entity>`, `changes.<entity>`), domain filter. A signing
     secret is generated and stored in the secret store; receivers
     verify each delivery with it.
   - **Send test** posts a sample event. The delivery log shows status,
     response code, attempts and next retry.
   - Payloads contain only what the subscription owner may read.
5. **MCP exposure** (Admin): the role→tool grant matrix (versioned
   configuration), agent policies, and active agent sessions with
   their initiating user. Disabling a tool for a role takes effect on
   the next call.
6. **Usage & limits:** calls, errors and latency per client over time;
   rate limits per client; a warning when a client nears its quota.
7. The **Connection details** tab of a repository shows ready-to-copy
   JDBC / ODBC / Python details for its SQL endpoint, with
   `${REPOIO_SQL_HOST}`-style values from deployment config. For the
   Admin its **Create token** link opens step 3; other users see
   "Ask your administrator for an access token" instead.
8. Every token, webhook, grant and MCP change lands in the audit trail.

*Edge cases:*
- An expired or revoked token is rejected with 401; an ungranted scope
  or domain is denied, never answered with partial data.
- A webhook endpoint that keeps failing is paused after the retry
  policy is exhausted; the owner sees it in the list. A webhook never
  writes to a source system; write-back goes only through a workflow
  with a Write-back Task (J9).
- Secret store unreachable → token or webhook creation fails safely,
  with no plaintext fallback.
- There is no anonymous or shared key, and no shared agent identity.
- The Admin cannot issue a token with more than its owner's grants;
  issuing, revoking and every handover-relevant event are audited with
  both the Admin and the owner.

---

## Out of scope (explicitly)

- **AI agents via MCP** — machine interface; see M5 and the
  `repoio-mcp-identity` skill. Agents follow the same governed paths
  (e.g. writes go through ChangeRequests), but their "journey" is a
  tool contract, not this file.
- **Source-system UIs** (SAP C4C, ERP screens) — Repo.io writes back
  through adapters; users of those systems never see Repo.io screens.

## Maintenance

When a screen's journey changes, update this file in the same change;
when an architecture decision conflicts with a journey, the README wins
and the journey is rewritten. Add journeys for new console areas rather
than stretching an existing one past its milestone.
