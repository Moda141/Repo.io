# Repo.io — UI Pages (console navigation map)

> v0.7 — added Feeds (Activity + Announcements) and Announcements
> authoring in Administration; v0.6 — shell locked: Tool Page Layout +
> sap.tnt.SideNavigation (with search) on the Quartz Light theme;
> v0.5 — added the Relationships group (Relationships list +
> Relationship builder): steward-owned governed instance links,
> edited per record or by bulk upload — always as change requests;
> v0.4 — the proposal applied, risks resolved and gap decisions
> locked; v0.3 added Reference data management; v0.1 was the agreed
> tree.
> Markers: **(+)** page added by the proposal · **(→)** renamed or scope
> clarified · unmarked pages are exactly as agreed in v0.1.
> Each page carries a one-line scope and its journey mapping
> (J1–J13 from `docs/user-journey.md`). The conflict-check log is at the
> end of this file.

## Navigation tree

1. **Home** — personal dashboard: golden-record counts per domain, my open
   items, pipeline health summary, inbox badge, an announcements strip
   (pinned / active), language switch. [J1]
2. **Explore** — search & browse golden records across granted domains;
   record detail with attributes, contributing sources, match confidence,
   lineage, relationship links, field-level change history; explicit
   "Request a change" and "Add relationship" entries.
   Golden records are never edited inline. [J2]

3. **Feeds** — the awareness surface; one page, two tabs:
   **Activity** — an event-driven stream for the domains the user can
   see (record created / merged / golden field changed, request
   submitted / approved / rejected, match confirmed, relationship
   added or retired, workflow completed), permission-filtered by the
   same role→domain grants, filterable by domain and event type, with
   follow on a domain or record; and **Announcements** — the full
   read list of platform announcements (active and recent). The feed
   is for awareness, never a compliance record — the audit log
   remains the forensic source. Backed by a control-plane activity
   table fed from existing platform events (CR transitions,
   `changes.<entity>` topics, match confirmations) — no new event
   pipeline. [J13]

4. **Business operation**
   - **Favorites** — *personal shortcuts: filtered views over the same
     APIs, no separate authority*
     - **(+) Awaiting my approval** — approver inbox: requests needing my
       action, diff against current golden values, approve / reject with
       mandatory comment. Also surfaced on Home and via the top-bar
       inbox badge — never reachable only through Favorites. [J4]
     - **My repo** — pinned shortcut to the repositories I work in
       daily. [J2]
     - **My requests** — my submissions: status, selected workflow,
       outcome. [J3, J4]
   - **Domain management** — manage master-data domains (Customer, Vendor,
     Product…) and the repositories inside each (a domain holds one or
     more — ADR-0001): per repository its assigned model, golden records
     it holds, contributing data sources, ID prefix, owner team, status;
     per data source the repositories it feeds; per field the
     repositories and model attributes it maps to. Prototype:
     `repoio-ui/design-reference/prototypes/02-domains.html`.
   - **Golden Records management** — steward working area over the records
     themselves: browse per domain, inspect, review states, history.
     Shares the record-detail component with Explore. [J2, J5]
   - **Relationships** — *steward-owned governed links between golden
     records (customer hierarchies, product relations) — instance
     links, not types; the type catalog lives in the Ontology
     Explorer; creating / editing / retiring is a steward RBAC
     action, every other role reads*
     - **(+) Relationships list** — all relationship instances per
       domain: from → type → to, status (pending request / active /
       retired), attributes, evidence and approval trail; edit or
       retire only via change requests. **Bulk upload** lives here:
       the steward uploads a CSV/XLSX of (from, to, type, action,
       attributes) rows, gets a per-row validation report (type valid
       for the pair, both records exist and granted, cycle /
       duplicate / self-link checks), accepted rows submit as one
       batch relationship change request — rejected rows never enter
       it, and re-upload is idempotent. Same edge data as the
       record-detail panel and the Ontology Explorer graph. [J12]
     - **(+) Relationship builder** — the per-record mode: build or
       edit one governed link. Type dropdown filtered by the from→to
       domain pair (served by the Ontology Explorer type catalog),
       both golden records picked through search pickers scoped to
       granted domains, the type's own attributes (effective dates,
       share %, role…), a live validation strip (hierarchy cycle
       detection, duplicate pair+type, self-link block), then submit
       as a relationship change request through a selected workflow.
       Editing an existing link opens the same form pre-filled and
       still submits as a change request. System-written types
       (`same_as`, match links) are never offered here. [J12]
   - **Change requests management**
     - **Open change requests** — the domain-wide in-flight queue
       (steward / manager view); write-back conflict reviews surface
       here (conflicts route to review, never a silent overwrite),
       with the affected system named. [J4]
     - **Change requests templates**
       - **(→) Templates catalog** — what requesters pick from:
         role-filtered, grouped by domain; opens the request form with
         reference lists and duplicate check. [J3]
       - **(+) Template authoring** — steward side: draft → approve →
         publish, versioning, archive, visibility preview. [J6]
     - **(+) Reference data management** — governed code lists per
       (domain, source/target system pair): values, versions, activation;
       served to request forms as dropdowns — governed values are never
       free-typed, switching the target system re-filters the lists live.
       Steward-maintained. [supports J3]
   - **Data Quality management**
     - **Test cases** — Great Expectations suites: definitions, entity /
         model bindings, per-run results. [J10]
     - **Alerts** — operational alert rules (quality, ingestion,
         approvals) and their routing. [J10]
   - **Stewardship management**
     - **Match detection** — scored-pairs review queue: side-by-side
       compare, score breakdown, confirm / reject with note. [J5]
     - **Quarantine** — records held by DQ failures: inspect, resolve,
       reprocess. [J10]
     - **(→) Models & rules** *(was "Modules management")* — the mastering
       modules per domain: entity schema authoring (against
       `repoio-spec`), model versions, match rules, survivorship rules.
       Domain management links a model to its domain; this page owns the
       model itself. [J5]

5. **Ontology Explorer** — business-concept graph: classes, properties,
   the relationship **type catalog** (including same-entity types:
   customer ↔ customer, product ↔ product — seed catalog in README
   §2.3; type authoring included: types defined per from→to domain
   pair with inverse, cardinality and attributes); concept pages
   linked to canonical entity IDs, glossary terms, KPIs; glossary and
   concept **authoring included** (versioned, reviewed, audited like
   every governed artifact); permission-filtered SPARQL search.
   Instance edges render here with their change-request provenance.
   [J11, J12]

6. **Workflows**
   - **Workflows list** — published and draft workflows, versions, running
     instances. [J7]
   - **New workflows** — the Repo.io flow designer (ADR-0002): step cards
     Begin → Template (one) → Validation / Approval / Script / Write-back /
     Notification / Condition → End, "+" to add a step, properties panel,
     Datasphere-style field mapper for write-back, code editor for
     Script; validate, version, publish, export the compiled BPMN. [J7]

7. **System & Administration**
   - **Analytics**
     - **(→) Reports** *(was "Reports lists")* — report definitions over
       golden data and platform metrics.
     - **Broadcasts** — scheduled distribution of reports to stakeholders
       (delivery, not operational alerts).
   - **Administration**
     - **User management** — users, teams, invites.
     - **(+) Roles & access** — roles, domain grants, delegation; the
       server-side source of every page's visibility. [M5]
     - **System configuration** — platform-wide settings: auth / SSO,
       preferences, custom properties.
     - **(+) Announcements** — authoring side of the read views on
       Feeds and Home: draft → audience (all users, a role, a
       domain) → publish window (from / until) → publish; pinned
       flag, retire, history. Publishing is an RBAC action (admin or
       a granted steward), audited like every governed artifact. [J13]
     - **Audit log** — platform-wide audit trail: who, what, when, which
       version. [cross-cutting UX rule 4]
   - **Integration Hub**
     - **(→) Connections** *(was "Data source")* — one registry entry per
       external system (SAP C4C, SAP ERP, SQL Server, Databricks,
       Snowflake, Data Fabric…): endpoint, auth method, token stored once
       in the secret store, health checks; feeds ingestion, write-back
       and federation from the same record. [J9]
     - **API management** — Admin-only page (`administer API
       access`); the inbound side of the hub: how apps, BI,
       data platforms and AI agents reach Repo.io (Connections is the
       outbound side). Five tabs [J16, M5]:
       1. **API catalog** — published interfaces (REST and GraphQL for
          golden records, the SQL endpoint through Trino, MCP) by
          domain and version, with status (active / deprecated). The
          spec is rendered from `repoio-spec`; "Try it" runs as the
          caller; OpenAPI download. Read-only — the page displays the
          contract, it never owns it.
       2. **Access tokens** — **only an Admin generates tokens.** Each
          token is issued to a named owner — a user or an app
          registration (Entra ID service principal, granted roles and
          domains like any user) — never to nobody. Scopes, expiry,
          last used, revoke; the value is shown once to the Admin;
          stored in the secret store. Users cannot generate tokens. No
          shared or anonymous key, no shared agent identity.
       3. **Webhooks** — subscriptions to `golden.<entity>` /
          `changes.<entity>` events: destination
          (`${WEBHOOK_URL}`-style, admin-configured), events, domain
          filter, signing secret in the secret store, delivery log,
          retries, test delivery. Payloads are filtered by the
          subscription owner's grants. Notification only — never a
          write-back path.
       4. **MCP exposure** — tools enabled per role (the versioned
          role→tool grant matrix), agent policies, active agent
          sessions with their initiating user. Agents act with that
          user's scopes; every call is audited.
       5. **Usage & limits** — calls, errors and latency per client;
          rate limits and quota warnings; call log popup.
       - **API reference** (sub-page) — every API family rendered from
         the OpenAPI 3.1 contract in `repoio-spec` with Swagger UI inside
         an OpenUI5 control; each operation shows the milestone it lands
         with and its required grant; OpenAPI download. "Try it out"
         runs as the signed-in user through the gateway.
     - **Data sync** — what syncs and when: sync configurations,
       schedules and field mappings per connection (configuration, not
       runs).
     - **Data jobs** — execution observability: ingestion batches,
       streaming checkpoints, consumer lag, governed replay. [J10]

## Layout notes — cross-cutting components (not pages)

### Shell & theme (locked in v0.6)

- **Shell** — the console is a Tool Page Layout: `sap.tnt.ToolPage`
  with a `sap.tnt.ToolHeader` on top and `sap.tnt.SideNavigation` as
  the navigation panel (reference sample:
  `sap.tnt.sample.SideNavigationSearch` in the OpenUI5 SDK).
- **Side navigation with search** — the SideNavigation renders the
  full tree below (Home · Explore · Feeds · Business operation ·
  Ontology Explorer · Workflows · System & Administration) and carries the
  built-in search field that filters navigation items live. It is
  collapsible to an icon rail; in RTL the panel flips to the right
  automatically. `sap.tnt` and `themelib_sap_fiori_3` both ship in
  the OpenUI5 distribution (verified in the SAP/openui5 repo) — no
  SAPUI5-only exception needed.
- **Theme** — **Quartz Light** = `sap_fiori_3`, applied at bootstrap
  for the whole console; dark mode (Quartz Dark, `sap_fiori_3_dark`)
  is not scoped in v1.
- **Navigation items come from APIs** — the tree renders from the
  same server-filtered APIs that drive page visibility (role→domain
  grants); hiding an item client-side is presentation, never
  authorization (cross-cutting UX rule 1). The shell owns zero
  business logic.
- **Global search (refines G5)** — the persistent search lives in the
  SideNavigation per the chosen sample (instead of the top bar); when
  the panel is collapsed, the ToolHeader keeps a search affordance
  reachable. Scope unchanged: golden records, requests, templates and
  ontology concepts. Explore remains the full discovery workspace.

### Components

- **Notification tray** — a top-bar tray for personal events (request
  approved / rejected, assigned to me, write-back conflict raised);
  operational alert *rules* stay in Data Quality → Alerts.
- **Collapsible sidebar, RTL-first** — Business operation holds 17 pages
  under 8 groups; the SideNavigation must collapse to group level and
  both Arabic RTL and English LTR must pass on every screen.

## Conflict check (v0.7)

### Internal — overlaps found and resolved

| # | Pair | Risk | Resolution |
|---|------|------|------------|
| 1 | Data sync vs Data jobs | Both "moving data" | Split by layer: sync = configuration & schedules; jobs = runs & monitoring |
| 2 | Alerts vs Broadcasts | Both "notifications" | Alerts = operational events (DQ / ingestion / approvals); Broadcasts = scheduled report delivery |
| 3 | Templates catalog vs Template authoring | One page, two RBAC worlds | Split: catalog is the requester entry (J3); authoring is the steward pipeline (J6) |
| 4 | Awaiting my approval vs Open change requests | Two request queues | The Favorites item is a personal filtered view of the same API; the queue page is the domain-wide monitoring view — no separate authority |
| 5 | My repo vs Golden Records management vs Explore | Three ways to reach a record | One shared record-detail component; three entry points: pinned shortcut / steward workspace / universal search |
| 6 | "Modules management" ambiguity | Unclear scope | Renamed "Models & rules" = model versions + match rules + survivorship rules — distinct from Domain management (the parent record) and from Golden Records management (the data) |
| 7 | Match detection vs Quarantine | Two review queues | Different pipelines: match = potential duplicates (scored pairs); quarantine = DQ-held records |
| 8 | Domain management vs Roles & access | Both "who owns what" | Domain management = the master-data domain record (repo, model, owner team); Roles & access = which users see / act on it |
| 9 | Reference data management vs Templates catalog / authoring | Both feed the request form | Templates define the **form structure** (fields, pre-fill, match_check); reference data supplies the **governed values** the form's reference-list fields point to — separate authoring, joined only at rendering |
| 10 | Reference data management vs Domain management | Both "per domain" | The domain enum itself is fixed by Entity Coverage and owned by Domain management; reference lists are assigned per (domain, source/target system) pair and never redefine the enum |
| 11 | Reference data management vs Test cases | Values vs checks | DQ test cases may *validate against* reference lists; reference data is the source of truth for the values — the dependency points one way |
| 12 | Relationship builder vs Golden record detail | Two ways to create an edge | One shared builder component: the record detail's "Add relationship" opens the same builder pre-filled with that record; the standalone page is the blank-canvas / bulk entry |
| 13 | Relationships list vs Ontology Explorer | Both show the graph | The list is tabular lifecycle management over instances (steward actions); the Explorer is visual traversal of types + instances (read/consume) — same data, two lenses |
| 14 | Relationship builder vs Templates catalog | Both create governed changes | Templates produce field-level change requests for one record; the builder produces relationship change requests (an edge payload) — both flow through the same CR state machine and workflows |
| 15 | Match detection vs Relationship builder | Both link records | Match links (`same_as`) are system-written identity resolution from confirmed scored pairs; business relationships are human-declared semantics built in the builder — the builder's type picker excludes system-written types |
| 16 | Bulk upload vs Relationship builder | Two edit modes for the same data | One governed path, two input modes: the builder authors per record; bulk upload authors per file — both produce (batch) relationship change requests through the same state machine, validation and audit; both steward-only |
| 17 | Feeds vs Notification tray | Both "events" | The tray holds personal, actionable events addressed to the user (approve this, your request was rejected); the feed is a browsable stream of platform activity — broadcast, not addressed. Both exist |
| 18 | Feeds vs Audit log | Both "what happened" | The feed is a human-readable, permission-filtered awareness stream; the audit log is the forensic record of every state change (who, what, when, which version) — the feed never replaces it and derives from it |
| 19 | Announcements vs Broadcasts | Both "push to people" | Announcements = console messages to users (maintenance, policy, releases) rendered on Feeds and Home; Broadcasts = scheduled delivery of report artifacts to stakeholders — different payload, different channel |
| 20 | Announcements authoring vs Feeds / Home read views | One artifact, many surfaces | Authoring lives in Administration → Announcements (RBAC action); the Feeds → Announcements tab and the Home strip are read-only views of the same published announcements |

### Journey coverage — all 13 journeys have a home

J1 Home · J2 Explore + Golden Records management ·
J3 Templates catalog (served by Reference data management) ·
J4 Awaiting my approval + Open change requests · J5 Match detection ·
J6 Template authoring + Reference data maintenance · J7 Workflows ·
J8 retired (ADR-0004) · J9 Connections ·
J10 Data jobs + Test cases + Quarantine + Alerts ·
J11 Ontology Explorer · J12 Relationships list + Relationship builder
(types from the Ontology Explorer catalog) · J13 Feeds (Activity +
Announcements) + the Home strip, authored in Administration →
Announcements. The v0.4 flag is closed:
reference-data maintenance is folded into J6; relationships got J12.

### Risk & gap resolutions locked in v0.4

| # | Item | Resolution |
|---|------|------------|
| R1 | README domain model conflict (blocker) | README §2.6/§3 + CLAUDE.md + milestone-plan + user-journey + templates-refdata skill all updated to entity-type domains, fed by every business line's sources. Amended by ADR-0001: a domain holds one or more repositories |
| R2 | "Awaiting my approval" buried in Favorites | Also surfaced on Home and the top-bar inbox badge |
| R3 | Business operation depth (13 pages) | Collapsible sidebar, group-level collapse, RTL-first layout note added |
| G1 | Write-back conflict reviews had no home | Surface inside Open change requests detail, system named |
| G2 | Personal notifications had no home | Top-bar notification tray (component, not a page); alert rules stay in DQ |
| G3 | Glossary authoring undefined | Included in Ontology Explorer, versioned and audited |
| G4 | Model schema authoring undefined | Models & rules owns schema + match + survivorship; Domain management only links |
| G5 | Global search undeclared | Persistent top-bar search component on every page |

### External — resolved in v0.4

- ~~The root README defined domains as **organizational lines** (sales,
  procurement, publishing, hr, retail).~~ **Fixed in this version:** the
  root README (§2.6, §3) now defines a domain as a **master-data entity
  type** (Customer, Vendor, Product, Author, Employee, Store — the
  Entity list in §3) holding one or more repositories (ADR-0001), fed by every business
  line's sources (SAP C4C, Pharma ERP, Retail POS). The same fix landed
  in CLAUDE.md (rule 14), `docs/milestone-plan.md` (M1 acceptance),
  `docs/user-journey.md` (J6) and the `repoio-templates-refdata` skill
  (enum, data-model sketch, verification). No kit file now contradicts
  this tree.
