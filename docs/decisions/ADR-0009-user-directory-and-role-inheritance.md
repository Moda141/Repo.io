# ADR-0009 — User directory synced from Entra ID or SuccessFactors; roles assigned on Department, Team or User

- Status: **accepted** (2026-11-15, Mohamed)
- Amends:
  - `docs/ui-pages.md` (User management, Roles & access);
  - `docs/user-journey.md` J17;
  - `docs/milestone-plan.md` M5;
  - CLAUDE.md §8 decisions list.
- Does not change:
  - sign-in through Entra ID (M5); Repo.io never creates identities or
    holds passwords;
  - role → domain grants are part of a role and are enforced
    server-side (CLAUDE.md rule 14);
  - only an Admin issues API tokens (J16);
  - Employee master data stays a governed domain in the data plane; the
    user directory is control-plane access data, never a golden record.

## Context

User management follows the SAP IBP flow: maintain employees, turn an
employee into a business user, connect the user to the identity
provider, assign business roles (from the user or from the role). The
organisation has a hierarchy Org → Business unit → Department → Team →
User, and access should follow it without granting more than needed.

## Decision

1. **Directory source.** Employees and the org hierarchy are **synced
   from Entra ID (Microsoft Graph) or SAP SuccessFactors** — one source
   per deployment, chosen in sync settings, with a field mapping
   (business unit, department, team, job title, manager). Manual
   create and CSV import (with a downloadable template) are a
   **fallback only**: manual records are labelled *Manual*, and the next
   sync flags them for review when the source has the same person.
2. **Employee → business user.** An employee becomes a Repo.io user by
   *Maintain business user*. The user is linked to its Entra ID account
   by email / UPN; the console shows the link state (linked, not found
   in Entra ID, disabled). Validity dates (from / until) are kept on the
   user.
3. **Role assignment levels.** A role is assigned on a **Department**,
   a **Team** or a **User**. Org and Business unit carry no roles.
   Department and Team roles are inherited by everyone below them.
4. **Effective roles** = direct user roles ∪ roles of the user's team ∪
   roles of the user's department. Each role on the user's Assigned
   roles tab shows its source. There is no deny at user level: a user
   who should not inherit a role moves to another team.
5. **Sensitive roles are never inherited.** Admin, API access
   administration and template authoring are assigned only to a named
   user; the console does not offer them on a department or team, and
   the API rejects such an assignment.
6. **Two entry points, one assignment.** Roles are assigned from the
   user (Assigned roles tab) or from the role (Assigned users and
   Assigned org units tabs) — the same control-plane record either way.
   Every change is audited.

## Consequences

- Moving a person between teams in the source changes their inherited
  roles at the next sync; the audit log records both the move and the
  resulting role change.
- Credentials for Microsoft Graph or SuccessFactors live in the secret
  store, referenced by the sync settings — never in Postgres.
- Open point: whether the directory sync runs as an Airflow platform
  DAG or inside `repoio-service` is decided with the M5 spec.
