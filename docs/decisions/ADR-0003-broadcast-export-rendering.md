# ADR-0003 — Broadcast exports: Node render worker with ECharts and headless Chromium; attachment size policy

- Status:
  - Part A (render runtime): **accepted** (2026-11-10, Mohamed).
  - Part B (attachment size policy): **accepted** (2026-11-10, Mohamed),
    with a 10 MB relay limit.
- Amends: README §2.8 (open decisions), §6 module layout; CLAUDE.md §3
  module map, §4 technology table, §8 decisions list;
  `docs/user-journey.md` J14.
- Related decisions in README §2.8, confirmed 2026-11-10:
  - Mail goes through the corporate SMTP relay.
  - Exports are generated per run and never stored.
  - Recipients are Entra ID users only.
- Does not change: authorization (each export is evaluated as the
  recipient through the Query API), the control-plane / data-plane split,
  or any rule in CLAUDE.md §6.

## Context

Broadcasts (README §2.8, journey J14) send a report or a story by email
on a schedule:

- Reports go as XLSX, CSV or PDF.
- Stories go as PDF or PPTX.

The console draws charts with Apache ECharts, through the `EChart`
OpenUI5 wrapper. The product is Arabic-first, so PDF and PPTX output
must render Arabic correctly: shaping, bidi and RTL layout.

Two runtimes were considered for rendering charts and documents.

| | Node worker | Python worker |
|---|---|---|
| Charts | ECharts server-side rendering (SVG string, no browser), with the same chart options as the console | Re-implemented in matplotlib / plotly per chart type, so they look different and the code is duplicated |
| PDF with Arabic | HTML + SVG printed by headless Chromium, with correct shaping, bidi and RTL | Needs arabic-reshaper + python-bidi, or WeasyPrint, which is more fragile |
| PPTX | `pptxgenjs` (RTL mode) | `python-pptx` (RTL needs manual XML) |
| XLSX / CSV | `exceljs` (right-to-left sheet view) | `openpyxl` (slightly richer) |
| Operations | New runtime image (Node + Chromium) | Could reuse the planned `repoio-python-runtime` |

## Decision

### Part A — render runtime (accepted)

1. Exports are rendered by a **Node render worker**, a new planned module
   `repoio-export-worker/`:
   - **Charts:** ECharts server-side rendering to SVG. Chart options are
     produced from the stored tile or report definition by a shared
     option builder, so a broadcast chart matches the screen.
   - **PDF:** an HTML template (Arabic and English fonts, RTL or LTR)
     with the SVG charts, printed by headless Chromium.
   - **PPTX:** `pptxgenjs`, one slide per story page, charts as SVG or
     PNG, RTL mode for Arabic.
   - **XLSX / CSV:** `exceljs` (right-to-left sheet for Arabic) and a
     streaming CSV writer (UTF-8 with BOM, so Excel opens Arabic
     correctly).
2. **The worker only renders.** It receives data that `repoio-service`
   already queried as the recipient through the Query API. It has no
   database credentials, no Trino access, no grants of its own and no
   inbound network.
3. **Isolation is the same as for workers in CLAUDE.md §6.8:**
   - a disposable, resource-limited container;
   - no Docker socket and no host mounts;
   - no outbound network except back to `repoio-service`;
   - Chromium runs sandboxed with JavaScript limited to the bundled
     render page;
   - no `npm install` at runtime.
4. **Nothing is written to disk or object storage.** The file is built
   in memory, returned to `repoio-service`, attached to the email and
   discarded. Run metadata goes to `broadcast_runs` without file
   content.
5. Package versions (Node LTS, ECharts, Chromium, `pptxgenjs`, `exceljs`)
   are pinned when the module is scaffolded. They are not chosen here.

### Part B — attachment size policy (accepted)

1. **Limit.** The limit is the relay's maximum message size, an SMTP
   setting in Administration → System configuration (environment
   default `BROADCAST_MAX_ATTACHMENT_MB`). The decided value is
   **10 MB**. It is measured on the encoded message: base64 adds about
   37 %, so the raw file cap is about 10 ÷ 1.37 minus room for the body,
   about **7 MB**. If the relay limit changes, only the setting changes.
2. **Pre-flight before rendering.** `repoio-service` estimates the size
   from the recipient's row count, the column count and the format. If
   the estimate is clearly over the cap, it skips rendering and goes to
   step 5.
3. **Row cap per broadcast:** `BROADCAST_MAX_ROWS`, proposed at 100,000
   rows. A broadcast is a digest, not an extract. Bigger extracts belong
   in the console export or a data-platform share (README §2.5).
4. **ZIP.** If the rendered file is over the cap and the format is CSV,
   compress it as ZIP even if ZIP was not chosen. XLSX, PPTX and PDF are
   already compressed, so ZIP is not attempted for them.
5. **Link-only fallback.** If the file is still over the cap, send the
   email without an attachment. It contains the same subject and
   message, a short note that the file was too large, and the link to
   the live report with the same view or page (sign-in required). The
   recipient's outcome is `linkOnly`.
6. **Never:**
   - split one export across several emails;
   - upload the file somewhere to link to it (exports are not stored);
   - drop rows silently.
7. **Decided per recipient.** Each recipient's data is filtered by
   their own grants, so file sizes differ. One recipient can get the
   attachment while another gets the link.
8. **Visibility:**
   - The broadcasts list shows "Sent · N link only" as a warning, with
     details.
   - The new-broadcast dialog warns when the last run, or the estimate
     for the owner's own view, is near the cap.

## Consequences

- The platform gains a Node runtime image with Chromium. It is heavier
  (Chromium is a few hundred MB) and has its own patch cadence. Chromium
  security updates are part of the platform's monthly patching.
- Chart rendering logic is written once: the option builder is shared
  by the console wrapper and the render worker. A visual change to a
  chart type lands in both.
- Python stays the language for ingestion, data quality, matching and
  user scripts. The render worker does no data processing.
- `broadcast_runs` per-recipient outcomes are:
  - `sent`;
  - `linkOnly`;
  - `skipped` (no grant);
  - `failed` (relay error; retried at the next slot or with Start now).
- The SMTP relay is configured later by an Admin in Administration →
  System configuration:
  - host, port and TLS;
  - sender address;
  - authentication, with the password as a secret-store reference
    (CLAUDE.md §6.13);
  - maximum message size (10 MB).

  Until then broadcasts can be defined but not sent. Start now and
  scheduled runs report "mail not configured".
