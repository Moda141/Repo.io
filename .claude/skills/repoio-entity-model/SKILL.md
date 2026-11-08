---
name: repoio-entity-model
description: Use when working on Repo.io entity JSON Schemas, the Dropwizard REST/GraphQL service, Postgres control-plane migrations, SDK generation, or any M1 work on Customer, Vendor, Product, GoldenRecord or ChangeRequest. Trigger on tasks touching repoio-spec, repoio-service, repoio-sdk, bootstrap/sql, entity APIs, or golden record serving endpoints — even if the user just says "add a field to Customer" or "the API for X".
---

# Repo.io Entity Model & REST Service (M1)

## What this domain owns

- `repoio-spec/src/main/resources/json/schema/entity/` — one JSON Schema
  (OpenAPI 3.1) per entity + shared types.
- `repoio-service/` — Dropwizard 4 (Java 17, JDBI3, Jersey) REST/GraphQL
  app: entity CRUD, GoldenRecord, ChangeRequest, auth.
- `bootstrap/sql/` — Flyway migrations, **Postgres control plane only**.
- `repoio-sdk/` — Java client generated from the spec.

## Non-negotiables

1. **Spec is the contract.** Change `repoio-spec` first (or in the same
   commit) — never let the service drift from the schemas. Breaking a
   contract requires an approved versioning decision, not a silent edit.
2. **Dropwizard, not Spring.** JDBI3 for data access, Jersey for resources.
   Do not add Spring Boot starters, Spring Data or Spring MVC.
3. **Postgres is control plane only.** It stores entity metadata,
   change-request state, workflow state, users, audit. Golden record
   *rows* live in Iceberg (`golden_customer` etc.). `repoio-service` reads
   golden records through the Iceberg/Trino path — never replicate them
   into Postgres tables.
4. **The UI is a consumer.** Never add business rules or entity definitions
   to `repoio-ui`; they belong in the spec and the service.
5. **Entities are the Phase 1 set:** Customer, Vendor, Product (Book),
   Author, Employee, Store/Outlet — with GoldenRecord and ChangeRequest as
   first-class APIs. Adding a new entity is a spec change with a
   corresponding `openspec/changes/` entry.

## Implementation order that works

1. Draft/extend the JSON Schema for the entity (fields, types, required,
   shared types reused where possible).
2. Regenerate `repoio-sdk` from the spec; commit generated code separately
   from hand-written code so diffs stay reviewable.
3. Add Flyway migration for control-plane tables (metadata, statuses,
   audit references) — forward-only, never edit an applied migration.
4. Implement Jersey resources + JDBI3 DAOs; wire auth; add integration
   tests against a real Postgres (testcontainers pattern), not mocks.
5. Update the module README and the OpenAPI artifact.

## Verification (must pass before "done")

- `mvn -q verify` for `repoio-service` and `repoio-spec` modules.
- OpenAPI generation runs clean and the generated SDK compiles.
- App boots locally against Postgres (the M1 exit condition): health check
  responds, CRUD round-trips for the touched entity, ChangeRequest flow
  transitions states correctly.
- Contract tests: service responses validate against the JSON Schemas.

## Common pitfalls

- **Golden records in Postgres** — the most tempting wrong move. If a task
  seems to need it, stop: that's an Iceberg read-path design question.
- Letting generated SDK code drift from the spec (regenerate, don't
  hand-edit).
- Editing an already-applied Flyway migration instead of adding a new one.
- Adding fields only in the service and only in the UI — the field exists
  when it's in `repoio-spec`, nowhere else first.
