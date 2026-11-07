---
name: repoio-templates-refdata
description: Use when working on Repo.io request templates or reference data — the domain-scoped template registry, the role-filtered Templates catalog page, the potential-match duplicate check in request forms, the template authoring role for master data stewards, workflow selection at request creation, reference data / code lists assigned by domain and source/target system (C4C, ERP), and reference lists filtered by the selected target system. Trigger on tasks about request templates, template forms, the template catalog, reference lists or picklists, domain scoping, role→domain visibility, or any M1/M4/M5 work touching these.
---

# Repo.io Request Templates & Reference Data

## The two product rules (from the product owner — treat as law)

1. **Templates are scoped by domain, and the Templates catalog page shows
   each user only what their role grants.** One template belongs to
   exactly one domain — cross-domain templates are explicitly rejected.
2. **Reference data is assigned by domain and by data source / target
   system (SAP C4C, SAP ERP, …).** The reference lists in request forms
   show only the entries assigned to the pair — filtered live when the
   user selects the target system.

## What this domain owns

- **Template registry** (control plane, `repoio-service`): domain (the
  entity type — README §3), pre-fill fields, applicable workflows,
  version, status.
- **Role→domain mapping** (configuration table): which roles see which
  domains — drives server-side template visibility.
- **Template authoring RBAC**: a dedicated role the Admin grants,
  typically to master data stewards; author / approve / publish are
  separate actions.
- **Reference-data registry**: code lists / picklists with
  (domain, system) assignment; served filtered to forms.
- **UI pieces**: Templates catalog page (entry point "New request",
  grouped by domain), request form with workflow selection,
  target-system-filtered reference lists and the potential-match
  duplicate check (OpenUI5).

## Non-negotiables

1. **The domain enum is closed:** customer, vendor, product, author,
   employee, store — exactly the Entity list in README §3. A domain is
   the master-data entity type. A domain holds one or more repositories
   of golden records (ADR-0001), fed by every business line's sources (SAP C4C, Pharma ERP,
   Retail POS, …). Never invent a second domain list anywhere (UI
   enums, config files, code).
2. **One template = one domain.** An API call or spec that would create
   a multi-domain template is rejected, not "handled".
3. **Visibility is enforced server-side.** `GET /templates` filters by
   the role→domain grants from the caller's token. The UI hides nothing
   on its own — it renders what the API returns. Hiding rows in the
   frontend is presentation, not authorization.
4. **Template does not hard-bind a workflow.** The user selects from the
   applicable published workflows at request creation. The template
   defines *which* workflows are applicable (by entity/domain), never a
   single forced one.
5. **Published templates are immutable.** Changes create a new version;
   author / approve / publish are separate RBAC actions; every change is
   audited (who, what, when, which version).
6. **Reference data follows the (domain, system) pair.** Entries assigned
   to C4C never appear in an ERP-targeted request's lists. The filter is
   applied by the API serving the lists — the UI passes the selected
   target system as a parameter; it must not receive the full list and
   filter client-side.
7. **Template pre-fill fields validate against `repoio-spec`** entity
   schemas — a template is not a place to invent fields.
8. **The UI owns nothing here** — templates, domains, roles and
   reference data all come from APIs; the screens consume.

## Data model sketch

```
request_template {
  id, name, description
  domain            → customer | vendor | product | author | employee | store
                      // domain IS the entity type (README §3); one or more repos per domain (ADR-0001)
  pre_fill_fields   → JSON (validated against repoio-spec entity schema)
  applicable_workflows → [workflow ids + versions]   // user picks one
  match_check       → optional: run potential-match check on creation forms
  version, status   → draft | published | archived
}

reference_data_entry {
  id, list_code, value, label, sort_order
  domain            → same enum
  system            → sap_c4c | sap_erp | sqlserver | … (connection types)
}

role_domain_grant { role_id, domain }   // configuration, not code
```

## Flow: template → request → workflow → (optional) write-back

The template is the front door of the governed chain (§2.6 of the root
README). User journey:

1. User opens **New request** (Dashboard / Inbox) → Templates catalog,
   role-filtered server-side, grouped by domain.
2. Selecting a template opens the request form — pre-filled, fields
   validated against the `repoio-spec` entity schema, reference-list
   fields as dropdowns filtered by (domain, selected target system).
3. For creation templates with `match_check` enabled, the form runs a
   potential-match check against existing golden records; the user
   confirms "not a duplicate" or links the request to the existing
   record.
4. At submission the user picks one of the applicable published
   workflows → ChangeRequest created, with template id+version and
   workflow id+version recorded in the audit trail.
5. Approvers act from their Inbox (approve / reject with comment).
6. Only a workflow containing a Write-back Task writes back to C4C/ERP
   (§2.4 of the root README).

The template itself never executes anything.

Full UX sequencing for this journey (J3) and every other console
journey: `docs/user-journey.md`.

## Verification (must pass before "done")

- A user whose role grants only `customer` gets an **empty result from
  the templates API** for other domains — verified with a direct API
  call, not just the UI.
- Creating a template with two domains (or a domain outside the enum) is
  rejected by the API.
- Request form: selecting target system C4C shows only (domain, C4C)
  reference entries; switching to ERP swaps the lists — verified at the
  API level with both parameters.
- A user without the template-authoring role cannot create or publish
  templates; approve is a different action than author.
- Published template edits create version N+1; version N remains
  retrievable and audited.
- A request created from a template records the template id+version and
  the user-chosen workflow id+version in its audit trail.
- With `match_check` enabled, the form surfaces potential matches
  against existing golden records; creating a new record while a
  flagged match is unresolved is rejected or routed to review —
  verified at the API level.

## Common pitfalls

- Client-side filtering of reference lists (the API must do it — full
  lists must never reach the browser).
- A second domain enum drifting in the UI or a config file.
- Hard-binding one workflow into the template "for convenience".
- Treating the Templates catalog page as the security boundary instead of
  the API.
- Letting template pre-fill fields drift from the `repoio-spec` schemas.
- Silently creating a new record when a potential match was flagged but
  not resolved.
