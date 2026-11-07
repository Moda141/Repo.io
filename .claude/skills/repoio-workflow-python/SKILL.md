---
name: repoio-workflow-python
description: Use when working on Repo.io workflow and governed Python execution — the BPMN Workflow Designer (M7), Flowable engine integration, workflow definitions/versioning/approvals, the Python Workspace with Monaco editor (M8), or the isolated Python worker runtime. Trigger on tasks touching repoio-ui workflow screens, bpmn-js, Flowable, repoio-python-runtime, script permissions/allowlists, or any "let users run Python scripts" request.
---

# Repo.io Workflow & Python Workspace (M7 + M8)

## Part 1 — Workflow capability (M7)

### What it owns

- **Designer:** bpmn-js inside an OpenUI5 page — BPMN 2.0 canvas,
  import/export, diagram editing.
- **Configuration:** OpenUI5 forms/panels for Repo.io-specific task
  properties, approvers, conditions, ownership, validation.
- **Persistence:** workflow definitions, versions and metadata through
  Repo.io APIs and the control-plane database.
- **Execution:** Flowable (initial candidate) behind an adapter — process
  execution, task lifecycle, timers, retries, runtime state.
- **Events:** workflow events published through Kafka where async
  integration is needed.

### Non-negotiables (M7)

1. **bpmn-js is the designer, never the engine.** Nothing "executes" in
   the browser. Execution belongs to Flowable.
2. **Flowable sits behind an adapter.** `repoio-service` stays the
   integration/governance layer (auth, business context, API façade,
   audit); the engine is swappable through the adapter boundary. Confirm
   the Flowable edition/license/deployment model before production
   adoption — surface this as a decision point, don't assume.
3. **Definitions are versioned and reviewed.** Publish flow: author →
   validate → approve → publish. A published version is immutable;
   changes create a new version.

## Part 2 — Python Workspace (M8)

### What it owns

- **Frontend:** Monaco editor embedded in OpenUI5, script explorer,
  tabs, run controls, output/logs/errors panel, DataFrame/record
  preview. Script-based execution in V1; notebooks are optional future
  scope.
- **Backend:** script metadata, permissions, run requests and status via
  `repoio-service` or a dedicated API; large outputs in approved object
  storage; versions, dependency manifests, run metadata and audit in the
  control plane.
- **Runtime:** `repoio-python-runtime/` — disposable, isolated worker
  containers. Jupyter kernels/notebooks only if interactive cell-based
  execution becomes a confirmed requirement. Pyodide may be evaluated for
  browser-side examples — it is never the trusted backend execution
  environment.

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

- Reuse the Monaco integration for SQL and JSON editing where practical.
- The worker API returns execution status and output references (not
  inline blobs) through REST or a controlled event channel.
- Package requests follow the manifest → approval → build → scan flow;
   environment retention policy is configuration.

## Verification (must pass before "done")

**M7:** a designed workflow saves, validates, versions, publishes, then
executes end-to-end via the engine (approvals, retries, audit history
present); workflow events land on Kafka where async is configured.

**M8:** a script authored in the workspace runs in an isolated worker
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
