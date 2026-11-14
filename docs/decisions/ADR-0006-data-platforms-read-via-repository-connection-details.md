# ADR-0006 — Data platforms read golden records through repository connection details, not connection records

- Status: **accepted** (2026-11-14, Mohamed)
- Amends:
  - README §2.5 (connections hub: data-platform connections);
  - CLAUDE.md §8 decisions list;
  - `docs/ui-pages.md` (Connections, Domain management);
  - `docs/user-journey.md` J9 step 6 and J16 step 7;
  - skill `repoio-integrations`.
- Does not change:
  - federation as the preferred serving mode: platforms read the golden
    tables in place through the Iceberg REST catalog (or Trino), with no
    copy and no per-platform export pipeline;
  - per-user (or per app registration) access: tokens are issued by an
    administrator in API management, live in the secret store, and never
    exceed their owner's grants (J16);
  - Trino and the catalog enforcing row and column grants;
  - the four source connection types (SAP HANA / ERP, SAP C4C, SQL
    Server, CSV / Excel) and write-back through workflows only.

## Context

README §2.5 described Databricks, Snowflake and Data Fabric as entries in
the connections registry, with a "federation" mode whose connection
record documents the reader identity and catalog endpoint.

In practice the direction is reversed: Repo.io does not connect to the
platform; the platform connects to Repo.io. The platform team needs the
endpoints of one repository (host, catalog, schema, table) and a token —
the same thing a BI tool or a notebook needs.

## Decision

1. Databricks, Snowflake and other data platforms are **not** registered
   as connections for reading golden records.
2. Each repository offers **Connection details** (from its card in
   Domain management): ready-to-copy values and snippets per client —
   JDBC, ODBC, Python, Databricks (Spark catalog over the Iceberg REST
   catalog) and Snowflake (catalog integration over the Iceberg REST
   catalog). Hosts are deployment placeholders.
3. The reader identity is a token owner from API management: a named
   user or an Entra ID app registration. Only an administrator issues
   tokens (J16).
4. The audit of who reads what comes from the call log and catalog
   access logs, not from a connection record.

## Open point

Using a data platform as a **source** (pulling master data from platform
tables, README §2.5 "ingest" mode) is not covered by this decision. When
it is needed, it is added as a connection type through its own decision.

## Consequences

- The connections registry stays a list of systems Repo.io calls
  (sources and write-back targets).
- One place per repository answers "how do I connect to this data".
- No connection record to keep in sync with platform-side configuration.
