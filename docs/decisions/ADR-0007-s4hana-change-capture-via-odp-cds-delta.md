# ADR-0007 — SAP S/4HANA change capture through ODP / CDS delta over OData

- Status: **accepted** (2026-11-14, Mohamed)
- Amends:
  - `docs/milestone-plan.md` M2 (change-capture decision);
  - CLAUDE.md §8 decisions list;
  - skill `repoio-ingestion`.
- Does not change:
  - SAP ERP stays a **pull** source through Airflow (README §1);
  - push and pull converge on the same `raw.<entity>` topic;
  - raw first, thin ingest, idempotent re-delivery;
  - write-back to ERP only through workflows (OData/RFC adapters).

## Context

The ERP release is SAP S/4HANA. The ERP pull DAG must read only what
changed since the last run. The options were ODP / CDS delta (pull) and
IDoc / Change Pointers (ALE push). Debezium was ruled out: S/4HANA runs
on HANA, which has no supported Debezium connector, and SAP does not
support third-party reads of ERP database tables or logs.

## Decision

1. ERP change capture uses **delta-enabled CDS views extracted through
   ODP**, pulled by the Airflow DAG for each repository.
2. ODP is consumed through its **OData exposure**, not the ODP RFC API
   (SAP restricts third-party RFC use of ODP; the current SAP note is to
   be confirmed with the Basis team).
3. Customers and vendors are read as **Business Partners** (BP-based
   views); the BP → Customer / Vendor mapping belongs to the entity model
   (M1) and standardisation (M3), not to the connector.
4. Access uses a read-only SAP communication user; its credentials live
   in the secret store, referenced by the connection record.
5. No full extract-and-compare and no direct database access.

## Prerequisites (SAP Basis team)

- The list of delta-enabled CDS views for Business Partner (customer,
  vendor) and Product.
- ODP over OData enabled for those views.
- A read-only communication user.

## Consequences

- The ERP DAG keeps a delta token per view; a lost token triggers a
  governed re-initialisation, never a silent full reload.
- Near-real-time ERP events (IDoc or business events) stay out of scope
  until a separate decision.
