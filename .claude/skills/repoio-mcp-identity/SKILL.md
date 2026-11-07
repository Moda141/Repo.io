---
name: repoio-mcp-identity
description: Use when working on Repo.io AI-agent access — the MCP server, tool registry, agent policies, Entra ID authentication, role-based access control, or per-user agent scopes. Trigger on tasks touching repoio-mcp, MCP tools/protocol, agent permissions, Entra ID/Azure AD integration, or any request to "let the AI agent read/write golden records".
---

# Repo.io MCP Server & Identity (M5)

## What this domain owns

- `repoio-mcp/` — MCP server (JDK): tool registry, agent policies,
  permission-filtered tools.
- Entra ID authentication integration and role-based access.
- Per-user scopes for AI agents reading/writing golden records.

## Non-negotiables

1. **Agents act as users, never as a super-identity.** Every MCP action
   executes with the initiating user's permissions (per-user scopes). A
   shared "agent account" with broad rights is the single most dangerous
   shortcut in this milestone — refuse it.
2. **Every tool is permission-filtered.** An MCP tool that returns data
   the calling user could not fetch via `repoio-service` is a security
   hole, however convenient. Tools wrap the same authorization checks as
   the REST API — they never query the database directly.
3. **Never expose an unrestricted endpoint to an agent.** This includes
   SPARQL: agents query semantics through permission-filtered MCP tools,
   not an open Fuseki endpoint (see the `repoio-ontology` skill).
4. **Audit every agent action.** Who (user), what (tool), what data
   (entity ids), when, from which session. Agent writes to golden records
   land in the same audit trail as human writes.
5. **Deny by default.** A tool not explicitly granted to a role is
   unavailable to that role. Registration in the tool registry is not
   authorization.
6. **Write operations go through governed paths.** Agent writes to golden
   records should create ChangeRequests or follow the governed update
   flow — not raw UPDATE semantics, unless the approved spec says
   otherwise for a specific tool.

## Implementation notes

- Token validation: Entra ID (audience, issuer, roles/claims mapping to
  Repo.io RBAC roles configured per deployment).
- The MCP server is a JDK service in `repoio-mcp/` — same build
  conventions as `repoio-service` (no Spring).
- Define the role→tool grant matrix as configuration, versioned and
  reviewable — role names are deployment-configured, not hardcoded.
- Design tool surfaces around tasks agents actually perform ("get golden
  customer by id", "search customers", "propose change") with response
  shapes documented in the registry.

## Verification (must pass before "done")

- An authenticated agent with per-user scope can read and write golden
  records through MCP tools (the M5 exit condition).
- The same agent without a required role gets denials — not degraded
  data, denials.
- An expired/invalid Entra ID token is rejected.
- Every allowed and denied action in the test run appears in the audit
  trail with the initiating user identity.
- No tool in the registry can be invoked without passing the
  authorization layer (enumerate tools and probe each).

## Common pitfalls

- Testing only the happy path — the denials are the security product.
- Tool responses leaking more fields than the REST API returns for the
  same user.
- Skipping audit writes for read operations (reads are auditable events
  too).
- Hardcoding role names instead of mapping deployment-configured roles.
