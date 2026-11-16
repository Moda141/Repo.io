# repoio-openui5-prototype

> Status: **prototype** (design reference, not the product console)
> Milestone: enabler for M4 — the visual and interaction contract for the OpenUI5 console
> Owner domain: ui5

## Purpose

A clickable OpenUI5 prototype of the Repo.io console, built only from OpenUI5
1.136 (LTS) controls on the locked shell and theme: `sap.tnt.ToolPage` +
`ToolHeader` + `SideNavigation`, theme `sap_fiori_3` (Quartz Light), Arabic RTL
and English LTR. It shows how each approved page looks and behaves before M4
implements it against real APIs.

It deliberately does **not** call any backend. Every number, name and record
comes from `webapp/model/*.json` and is illustrative sample data
(CLAUDE.md §6 rule 2 applies to the product, not to this prototype). Do not
copy that data into `repoio-ui`.

## Pages

Layouts follow SAP Datasphere, drawn with OpenUI5 controls on the locked
Quartz Light theme. The kit's theme is unchanged; only the page layouts follow
Datasphere.

Scope is deliberately narrow for now: only Home, Domain management,
Connections (with CSV / Excel import), the Ontology Explorer, the Workflows
list, New workflow and Data jobs (job runs and run details) are designed. The domain detail, repository, data source, table, golden record
and Explore pages were removed at the owner's request; their code is in git
history. Every other navigation item opens the planned-page placeholder.

| Route | Page | Datasphere layout it follows |
|-------|------|------------------------------|
| `#/` | Home (J1) | Datasphere Home: compact hero banner (image kept, smaller; two-line brief, "Learn more" opens a summary of what the tool does), announcement strip, "needs me now" tiles (awaiting my approval, overdue requests, new data quality issues, failed write-backs; each opens its list), welcome card with three getting-started steps (done steps ticked, progress, Hide; hides itself when all are done), recent files, then the J1 cards (quick actions, golden records per domain, awaiting approval, open items, pipeline health, completeness, merge candidates, stewards, owner, run schedule) — drag to reorder, show or hide |
| `#/domains` | Domain management | Catalog: dark search header (scope select + search), type tabs (all, domains, repositories, data sources, tables, favorites, recent), filter panel (domain, status), asset cards or list; quick view, copy link (`#/domains/{item}`), favorites. A repository's quick view has **Connection details** (ADR-0006): tabs JDBC, ODBC, Python, Databricks (Spark catalog over the Iceberg REST catalog) and Snowflake (catalog integration), each with copyable values and a snippet using deployment placeholders, and a link to create a token in API management |
| `#/connections` | Connections (J9) | Datasphere Connections: registry table (logo, technical name, type, category, features, status, last sync, owner) with create / edit / delete / validate / pause / resume. "Create Connection" dialog in three steps like Datasphere: 1 choose type (filters by feature, category, source + type tiles for SAP HANA, SAP Cloud for Customer, Microsoft SQL Server, CSV / Excel), 2 configure properties (per-type form; secrets go to Key Vault, only a reference is kept), 3 business and technical name, owner, description. **Upload file** on a CSV / Excel connection opens the Datasphere "Import CSV File" dialog: file (.csv / .txt / .xlsx), first row as header, missing value as NULL or empty, delimiter (auto-detect) and encoding (UTF-8 / Windows-1256) or sheet, target entity (→ `raw.<entity>`), data preview with a source → target field mapping per column (auto-mapped, required fields and duplicates checked); import sends a batch to push ingest, never to golden records. Parsing runs in the browser (`util/tabular.js`, no third-party parser); the server re-validates every row. The business name opens **connection details**: Overview (technical name, type, endpoint placeholder, authentication, secret reference with the value masked, features, last health check, owner), **Used by** (data sync flows and workflows whose Write-back Task targets it) and **History** (created, edited, schedule, secret rotated, paused / resumed, deprecated). Deleting a connection that anything uses is blocked; **Deprecate instead** keeps it serving what uses it and hides it from new picks |
| `#/ontology` | Ontology Explorer (J11, J12) | Datasphere Graph Builder: left tabs (concept tree with relationships and data properties; relationship type catalog grouped by from → to pair), Cytoscape.js graph in the Ontology Studio spirit (light dotted canvas; concepts as white cards with a coloured border per category and a blue pill with the number of golden records, sub-concepts included; records as filled circles; relationship types teal, is-a dashed violet; top-down hierarchy layout by default; a floating control pill with fit, layout, labels and a zoom slider; a status bar with model size, Turtle triple count and the checks result; record counts in the concept tree) (parallel relationship types between two concepts grouped into one line with a count, tap to show them; unlinked concepts hidden behind a toggle; tree icons by concept category) in the centre (show/hide relationship types, semantic properties and is-a; network, hierarchy or rings layout; zoom, fit, focus mode), details panel on the right (concept: business name, URI local name, description, parent concepts, owner, links to canonical entity / glossary / KPI / catalog asset, data properties, relationships; relationship: from → to, inverse, cardinality, attributes, governance note). Concepts / Records switch: from a concept or a relationship type, "View record links" drills down to the governed links between golden-record codes (e.g. C-10001 parent of C-10002) as a graph with a Datasphere-style "Data preview" table docked under it (the graph stays visible; a row zooms the graph to that link), filtered by domain, type and code; a link shows its attributes, status (active / pending approval) and provenance (change request or match confirmation). Versions (draft / in review / published / retired): new concept and new relationship type go into the draft, which is submitted for review; validate (SHACL-style checks), preset SPARQL queries on the secured endpoint, Turtle export |
| `#/workflows` | Workflows list (J7) | Datasphere Repository Explorer: search on top ("Search in: <collection>"), a filter toggle and actions (new: blank or copy of the selected; edit, which opens a new draft version for a published workflow; export BPMN; retire published workflows; delete drafts only), a filter panel with Collection (all, recently changed, my workflows, shared with me, favorites) and "Filter by" facets with counts (domain, status, write-back target), and a full-width table (business name, technical name, domain, template, version, status, steps, write-back, runs in 30 days, owner, changed on, favorite) with Previous / Next paging |
| `#/workflows/new` | New workflow (J7, ADR-0002) | Repo.io flow designer like the reference image: step cards on a dotted canvas with "+" on every path, automatic lane layout (RTL mirrored), zoom bar; properties panel per step. Steps: Begin, Template (one per workflow, its fields drive everything after), Validation (Great Expectations rule on template fields, or Splink duplicate check against golden records or a source connection, threshold), Approval (people or team, any / all, SLA, escalation), Script (Python or read-only SQL written in the step with CodeMirror 6, template fields as autocomplete and chips), Write-back (connection, and a Mapping section in the side panel: Datasphere-style field mapper to the target allowlist with All / Mapped / Unmapped, search, auto-map, code-list value translation), Notification (in-app and/or email, recipients, message in Arabic and English with variables), Condition (yes / no, on template fields or outputs of earlier steps), End. Approval: one group or parallel groups, return for rework, segregation of duties, out-of-office delegation. Template version pinning with upgrade impact and migration. Mapping transformations (constant, combine, truncate, upper, trim, default) with preview. Test run with a sample request (path highlight, step outcomes, write-back payload preview), Compare with another version, Runs overlay of the published version, New: blank or copy of an existing workflow, minimap. Validate, undo / redo, save version, submit for publishing (domain owner or governance board approves), new version, Export BPMN (the compiled BPMN 2.0 that Flowable receives) |
| `#/analytics/reports` | Reports list (J14) | Same Repository Explorer layout as the workflows list: search, actions (new story or analytical list report, copy; edit in the studio; broadcast; export definition; retire published; delete drafts), collections (all, recently changed, my reports, shared with me, favorites), facets with counts (type, domain, status), full-width table (business name, technical name, type, domain, data source, status, views in 30 days, broadcasts, owner, changed on, favorite), Previous / Next paging |
| `#/analytics/reports/{id}` | Analytical list report (J14) | SAP Fiori ALP: variant menu (Standard, Cairo schools, Low data quality; "*" when changed), visual filters in the header (business line bars, source system donut, DQ score line; selecting filters everything, tokens with clear), compact filter bar alternative, main chart with view by (region, business line, source, DQ score) and chart type, chart / hybrid / table modes, record table with DQ score states and paging; broadcast and share. Sample data only for "Customer golden records" |
| `#/analytics/studio/{id}/{mode}` | Analytics studio (J14) | SAP Analytics Cloud story designer: toolbar (save, insert chart / numeric point, story filter, linked analysis, broadcast, Designer / View), page tabs, grid canvas of tiles, tile "⋯" menu (sort, rank, linked analysis, compare, show / hide labels and legend, duplicate, export, full screen, pin to Home, remove), Builder panel (data source, chart structure, measure, dimension, colour, filters). Measures come from the governed KPI catalog. `id` = `new` opens an empty story |
| `#/analytics/broadcasts` | Broadcasts (J14) | SAP C4C broadcast flow in the explorer layout: list (name, object, format and ZIP, schedule, recipients, last run with skipped / failed details, next run, owner, status), Start now / Pause / Resume / Edit / Delete; new broadcast dialog (object type, name, object, view or page, subject, message, recipients with an access warning, format, ZIP, sign-in link, schedule). `?report=<id>` opens a new broadcast for that report |
| `#/integration/sync` | Data sync (J15) | Replication flows in the Repository Explorer layout: actions (new, edit, deploy, run, delete never-deployed), collections (all, my flows, needs attention), a Folders tree like the Airflow Folders panel (`domain / repository / sync`, ADR-0005) with a `dags / …` breadcrumb, facets with counts (source connection, status), table (business name, technical name, source connection with its SAP icon, target repository, objects, load type, delta interval, status, last run, owner, changed on), Previous / Next paging |
| `#/integration/sync/{id}` | Replication flow editor (J15) | Laid out like the SAP Datasphere replication flow editor: grouped toolbar (General: save / deploy / run; Edit: Add Projection; Tools: validate, Job runs; Details toggle); three columns — source (connection + container with browse icons, Objects (n) with add and search), Projections (n) / Settings (load type, truncate per row), target (repository + model container, settings, objects with additional options); Replication Flow / Object Properties panel with collapsible General (including the Airflow DAG ID and DAG file path of ADR-0005), Run settings (delta load interval), Run Status. Dialogs as in Datasphere: Select Source Connection / Container / Target Repository (technical name, business name, type, description), Select Source Objects (Available → Next → Selection with location and status → Add Selection), projection (Filter: column list, Add Filter for, Add Expression, Filter Expression; Mapping: field mapper) |
| `#/integration/api` | API management (J16, Admin only) | The inbound side of the Integration hub, five tabs. **API catalog:** published interfaces (REST and GraphQL golden records, the Trino SQL endpoint, MCP) with type filter, domain, version, status (deprecated with its sunset date), base address as a deployment placeholder; the spec dialog lists the operations from `repoio-spec`, Try it (runs as the caller) and Download OpenAPI. **Access tokens:** only an Admin generates tokens; each token has a named owner (user or app registration) and acts with that owner's grants; scopes (read, SQL, MCP), expiry up to 180 days, masked hint, last used, expiring-soon warning, revoke; the value is shown once with a hand-over warning (key vault or encrypted message). App registrations (Entra ID service principals) with register and approve. **Webhooks:** subscriptions on `golden.<entity>` / `changes.<entity>` with destination placeholder, events, owner, last delivery, success rate, pause / resume, send test, delivery log; signing secret in the secret store, never a write path. **MCP exposure:** the role → tool grant matrix (write tools marked "via change request"), saved as a new version; active agent sessions with their initiating user. **Usage and limits:** calls per day per client (ECharts), errors, p95 latency, today against the daily limit with a warning at 80%; a call log popup, opened from a client row or the Call log button for all clients (time, client avatar, interface, operation, response with the reason for denied / rate-limited / failed calls, duration, rows, token hint, request ID; filters by client, type and result; search; CSV export; paging) — metadata only, never payloads |
| `#/integration/api/reference/{api}` | API reference (J16) | Every API family (golden records, change requests, templates and reference data, relationships, GraphQL, legacy lookup, match review, data quality, push ingest, data sync and jobs, workflows, MCP, feeds, reports and broadcasts, audit, connections, API management) grouped by area in a searchable side list with the milestone; the selected OpenAPI 3.1 document rendered by Swagger UI (`control/SwaggerDoc.js`) left to right in both languages, with status (planned · milestone or deprecated until), base address placeholder, OpenAPI download and copy link. Entity schemas come from `repoio-spec`; the rest is sample (`model/apidocs.json`, generated by `tools/gen_apidocs.py`). Try it out is off in the prototype. The API catalog rows open it |
| `#/admin/users/{user}` | User management (J17, ADR-0009, Admin only) | The SAP IBP order: employees → business users → Entra ID → roles. Org tree (Org › Business unit › Department › Team, people counts); the header shows the directory source (Entra ID or SuccessFactors), last sync, *Sync now* and **sync settings** (source, endpoint placeholder, secret-store reference, schedule, field mapping). Selecting a department or team shows its **default roles** (add / remove; a team also shows what it inherits from its department; sensitive roles are not offered). **Employees** tab: source per person (Entra ID, SuccessFactors, Manual, Manual · review when the source has the same person), *Maintain business user* for the selected employees (validity dates, Entra ID link state), and a *Manual* fallback menu — *Create employee*, *Import employees (CSV)* with real in-browser parsing and per-row checks, *Download template*. **Users** tab: Entra ID link (linked, not found, disabled), roles (effective · direct), validity, last sign-in; a user opens on General (validity editable), **Assigned roles** (source of each role: direct, team or department; add / remove direct roles, optional end date), **Effective access** (permission × domains × granting roles, separation-of-duties warnings) and History; *Lock* with a reason. Also: *Review changes* (sync preview: new / moved / left, applied on confirmation), Entra ID group → team mapping in sync settings, *Resolve duplicate* for a flagged manual record, *Edit* for manual records, sign-in status (active, not in Entra ID, disabled, expired, locked, left) with filters, bulk *Assign role*, *Upload assignments* (CSV, per-row checks), *Export* (CSV of users and roles), an **Access reviews** tab (start, keep / remove per direct role, close), and a guard against leaving no active administrator |
| `#/admin/roles/{role}` | Roles & access (J17, ADR-0009) | SAP IBP's Maintain Business Roles. **Create role** (blank or a copy: names, technical ID, description, domains, permissions from the catalog; a sensitive permission makes the role user-only); delivered roles are read-only, custom roles editable and deletable when unheld. Roles with their type (delivered / custom), domain grants, who they can be assigned to (users only for Admin, API access administration and template authoring; otherwise departments, teams and users), user and org-unit counts. A role opens on General, **Permissions**, **Domain grants** (edit for custom roles), **Assigned users** (everyone holding it and how; add / remove direct) and **Assigned org units** (add / remove departments and teams; hidden for sensitive roles). Same records as User management. A role also has a **History** tab (*Open in audit log*) and **Preview access** (pages its permissions open, from `navAccess` in `model/users.json`); removing the last administrator is blocked; assignments made here can carry an end date |
| `#/admin/system/{section}` | System configuration (J18, Admin only) | Sections on the left — Authentication (Entra ID placeholders, secret reference, session and idle limits, allowed domains), Email (SMTP relay placeholders, sender, *Send test email*), Regional defaults, Custom properties (catalog objects only; add / edit / delete with validation; a *Person* type references the users list — all active users or holders of chosen roles, single or multiple, with a live eligible count), Data retention. One working copy; *Unsaved* marks and a Save / Discard footer; each saved section is an audit entry with before / after |
| `#/admin/announcements/{id}` | Announcements (J13) | Live / scheduled / draft / ended list with audience, window, pin and author. Editor: type, titles and messages in both languages, audience (all users, a role, a domain) with its reach, publish window, pin, live preview; Publish / Update / Save draft / Retire / Duplicate / Delete draft; History tab. The Home strip shows the live pinned announcement |
| `#/admin/audit` | Audit log (J18) | Read-only, append-only trail merged from administration and user management: time, who (person, Repo.io, directory sync), area, action, what happened, object, version; text, period, area and actor filters; entry details with before / after and *Open* (goes to the user, role, announcement, setting, broadcast or story); CSV export. Broadcast actions and story saves are logged through `util/audit.js` |
| `#/jobs/streams` | Data jobs: streams (J10) | Runs / Streams switch beside the title. Streaming jobs per entity: DLQ growth alert (above the per-hour threshold, with the main cause and a link to quarantine), tiles (streams running, highest lag, dead-letter records, oldest checkpoint), consumer lag over the last hour (ECharts), table (stream with source → golden topic and the four stages standardise → DQ → match → survivorship as state chips, status, consumer lag with time behind, last checkpoint, throughput, dead-letter count with last-hour growth, owner, open latest run) |
| `#/jobs/runs` | Data jobs: job runs (J10) | Analytical list layout, the same as the J14 reports: title with variants (Standard, Failed runs, Running and queued, My runs; `*` when changed), Runs / Streams switch, Adapt filters, visual / compact filter switch, refresh. Visual filters: runs by type (bars), by status (donut in the status colours), by error code (top five; the tooltip shows when each code was last seen); select a value to filter, select again to clear. Compact filters: job name, type, run as everyone or me, time range 24 h / 48 h / 7 days, run status, run ID, error code. Time range and "Filtered by" tokens (folder, type, status, error code, run as, name, run ID) stay under the filters. Folders panel beside the chart and table (ADR-0005: `domain / repository / kind` and `platform / kind`, toggle remembered per browser, `dags / …` breadcrumb on the runs title). Main chart with View by: time (finished runs per time bucket stacked by outcome; select a bar to show only that period), status, type, error code, domain, launched, run as; column, bar or donut; chart only, chart and table, or table only. Runs table (start time, job with technical name, type, run as, launched, duration with an overdue warning, status, error code, parameters, stop for active runs, row menu: open, open in Airflow, request replay, stop, copy run ID) with a column chooser remembered per browser, search and export to Excel |
| `#/jobs/runs/{runId}` | Run details (J10) | SAP Datasphere Data Integration Monitor: a resizable split. Left: the job (status, delta load interval, source with a link to its connection, target, runs on, owner), its schedule (frequency, latest update, next run), recent run durations as bars (a bar opens that run) and the runs list with sort and status filter; Run menu (run now, request replay, stop) and Schedule menu. Right: run details header (status, duration, start, end, run by, run type, launched, run ID, the Airflow DAG run link), the failing message, the tasks as a chain coloured by status (a task opens its Airflow task link), the objects table (source → target, load type, status, last transfer, records) and tabs: Messages (timestamp, category, message, view details; search, sort, category filter), Metrics of the selected object (duration, operations, partitions, state; consumer lag and checkpoint for streams) and Data quality (Great Expectations results per expectation; quarantined records with a link to Quarantine). Download the run log, expand, close. Replay is a governed request with scope, idempotency key, approver and reason. Airflow links show the DAG / run / task IDs and the link template; the base URL belongs to the Airflow connection, so the prototype does not open it |
| `#/page/{key}` | Every other page in `docs/ui-pages.md` | Planned-page placeholder with the page scope and journey |

## Entry points

| Entry point | What it is |
|-------------|------------|
| `webapp/index.html` | Local bootstrap (`ui5 serve`) |
| `webapp/manifest.json` | Routes, models, i18n (`supportedLocales`: en, ar) |
| `webapp/controller/App.controller.js` | Shell: navigation tree from `model/navigation.json`, header search filter, language switch |
| `webapp/control/EChart.js` | Apache ECharts wrapper control (README §7.2) |
| `webapp/control/OntologyGraph.js` | Cytoscape.js wrapper control for the ontology graph (README §2.3, §7.2) |
| `webapp/control/FlowCanvas.js` | Flow designer canvas: step cards, connectors, "+" insert, pan and zoom (ADR-0002) |
| `webapp/control/FieldMapper.js` | Datasphere-style field mapping (two columns, lines, filters, drag or click) |
| `webapp/control/Pager.js` | Previous / Next paging under long tables (job runs, run messages, Connections) with rows per page; hidden when everything fits on one page |
| `webapp/control/CodeEditor.js` | CodeMirror 6 wrapper for the Script step |
| `webapp/control/SwaggerDoc.js` | Swagger UI wrapper (swagger-ui-dist 5.17.14, Apache 2.0, vendored in `webapp/thirdparty/`) for the API reference |
| `webapp/util/flowModel.js` | Flow model: insert / remove, lane layout, compile to BPMN 2.0 |
| `webapp/controller/JobRuns.controller.js`, `webapp/controller/JobRun.controller.js`, `webapp/util/jobRuns.js` | Job runs list, run details, and the shared Airflow link and replay request helpers; sample runs in `webapp/model/runs.json` |
| `webapp/util/ImportDialog.js`, `webapp/util/tabular.js` | CSV / XLSX import dialog and the in-browser CSV and XLSX readers |
| `publish/repoio-console.html` | Page used for the published artifact |

## Build

```bash
npm install
npm run build          # ui5 build self-contained → dist/ (JavaScript bundle only)
```

## Run (local dev)

```bash
npm start              # ui5 serve; open http://localhost:8080/index.html
```

Language: the header button switches Arabic ↔ English (stored in
`localStorage` key `repoio-lang`, then reloads).

## Publish as an artifact

```bash
npx ui5 serve --port 8095 &          # compiles the theme on request
npm run build
tools/collect-framework-files.sh     # adds themes, fonts, CLDR, message bundles to dist/
```

Then publish `dist/repoio-console.html` with the other `dist/` files except
`*-dbg.*`, `*.map` and `index.html` (`.properties` as `text/plain`, views as
`application/xml`).

## Test

Not automated. Checked in Chromium (Playwright): all six routes load in `ar`
and `en` with no missing files, and the Home, Domains, Domain, Repository,
Sources and Table pages render with no console errors (Arabic at 1440 px;
Home and Lineage also in English; Home at 390 px).

## Configuration

None. No hosts, ports or credentials.

## Dependencies

- OpenUI5 1.136.22 (framework libraries in `ui5.yaml`): sap.ui.core, sap.m,
  sap.tnt, sap.f, sap.uxap, sap.ui.layout, sap.ui.table, sap.ui.unified,
  themelib_sap_fiori_3.
- `@ui5/cli` 4.0.33 (dev).
- Apache ECharts 5.5.1, vendored in `webapp/thirdparty/` (Apache-2.0, licence
  file alongside).
- Cytoscape.js 3.30.4, vendored in `webapp/thirdparty/` (MIT, licence file
  alongside). Used only inside `control/OntologyGraph.js`.
- dagre 0.8.5 + cytoscape-dagre 2.5.0 (both MIT), vendored together in
  `webapp/thirdparty/cytoscape-dagre.bundle.js` (licences in
  `cytoscape-dagre.LICENSE`): the hierarchical (top-down) layout of the
  ontology graph. Used only inside `control/OntologyGraph.js`; without it the
  control falls back to Cytoscape's breadthfirst layout.
- CodeMirror 6 (MIT), bundled from pinned versions in `tools/codemirror`
  (`npm ci && npm run build`) into `webapp/thirdparty/codemirror/`. Used only
  inside `control/CodeEditor.js`. bpmn-js was removed (ADR-0002).

## Colors

Charts use the SAP Quartz chart palette in its softer tints (`BaseController.colors`).
Progress bars use light semantic fills (`css/style.css`), so status stays readable
without saturated blocks of color.

## Findings for M4

- `sap.tnt.SideNavigation` in OpenUI5 1.136 has no search property. The
  prototype puts a `SearchField` in the `ToolHeader` that filters the tree.
  `docs/ui-pages.md` describes a "built-in search", which should be corrected.
- Overview Page cards, the visual filter bar and micro charts are SAPUI5-only.
  Here they are built from `sap.f.Card`, `GridContainer` and the ECharts
  wrapper.

## Related specs

- `docs/ui-pages.md`, `docs/user-journey.md` (J1, J2, J10, J12)
- `docs/decisions/ADR-0001-multiple-repositories-per-domain.md`
