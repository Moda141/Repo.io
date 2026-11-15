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

7. **Custom roles.** An Admin creates roles — blank or as a copy of
   another role — with a name, a technical ID, domain grants and
   permissions picked from a **fixed permission catalog defined by the
   server** (no free-text permissions). Delivered roles are read-only;
   copy one to change it. A role is **sensitive when any of its
   permissions is sensitive** (administer users and roles, system
   configuration, connections, API access, template authoring): the
   Admin never sets the flag by hand, and a permission change that would
   make a role sensitive is rejected while the role is assigned to a
   department or team. A custom role can be deleted only when nobody
   holds it.

8. **Never without an administrator.** Any change that would leave no
   active user holding *administer users and roles* — removing a role,
   locking, ending validity, a leaver from the sync, a permission change
   — is rejected (a leaver is held for review instead of applied).
9. **Sign-in status** is derived, strongest first: left › locked in
   Repo.io › expired › not valid yet › disabled in Entra ID › not found in
   Entra ID › active. Only *active* users get any access; their roles stay
   visible but grant nothing.
10. **Directory lifecycle.** The sync is previewed (new, moved, left)
    and applied on confirmation. A leaver is blocked at once and loses
    their direct roles. A manual record that the directory now has is
    resolved by keeping the directory record; the business user and its
    direct roles move to it. Manual records can be edited; directory
    records change only at the source. With Entra ID, teams come from a
    user attribute or from **Entra ID group → team** mappings.
11. **Locking** blocks sign-in to Repo.io at once, with a mandatory
    reason, without waiting for Entra ID; roles stay assigned.
12. **Time-bound assignments.** A direct role may carry an end date and
    ends by itself; bulk assignment and CSV upload (per-row validation)
    use the same rule.
13. **Effective access** (permission × domains × granting roles) is
    shown per user and exported (CSV) with every assignment and its
    source.
14. **Access reviews.** An Admin starts a review; each person's manager
    keeps or removes each direct role; removal applies at once; one open
    review at a time; inherited roles are reviewed on the org unit.
15. **Separation of duties** rules (server configuration) raise
    warnings — for example creating and approving change requests in the
    same domain, or administering users and issuing API tokens. They do
    not block; the workflow still blocks approving one's own request.

## Consequences

- Moving a person between teams in the source changes their inherited
  roles at the next sync; the audit log records both the move and the
  resulting role change.
- Credentials for Microsoft Graph or SuccessFactors live in the secret
  store, referenced by the sync settings — never in Postgres.
- Open point: whether the directory sync runs as an Airflow platform
  DAG or inside `repoio-service` is decided with the M5 spec.
