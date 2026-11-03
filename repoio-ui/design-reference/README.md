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
| 01 | Home | `/home` | Overview Page (node `53:7537`) | `sap-s4hana/01-overview-page.svg` | `prototypes/01-home-overview.html` (screenshots: `01-home-implemented.{ar,en}.png`) | Approved 2026-11-03, implemented |

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

## Theme

Light Horizon only. Pages do not ship a dark variant unless the reference
for that page has one.

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
