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
Connections (with CSV / Excel import), the Ontology Explorer and New
workflow are designed. The domain detail, repository, data source, table, golden record
and Explore pages were removed at the owner's request; their code is in git
history. Every other navigation item opens the planned-page placeholder.

| Route | Page | Datasphere layout it follows |
|-------|------|------------------------------|
| `#/` | Home (J1) | Datasphere Home: compact hero banner (image kept, smaller; two-line brief, "Learn more" opens a summary of what the tool does), announcement strip, "needs me now" tiles (awaiting my approval, overdue requests, new data quality issues, failed write-backs; each opens its list), welcome card with three getting-started steps (done steps ticked, progress, Hide; hides itself when all are done), recent files, then the J1 cards (quick actions, golden records per domain, awaiting approval, open items, pipeline health, completeness, merge candidates, stewards, owner, run schedule) — drag to reorder, show or hide |
| `#/domains` | Domain management | Catalog: dark search header (scope select + search), type tabs (all, domains, repositories, data sources, tables, favorites, recent), filter panel (domain, status), asset cards or list; quick view, copy link (`#/domains/{item}`), favorites |
| `#/connections` | Connections (J9) | Datasphere Connections: registry table (logo, technical name, type, category, features, status, last sync, owner) with create / edit / delete / validate / pause / resume. "Create Connection" dialog in three steps like Datasphere: 1 choose type (filters by feature, category, source + type tiles for SAP HANA, SAP Cloud for Customer, Microsoft SQL Server, CSV / Excel), 2 configure properties (per-type form; secrets go to Key Vault, only a reference is kept), 3 business and technical name, owner, description. **Upload file** on a CSV / Excel connection opens the Datasphere "Import CSV File" dialog: file (.csv / .txt / .xlsx), first row as header, missing value as NULL or empty, delimiter (auto-detect) and encoding (UTF-8 / Windows-1256) or sheet, target entity (→ `raw.<entity>`), data preview with a source → target field mapping per column (auto-mapped, required fields and duplicates checked); import sends a batch to push ingest, never to golden records. Parsing runs in the browser (`util/tabular.js`, no third-party parser); the server re-validates every row |
| `#/ontology` | Ontology Explorer (J11, J12) | Datasphere Graph Builder: left tabs (concept tree with relationships and data properties; relationship type catalog grouped by from → to pair), Cytoscape.js graph (parallel relationship types between two concepts grouped into one line with a count, tap to show them; unlinked concepts hidden behind a toggle; tree icons by concept category) in the centre (show/hide relationship types, semantic properties and is-a; network, hierarchy or rings layout; zoom, fit, focus mode), details panel on the right (concept: business name, URI local name, description, parent concepts, owner, links to canonical entity / glossary / KPI / catalog asset, data properties, relationships; relationship: from → to, inverse, cardinality, attributes, governance note). Concepts / Records switch: from a concept or a relationship type, "View record links" drills down to the governed links between golden-record codes (e.g. C-10001 parent of C-10002) as a graph with a Datasphere-style "Data preview" table docked under it (the graph stays visible; a row zooms the graph to that link), filtered by domain, type and code; a link shows its attributes, status (active / pending approval) and provenance (change request or match confirmation). Versions (draft / in review / published / retired): new concept and new relationship type go into the draft, which is submitted for review; validate (SHACL-style checks), preset SPARQL queries on the secured endpoint, Turtle export |
| `#/workflows/new` | New workflow (J7, ADR-0002) | Repo.io flow designer like the reference image: step cards on a dotted canvas with "+" on every path, automatic lane layout (RTL mirrored), zoom bar; properties panel per step. Steps: Begin, Template (one per workflow, its fields drive everything after), Validation (Great Expectations rule on template fields, or Splink duplicate check against golden records or a source connection, threshold), Approval (people or team, any / all, SLA, escalation), Script (Python or read-only SQL written in the step with CodeMirror 6, template fields as autocomplete and chips), Write-back (connection, and a Mapping section in the side panel: Datasphere-style field mapper to the target allowlist with All / Mapped / Unmapped, search, auto-map, code-list value translation), Notification (in-app and/or email, recipients, message in Arabic and English with variables), Condition (yes / no, on template fields or outputs of earlier steps), End. Approval: one group or parallel groups, return for rework, segregation of duties, out-of-office delegation. Template version pinning with upgrade impact and migration. Mapping transformations (constant, combine, truncate, upper, trim, default) with preview. Test run with a sample request (path highlight, step outcomes, write-back payload preview), Compare with another version, Runs overlay of the published version, New: blank or copy of an existing workflow, minimap. Validate, undo / redo, save version, submit for publishing (domain owner or governance board approves), new version, Export BPMN (the compiled BPMN 2.0 that Flowable receives) |
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
| `webapp/control/CodeEditor.js` | CodeMirror 6 wrapper for the Script step |
| `webapp/util/flowModel.js` | Flow model: insert / remove, lane layout, compile to BPMN 2.0 |
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
