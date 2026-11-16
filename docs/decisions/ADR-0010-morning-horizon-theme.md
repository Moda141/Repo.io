# ADR-0010 — Console theme: Morning Horizon (sap_horizon)

- Status: **accepted** (2026-11-16, Mohamed)
- Supersedes: the theme in CLAUDE.md §4 (`sap_fiori_3`, Quartz Light).
- Amends:
  - CLAUDE.md §4 (technology table and traps) and §8 (decisions list);
  - `docs/ui-pages.md` (shell and theme);
  - `docs/user-journey.md` J1;
  - `docs/milestone-plan.md` M4;
  - `repoio-ui/UI_AGENT_GUIDE.md`, `repoio-ui/design-reference/README.md`,
    the OpenUI5 prototype README.
- Does not change:
  - OpenUI5 (Apache 2.0), not SAPUI5;
  - the shell controls: `sap.tnt.ToolPage` + `ToolHeader` +
    `SideNavigation` with search;
  - Arabic RTL and English LTR as first-class directions;
  - no dark variant in v1.

## Context

The console was built on Quartz Light (`sap_fiori_3`), with a black
shell header and a dark blue side navigation added in custom CSS. The
owner wants the whole tool on SAP's current visual language, Morning
Horizon (light), the default theme of current SAP Fiori and S/4HANA.

## Decision

1. The console theme is **`sap_horizon`** (Morning Horizon, light),
   applied at bootstrap. It ships in OpenUI5 1.136
   (`themelib_sap_horizon`), so no SAPUI5-only exception is needed.
2. The shell header and side navigation use Horizon's own look. The
   custom black header and dark blue navigation are removed; the logo
   uses the light-background version.
3. Custom CSS takes its colours from theme parameters
   (`var(--sapTextColor)`, `--sapBrandColor`, `--sapContent_LabelColor`,
   `--sapGroup_ContentBorderColor`, the semantic colours …) with the old
   values only as fallbacks, so screens follow the theme instead of
   hard-coded Quartz colours.
4. **One font.** Latin text uses the theme font (SAP 72); Arabic
   characters use Noto Sans Arabic (SIL OFL 1.1, bundled with the app,
   no font CDN), added to the theme font variables for the Arabic range
   only. IDs and codes use the same font with tabular digits; only code
   editors use 72Mono. The console is one step denser (root size 15px).
5. The published prototype loads the `sap_horizon` theme files
   (`publish/framework-files.txt`), collected from `ui5 serve`.

## Consequences

- Screens look like current SAP Fiori apps (rounded fields and cards,
  brand blue `#0070f2`, 72 font family).
- A few custom tints (chart palette, lineage purple, segment colours)
  are still fixed colours; they read well on Horizon and can move to
  theme parameters when touched.
- Screenshots in `repoio-ui/design-reference/prototypes/openui5/` taken
  before 2026-11-16 show Quartz Light.
