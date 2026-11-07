# ADR-0001 — A domain holds one or more repositories

- Status: **accepted** (2026-11-08, Mohamed)
- Amends: README §2.6 and §3, CLAUDE.md rule 14, `docs/milestone-plan.md`
  §M1, `docs/ui-pages.md` R1, `repoio-templates-refdata` skill. The agent
  kit shipped "one repository per domain"; everything else in the kit is
  adopted unchanged.

## Context

The domain enum stays closed and equal to the entity types in README §3
(Customer, Vendor, Product, Author, Employee, Store). Inside a domain,
the business needs more than one mastering scope. Customer, for example,
needs *Customer Master*, *Distribution partners* and *School accounts*,
each with its own model, match rules and survivorship. The approved
Domains prototype (`repoio-ui/design-reference/prototypes/02-domains.html`)
is built on this: Domain → Repositories → Data sources → Tables → Fields.

## Decision

1. A **domain** is a master-data entity type (closed enum, README §3).
2. A domain holds **one or more repositories**. A repository is a
   governed mastering scope with exactly one assigned **model version**
   (attributes, match rules, blocking, survivorship, source priority)
   and its own golden records.
3. A **data source** may feed several repositories, in the same domain or
   in different domains. A **source field** may map to attributes in more
   than one repository's model. These mappings are governed control-plane
   data, queryable by the UI (source → repositories, field → repositories
   and model attributes).
4. Unchanged: templates are scoped to exactly one domain; reference data
   is assigned per (domain, source/target system); role→domain grants
   drive visibility server-side.

## Consequences

- Control plane (Postgres): add a `repository` registry (domain, model
  version, owner team, ID prefix, status) and the source→repository and
  field→attribute mapping tables. These are metadata, not golden data.
- Data plane (Iceberg): golden tables stay one per entity
  (`golden_<entity>`) and carry `repository_id`. Partition or index on it
  as the M2 benchmark shows. No per-repository table explosion.
- Kafka topics stay one subject per entity (`golden.<entity>` …).
  `repository_id` travels in the payload.
- The same real-world party can be golden in two repositories of one
  domain. Linking them is identity resolution through the governed
  `same_as` path (README §2.3). It is never an implicit merge across
  repositories.
- Open questions for the M1 spec:
  - Can a role grant be narrower than a domain (per repository)?
  - Can a template target a specific repository inside its domain?
