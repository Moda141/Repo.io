# Repo.io Agent Kit — for Claude Code

This kit contains everything an AI agent (Claude Code) needs to implement
Repo.io, the lakehouse-native MDM platform for Nahdet Misr Publishing Group,
following the architecture in the root README (`README_repoio_openui5.md`).

## What's inside

| File | Purpose |
|------|---------|
| `README_repoio_openui5.md` | The architecture document itself — the source of truth the kit executes. Install it as the repo's root `README.md` (step 4 below). |
| `CLAUDE.md` | Main instruction file. Claude Code reads it automatically at the start of every session. Contains the milestone → skills routing table, hard guardrails and the verification protocol. |
| `.claude/skills/repoio-*/SKILL.md` | 11 domain skills. Each one loads only when work touches its domain (entity model, ingestion, Iceberg, streaming/MDM, OpenUI5, MCP, platform ops, workflow+Python, ontology, integrations/connections/write-back, templates/reference data). |
| `docs/milestone-plan.md` | Acceptance criteria for milestones M1–M9. Each milestone has a verifiable exit gate. |
| `docs/user-journey.md` | Platform-wide user journeys — personas, cross-cutting UX rules and step-by-step journeys J1–J13 for every console area, mapped to milestones. The UX contract for M4+ screens. |
| `docs/ui-pages.md` | The console navigation map — every UI page with its scope, journey mapping, the conflict-check log and the locked risk/gap resolutions. Screens are built page by page from this file. |
| `docs/module-readme-template.md` | Standard README template every module must use. |

## Installation (4 steps)

From this folder, copy into the **root of the Repo.io repository**:

```bash
# 1. Main instruction file (repo root)
cp CLAUDE.md  /path/to/repoio/CLAUDE.md

# 2. Skills (Claude Code discovers them automatically)
cp -r .claude /path/to/repoio/.claude

# 3. Execution plan + UX journeys + template
mkdir -p /path/to/repoio/docs
cp docs/milestone-plan.md docs/user-journey.md docs/ui-pages.md docs/module-readme-template.md /path/to/repoio/docs/

# 4. The architecture README — CLAUDE.md references it as the source of
#    truth. Install it as the repo root README (adjust if the repo already
#    has one — keep the content, merge headings if needed):
cp README_repoio_openui5.md /path/to/repoio/README.md
```

After copying, open Claude Code in the repository root and start with:

> "Read CLAUDE.md, tell me the current milestone status, and draft the spec
> for the next milestone."

## How the pieces work together

1. **CLAUDE.md is always in context.** It routes every task to the right
   skill(s) based on the milestone being worked on.
2. **Skills carry the domain depth.** Claude Code loads a skill when its
   description matches the task — the routing table in CLAUDE.md makes this
   deterministic instead of hopeful.
3. **`docs/milestone-plan.md` is the definition of done.** No milestone is
   complete until its acceptance checklist passes.
4. **`docs/user-journey.md` is the UX contract.** The root README keeps
   architecture decisions; the journey file carries persona-level
   sequencing; `docs/ui-pages.md` fixes the page map they land on.
   Console screens are built and tested against all three.
5. **The root README stays the source of truth** for architecture. These
   files encode how to *execute* it, not a replacement for it.

## Maintenance rules

- When the root README architecture changes, update CLAUDE.md §4
  (technology choices) and the affected skill in the same commit.
- When a milestone completes, update the milestone table in the root README
  and check off the acceptance list in `docs/milestone-plan.md`.
- Keep skills under 500 lines. Move deep detail into `references/` files
  inside the skill folder when they grow.
