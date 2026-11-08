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

| Route | Page | Datasphere layout it follows |
|-------|------|------------------------------|
| `#/` | Home (J1) | Datasphere Home: welcome banner, recent files, quick actions, plus the J1 cards (golden records per domain, awaiting approval, open items, pipeline health) |
| `#/domains` | Domain management | Space Management: summary bar with status icons and usage bars, one card per domain (or a table), create / edit / delete / lock / monitor |
| `#/domains/{domain}` | Domain → repositories | Data Builder: domain selector, "create new" tiles, "All repositories" table with business and technical names, status, changed on/by (ADR-0001) |
| `#/domains/{d}/repositories/{repo}` | Repository | Edit Space: overview (general settings, capacity and quality), model, golden records, members, data sources |
| `…/sources/{source}` | Data source | Connections, kept as multi-instance tabs: connection details and features, participating repositories, remote tables (replicated or remote), data integration monitor |
| `…/tables/{schema}/{table}` | Table | Table editor: general settings and columns (key, data type, not null, repositories, model attributes), data preview, data quality, impact and lineage |
| `#/records/{recordId}` | Golden record (J2), opened from a repository's golden records | Object Page: header KPIs (quality, match confidence, source records, last merge), attributes with winning source and survivorship rule, contributing source records, relationships, change history, lineage. No inline editing — "Request a change" opens the templates catalog |
| — | Explore (search page) | Removed from the prototype for now at the owner's request; it stays in `docs/ui-pages.md` |
| `#/page/{key}` | Every other page in `docs/ui-pages.md` | Planned-page placeholder with the page scope and journey |

## Entry points

| Entry point | What it is |
|-------------|------------|
| `webapp/index.html` | Local bootstrap (`ui5 serve`) |
| `webapp/manifest.json` | Routes, models, i18n (`supportedLocales`: en, ar) |
| `webapp/controller/App.controller.js` | Shell: navigation tree from `model/navigation.json`, header search filter, language switch |
| `webapp/control/EChart.js` | Apache ECharts wrapper control (README §7.2) |
| `webapp/control/LineageGraph.js` | Impact and lineage view: cards per object, curved connectors, hover traces the up- and downstream path (HTML + SVG, RTL aware) |
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
