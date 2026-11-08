# Module README Template

Every module in Repo.io gets a README following this template. Copy it to
`<module>/README.md`, fill every section, and keep it current — a README
that lies is worse than none. Delete any section that genuinely does not
apply, but say why in one line rather than leaving it empty.

---

# <module-name>

> Status: **planned | in-progress | implemented**
> Milestone: <M# — or "enabler, no milestone">
> Owner domain: <e.g. entity-model / ingestion / iceberg / streaming /
> ui5 / mcp / platform-ops / workflow-python / ontology>

Be honest about status — this line is what the root README's milestone
table and the agent's reports are checked against.

## Purpose

Two or three sentences: what this module does for Repo.io and what it
deliberately does **not** do (its boundary).

## Entry points

| Entry point | What it is |
|-------------|------------|
| `<path/class>` | main class / job / endpoint / page |

## Build

```bash
# real, runnable commands — discovered from Makefile/CI, not aspirational
```

## Run (local dev)

```bash
# how to run it against the dev compose stack
```

## Test

```bash
# unit + integration commands; note any external deps
```

## Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `ENV_VAR` | what it controls | — | yes/no |

No real values in this table — placeholders and the secret store only.

## Dependencies

- Upstream (what this module calls)
- Downstream (what calls this module)
- Key pinned libraries and why

## API surface / contracts

- Endpoints, topics, schemas or CRDs this module exposes. Link to the
  `repoio-spec` artifact rather than duplicating field lists.

## Operational notes

- Logging, metrics, health checks, failure modes, DLQ/retry behavior —
  whatever an on-call engineer needs at 2 a.m.

## Related specs

- `openspec/changes/<id>` and ADRs affecting this module.
