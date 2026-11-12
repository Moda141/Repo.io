---
name: repoio-ui5-frontend
description: Use when working on the Repo.io frontend — the OpenUI5 console, the migration from React, reusable UI5 custom controls and wrappers, or any M4 work. Trigger on tasks touching repoio-ui, repoio-ui5-components, OpenUI5/UI5 Tooling, bpmn-js / Monaco / ECharts / Cytoscape integrations, RTL/Arabic layout, or any screen, page, dialog, table or form in the console.
---

# Repo.io OpenUI5 Frontend (M4)

## What this domain owns

- `repoio-ui/` — the OpenUI5 console (Discover · Workbench · Admin):
  app shell, routing, models, binding, theming.
- `repoio-ui5-components/` — reusable controls (Table, Form, Diff,
  Lineage) and wrappers for third-party libraries.
- The incremental migration from the existing React application,
  screen by screen.
- The Templates catalog and request-form screens: the UI renders what
  the server-filtered templates / reference-data APIs return — rules
  and domain depth live in the `repoio-templates-refdata` skill.
- `repoio-ui/design-reference/` — approved HTML prototypes per page
  (visual contract). Rebuild a page in OpenUI5 from its prototype;
  never ship the prototype's sample data.
- `docs/user-journey.md` — the platform-wide persona journeys (J1–J13):
  the UX contract for console screens. Build and test each screen
  against its journey there, in RTL and LTR both.

## Non-negotiables

1. **OpenUI5 (Apache 2.0), not SAPUI5, not React.** The framework is
   OpenUI5. Before designing a screen around any control or theme, verify
   it exists in the OpenUI5 distribution — some SAP-licensed controls and
   themes ship only with SAPUI5. If one is genuinely required, stop and
   surface it as an explicit exception decision.
2. **Native controls first.** Shell, navigation, forms, tables, dialogs,
   tabs, notifications, admin screens — use standard OpenUI5 controls.
   Reach for a third-party library only when OpenUI5 lacks the capability
   or is materially worse at it.
3. **Every third-party library is wrapped.** Monaco (code editor), Apache ECharts (charts), Cytoscape.js (graphs),
   CodeMirror 6 (lightweight editor), Swagger UI (API reference) each live inside an OpenUI5 custom
   control or dedicated page component. Library DOM and event handling
   stays inside the wrapper and respects the OpenUI5 rendering and
   destruction lifecycle. Never let library DOM leak into views.
   The workflow designer is our own OpenUI5 control (ADR-0002), not a
   wrapped library.
4. **Never introduce React to host a JavaScript library.** The classic
   trap — "I'll just mount this React wrapper for Monaco" — re-imports
   the framework we are migrating away from.
5. **The UI is a consumer, not an owner.** Entity definitions and
   business rules come from `repoio-spec` + APIs. A screen that encodes
   matching or survivorship logic locally is wrong.
6. **RTL is first-class.** Arabic RTL and English LTR must both work on
   every screen — layout, binding, tables, charts. Test both directions;
   an RTL-only or LTR-only screen fails acceptance.
7. **Migration is screen-by-screen with parity.** Keep existing API
   contracts and behavior intact until the replacement screen passes
   functional testing against the React baseline. Never run two
   competing frameworks inside one screen without a documented reason.
8. **The UI container serves static assets only** (Nginx) — no Python
   execution deps, no database credentials. Backend access goes through
   the reverse proxy / API gateway.

## Build and tooling rules

- UI5 Tooling: `@ui5/cli`; npm packages via `ui5-tooling-modules`.
- Pin every dependency version; check license, maintenance status,
  security posture and bundle size before adding any package — do not
  install packages speculatively.
- Production builds must be tested inside Docker (the deployment target),
  not just `ui5 serve`.

## Verification (must pass before "done")

- Production build succeeds in the Docker image.
- Screen parity checklist vs the React baseline: data displayed, actions
  available, states (loading/empty/error) handled, RTL renders correctly.
- The wrapped third-party control destroys cleanly (navigate away and
  back — no leaked listeners or orphan DOM).
- No network calls bypass the API gateway path.

## Common pitfalls

- Deep-linking/routing regressions during migration (each migrated screen
  must restore its routes exactly).
- Hardcoding Arabic strings instead of i18n resource bundles (both
  directions must be translatable).
- Mixing RTL fixes with CSS hacks instead of using UI5's RTL support.
- "Temporary" React island inside an OpenUI5 screen.
