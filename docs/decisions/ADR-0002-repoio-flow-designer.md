# ADR-0002 — Repo.io flow designer replaces bpmn-js; Flowable stays the engine

- Status: **accepted** (2026-11-09, Mohamed)
- Amends: README §7.2 (library table), §7.3, §7.6 install list and
  "Confirmed architecture decisions"; CLAUDE.md §4 traps;
  `docs/milestone-plan.md` §M7; `docs/user-journey.md` J7;
  `docs/ui-pages.md` (New workflows); skills `repoio-workflow-python`
  (Part 1) and `repoio-ui5-frontend` (wrapped libraries).
- Does not change: the workflow engine (Flowable behind an adapter),
  BPMN 2.0 as the executable format, versioning, immutability of
  published versions, audit, or any rule in CLAUDE.md §6.

## Context

The kit chose `bpmn-js` as the designer. The approved New workflow
prototype showed that business authors (stewards, domain owners) find a
free BPMN canvas hard to use: they see gateways, events and sequence
flows instead of the steps they think in, and can draw invalid diagrams
(dangling nodes, missing branches) that only validation catches.

The product owner asked for a step-card designer (reference: a node
canvas with cards, "+" between steps and a properties panel) built around
the steps of a governed request:

Begin → Template → Validation → Approval → Script → Write-back →
Notification → End, with Condition branches.

## Decision

1. **The designer is a Repo.io flow designer**, a pure OpenUI5 control
   (`control/FlowCanvas.js`) with no third-party diagram library. Steps
   are cards; steps are added only with "+" on an existing path, so every
   branch ends in an End and there are no dangling steps by construction.
   The layout is automatic (columns by step, a lane per branch) and
   mirrors for Arabic (RTL).
2. **Node set (v1):**
   - **Begin** — the request is submitted.
   - **Template** — exactly **one** request template per workflow, chosen
     from the published templates the user may see (server-filtered by
     role→domain grants). The workflow's domain is the template's domain.
     A template can still have several applicable workflows
     (`repoio-templates-refdata` rule 4 is unchanged).
   - **Approval** — approvers are named people (one or more) or a team;
     any one / all; SLA, reminder and escalation to a person or team.
     Outcomes: approved / rejected.
   - **Notification** — in-app alert and/or email; recipients: requester,
     approvers of earlier steps, teams, people; message with variables.
     Awareness only (CLAUDE.md rule 16).
   - **Script** — the author chooses the language and writes the code in
     the step (Python, or read-only SQL). Template fields are offered as
     names. Python runs only in the isolated workers (CLAUDE.md rule 8) as
     the requesting user; SQL runs read-only through Trino with the user's
     grants. The code is versioned with the workflow version.
   - **Validation** — a rule applied to the template's fields: a data
     quality rule (Great Expectations) or a duplicate check (Splink) with
     the source to compare with (golden records of the domain, or a
     registered source connection) and a threshold. Outcomes:
     passed / failed.
   - **Write-back** — source system (connections with write-back), the
     template's entity, and a field mapping from template fields to the
     target system's write-back allowlist, edited in the **Mapping**
     section of the step's side panel (Datasphere-style mapper).
     Code-list fields are translated with the target system's reference
     data. Conflict → review, retries. Execution unchanged (README §2.4,
     CLAUDE.md rule 13).
   - **Condition** — branch on a template field (yes / no).
   - **End** — completed / rejected / cancelled.
3. **The saved definition is a small JSON flow model**
   (`util/flowModel.js`). On publish, `repoio-service` compiles it to
   **BPMN 2.0** for Flowable: approvals → `userTask` + exclusive gateway,
   notifications → `sendTask`, script / validation / write-back →
   `serviceTask` calling Repo.io APIs (never `scriptTask`), conditions →
   exclusive gateways, Begin / End → start / end events. Repo.io settings
   travel as `repoio:*` attributes. "Export BPMN" shows that output.
4. **Code editing uses CodeMirror 6** (MIT), pinned and bundled from
   `repoio-ui/design-reference/openui5-prototype/tools/codemirror`, wrapped
   in `control/CodeEditor.js`. The README's Monaco choice for the Python
   Workspace (M8) is unchanged; CodeMirror 6 is the listed lightweight
   editor and fits a side panel.
5. `bpmn-js` is removed from the console. Anyone who needs to inspect the
   compiled BPMN uses the export (or Flowable's own tooling).

## Consequences

- Authors cannot draw arbitrary BPMN (parallel joins, loops, boundary
  events). v1 covers the governed request flow; anything else needs a new
  node type and an amendment to this ADR.
- The compiler from flow model to BPMN becomes a contract owned by
  `repoio-service` and needs tests (round trip, every node type, every
  branch ends, no `scriptTask`).
- A published version stays immutable: the flow model and its compiled
  BPMN are stored together with the version.
- The prototype implements the designer and the compile in the browser
  for review only; in the product the compile runs server-side.
