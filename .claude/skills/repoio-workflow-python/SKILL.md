---
name: repoio-workflow-python
description: Use when working on Repo.io workflow and governed Python execution — the BPMN Workflow Designer (M7), Flowable engine integration, workflow definitions/versioning/approvals, the isolated Python worker runtime that executes workflow Script steps (M8; no Python Workspace screen, ADR-0004). Trigger on tasks touching repoio-ui workflow screens, bpmn-js, Flowable, repoio-python-runtime, script permissions/allowlists, or any "let users run Python scripts" request.
---

# Repo.io Workflow & Python runtime (M7 + M8)

## Part 1 — Workflow capability (M7)

### What it owns

- **Designer:** the Repo.io flow designer (ADR-0002) — an OpenUI5
  step-card canvas (Begin, Template, Validation, Approval, Script,
  Write-back, Notification, Condition, End) that saves a JSON flow model,
  compiled to BPMN 2.0 on publish.
- **Configuration:** OpenUI5 forms/panels for Repo.io-specific task
  properties, approvers, conditions, ownership, validation.
- **Persistence:** workflow definitions, versions and metadata through
  Repo.io APIs and the control-plane database.
- **Execution:** Flowable (initial candidate) behind an adapter — process
  execution, task lifecycle, timers, retries, runtime state.
- **Events:** workflow events published through Kafka where async
  integration is needed.

### Non-negotiables (M7)

1. **The flow designer is the designer, never the engine** (ADR-0002).
   Nothing "executes" in the browser. Execution belongs to Flowable;
   Script steps compile to service tasks calling the isolated workers.
2. **Flowable sits behind an adapter.** `repoio-service` stays the
   integration/governance layer (auth, business context, API façade,
   audit); the engine is swappable through the adapter boundary. Confirm
   the Flowable edition/license/deployment model before production
   adoption — surface this as a decision point, don't assume.
3. **Definitions are versioned and reviewed.** Publish flow: author →
   validate → approve → publish. A published version is immutable;
   changes create a new version.

## Part 2 — Python runtime for Script steps (M8)

### What it owns

There is **no Python Workspace screen** (ADR-0004): no workspace editor,
no notebooks, no `%pip`. Python is written in the flow designer's Script
step (ADR-0002) and executed here.

- **Backend:** script versions (with the workflow version), run requests,
  status, logs and audit in the control plane via `repoio-service`.
- **Runtime:** `repoio-python-runtime/` — disposable, isolated worker
  containers invoked by Flowable through the secured worker integration,
  and by the Script step's test run. Packages come from the approved
  pinned image.

### Non-negotiables (M8) — security invariants

1. **User Python never runs in the FastAPI, Dropwizard or UI
   containers.** Only in disposable workers with CPU, memory, disk and
   time limits.
2. **Flowable invokes Python tasks through a secured Repo.io
   worker/API integration** — never executes arbitrary Python inside the
   engine.
3. **No Docker socket or host path mounts** into user-code workers.
4. **Default no outbound network;** allowlist destinations only when
   required.
5. **Pinned dependency manifests from approved registries only** —
   scanned, reproducible, immutable runtime images. No unrestricted
   production `pip install` during an active task.
6. **Workers read/write data only through explicitly granted identities
   and approved connectors.**
7. **RBAC actions are separate:** author, approve, execute, publish,
   administer — mapped to deployment-configured roles, enforced at both
   API and worker boundaries (including workflow-triggered runs), with
   the initiating identity and script version audited.
8. **Dev experimentation is separated from production pipeline
   execution.**

### Implementation notes

- The worker API returns execution status and output references (not
  inline blobs) through REST or a controlled event channel.
- Package requests follow the manifest → approval → build → scan flow;
   environment retention policy is configuration.

## Verification (must pass before "done")

**M7:** a designed workflow saves, validates, versions, publishes, then
executes end-to-end via the engine (approvals, retries, audit history
present); workflow events land on Kafka where async is configured.

**M8:** a Script step of a published workflow runs in an isolated worker
with visible resource limits; a second run by a user without the execute
permission is denied at the API *and* at the worker; dependency requests
outside the allowlist are rejected; the audit trail records initiating
identity + script version; killing a worker mid-run leaves no orphaned
state.

## Common pitfalls

- Executing user Python anywhere other than the workers — the one mistake
  this architecture treats as unacceptable.
- Workflow state duplicated between the engine and Postgres without a
  clear ownership boundary.
- Skipping the adapter "until we need a second engine" — the adapter IS
  the insurance policy.
- Permission checks only at the API while workers trust the caller.
