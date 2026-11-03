# UI Agent Guide — Repo.io Front-End

> **Design system: SAP Fiori Horizon**
> Read this file before touching anything inside
> `repoio-ui/src/main/resources/ui/`.
> Deviations require a human review on PR.

---

## 0 · Quick-start checklist (read every time)

Before you open any file in `src/`:

1. **Read §1** (folder map) — know where the file belongs.
2. **Read §2** (design system) — if you're touching colour, type, spacing, icons, or shell chrome, check the token table first.
3. **Read §4** (page anatomy) — every new page follows one Fiori floorplan.
4. **Open `repoio-ui/design-reference/README.md`** — find the page's SAP reference
   export and approved prototype. Build to match them; pages are approved one at a time.
   For every element on the page (button, input, table, dialog, message strip…),
   check `design-reference/sap-s4hana/components/README.md` first and build it to
   that spec. Shared versions live in `components/common/Fiori/`; build one there
   the first time a page needs it. Density is **Compact** (26 px controls).
5. **Run `npx tsc --noEmit && npx vite build`** before you push. Both must pass.

If a rule here surprises you, open a PR amending the guide *first*, then the code.

---

## 1 · Folder map

```
repoio-ui/src/main/resources/ui/src/
├── components/
│   ├── AppShell/          ← FioriShellBar.tsx, NavigationMenu.tsx, AppShell.tsx
│   ├── common/            ← shared primitives (≥ 2 pages or planned)
│   └── <Area>/            ← area-specific components, sibling to their page
├── pages/
│   └── <Area>/
│       ├── <Name>Page.tsx
│       └── <Name>Page.module.css   ← CSS Module for this page
├── styles/
│   ├── tokens.css         ← SAP Fiori Horizon CSS custom properties (source of truth)
│   ├── variables.less     ← LESS mirrors of key tokens (@shell-bar-height, etc.)
│   ├── app.less           ← Fiori layout primitives (.fiori-shell-bar, .fiori-side-nav, …)
│   ├── fonts.less         ← "72" font-face declarations
│   └── components/        ← Antd 5 class overrides using SAP tokens
│       ├── button.less
│       ├── table.less
│       ├── tabs.less
│       ├── menu.less
│       ├── form.less
│       ├── select.less
│       ├── tags.less
│       ├── drawer.less
│       ├── pagination.less
│       ├── radio.less
│       └── toggle-switch.less
├── constants/
│   └── routes.ts          ← every route constant lives here, nowhere else
├── locale/languages/
│   ├── en-us.json
│   └── ar-eg.json
└── rest/                  ← one file per entity, typed axios helpers
```

Rules:

- Do **not** invent new top-level folders (`services/`, `utils/`, `helpers/`). Put utilities in a sibling file next to the only caller, or in `src/components/common/` if shared.
- New **page** → `src/pages/<Area>/<Name>Page.tsx` + `<Name>Page.module.css`.
- New **shared component** → `src/components/common/<Name>.tsx` + `.module.css` if needed.
- Area-specific component (used by one page only) → sibling file: `src/pages/<Area>/<Name>.tsx`.

---

## 2 · The design system (non-negotiable)

The design system is **SAP Fiori Horizon**. All tokens live in
`src/styles/tokens.css` as CSS custom properties. Import them through
`@import '../tokens.css'` in LESS, or use them directly as `var(--sap…)` in
CSS Modules. Never hardcode a hex unless it is a local one-off not covered by
the token table, and add an inline comment explaining why.

### Core tokens

| Purpose | Token | Fiori value |
|---|---|---|
| Brand / primary | `--sapBrandColor` | `#0070F2` |
| Shell bar background | `--sapShellColor` | `#354A5E` |
| Page background | `--sapBackgroundColor` | `#F5F6F7` |
| Card / form background | `--sapCard_Background` | `#FFFFFF` |
| Object header background | `--sapObjectHeader_Background` | `#FFFFFF` |
| Group content bg | `--sapGroup_ContentBackground` | `#F5F6F7` |
| Primary label text | `--sapContent_LabelColor` | `#556B82` |
| Primary value text | `--sapContent_ValueColor` | `#32363A` |
| Border (foreground) | `--sapContent_ForegroundBorderColor` | `#C5C7C8` |
| Card border | `--sapCard_BorderColor` | (see tokens.css) |
| Field background | `--sapField_Background` | `#FFFFFF` |
| Field border | `--sapField_BorderColor` | `#C5C7C8` |
| Field hover border | `--sapField_Hover_BorderColor` | `#0070F2` |
| List header bg | `--sapList_HeaderBackground` | `#F5F6F7` |
| List border | `--sapList_BorderColor` | `#E8EAEB` |
| List row hover | `--sapList_Hover_Background` | `rgba(0,0,0,0.04)` |
| List selection bg | `--sapList_SelectionBackgroundColor` | `#EBF5FF` |
| List background | `--sapList_Background` | `#FFFFFF` |
| Positive | `--sapPositive` | `#188918` |
| Negative | `--sapNegative` | `#BB0000` |
| Critical / warning | `--sapCritical` | `#E76500` |
| Informative | `--sapInformative` | `#0070F2` |
| Focus ring | `--sapContent_FocusColor` | `#0070F2` |
| Shadow 0 (subtle) | `--sapContent_Shadow0` | `0 1px 2px rgba(0,0,0,0.04)` |
| Shadow 1 (card) | `--sapContent_Shadow1` | `0 2px 8px rgba(0,0,0,0.12)` |
| Shadow 2 (modal) | `--sapContent_Shadow2` | `0 8px 24px rgba(0,0,0,0.16)` |
| Border radius | `--sapContent_BorderRadius` | `4px` |
| Border radius large | `--sapContent_BorderRadius_Large` | `8px` |

#### Button tokens

| Button type | Background | Border | Text |
|---|---|---|---|
| Emphasized (primary) | `--sapButton_Emphasized_Background` | `--sapButton_Emphasized_BorderColor` | `--sapButton_Emphasized_TextColor` |
| Negative (danger) | `--sapButton_Negative_Background` | `--sapButton_Negative_BorderColor` | `--sapButton_Negative_TextColor` |

#### Shell layout tokens

| Token | Value |
|---|---|
| `--sapShellBar_Height` | `44px` |
| `--sapSideNav_Width` | `272px` |
| Side nav collapsed width | `48px` |

### Typography

- **UI font**: `"72"`, `"72full"`, Arial, Helvetica, sans-serif — declared by `--sapFontFamily`.
- **Arabic UI font**: `"72"` includes Arabic glyphs; swap is automatic on `html[dir="rtl"]`.
- **Monospace / code**: JetBrains Mono (fallback `Menlo`, `Monaco`, `Consolas`). Use for IDs, YAML/JSON, logs.
- Set font via `font-family: var(--sapFontFamily)` — never inline-hardcode font names.
- Body: 0.875 rem. Labels: 0.8125 rem. Headings: `font-weight: 700`, size from Antd `Typography.Title`.

### Spacing & radius

- Base radius: `var(--sapContent_BorderRadius, 4px)`. Large: `var(--sapContent_BorderRadius_Large, 8px)`.
- Shell bar height: `44px` (`--sapShellBar_Height`).
- Side nav expanded: `272px` (`--sapSideNav_Width`); collapsed: `48px`.
- Page content gets padding from `AppShell`; a page **never** adds its own outer padding.
- Card padding: `1rem`. Section gutter: `1.5rem`.

### Icons

- New pages and components: **inline `<svg>` elements only**. Size at 16/20 px.
- Do **not** import `@ant-design/icons` in new files. If an existing shared component you call uses it, that is acceptable — do not refactor it just to migrate icons.
- Icon-only buttons **must** have an `aria-label`.

---

## 3 · AppShell

Reference: `design-reference/sap-s4hana/01-overview-page.svg` (Horizon, light).

| Component | File | Description |
|---|---|---|
| `FioriShellBar` | `AppShell/FioriShellBar.tsx` | 52 px **white** bar: menu (☰), back, repo.io logo, app title ▾, pill search field, language, notifications, help, avatar → User Menu popover (`user-menu.svg`) |
| `NavigationMenu` | `AppShell/NavigationMenu.tsx` | Popover under the ☰ button (`navigation-menu.svg`). Overlays the page; closes on outside click, Escape, or navigation. There is **no side bar** |

`AppShell.tsx` owns the menu's open state. `<main>` is always full width.
The logo lives in `src/assets/img/brand/repoio-logo.png` (source art in
`design-reference/brand/`). Do not redraw it as SVG or text.

Current primary nav items (do **not** break or reorder):
Home, Explore, Entities, Change Requests, Pipelines, Quality, Settings.

Rules:

- Max **7** items. An 8th item means something else leaves.
- Each item is an inline SVG icon + a `t('nav.<key>')` tooltip (LTR + RTL).
- Add nav items by editing `NavigationMenu.tsx` (the `sections` array) and both locale files under `nav.*`.
- Sub-nav lives **inside** the page (as tabs, segmented control, or a secondary section list). Never on the global side nav.

---

## 4 · Page anatomy — Fiori floorplans

Every page maps to one of three SAP Fiori floorplans:

### Overview Page (home / dashboard)

Use for: landing page, summary dashboards. Reference implementation: `pages/Home/`.

Shared building blocks live in `components/common/Fiori/`:

| Export | SAP element |
|---|---|
| `DynamicPageHeader` | Variant management ("Standard ▾ / No filters active") + centred collapse handle |
| `OvpGrid` | Masonry card columns (`columns: 4 300px`) |
| `OvpCard` | Card shell: title, subtitle, counter ("6 of 12"), overflow "…"; `side` prop = numeric card |
| `ObjectStatus` | Status text with icon, or solid tag when `inverted` |
| `intlLocale()` | Intl locale with Western digits for Arabic |

```tsx
<DynamicPageHeader variant={t('…variant')} subtitle={t('…no_filters')} />
<div className={styles.content}>
  <OvpGrid>
    <OvpCard title="…" subtitle="…" counter={t('fiori.of', { shown: 6, total: 12 })} onMore={…}>
      …card body…
    </OvpCard>
  </OvpGrid>
</div>
```

Card types used so far (see `design-reference/README.md` for the mapping):
analytical (KPI + EChart stacked bars), numeric, list with Approve / Reject,
table with search, quick links, timeline, contact, calendar.

Until a page has real endpoints, its data lives in `<page>SampleData.ts` and the
header shows the "Sample data" badge. Remove both when the REST call lands.

### List Report (master list with filters)

Use for: entity lists, search results, pipeline runs.

Key elements:
- Filter bar with chip-style filter buttons (`.filterChip`, `.filterChipActive`).
- Info strip with record count and action buttons.
- Card grid or Antd `<Table>` for results.
- `MessageStrip` for info / warning banners.

### Object Page (entity detail)

Use for: entity detail, change request detail, pipeline detail.

Key elements:
- Object header: breadcrumb + avatar + title + key attributes facets row.
- Tab bar with section tabs (`.tabBar`, `.tab`, `.tabActive`).
- Attributes layout: main content area + sticky aside (`.attributesLayout`, `.aside`).

### Shared rules (all floorplans)

- Use **CSS Modules** (`*.module.css`) for all page-level styles. No inline style objects except for dynamic computed values.
- Styling that applies to an Antd component globally goes in `src/styles/components/<name>.less`.
- `document.title` is set via `<title>` or Helmet inside the page — do not rely on the shell.
- **No raw `<h1>…<h6>`** except in CSS Module–styled page headers. Use Antd `Typography.Title` inside cards.
- **Breadcrumbs** are allowed in Object Pages (Fiori pattern). They are not used in List Reports or Overview Pages.
- **Theme**: light Horizon only. `tokens.css` has no dark overrides; do not add `prefers-color-scheme: dark` rules.
- **Digits**: format dates and numbers with `intlLocale(i18n.language)` so Arabic shows Western digits.

---

## 5 · RTL / Arabic support

- Use **logical CSS properties** everywhere: `inset-inline-start` (not `left`), `border-inline-start` (not `border-left`), `padding-inline` (not `padding-left/right`), `margin-inline-start` (not `margin-left`), `border-start-start-radius` (not `border-top-left-radius`).
- RTL is applied in `AppRoot` via `document.documentElement.dir = 'rtl'`. Do not add `dir="rtl"` to your own elements unless overriding a specific third-party component.
- Test every new layout at `dir="rtl"`. The KPI row, tile grid, and aside panel must mirror correctly.

---

## 6 · CSS Modules conventions

```css
/* <Name>Page.module.css */

.page {
  padding: 1.5rem;
  background: var(--sapBackgroundColor, #F5F6F7);
}

.pageHeader {
  margin-block-end: 1.5rem;
}

.pageTitle {
  font-family: var(--sapFontFamily);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sapContent_ValueColor, #32363A);
  margin: 0;
}
```

- Class names use **camelCase**.
- Responsive breakpoints: `@media (max-width: 768px)` for mobile, `@media (max-width: 1024px)` for tablet. Pages must be readable at 320 px minimum width.
- Dark mode: override tokens in `src/styles/tokens.css` under `[data-theme="dark"]`; do not add per-component dark overrides.

---

## 7 · Routing

- Every route lives in `src/constants/routes.ts` as a constant on `ROUTES`.
- Every `<Link>` and every `navigate()` call uses `ROUTES.X` or `generatePath(ROUTES.X, {…})`.
- **Static before dynamic.** `/x/new` is registered BEFORE `/x/:id` in `App.tsx`.
- Nested sub-routers (like `SettingsPage`) are allowed when a surface owns a whole area — they still register their children in one place.
- Query params are read with `useSearchParams()`; never parse `window.location.search` by hand.
- URL params are the only way to pass state between pages. Don't rely on React state to survive navigation.

---

## 8 · State

| Need | Use |
|---|---|
| Data from the server (list, fetch, mutate) | **TanStack Query** (hooks in `rest/`) |
| Current user, feature flags, UI prefs | **Zustand** (`useApplicationStore`) |
| One-page UI state (open/close, form input, selected row) | `useState` |
| Cross-page state that isn't server data | URL params. If URL doesn't fit, Zustand. |
| Heavy derived data | `useMemo` |

Rules:

- **Never** put server data in Zustand. Query owns the cache.
- **Never** stash secrets or tokens in Zustand `persist`. Tokens live in `localStorage` under `repoio-token` only.
- A new Zustand store needs a PR note explaining why `useApplicationStore` + persist can't hold the state.

---

## 9 · REST & API

- All HTTP goes through `src/rest/axiosClient.ts`. It carries the Bearer header, clears the Query cache on 401, and redirects to `/login`.
- Group endpoints by entity in `src/rest/<entity>.ts`. Export typed helpers (`listEntities`, `getEntity`, `patchEntity`).
- Base URL is `/api`. In dev, Vite proxies to `http://localhost:8585` (repoio-service). In prod it's same-origin.
- Request/response shapes come from the backend's OpenAPI. Regenerate TS types with `yarn api:gen` and import from `src/types/generated`. Until that lands, keep local types minimal and marked `// TODO: regenerate from spec`.
- No endpoint, model, or mutation goes live without a matching change to `repoio-spec/src/main/resources/json/schema/entity/<entity>.json`.

---

## 10 · Charts

Any chart goes through `src/components/common/EChart.tsx`, which wraps `echarts-for-react`. The wrapper injects the Repo.io Fiori palette, the "72" font, and consistent grid insets.

```tsx
import EChart from '@/components/common/EChart';

const option = {
  xAxis: { type: 'category', data: trendDays, axisLabel: { color: 'var(--sapContent_LabelColor)' } },
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: scores, smooth: true, showSymbol: false }],
};

return <EChart option={option} height={280} />;
```

- Never embed charts taller than 400 px in a KPI row.
- Area charts: linear gradient from series color at `0.18` alpha to transparent.
- Status bar charts: `itemStyle.color` driven by `--sapPositive` / `--sapNegative` / `--sapCritical`.

---

## 11 · Dependencies

Approved runtime deps are listed in `package.json`. Before adding a new one:

1. Is there already a dep that does this? (lodash, dayjs, antd, echarts, tanstack/react-query, axios, i18next, zustand, qs). If yes, use it.
2. Can it be done without a new library in ≤ 50 lines of code? If yes, write it.
3. Is the package maintained (released in last 12 months, ≥ 1k weekly downloads)?

If you still need the dep: pin a minor version (`^5.3.0`, not `*`), add it to `manualChunks` in `vite.config.ts` if its gzipped contribution to any chunk exceeds 150 KB, and note in the PR which feature it unlocks.

**Pre-approved heavy libs**: `echarts`, `echarts-for-react`, `antd`, `@ant-design/icons` (legacy pages only), `@tanstack/react-query`, `zustand`, `i18next`, `react-i18next`, `axios`, `styled-components`, `dayjs`, `lodash`, `qs`.

**On the port list** (ok to add when the first page that needs them lands): `reactflow`, `@uiw/react-codemirror` + CodeMirror packages, `@tiptap/*`, `@rjsf/*`, `react-awesome-query-builder`.

---

## 12 · i18n

- Every user-visible string goes through `t('…')`.
- Keys live in `src/locale/languages/en-us.json` and `ar-eg.json` with identical shape. Both files are updated in the same change.
- Namespace keys by surface: `nav.*`, `actions.*`, `entity.*`, `page.<area>.*`, `user.*`, `auth.*`.
- Interpolate with `{{var}}`: `t('invite.subject', { email })`.
- Pluralize with `t('entity.records', { count })` — never hand-concatenate "1 record" / "N records".
- Dates: `dayjs` with explicit locale. Numbers: `Intl.NumberFormat` — never raw `.toLocaleString()` with no locale.

---

## 13 · Accessibility & responsiveness

- All interactive elements use native keyboard controls (Antd gives you this).
- Icon-only buttons: `aria-label`.
- Modals: `<Modal title={…}>` so the title announces.
- Color is never the only signal — pair with a label (e.g. `WARN` text + warning color).
- Minimum target: readable on 1280 × 800. The layout uses CSS Grid / Flexbox + `@media` breakpoints in the CSS Module. Default single-column on mobile.
- Tables: `scroll={{ x: 'max-content' }}` when a column could overflow narrow viewports.
- Focus ring: `outline: 2px solid var(--sapContent_FocusColor, #0070F2); outline-offset: 2px;` — do not suppress `:focus-visible` outlines.

---

## 14 · Workflow for adding a new page

1. **Read §0–§5 again.** Yes, every time.
2. Add the route constant to `src/constants/routes.ts`.
3. Create `src/pages/<Area>/<Name>Page.tsx` + `<Name>Page.module.css` from the §4 floorplan template.
4. Register it in `App.tsx`.
5. Add i18n keys to **both** language files.
6. Wire it into the parent navigation (side nav OR a page's actions row OR SettingsHub cards).
7. Run `npx tsc --noEmit && npx vite build`. Both must pass.
8. Open a PR. Mention which floorplan the page follows and which sections of this guide it touches.

---

## 15 · Workflow for adding a new component

**Shared primitive** (used by ≥ 2 pages or planned to be):

1. `src/components/common/<Name>.tsx` + `.module.css` if needed.
2. Default export, PascalCase name matches file.
3. Props are a typed interface.
4. Inline SVG icons only (no `@ant-design/icons` import).
5. No business logic — pass data via props; let the page fetch.

**Area-specific component** (used by one page): sibling file `src/pages/<Area>/<Name>.tsx`.

**Antd override**: add to the relevant `src/styles/components/<name>.less` using SAP tokens.

---

## 16 · Workflow for adding a Settings sub-page

Settings is a nested router in `src/pages/Settings/SettingsPage.tsx`:

1. Add the route constant to `routes.ts` (e.g. `SETTINGS_X`).
2. Create `src/pages/Settings/<Area>/<Name>Page.tsx`.
3. Add a `<Route path="x" element={<XPage />}>` in `SettingsPage`'s `<Routes>`.
4. Add a hub card to the `cards` array in `SettingsHub`.
5. i18n + build pass.

---

## 17 · Hard "no" list

- No new routing library. We use `react-router-dom` 6.
- No new state manager. We use TanStack Query + Zustand.
- No new form library. We use Antd `Form`. (RJSF when a JSON-Schema driven form lands — pre-approved.)
- No new icon pack. New components use inline SVG.
- No CSS-in-JS runtime beyond styled-components (already in deps) and CSS Modules. No emotion, no stitches.
- No Tailwind. We use SAP Fiori tokens + CSS Modules.
- No Redux.
- No new animation library. Use CSS transitions or Antd's built-in.
- No `any` without an inline justification comment.
- No disabling TS strict checks in a config file.
- No committing with `tsc` or `vite build` broken.
- No binary assets in the UI tree larger than 200 KB. SVGs go to `/public`; rasters must be optimised.
- No tracking scripts, no third-party analytics, no CDNs other than those in `index.html`.
- No importing from `openmetadata-ui-core-components` — use `repoio-ui-core-components` for anything shared.
- No `@ui5/webcomponents-react` — Fiori styling is achieved through CSS tokens and CSS Modules, not UI5 web components.
- No hardcoded hex values for SAP Fiori semantic colours. Use `var(--sap…)` with a fallback.

---

## 18 · When in doubt

OpenMetadata is the structural reference for patterns we haven't migrated yet. Where its code uses a pattern this guide disallows (Tailwind, stray hex literal, `fetch` inline, `@ant-design/icons` import), **this guide wins**. Port the behaviour, not the deviation.

If you believe OpenMetadata's or another approach is better than what this guide prescribes, open a PR amending the guide first, then the code.

---

## 19 · How to extend this guide

This file ships in the repo (`repoio-ui/UI_AGENT_GUIDE.md`). To change a rule:

1. Open a PR with the change + a one-paragraph rationale.
2. Mohamed (or a delegate) reviews.
3. Merge. The next agent run reads the updated file.

Do **not** silently change behaviour in code without updating the guide.

---

## 20 · Current UI inventory (as of 2026-11-03)

For orientation only — reflects what shipped, not what you must preserve verbatim.

**Migrated to SAP Fiori Horizon (CSS Modules + tokens):**
- Shell: `FioriShellBar`, `NavigationMenu`, `AppShell`
- Pages: Home (Overview Page — matched to `design-reference/sap-s4hana/01-overview-page.svg`, approved 2026-11-03), Explore (List Report), Entity Detail (Object Page)
- Shared: `components/common/Fiori/` (DynamicPageHeader, OvpGrid, OvpCard, ObjectStatus)
- Styles: `tokens.css`, `variables.less`, `app.less`, `fonts.less`
- Component overrides: button, table, tabs, menu, form, select, tags, drawer, pagination, radio, toggle-switch

**Pending migration (still using OpenMetadata styling):**
- EntityListPage, LoginPage, PipelinesPage, SettingsPage and sub-pages
- Component overrides (old OM LESS variables mapped in `styles/components/legacy-om-variables.less`): add-edit-form-steps, code-mirror, entity-version-time-line, form-hint-doc, glossary, om-rdg, profile-picture, profiler, resizable-panels-component, rjsf, size, slider, step
- All remaining pages (≈ 50+ pages across Entities, Change Requests, Search, Quality, Workflows, Alerts, Integrations, Admin, Auth)

Total target: ≈ 57 pages. Every new page follows Fiori Horizon from the start.

---

*End of guide. If a rule here surprises you, open the PR — don't just route around it.*
