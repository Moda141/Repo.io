# AGENTS.md

Guidelines for AI coding agents working in this repository.
Modeled after OpenMetadata's AGENTS.md. See [CONTRIBUTING.md](CONTRIBUTING.md)
for the human-facing guide.

## Before touching the UI

**Read [`repoio-ui/UI_AGENT_GUIDE.md`](repoio-ui/UI_AGENT_GUIDE.md)
before adding any component, page, style, route, or dependency to
`repoio-ui/src/main/resources/ui`.** That guide is the UI contract —
design tokens, folder layout, routing conventions, state rules, chart
wrapper, i18n, and the hard "no" list. Deviations need a human review
on PR.

## Before touching the backend

- Spec first: every REST/MCP change starts in
  `repoio-spec/src/main/resources/json/schema/entity/<entity>.json`.
- Backend writes land in `repoio-service/src/main/java/com/nahdetmisr/repoio`
  with a matching Flyway migration in `bootstrap/sql/migrations/native/`.
- See [`docs/architecture/README.md`](docs/architecture/README.md) for the
  module map and milestones.
