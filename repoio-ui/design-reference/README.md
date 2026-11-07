# Repo.io design reference

This folder is the source of truth for how each Repo.io page should look.
Every page is built from one SAP S/4HANA (Fiori Horizon) floorplan, exported
from the SAP S/4HANA Web UI Kit (Community) Figma file
`j9Zj3GwaXJrYe0bimzDxRW`.

Before building or changing a page:

1. Find the page in the table below.
2. Open its SAP reference (`sap-s4hana/`) and its approved prototype (`prototypes/`).
3. Build with the same card types, header, and spacing. Do not add elements the
   reference does not have, and do not drop ones it has without noting it here.

## Pages

| # | Repo.io page | Route | SAP floorplan | SAP reference | Approved prototype | Status |
|---|---|---|---|---|---|---|
| 01 | Home | `/home` | Overview Page (node `53:7537`) | `sap-s4hana/01-overview-page.svg` | `prototypes/01-home-overview.html` (screenshots: `01-home-implemented.{ar,en}.png`) | Approved 2026-11-03 · implemented in the React baseline · **to rework**: Quartz Light + SideNavigation shell, rebuild in OpenUI5 (M4) |
| 02 | Domains (Domain → Repositories → Data Sources → Table) | `/domains` (planned) | Domains: **Analytical List Page** (visual filters + column chart + Responsive Table) · Repositories: **Spaces page** · Data Sources: **Multi Instance Object Page** with anchor bar · Table: Object Page with tabs | `sap-s4hana/patterns/analytical-list-page.png`, `responsive-table.png`, `spaces-page.png`, `object-page-instance.png`, `multi-instance.png` | `prototypes/02-domains.html` | Prototype — structure approved (multi-repository domains, ADR-0001) · **to rework**: Quartz Light + SideNavigation shell |

`prototypes/00-clickable-prototype.html` is the combined click-through: Home with
the Domains prototype embedded. Open Domains from the navigation menu (مساحاتي ›
الدومينات, the entity items, or All Spaces), the "مصادر البيانات" quick link, or the
domain owner card; the logo or ☰ in Domains returns to Home. Rebuild it whenever
01 or 02 changes.

Add a row per page as it is approved. Number SAP exports and prototypes with the
same prefix as the row.

## Component catalog

`sap-s4hana/components/README.md` lists every SAP component export with its
specs, tokens, and the code that implements it. Check it before building any
UI element.

## Brand

- `brand/repoio-logo-source.jpg`: original logo artwork.
- `brand/repoio-logo.png`: transparent-background crop used in the shell bar
  (runtime copy lives in `src/main/resources/ui/src/assets/img/brand/`).

## Theme and shell (locked by CLAUDE.md §4 and `docs/ui-pages.md`)

- Console shell: Tool Page Layout. That is `sap.tnt.ToolPage` +
  `sap.tnt.ToolHeader` + `sap.tnt.SideNavigation` with its search field.
- Theme: **Quartz Light** (`sap_fiori_3`). No dark variant in v1.
- Prototypes 01–02 were drawn on Horizon tokens with a compact pop-over
  navigation menu. They must be reworked to the locked shell and theme
  before they serve as the visual contract for M4.
- Controls must exist in **OpenUI5**. Patterns used so far that are
  SAPUI5-only (Fiori elements or licensed libraries):
  - Overview Page (`sap.ovp`): rebuild with `sap.f.GridContainer` +
    `sap.f.Card`.
  - Analytical List Page visual filters: rebuild with `sap.m` and
    ECharts in a wrapper control.
  - Micro charts (`sap.suite.ui.microchart`): use ECharts or plain
    controls.

  Each needs a documented exception or a rebuild with OpenUI5 controls.
- Prototype data is illustrative. Implementations never ship it
  (CLAUDE.md §6 rule 2).

## SAP card types → Repo.io use (Overview Page)

| SAP card | Repo.io card on Home |
|---|---|
| Analytical card (KPI header + stacked column chart) | Customer data completeness |
| Numeric card (`20 of 42`) | Open review requests |
| List card with Approve / Reject (Urgent Purchase Requisition) | Urgent change requests |
| Table card with search (Off-Contract Spend) | Merge candidates |
| Quick Links | Quick links |
| Timeline card (Team Members) | Data stewards |
| Object / contact card | Domain owner |
| Calendar card | Run schedule |
| Image card (Tablets, Notebooks) | Not used |
