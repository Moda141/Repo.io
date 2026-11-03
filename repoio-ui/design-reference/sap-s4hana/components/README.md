# SAP component catalog

Exports from the SAP S/4HANA Web UI Kit (Community), one file per component
family. Each `.svg` is the original export. The `.preview.png` beside it is a
render you can open quickly.

**Rule:** before building any UI element, look for it here. If it exists, build
it to these specs using the tokens in `src/styles/tokens.css`. Build the shared
React component in `src/components/common/Fiori/` the first time a page needs
it, then reuse it. Do not hand-draw a variant on a page.

Density: every file shows **Compact** (desktop) and **Cozy** (touch). Repo.io
uses **Compact** by default.

Status column: **Built** = a shared component exists in code; **Tokens** = its
values are in `tokens.css` but no shared component yet; **Reference** = pattern
only, build when a page needs it.

## Batch 1 (2026-11-03)

| Component | File | Key specs (Compact) | Tokens | Code | Status |
|---|---|---|---|---|---|
| Avatar, Avatar Group, Avatar Badge | `avatars.svg` | Circle. Sizes 28 / 48 px. Initials on 6 accent pairs (pink, yellow, teal, violet, blue, magenta). Group overlaps with a "Team Members (n)" popover list | `--sapAvatar_1…6_*` | — | Tokens |
| Busy Indicator | `busy-indicator.svg` | Three dots growing left→right, `#0064D9` | `--sapBusyIndicator_Color` | — | Tokens |
| Button, Menu Button, Split Button, Message Button | `buttons.svg` | Height 26 (Cozy 36), radius 8. Emphasized `#0070F2`; default white, border `#BCC3CA`, text `#0064D9`. Message button: Error `#F53232`→hover `#E90B0B`; Warning `#E76500`→`#DD6100`; Success `#30914C`→`#2D8646`; Info `#E8F3FF`→`#D3E8FF`; Down state = white with colored border | `--sapButton_*` | antd Button via `theme.ts` + `button.less` | Tokens |
| Change Log | `change-log.svg` | SAP kit release notes (2026). Not a UI component | — | — | Reference |
| Feed Input | `feed-input.svg` | Avatar 48 + multi-line text area + transparent send button | `--sapField_*` | — | Reference |
| Analytical Table | `analytical-table.svg` | Toolbar: title, search (radius 4), Create (outlined) / Edit / Delete / Copy / Paste, settings, export, full screen. Header row white with bottom border; rows 32 (Cozy 44); group header rows `#EFF1F2` with chevron; group totals; status text `#256F3A`; row navigation chevron | `--sapList_*` | `table.less` | Tokens |
| Illustrated Message | `illustrated-message.svg` | Four sizes: Scene (L), Dialog (M), Spot (S), Dot (XS). Title + one-line description, centred | — | — | Reference |
| Menu | `menu.svg` | Popover, radius 8, items 32 high, optional icon `#758CA4`, submenu chevron, group separator | `--sapMenu_*` | `menu.less` | Tokens |
| Cards: Banner, Analytical, Calendar, List, Object, Table, Timeline, Stack | `cards.svg` | Same anatomy as Home (Overview Page). Card radius 16, header title 14 bold, counter "6 of 12" | `--sapCard_*` | `common/Fiori/OvpCard` + `pages/Home/cards/*` | Built |
| Comparison Pattern | `comparison-pattern.svg` | Object cards side by side with prev / next arrows, then collapsible attribute groups compared in columns | — | — | Reference |
| Dialogs (11 types) | `dialogs.svg` | Dialog (padding / no padding), Busy Dialog, Cloud File Browser, Keyboard Shortcuts, Personalization (P13n), Save as Tile, Select, Table Select, Value Help, View Settings, Wizard. Header title bold + bottom border; footer right-aligned: emphasized OK + transparent Cancel | `--sapDialog_*` | `common/Fiori/P13nDialog` (Personalization) | Built |
| Filter Bar, Adapt Filters Dialog (built: `common/Fiori/FilterBar`, used on Home) | `filter-bar.svg` | Variant ("Standard ▾") on top; filter fields in a grid, label above field; Go (emphasized) + "Adapt Filters (n)" link; collapse + pin buttons centred on the bottom edge; collapsed shows "n filters active: …" | `--sapField_*`, `--sapVariant_*` | `common/Fiori/DynamicPageHeader` + `FilterBar` | Built |
| Flexible Column Layout | `flexible-column-layout.svg` | 1 / 2 / 3 columns: list → object page → detail. Column separators with drag handle; full-screen and close in the column header | — | — | Reference |
| Form Item, Form Group | `form.svg` | Horizontal (label left, `:` suffix) and vertical (label above). Required `*` in `#BA066C`. Display mode shows plain text. Number + currency / unit fields pair a value input with a unit select | `--sapField_*` | `form.less` | Tokens |
| Info Bar | `info-bar.svg` | Full-width strip, 32 high (Cozy 44). Regular `#F5F6F7`, pressed `#C2FCEE` with `#046C7A` text; close × at end | `--sapInfobar_*` | — | Tokens |
| Input, Tabular Suggestions, In-place Edit | `input.svg` | Height 26, radius 4, border `#556B81`, placeholder italic `#556B82`. Suggestions open as a table popover; mobile stacks fields. In-place edit: display text → field + ✓ / × buttons | `--sapField_*` | antd Input via `theme.ts` | Tokens |
| Message Box | `message-box.svg` | Dialog with state icon + title ("Error"), message text, "Show details" link, single emphasized OK | `--sapDialog_*` | — | Tokens |
| Message Strip | `message-strip.svg` | Error: background `#FFEAF4`, border `#FF8EC4`, icon `#F53232`, inline bold link, close × | `--sap*Background`, `--sap*BorderColor` | — | Tokens |
| Message View, Message Popover | `message-view-popover.svg` | Messages list grouped by section, filter segmented button (All / errors / warnings / success / info with counts), detail page with back arrow; popover opened from a message button | — | — | Reference |
| Micro Process Flow | `micro-process-flow.svg` | Chain of 12 px state circles (positive / critical / negative / neutral) joined by lines; icon variant; hover tooltip; "‹ 7" / "4 ›" overflow | `--sapProcessFlow_*` | — | Tokens |

## Batch 2 (2026-11-03)

`Overview_page.svg` in this batch is identical to `../01-overview-page.svg`, so it is not stored twice.

| Component | File | Key specs (Compact) | Tokens | Code | Status |
|---|---|---|---|---|---|
| Multi Combo Box | `multi-combo-box.svg` | Field with tokens ("Notebook Basic 20 ×") + "2 More" link + dropdown chevron; states Regular / Hover / Active (list popover of options) / Read only (dashed bottom border) / Disabled | `--sapField_*` | antd Select (mode multiple) via `select.less` | Tokens |
| Navigation Menu | `navigation-menu.svg` | **Compact Main Menu is the one used** (approved 2026-11-03). Popover under the shell bar ☰ button, overlays the page (no side bar). 288 wide, 32 rows, section titles in label color, separator before footer items (All Spaces / App Finder). Second level "All Spaces" with search, pin icons, expandable groups | `--sapMenu_*` | `AppShell/NavigationMenu.tsx` | Built |
| Notifications | `notifications.svg` | Card-like items, radius 12: app icon in a circle, bold title, text, meta line "source • source • time" + "More"; overflow … and close ×. Popover groups by Today / Yesterday; "Important" negative tag | `--sapNotification_*` | — | Tokens |
| Quick View | `quick-view.svg` | Popover for a person or object: avatar + name + role, then label / value groups (links for phone, email). Mobile: full screen with "4 of 12" paging | — | — | Reference |
| Radio Button | `radio-button.svg` | 16 circle, label to the end; edit mode list under a field label; display mode shows the chosen value as text | `--sapField_*` | `radio.less` | Tokens |
| Segmented Button | `segmented-button.svg` | Outlined group, radius 8; selected item gets `#0064D9` border and `#EBF8FF` fill | `--sapSegmentedButton_*` | `radio.less` (`.new-radio-group`) | Tokens |
| User Menu | `user-menu.svg` | Popover 304 wide from the avatar: avatar 80 centred (edit badge), name bold, role lines, "Manage Accounts", item list with icons (Settings, Legal Information ›, About), footer with "Sign Out" transparent button at the end | `--sapMenu_*`, `--sapAvatar_*` | `AppShell/FioriShellBar.tsx` | Built |
| Network Graph | `network-graph.svg` | Free layout (circle nodes, colored edges) and column layouts (horizontal / vertical) with node cards: icon + title + key figures, state border and state icon; colored arrows for state | `--sapIndicationColor_*` | — | Reference (use for lineage / hierarchy) |
| Object Page Header | `object-page-header.svg` | Breadcrumb (with parent dropdown), bold title, actions (Edit emphasized, Delete, others outlined, share icon), image + attribute lines, KPI facets (label above large value, state colored), collapse + pin handle, tab bar under it. Wraps facets at L / M / S widths | `--sapObjectHeader_*` | Entity Detail page (pending re-check) | Tokens |
| Object Number, Object Status, Inverted Object Status, Object Identifier | `object-status.svg` | Status: icon in element color, text in darker text color — Information, Warning, Success, Error, Neutral. Interactive = underlined. Indication colors 1–8. Inverted = solid "Tag". Identifier: bold title + description; link variant blue | `--sap*TextColor`, `--sap*ElementColor`, `--sapIndicationColor_1…8` | `common/Fiori/ObjectStatus` (+ `IndicationText`) | Built |
| Overview Page | `../01-overview-page.svg` | See the Home page | — | `pages/Home` | Built |
| Planning Calendar | `planning-calendar.svg` | Rows per person (avatar + name + byline), time grid with Days / Weeks / Months / One Month / One Week views, colored appointment blocks, "Today" + date navigation | — | — | Reference |
| Process Flow | `process-flow.svg` | Lanes with circular step nodes (icon, progress ring colored by state), connector lines (planned dashed, regular, highlighted), node cards with states Regular / Read only / Hover / Pressed / Disabled / Dimmed / Selected; "»" chevron nodes | — | — | Reference (use for workflows) |
| SAP Icons | `sap-icons.svg` | The SAP icon font glyph sheet (~600 icons). Draw inline SVG icons to match this style: 16 px, 1.5–1.8 stroke, rounded caps | — | inline SVGs in components | Reference |
| Generic Tag | `tags.svg` | 24 high, radius 8, **6 px state bar at the start edge**, tinted background (Error `#FFEAF4`, Warning `#FFF8D6`, Success `#F5FAE5`, Information `#E1F4FF`, Neutral `#EFF1F2`), icon + label + colored value; hover grey `#EAECEE`; active border `#0032A5`; situation and removable (×) variants | `--sapGenericTag_*` | — | Tokens |
| Timeline | `timeline.svg` | Vertical and horizontal, single or double sided; year group pills ("› 2024"); items are bordered boxes with initials avatar, blue name + role, timestamp, text, optional Edit / Delete links | — | `pages/Home/cards/StewardsCard` (single-sided) | Tokens |
| Variant Management | `variant-management.svg` | Title sizes H1–H6 + snapped (collapsed header) size; states Regular / Hover / Active / Disabled. "My Views" popover (list + Save / Save As / Manage), Save View dialog (label, Set as Default, Public), Manage Views table (favorite star, sharing, default radio, created by) | `--sapVariant_*` | `common/Fiori/DynamicPageHeader` (title only — popover pending) | Tokens |
| Visual Filter Bar | `visual-filter-bar.svg` | Filter bar of small charts (bar by country, line by month, donut by category) that filter on click; collapsed shows active filter tags | `--sapChart_*` | — | Reference |
| VizFrame Charts | `vizframe-charts.svg` | SAP marks VizFrame as discontinued. Use the chart styles only: stacked column, line, bullet (vertical), donut, with legends under the chart | `--sapChart_*` | `common/EChart` | Tokens |

## What changed in code because of batch 2

- Navigation: the side bar is gone. ☰ now opens `NavigationMenu`, a popover
  that overlays the page, as in `navigation-menu.svg`.
- User menu rebuilt to `user-menu.svg`: large centred avatar, name, role,
  icon items, Sign out in the footer.
- `ObjectStatus`: text uses the darker text color and the icon the element
  color; added Information and Neutral states and `IndicationText` (colors 1–8).
- New tokens: status text / element colors, indication colors 1–8, generic
  tag, segmented button, notification item.

## What changed in code because of batch 1

- `tokens.css`: text `#131E29`; button radius 8 and height 26; field border
  `#556B81` and height 26; focus `#0032A5` 2 px solid; negative element
  `#F53232`; status backgrounds (`#F5FAE5`, `#FFF8D6`, `#FFEAF4`, `#E8F3FF`);
  list hover `#EAECEE` and selection `#EBF8FF`; new density, message button,
  table, message strip, info bar, menu, dialog, avatar and process-flow tokens.
- `theme.ts`: antd moved off the OpenMetadata palette to the same values
  (primary `#0070F2`, text `#131E29`, Compact control height 26).
