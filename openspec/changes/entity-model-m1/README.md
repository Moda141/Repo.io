# Change · Entity model + REST (M1)

Author: Mohamed · Status: **proposed** · Target: M1

## Summary

Ship the first vertical slice of Repo.io: Customer entity schema,
JDBI repository, REST resource, OpenAPI contract, generated Java +
Python SDKs, and a minimal UI page. No lakehouse yet — this writes
directly to Postgres and proves the schema→SDK→UI loop.

## Entities in scope

- `Customer` (with record-level parent/child, per the user's clarification)
- `GoldenRecord` (the surviving record for an entity + source trail)
- `ChangeRequest` (steward-driven edits with workflow)

## Deliverables

- `repoio-spec/src/main/resources/json/schema/entity/customer.json`
- `repoio-service` resource + repository + Flyway migrations
- `repoio-sdk` and `ingestion/src/metadata/sdk/` regenerated from the spec
- `repoio-ui` Customer page + Golden Record view
- E2E test from spec → REST → UI

## Why M1 first, then M2

M1 is risk-free: no new infra. It validates the module boundaries and
build pipeline on familiar tech. M2 then adds the lakehouse plane
underneath without changing the REST contract M1 shipped.
