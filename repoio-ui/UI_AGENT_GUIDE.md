# Repo.io UI — Agent Build Guide

> **READ THIS BEFORE ADDING ANY COMPONENT, PAGE, STYLE, ROUTE OR DEPENDENCY TO THE UI.**
> This document is the contract. Deviations need a human review on PR.
> Owner: Mohamed (Data Management & Analytics, Nahdet Misr).
> Scope: `repoio-ui/src/main/resources/ui`.
> Last reviewed: 2026-11-02.

The point of this file is to keep Repo.io feeling like **one coherent app** as more hands add to it. Every rule below has a reason, and the reason is given — if you think a rule should bend for your case, read the reason, then say why in the PR.

---

## 0 · The one-page summary

1. **Follow the OpenMetadata look.** Primary `#1570EF`, 84 px dark icon rail, 64 px white top bar, `#F8F9FC` content background, Inter + IBM Plex Sans Arabic, 8 px radius, Antd 5. Design tokens live in `src/styles/theme.ts`. Never hardcode a palette value — use the token.
2. **Antd first, custom last.** If Antd 5 has a component for the job (Table, Form, Modal, Drawer, Tabs, Timeline, Steps, Descriptions, Progress, Tag, Card, Space, Row/Col), use it. Build a custom component only when none fits.
3. **Charts go through `src/components/common/EChart.tsx`.** Never import echarts-for-react directly in a page. Palette, font, grid defaults are centralised there.
4. **New page = new file in `src/pages/<Area>/<PageName>Page.tsx`.** Every page starts with `<PageHeader title subtitle actions>` from `src/components/common/PageHeader.tsx`. One page per route; no "mega-pages" that render six screens.
5. **Routes are named constants in `src/constants/routes.ts`.** No string literals in `<Route path>` or `<Link to>`. Build parameterised URLs with `generatePath(ROUTES.X, {…})`.
6. **i18n every user-visible string.** Add the key to BOTH `src/locale/languages/en-us.json` and `ar-eg.json` in the same change. Nothing hardcoded in TSX.
7. **Server state → TanStack Query. Durable client state → Zustand.** Local UI state → `useState`. Nothing else.
8. **REST calls go through `src/rest/axiosClient.ts`.** Never `fetch` or raw `axios.get` from a page.
9. **Static sub-routes before `:id`.** `/entity/:type/new` is registered BEFORE `/entity/:type/:id`.
10. **Build must pass.** `npx tsc --noEmit` and `npx vite build` are the gates. If you added a dep, update `vite.config.ts` `manualChunks` if the chunk would exceed 500 KB.

If you can't say "yes" to all ten, don't publish.

---

## 1 · Where things live

```
repoio-ui/src/main/resources/ui/
├─ index.html                 Entry
├─ package.json               Deps · ONLY add via a §9 bump
├─ vite.config.ts             Build + proxy + chunk splits
├─ tsconfig.json              Strict TS, @/ alias
└─ src/
   ├─ main.tsx                React root
   ├─ AppRoot.tsx             Providers (Query, I18n, Antd theme, Router)
   ├─ App.tsx                 Route table — EVERY route lives here
   ├─ queryClient.ts          Shared TanStack client (singleton)
   │
   ├─ components/
   │  ├─ AppShell/            84px rail + 64px top bar; don't touch
   │  └─ common/              Shared primitives (PageHeader, EChart,
   │                           ErrorBoundary). Add here when 2+ pages
   │                           need the same thing.
   │
   ├─ constants/
   │  └─ routes.ts            All routes + ENTITY_TYPES
   │
   ├─ hooks/
   │  └─ useApplicationStore.ts   Zustand store (persisted)
   │
   ├─ locale/
   │  ├─ i18n.ts
   │  └─ languages/{en-us,ar-eg}.json
   │
   ├─ pages/<Area>/           ONE page per file. See §4.
   │
   ├─ rest/
   │  ├─ axiosClient.ts       Shared axios instance (do NOT duplicate)
   │  └─ <entity>.ts          Typed call helpers per entity
   │
   ├─ styles/
   │  ├─ theme.ts             Antd ThemeConfig + token exports
   │  └─ global.css           Reset + body font + scrollbar
   │
   └─ types/                  Shared TS types that cross module boundaries
```

**Rules:**

- A page gets its own folder (`pages/Entity/`, `pages/Quality/`, …) once there's a second page in the same area. Lone pages (`NotFoundPage.tsx`) can sit at `pages/` root.
- Area name is **PascalCase**: `pages/ChangeRequests`, `pages/Workflows`.
- File name is **`<Something>Page.tsx`**: `WorkflowBuilderPage.tsx`. Default export is the component with the same name.
- Shared primitives live in `components/common/`. Area-specific components live next to the page that uses them, in a sibling file.
- Co-located CSS Modules use `<Component>.module.css` and are imported as `styles from './X.module.css'`.
- Do NOT invent new top-level folders (`services/`, `utils/`, `helpers/`). Put utilities in a sibling file next to the only caller, or in `src/components/common/` if shared. If something truly cross-cutting shows up, open a PR and amend §1.

---

## 2 · The design system (non-negotiable)

### Colors — use the token, never the hex

```ts
import { tokens } from '@/styles/theme';
// tokens.colorPrimary, tokens.colorSuccess, tokens.colorBgLayout, tokens.sidebarBg
```

The brand palette:

| Semantic         | Token                     | Value       |
|------------------|---------------------------|-------------|
| Primary          | `colorPrimary`            | `#1570EF`   |
| Violet accent    | (in gradients only)       | `#6938EF`   |
| Success          | `colorSuccess`            | `#12B76A`   |
| Warning          | `colorWarning`            | `#F79009`   |
| Error            | `colorError`              | `#F04438`   |
| Info / cyan      | `colorInfo` / local       | `#1570EF` / `#06AED4` |
| Layout bg        | `colorBgLayout`           | `#F8F9FC`   |
| Container bg     | `colorBgContainer`        | `#FFFFFF`   |
| Border           | `colorBorder`             | `#E4E7EC`   |
| Border secondary | `colorBorderSecondary`    | `#EAECF0`   |
| Text             | `colorText`               | `#101828`   |
| Text secondary   | `colorTextSecondary`      | `#475467`   |
| Text tertiary    | `colorTextTertiary`       | `#667085`   |
| Sidebar bg       | `sidebarBg`               | `#0C111D`   |

For a tinted background behind an icon, use the brand color at `1A` alpha (10%):
`background: ${tokens.colorPrimary}1A` and `color: ${tokens.colorPrimary}`.

### Type

- UI font: **Inter**.
- Arabic UI font: **IBM Plex Sans Arabic** — swapped automatically on `html[dir="rtl"]` via `src/styles/global.css`.
- Monospace / code: **JetBrains Mono** (fallback `Menlo`, `Monaco`, `Consolas`). Use for IDs (`<code>CUST-000142</code>`), YAML/JSON, logs.
- Headings use Antd's `<Title level={3}>` inside `PageHeader`. Don't invent sizes.
- Body text uses Antd's `<Text>`. Secondary labels use `<Text type="secondary">`.

### Spacing & radius

- Base radius: **8 px** (`borderRadius`). Large: 12. Small: 6.
- Control height: 36 (default), 40 (large), 28 (small). Use Antd `size="small"` for inline tables.
- Grid gutter: **16** inside a card, **24** between major rows.
- Page content padding is set by `AppShell`; a page never adds its own outer padding.

### Icons

- Only `@ant-design/icons`. Don't bring in a second icon pack.
- Pick icons that read at 16/20 px — avoid overly detailed ones.
- Icon-only buttons MUST have an `aria-label`.

---

## 3 · Dark sidebar nav

The 84 px icon rail is the ONLY global nav. Rules:

- Max 7 items. If you need an 8th, something else leaves.
- Each item is an `@ant-design/icon` + a `t('nav.<key>')` tooltip (shown on hover, LTR + RTL).
- Add nav items by editing `components/AppShell/Sidebar.tsx` (the `navItems` array) and `locale/languages/{en-us,ar-eg}.json` under `nav.*`. Don't branch outside this file.
- Sub-nav lives INSIDE the page (as Tabs, Segmented, Steps, or a left secondary rail), NEVER on the global sidebar.

Current primary nav (do not break): Home, Explore, Entities, Change requests, Pipelines, Quality, Settings.

---

## 4 · Page anatomy

Every page follows this shape:

```tsx
import { PageHeader } from '@/components/common/PageHeader';
import { useTranslation } from 'react-i18next';
import { Row, Col, Card } from 'antd';

export default function MyPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t('page.my.title')}
        subtitle={t('page.my.subtitle')}
        actions={/* 1–3 buttons, primary action rightmost */}
      />

      {/* Optional: 2–4 KPI cards in a Row(gutter=16) with Col xs/md/6 */}

      {/* Main content: Card(s) with Table, Form, Tabs, or Timeline */}
    </>
  );
}
```

- **`PageHeader` is mandatory.** It also sets `document.title` via Helmet.
- **Max 1 primary button** per page header (rightmost).
- **Max 4 action buttons** per header. More means the page is doing too much.
- **No raw `<h1>…<h6>`** outside Antd's `Typography.Title`.
- **Breadcrumbs** are not used in Repo.io — the page title and the AppShell nav are the context.

### Lists → table

Use **Antd `<Table>`**. Columns are declared as `ColumnsType<RowType>`. Give **every column a width** except the most-flexible one (usually "Name" or "Summary") that fills remaining space. Status columns use `<Tag bordered={false} color="…">`.

### Forms → `<Form layout="vertical">`

Vertical layout, label above field. One field per row on narrow, 2 on medium, 3 on wide. **Never** inline-labels, **never** Antd's `horizontal` layout — it reads cramped in Arabic.

### KPI cards

4 identical `<Card>` nodes in a `<Row gutter={16}>` with `<Col xs={12} md={6}>`. Each Card has:

```tsx
<Space direction="vertical" size={0}>
  <Text type="secondary">Label</Text>
  <span style={{ fontSize: 24, fontWeight: 600 }}>Value</span>
</Space>
```

If you need delta/arrows, use `RiseOutlined` / `FallOutlined` + color `#027A48` (positive) / `#B42318` (negative).

---

## 5 · Routing

- Every route lives in `src/constants/routes.ts` as a constant on `ROUTES`.
- Every `<Link>` and every `navigate()` call uses `ROUTES.X` or `generatePath(ROUTES.X, {…})`.
- **Static before dynamic.** `/x/new` is registered BEFORE `/x/:id` in `App.tsx`.
- Nested sub-routers (like `SettingsPage`) are allowed when a surface owns a whole area — but they still register their children in one place.
- Query params are read with `useSearchParams()`; never parse `window.location.search` by hand.
- URL params are the only way to pass state between pages. Don't rely on React state to survive a navigation.

---

## 6 · State

| Need                                             | Use                              |
|--------------------------------------------------|----------------------------------|
| Data from the server (list, fetch, mutate)       | **TanStack Query** (hooks in `rest/`) |
| Current user, feature flags, UI prefs            | **Zustand** (`useApplicationStore`) |
| One-page UI state (open/close, form input, selected row) | `useState` |
| Cross-page state that isn't server data          | URL params. If URL doesn't fit, Zustand. |
| Heavy derived data                                | `useMemo`                         |

Rules:

- **Never** put server data in Zustand. Query owns the cache.
- **Never** stash secrets or tokens in Zustand `persist`. Tokens live in `localStorage` under `repoio-token` only.
- A new Zustand store needs a PR note explaining why `useApplicationStore` + persist can't hold the state.

---

## 7 · REST & API

- All HTTP goes through `src/rest/axiosClient.ts`. It carries the Bearer header, clears the Query cache on 401, and redirects to `/login`.
- Group endpoints by entity in `src/rest/<entity>.ts`. Export typed helpers (`listEntities`, `getEntity`, `patchEntity`).
- Base URL is `/api`. In dev, Vite proxies to `http://localhost:8585` (repoio-service). In prod it's same-origin.
- Request/response shapes come from the backend's OpenAPI. Regenerate TS types with `yarn api:gen` (added when backend ships) and import from `src/types/generated`. Until that lands, keep local types minimal and clearly marked `// TODO: regenerate from spec`.
- No endpoint, model, or mutation goes live without a matching change to `repoio-spec/src/main/resources/json/schema/entity/<entity>.json`. Backend owns the contract; UI follows.

---

## 8 · Charts

Any chart — bar, line, area, scatter, pie, stacked, candlestick, heatmap — goes through `src/components/common/EChart.tsx`, which wraps `echarts-for-react`. The wrapper injects:

- The Repo.io palette (6 brand colors).
- Inter / IBM Plex Sans Arabic font.
- Dark tooltip (bg `#101828`, white text).
- Consistent grid insets.

```tsx
import EChart from '@/components/common/EChart';

const option = {
  xAxis: { type: 'category', data: trendDays, axisLabel: { color: '#667085' } },
  yAxis: { type: 'value', axisLabel: { color: '#667085' } },
  series: [{ type: 'line', data: scores, smooth: true, showSymbol: false }],
};

return <EChart option={option} height={280} />;
```

- Threshold / goal lines go in a lighter shade of the same series color.
- Bars above/below a threshold use `itemStyle: { color: isAbove ? success : neutral }`.
- Area under a trend line uses a linear gradient from the series color at `0.18` alpha to transparent.
- Never embed charts larger than 400 px tall in a KPI row.

---

## 9 · Dependencies

The approved runtime deps are listed in `package.json`. Before adding a new one:

1. Is there already a dep that does this? (lodash, dayjs, antd, echarts, tanstack/react-query, axios, i18next, zustand, qs). If yes, use it.
2. Can it be done without a new library in ≤ 50 lines of code? If yes, write it.
3. Does the OpenMetadata UI use the same library? If yes, match its version to within one minor.
4. Is the package maintained (released in the last 12 months, ≥ 1k weekly downloads)?

If you still need the dep:

- Pin a minor version (`^5.3.0`, not `*`).
- Add it to the matching `manualChunks` entry in `vite.config.ts` if its contribution to any chunk would exceed 150 KB gzipped.
- Note in the PR which features it unlocks.

**Pre-approved heavy libs** (already in or planned): `echarts`, `echarts-for-react`, `antd`, `@ant-design/icons`, `@tanstack/react-query`, `zustand`, `i18next`, `react-i18next`, `axios`, `styled-components`, `dayjs`, `lodash`, `qs`.

**On the port list** (ok to add when the first page that needs them lands):
`reactflow` (lineage, workflow graph), `@uiw/react-codemirror` + the CodeMirror packages (YAML/SQL/JSON editors), `@tiptap/*` (rich-text in CR comments), `@rjsf/*` (schema-driven forms when the Settings pages need them), `react-awesome-query-builder` (if the Query Builder page is upgraded past our custom builder).

---

## 10 · i18n

- Every user-visible string goes through `t('…')`.
- Keys live in `src/locale/languages/en-us.json` and `ar-eg.json` with identical shape. Both files are updated in the same change.
- Namespace keys by surface: `nav.*`, `actions.*`, `entity.*`, `page.<area>.*`, `user.*`, `auth.*`.
- Interpolate with `{{var}}`: `t('invite.subject', { email })`.
- Pluralize with `t('entity.records', { count })` — don't hand-concatenate "1 record" / "N records".
- RTL is applied in `AppRoot` via `document.documentElement.dir`. Do not add `dir="rtl"` to your own elements unless you're overriding a specific component (as the email template editor does).
- Date and number formatting respect the user's `dateFormat` / `numberFormat` preference (set on Profile). Format with `dayjs` and `Intl.NumberFormat` — never raw `.toLocaleString()` with no explicit locale.

---

## 11 · Accessibility & responsiveness

- All interactive elements use native keyboard controls (Antd gives you this).
- Icon-only buttons: `aria-label`.
- Modals: use `<Modal title=…>` so the title announces.
- Color is never the only signal — pair with a tag label (e.g. `WARN` text + warning color).
- Minimum target: readable on 1280 × 800. The layout uses `<Row gutter>` + `<Col xs md lg xl>`. Default `xs={24}` so pages reflow to a single column on narrow.
- Tables set `scroll={{ x: 'max-content' }}` if any single column would overflow narrow.

---

## 12 · Workflow for adding a new page

1. **Read §0–§5 again.** Yes, every time. It takes 90 seconds.
2. Add the route constant to `src/constants/routes.ts`.
3. Create `src/pages/<Area>/<Name>Page.tsx` from the §4 template.
4. Register it in `App.tsx`.
5. Add i18n keys to BOTH languages.
6. Wire it into the parent navigation (sidebar OR a page's actions row OR SettingsHub cards OR a hub page).
7. Run `npx tsc --noEmit && npx vite build`. Both must pass.
8. Open a PR. Mention which items in this file your change touches.

---

## 13 · Workflow for adding a new component

Shared primitive (used by ≥ 2 pages or planned to be):

1. `src/components/common/<Name>.tsx` plus `.module.css` if needed.
2. Default export, PascalCase name matches file.
3. Props are a typed interface, documented at least by name.
4. One short usage comment at the top of the file explaining when to reach for it.
5. No business logic. If it needs to fetch data, pass data in via props; let the page do the fetching.

Area-specific component (used by one page):

1. Sibling file next to the page: `src/pages/Workflows/StepBuilder.tsx`.
2. Same rules; just scoped by location.

Chart component: see §8.

---

## 14 · Workflow for adding a route under Settings

Settings is a nested router in `src/pages/Settings/SettingsPage.tsx`. To add a sub-page:

1. Add the route constant to `routes.ts` (e.g. `SETTINGS_X`).
2. Add the component file at `src/pages/Settings/<Area>/<Name>Page.tsx` for a group, or `src/pages/Settings/<Name>Page.tsx` for a single page.
3. Add a `<Route path="x" element={<XPage />}>` in the `SettingsPage` `<Routes>`.
4. Add a hub card to the `cards` array in `SettingsHub`.
5. i18n + build pass.

---

## 15 · Hard "no" list

- No new routing library. We use `react-router-dom` 6.
- No new state manager. We use TanStack Query + Zustand.
- No new form library. We use Antd `Form`. (RJSF when a JSON-Schema driven form lands — pre-approved in §9.)
- No new icon pack.
- No CSS-in-JS runtime beyond what styled-components (already in deps) and CSS Modules give us. Don't add emotion, don't add stitches.
- No Tailwind. We use design tokens + CSS Modules.
- No Redux. Not now, not later.
- No new animation library. If you need motion, use CSS transitions or Antd's built-in.
- No `any` without an inline justification comment.
- No disabling the TS strict checks in a config file.
- No committing with `tsc` or `vite build` broken.
- No binary assets in the UI tree larger than 200 KB. Images go to `/public` as SVG; raster assets must be optimized.
- No tracking scripts, no third-party analytics, no CDNs other than those listed in `index.html` (Google Fonts).
- No importing from `openmetadata-ui-core-components` (that package is OpenMetadata's internal; we have our own `repoio-ui-core-components` for anything shared).

---

## 16 · When OpenMetadata and this guide disagree

OpenMetadata is the structural reference, not a specification. Where its code uses a pattern this guide disallows (e.g. a Tailwind class, a stray hex literal, `fetch` inline), **this guide wins**. Port the behavior, not the deviation.

If you believe OpenMetadata's approach is better than what this guide prescribes, open a PR amending this guide first, then the code.

---

## 17 · How to extend this guide

This file ships in the repo (`repoio-ui/UI_AGENT_GUIDE.md`) and is referenced by the backend-of-house agent prompt. To change a rule:

1. Open a PR with the change to this file + a one-paragraph rationale.
2. Mohamed (or a delegate) reviews.
3. Merge. The next agent run reads the updated file.

Do **not** silently change behavior in code without updating the guide.

---

## 18 · Current UI inventory (as of 2026-11-02)

For orientation only — this reflects what shipped, not what you must preserve verbatim.

- Shell: Home, Explore
- Entities: list, detail, edit, new, hierarchy, lineage, duplicates list, duplicate review, merge
- Change requests: list, detail, new, mine
- Search: results, query builder, saved views, export wizard
- Pipelines: list, detail, edit, new
- Sources: list, detail, new
- Quality: dashboard, rule editor, matching, survivorship, playground
- Workflows: list, builder, detail, runs
- Alerts: list, editor, channels, history
- Integrations: hub, webhooks, share links, embeds, API reference
- Email (under Settings): templates, template edit, settings, log
- Admin (under Settings): users, roles, SSO, API keys, audit, schema list, schema editor, settings hub
- Auth & common: login, profile, notifications, 404

Total ≈ 57 pages. Every one obeys the rules above.

---

*End of guide. If a rule here surprises you, open the PR — don't just route around it.*
