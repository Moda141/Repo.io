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
| J8 | Develop & run a governed Python task | Data Engineer | M8 |
| J9 | Administer connections & write-back | Admin | M9 |
| J10 | Monitor pipelines & data quality | Data Engineer | M2/M3 (jobs), M4 (runs UI) |
| J11 | Browse the ontology | Data Steward, Approver | Ontology track |
| J12 | Build & govern entity relationships | Data Steward | M1 (type catalog + CR path), M4 (builder + list UI), Ontology track (RDF materialization) |
| J13 | Stay informed: feeds & announcements | all | M4 (feeds page, Home strip, authoring UI) |

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
   step, properties in a panel beside it. It starts with **Begin** and
   **Template**: exactly one request template, chosen from the published
   templates the user can see; the workflow's domain is that template's.
2. Compose with steps:
   - **Approval** — named people (one or more) or a team; any one or
     all; SLA with reminder and escalation to a person or team;
     branches *approved* / *rejected*.
   - **Validation** — a data quality rule (Great Expectations) on the
     template's fields, or a duplicate check (Splink) against the chosen
     source (the domain's golden records or a source connection) with a
     threshold; branches *passed* / *failed*.
   - **Script** — choose the language (Python, or read-only SQL) and
     write the code in the step, with the template's field names offered;
     runs in the isolated workers as the requester (M8).
   - **Write-back** — source system, then map template fields to the
     target system's allowlisted fields in the side panel's **Mapping**
     section (code lists
     translated by reference data); conflict → review (execution M9).
   - **Notification** — in-app alert and/or email to the requester,
     earlier approvers, teams or people.
   - **Condition** (branch on a template field) and **End** (completed /
     rejected / cancelled).
3. Every branch ends in an End by construction; removing a step removes
   its side branch after a confirmation.
4. The flow compiles to BPMN 2.0 for Flowable on publish; "Export BPMN"
   shows the result.
5. **Validate** runs definition checks (no template, no approver,
   missing recipients or message, missing rule or comparison source,
   unmapped key fields, fields that are not in the template).
6. Save as new version; **publish** freezes it. Published workflows
   are immutable; running instances keep their version.
7. Tag the workflow with entity/domain so request forms (J3) can offer
   it as applicable.

*Edge cases:* deleting a node running instances rely on → blocked on
the published version, allowed in a new draft; unpublish stops *new*
   selections, never running instances.

## J8 — Develop & run a governed Python task

1. The Data Engineer opens the **Python Workspace** (Monaco editor
   inside OpenUI5): script explorer, tabs, run controls.
2. Edit script; declare a pinned dependency manifest alongside.
3. **Run** submits to `repoio-python-runtime` disposable workers —
   never inside an API process. CPU/memory/time limits apply.
4. Follow the run: status, logs, errors, DataFrame/sample preview of
   outputs.
5. Promote a script version for workflow use: a **Python Script Task**
   in a published workflow (J7) invokes it with the same worker
   isolation and the initiating identity audited.
6. New dependencies go through: pinned manifest → approval → approved
   registry → scan → immutable image. No runtime `pip install`.

*Edge cases:* run killed at the limit → partial outputs clearly marked,
no orphaned state; package out of allowlist → rejected with the policy
reason; execution without permission → denied at the API, not
disabled-looking UI.

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
