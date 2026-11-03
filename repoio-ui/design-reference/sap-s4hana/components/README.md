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
| Dialogs (11 types) | `dialogs.svg` | Dialog (padding / no padding), Busy Dialog, Cloud File Browser, Keyboard Shortcuts, Personalization (P13n), Save as Tile, Select, Table Select, Value Help, View Settings, Wizard. Header title bold + bottom border; footer right-aligned: emphasized OK + transparent Cancel | `--sapDialog_*` | — | Tokens |
| Filter Bar, Adapt Filters Dialog | `filter-bar.svg` | Variant ("Standard ▾") on top; filter fields in a grid, label above field; Go (emphasized) + "Adapt Filters (n)" link; collapse + pin buttons centred on the bottom edge; collapsed shows "n filters active: …" | `--sapField_*`, `--sapVariant_*` | `common/Fiori/DynamicPageHeader` (variant part only) | Tokens |
| Flexible Column Layout | `flexible-column-layout.svg` | 1 / 2 / 3 columns: list → object page → detail. Column separators with drag handle; full-screen and close in the column header | — | — | Reference |
| Form Item, Form Group | `form.svg` | Horizontal (label left, `:` suffix) and vertical (label above). Required `*` in `#BA066C`. Display mode shows plain text. Number + currency / unit fields pair a value input with a unit select | `--sapField_*` | `form.less` | Tokens |
| Info Bar | `info-bar.svg` | Full-width strip, 32 high (Cozy 44). Regular `#F5F6F7`, pressed `#C2FCEE` with `#046C7A` text; close × at end | `--sapInfobar_*` | — | Tokens |
| Input, Tabular Suggestions, In-place Edit | `input.svg` | Height 26, radius 4, border `#556B81`, placeholder italic `#556B82`. Suggestions open as a table popover; mobile stacks fields. In-place edit: display text → field + ✓ / × buttons | `--sapField_*` | antd Input via `theme.ts` | Tokens |
| Message Box | `message-box.svg` | Dialog with state icon + title ("Error"), message text, "Show details" link, single emphasized OK | `--sapDialog_*` | — | Tokens |
| Message Strip | `message-strip.svg` | Error: background `#FFEAF4`, border `#FF8EC4`, icon `#F53232`, inline bold link, close × | `--sap*Background`, `--sap*BorderColor` | — | Tokens |
| Message View, Message Popover | `message-view-popover.svg` | Messages list grouped by section, filter segmented button (All / errors / warnings / success / info with counts), detail page with back arrow; popover opened from a message button | — | — | Reference |
| Micro Process Flow | `micro-process-flow.svg` | Chain of 12 px state circles (positive / critical / negative / neutral) joined by lines; icon variant; hover tooltip; "‹ 7" / "4 ›" overflow | `--sapProcessFlow_*` | — | Tokens |

## What changed in code because of batch 1

- `tokens.css`: text `#131E29`; button radius 8 and height 26; field border
  `#556B81` and height 26; focus `#0032A5` 2 px solid; negative element
  `#F53232`; status backgrounds (`#F5FAE5`, `#FFF8D6`, `#FFEAF4`, `#E8F3FF`);
  list hover `#EAECEE` and selection `#EBF8FF`; new density, message button,
  table, message strip, info bar, menu, dialog, avatar and process-flow tokens.
- `theme.ts`: antd moved off the OpenMetadata palette to the same values
  (primary `#0070F2`, text `#131E29`, Compact control height 26).
