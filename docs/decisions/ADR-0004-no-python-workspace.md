# ADR-0004 — No Python Workspace screen in Phase 1; the Python runtime serves workflow Script steps only

- Status: **accepted** (2026-11-11, Mohamed)
- Amends:
  - README: technology table, milestone M8, §7.4, roadmap item 8,
    "Confirmed architecture decisions";
  - CLAUDE.md §5 (M8 routing);
  - `docs/milestone-plan.md` §M8;
  - `docs/user-journey.md` J8;
  - `docs/ui-pages.md`;
  - skill `repoio-workflow-python` (Part 2);
  - the prototype navigation.
- Does not change:
  - the Python execution invariants (CLAUDE.md §6.8);
  - the Script step in the flow designer (ADR-0002);
  - `repoio-python-runtime/`.

## Context

The kit planned a **Python Workspace** for M8: an editor with scripts,
optionally notebooks, isolated runs, logs and data previews. A question
about adding Jupyter notebooks with `%pip install` led to a review of
what the workspace is for. Every use case found already has a home:

| Use case | Where it lives |
|---|---|
| Custom logic in a governed process | The **Script** step of the flow designer (ADR-0002). Code is written in the step, versioned with the workflow, with a test run, and runs in isolated workers |
| Tuning matching and DQ rules | Data quality and match configuration screens (Splink, Great Expectations): settings and precision / recall results, no free code |
| One-off fixes and bulk corrections | Bulk upload as change requests (CSV / XLSX, per-row validation) |
| Exploration and analysis | Databricks, reading golden records through the Iceberg REST catalog federation (README §2.5) |
| Scheduled jobs | Airflow (`repoio-airflow-apis`) |
| AI agents | MCP server (`repoio-mcp`) |

A standalone workspace would still need its own editor, kernels, a
package mirror, package approvals and isolation. That is real
operational weight (CLAUDE.md §9) without a use case of its own.

## Decision

1. **There is no Python Workspace screen in Phase 1.** It is removed from
   the console navigation, the page catalog and the journeys. Notebooks
   and `%pip install` are not offered.
2. **The isolated Python runtime stays** (`repoio-python-runtime/`). It
   executes the Script steps of published workflows. It is invoked by
   Flowable through the secured worker integration, as the requesting
   user, with the script version audited. All CLAUDE.md §6.8 invariants
   apply unchanged:
   - disposable, resource-limited containers;
   - no Docker socket and no host mounts;
   - no outbound network by default.
3. **Packages come from an approved, pinned runtime image.** The flow
   is: pinned manifest → approval → build from an approved registry →
   scan → immutable image. Script authors pick from the packages in the
   image. There is no `pip install` at run time.
4. **M8 is narrowed** to "Python runtime for workflow Script steps":
   - workers;
   - limits;
   - the image pipeline;
   - RBAC at the API and worker boundaries;
   - audit;
   - negative tests.
5. **Revisit** when a recurring need appears that none of the homes above
   covers. A new ADR then decides between a script workspace and
   notebooks. If notebooks are chosen, `%pip` stays governed: it installs
   only allowlisted packages from an internal mirror, and anything else
   becomes a package request.

## Consequences

- Less to build and operate in M8. There are no kernels, no workspace
  UI and no per-session package installs.
- Script authoring and test runs happen in the Script step's panel. Its
  editor and test run are the only Python editing surface in the
  console.
- Journey J8 is retired. Its runtime and dependency requirements move
  into J7 (Script step) and the M8 acceptance list.
