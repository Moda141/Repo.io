# Generates webapp/model/apidocs.json: sample OpenAPI 3.1 documents for every Repo.io API family.
# Entity schemas are copied from repoio-spec (the contract source); everything else is sample design data.
import json, copy, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
SCH = ROOT + "/repoio-spec/src/main/resources/json/schema"
OUT = ROOT + "/repoio-ui/design-reference/openui5-prototype/webapp/model/apidocs.json"

def load(p):
    d = json.load(open(os.path.join(SCH, p)))
    d = json.loads(json.dumps(d).replace('"../type/reference.json"', '"#/components/schemas/EntityReference"'))
    for k in ("$schema", "$id"):
        d.pop(k, None)
    return d

REAL = {
    "EntityReference": load("type/reference.json"),
    "GoldenRecord": load("entity/goldenRecord.json"),
    "ChangeRequest": load("entity/changeRequest.json"),
    "Domain": load("entity/domain.json"),
    "Repository": load("entity/repository.json"),
}

PROBLEM = {"type": "object", "description": "RFC 9457 problem details.", "properties": {
    "type": {"type": "string", "format": "uri"}, "title": {"type": "string"}, "status": {"type": "integer"},
    "detail": {"type": "string"}, "requestId": {"type": "string", "examples": ["req-ce5cc2"]}}, "required": ["title", "status", "requestId"]}

def page(item):
    return {"type": "object", "properties": {"items": {"type": "array", "items": {"$ref": "#/components/schemas/" + item}},
            "page": {"type": "integer"}, "pageSize": {"type": "integer"}, "total": {"type": "integer"}}}

STD = {
    "401": {"description": "Missing, expired or revoked token.", "content": {"application/problem+json": {"schema": {"$ref": "#/components/schemas/Problem"}}}},
    "403": {"description": "The caller (the token owner) has no grant for this domain, repository or action. Never answered with partial data.", "content": {"application/problem+json": {"schema": {"$ref": "#/components/schemas/Problem"}}}},
    "429": {"description": "Daily limit reached for this client.", "headers": {"Retry-After": {"schema": {"type": "integer"}}}, "content": {"application/problem+json": {"schema": {"$ref": "#/components/schemas/Problem"}}}},
}

def op(summary, desc="", params=None, body=None, ok="200", okschema=None, okdesc="OK", tag=None, grant=None, ms=None, extra=None, example=None):
    o = {"summary": summary, "description": (desc + ("\n\n**Required grant:** `" + grant + "`" if grant else "")).strip(),
         "responses": {ok: {"description": okdesc}}}
    if okschema:
        c = {"schema": okschema}
        if example is not None:
            c["example"] = example
        o["responses"][ok]["content"] = {"application/json": c}
    o["responses"].update(copy.deepcopy(STD))
    if extra:
        o["responses"].update(extra)
    if params:
        o["parameters"] = params
    if body:
        o["requestBody"] = {"required": True, "content": {"application/json": {"schema": body}}}
    if tag:
        o["tags"] = [tag]
    if ms:
        o["x-milestone"] = ms
    return o

def P(name, where="query", desc="", typ="string", req=False, enum=None):
    s = {"type": typ}
    if enum:
        s["enum"] = enum
    return {"name": name, "in": where, "required": req or where == "path", "description": desc, "schema": s}

def ref(n):
    return {"$ref": "#/components/schemas/" + n}

PAGEP = [P("page", typ="integer", desc="1-based page."), P("pageSize", typ="integer", desc="Rows per page, at most 200.")]

def doc(id, title, area, ms, desc, paths, schemas=None, base="${REPOIO_API_BASE_URL}", version="v1", tags=None, deprecated=False, sunset=None, kind="rest"):
    comps = {"schemas": {"Problem": PROBLEM}, "securitySchemes": {
        "entra": {"type": "oauth2", "description": "Microsoft Entra ID (interactive users and app registrations).",
                  "flows": {"authorizationCode": {"authorizationUrl": "${ENTRA_AUTHORITY}/oauth2/v2.0/authorize", "tokenUrl": "${ENTRA_AUTHORITY}/oauth2/v2.0/token", "scopes": {"repoio.read": "Read within your grants", "repoio.write": "Submit change requests"}}}},
        "pat": {"type": "http", "scheme": "bearer", "description": "Access token issued by an administrator to a named owner. Acts with the owner's grants."}}}
    for s in (schemas or []):
        comps["schemas"][s] = copy.deepcopy(REAL[s]) if s in REAL else EXTRA[s]
    d = {"openapi": "3.1.0",
         "info": {"title": title, "version": version, "description": desc +
                  "\n\n> Sample documentation in the console prototype. Endpoints are designed, not implemented; each one lands with the milestone shown."},
         "servers": [{"url": base, "description": "Set per deployment (API gateway)."}],
         "security": [{"entra": []}, {"pat": []}],
         "paths": paths, "components": comps,
         "x-repoio": {"id": id, "area": area, "milestone": ms, "status": "planned", "kind": kind, "deprecated": deprecated, "sunset": sunset}}
    for pth in paths.values():
        for o in pth.values():
            o.setdefault("tags", [title])
    d["tags"] = tags or [{"name": title}]
    return d

EXTRA = {
    "Template": {"type": "object", "properties": {"id": {"type": "string"}, "name": {"type": "string"}, "domain": {"type": "string", "enum": ["Customer", "Vendor", "Product", "Author", "Employee", "Store"]},
                 "targetSystem": {"type": "string", "enum": ["C4C", "ERP"]}, "version": {"type": "integer"}, "workflow": ref("EntityReference"), "fields": {"type": "array", "items": {"type": "object"}}}, "required": ["id", "name", "domain"]},
    "ReferenceValue": {"type": "object", "properties": {"code": {"type": "string"}, "label": {"type": "string"}, "labelAr": {"type": "string"}, "targetSystem": {"type": "string", "enum": ["C4C", "ERP"]}, "active": {"type": "boolean"}}},
    "RelationshipType": {"type": "object", "properties": {"id": {"type": "string", "examples": ["parent_of"]}, "from": {"type": "string"}, "to": {"type": "string"}, "inverse": {"type": "string"}, "cardinality": {"type": "string"}}},
    "Relationship": {"type": "object", "properties": {"type": {"type": "string"}, "from": ref("EntityReference"), "to": ref("EntityReference"), "status": {"type": "string", "enum": ["active", "pending approval"]}, "provenance": {"type": "string"}}},
    "MatchPair": {"type": "object", "properties": {"id": {"type": "string"}, "left": ref("EntityReference"), "right": ref("EntityReference"), "probability": {"type": "number"}, "status": {"type": "string", "enum": ["open", "confirmed", "rejected"]}}},
    "DqResult": {"type": "object", "properties": {"suite": {"type": "string"}, "expectation": {"type": "string"}, "column": {"type": "string"}, "evaluated": {"type": "integer"}, "unexpected": {"type": "integer"}, "success": {"type": "boolean"}}},
    "IngestBatch": {"type": "object", "properties": {"batchId": {"type": "string"}, "entity": {"type": "string"}, "source": {"type": "string"}, "records": {"type": "array", "items": {"type": "object"}}, "idempotencyKey": {"type": "string"}}, "required": ["entity", "source", "records", "idempotencyKey"]},
    "SyncFlow": {"type": "object", "properties": {"id": {"type": "string"}, "connection": {"type": "string"}, "repository": {"type": "string"}, "status": {"type": "string", "enum": ["draft", "deployed", "changed"]}, "dagId": {"type": "string"}}},
    "JobRun": {"type": "object", "properties": {"runId": {"type": "string"}, "job": {"type": "string"}, "status": {"type": "string"}, "start": {"type": "string", "format": "date-time"}, "end": {"type": "string", "format": "date-time"}, "dagRunId": {"type": "string"}}},
    "Connection": {"type": "object", "properties": {"id": {"type": "string"}, "type": {"type": "string", "enum": ["sap_c4c", "sap_erp", "sqlserver", "databricks", "snowflake", "data_fabric"]}, "endpoint": {"type": "string"}, "authMethod": {"type": "string"}, "secretRef": {"type": "string", "description": "Reference into the secret store; never the token."}, "health": {"type": "string"}}},
    "Workflow": {"type": "object", "properties": {"id": {"type": "string"}, "version": {"type": "integer"}, "status": {"type": "string", "enum": ["draft", "in review", "published", "retired"]}, "template": ref("EntityReference")}},
    "Activity": {"type": "object", "properties": {"id": {"type": "string"}, "kind": {"type": "string"}, "at": {"type": "string", "format": "date-time"}, "actor": ref("EntityReference"), "subject": ref("EntityReference")}},
    "Announcement": {"type": "object", "properties": {"id": {"type": "string"}, "title": {"type": "string"}, "audience": {"type": "string"}, "from": {"type": "string", "format": "date-time"}, "until": {"type": "string", "format": "date-time"}, "pinned": {"type": "boolean"}}},
    "Report": {"type": "object", "properties": {"id": {"type": "string"}, "type": {"type": "string", "enum": ["story", "alp"]}, "domain": {"type": "string"}, "status": {"type": "string"}}},
    "Broadcast": {"type": "object", "properties": {"id": {"type": "string"}, "report": {"type": "string"}, "format": {"type": "string", "enum": ["pdf", "pptx", "xlsx"]}, "schedule": {"type": "string"}, "recipients": {"type": "array", "items": {"type": "string"}}}},
    "Token": {"type": "object", "properties": {"id": {"type": "string"}, "name": {"type": "string"}, "owner": ref("EntityReference"), "scopes": {"type": "array", "items": {"type": "string", "enum": ["read", "sql", "mcp"]}}, "expires": {"type": "string", "format": "date"}, "hint": {"type": "string", "examples": ["rpio_…7f3a"]}}},
    "TokenCreated": {"type": "object", "description": "Returned once. The value is never readable again.", "properties": {"token": ref("Token"), "value": {"type": "string"}}},
    "Webhook": {"type": "object", "properties": {"id": {"type": "string"}, "owner": ref("EntityReference"), "url": {"type": "string"}, "events": {"type": "array", "items": {"type": "string"}}, "domain": {"type": "string"}, "status": {"type": "string", "enum": ["active", "paused"]}}},
    "CallLogEntry": {"type": "object", "description": "Call metadata only; never request or response payloads.", "properties": {"at": {"type": "string", "format": "date-time"}, "client": ref("EntityReference"), "operation": {"type": "string"}, "status": {"type": "integer"}, "durationMs": {"type": "integer"}, "rows": {"type": "integer"}, "requestId": {"type": "string"}}},
    "AuditEntry": {"type": "object", "properties": {"at": {"type": "string", "format": "date-time"}, "actor": ref("EntityReference"), "action": {"type": "string"}, "object": ref("EntityReference"), "version": {"type": "integer"}}},
    "GraphQLRequest": {"type": "object", "properties": {"query": {"type": "string"}, "variables": {"type": "object"}}, "required": ["query"]},
    "JsonRpc": {"type": "object", "properties": {"jsonrpc": {"const": "2.0"}, "id": {"type": ["string", "integer"]}, "method": {"type": "string", "examples": ["tools/call"]}, "params": {"type": "object"}}},
}

ENT = [("customers", "Customer"), ("vendors", "Vendor"), ("products", "Product"), ("authors", "Author"), ("employees", "Employee"), ("stores", "Store")]
MS_ENT = {"customers": "M1", "vendors": "M1", "products": "M1", "authors": "M4", "employees": "M4", "stores": "M4"}
GR_EX = {"id": "8f15ba58-…", "goldenId": "C-10001", "repository": {"id": "customer-master", "type": "repository", "name": "Customer Master"}, "status": "Active", "qualityScore": 0.97,
         "attributes": [{"name": "name", "value": "مكتبة الأسرة"}, {"name": "city", "value": "Cairo"}]}

golden = {}
for path, tag in ENT:
    ms = MS_ENT[path]
    golden["/v1/" + path] = {"get": op("List golden " + tag.lower() + " records", "Paged and filtered. Rows and columns the caller may not read are never returned.",
        PAGEP + [P("q", desc="Free-text search."), P("repository", desc="Repository code."), P("status", enum=["Active", "Pending approval", "Deactivated"])],
        okschema=page("GoldenRecord"), tag=tag, grant="read:" + path, ms=ms)}
    golden["/v1/" + path + "/{masterId}"] = {"get": op("Get one golden " + tag.lower() + " record", "Point lookup by master ID.", [P("masterId", "path", "Golden record master ID, e.g. C-10001.")],
        okschema=ref("GoldenRecord"), tag=tag, grant="read:" + path, ms=ms, extra={"404": {"description": "No golden record with this ID in your grants."}}, example=GR_EX if path == "customers" else None)}
    if path in ("customers", "vendors", "products"):
        golden["/v1/" + path + "/{masterId}/sources"] = {"get": op("Source records behind a golden record", "Survivorship lineage per attribute.", [P("masterId", "path")],
            okschema={"type": "array", "items": ref("EntityReference")}, tag=tag, grant="read:" + path, ms=ms)}
        golden["/v1/" + path + "/{masterId}/history"] = {"get": op("Change history", "Versions with the change request that produced each one.", [P("masterId", "path")] + PAGEP,
            okschema=page("AuditEntry"), tag=tag, grant="read:" + path, ms=ms)}

DOCS = [
    doc("golden-records", "Golden records", "data", "M1", "Read golden records per domain. Writes never go here: they go through change requests.",
        golden, ["EntityReference", "GoldenRecord", "AuditEntry"], tags=[{"name": t} for _, t in ENT]),
    doc("change-requests", "Change requests", "data", "M1", "The governed write path: create, change, merge or deactivate golden records through approval workflows.", {
        "/v1/change-requests": {
            "get": op("List change requests", "Mine, awaiting my approval, or all I may see.", PAGEP + [P("view", enum=["mine", "awaiting", "all"]), P("state", enum=["Draft", "Submitted", "In approval", "Approved", "Rejected", "Deployed"])], okschema=page("ChangeRequest"), grant="read:requests", ms="M1"),
            "post": op("Submit a change request", "Validated against the template; duplicates are checked before submit.", body=ref("ChangeRequest"), ok="201", okschema=ref("ChangeRequest"), okdesc="Created", grant="request:<domain>", ms="M1",
                       extra={"409": {"description": "Potential duplicate found; the response lists the candidates."}, "422": {"description": "Fails template validation."}})},
        "/v1/change-requests/{crId}": {"get": op("Get a change request", params=[P("crId", "path")], okschema=ref("ChangeRequest"), grant="read:requests", ms="M1")},
        "/v1/change-requests/{crId}/approve": {"post": op("Approve", "Only the assigned approver; segregation of duties applies.", [P("crId", "path")], body={"type": "object", "properties": {"comment": {"type": "string"}}}, okschema=ref("ChangeRequest"), grant="approve:<domain>", ms="M1")},
        "/v1/change-requests/{crId}/reject": {"post": op("Reject", params=[P("crId", "path")], body={"type": "object", "properties": {"comment": {"type": "string"}}, "required": ["comment"]}, okschema=ref("ChangeRequest"), grant="approve:<domain>", ms="M1")},
        "/v1/change-requests/{crId}/comments": {"post": op("Add a comment", params=[P("crId", "path")], body={"type": "object", "properties": {"text": {"type": "string"}}}, ok="201", okdesc="Created", grant="read:requests", ms="M1")},
    }, ["EntityReference", "ChangeRequest"]),
    doc("templates", "Templates and reference data", "data", "M1", "Domain-scoped request templates (filtered server-side by your role→domain grants) and reference lists filtered by target system.", {
        "/v1/templates": {"get": op("List templates I may use", "Server-side filtered by role→domain grants.", [P("domain"), P("targetSystem", enum=["C4C", "ERP"])], okschema={"type": "array", "items": ref("Template")}, grant="request:<domain>", ms="M1")},
        "/v1/templates/{id}": {"get": op("Get a template", params=[P("id", "path")], okschema=ref("Template"), grant="request:<domain>", ms="M1")},
        "/v1/reference-lists/{listId}/values": {"get": op("Reference values for one target system", "C4C values never reach an ERP-targeted request.", [P("listId", "path"), P("targetSystem", req=True, enum=["C4C", "ERP"])], okschema={"type": "array", "items": ref("ReferenceValue")}, grant="request:<domain>", ms="M1")},
    }, ["EntityReference", "Template", "ReferenceValue"]),
    doc("relationships", "Relationships", "data", "M1", "The governed relationship type catalog and links between golden records. Edits are change requests; there is no delete path.", {
        "/v1/relationship-types": {"get": op("Relationship type catalog", okschema={"type": "array", "items": ref("RelationshipType")}, grant="read", ms="M1")},
        "/v1/{entity}/{masterId}/relationships": {"get": op("Links of one golden record", params=[P("entity", "path"), P("masterId", "path"), P("type")], okschema={"type": "array", "items": ref("Relationship")}, grant="read:<domain>", ms="M1")},
        "/v1/relationship-requests": {"post": op("Request new or changed links", "One request per row or a bulk batch; validated per row.", body={"type": "object", "properties": {"rows": {"type": "array", "items": ref("Relationship")}}}, ok="202", okschema=ref("ChangeRequest"), okdesc="Accepted as a change request", grant="steward:<domain>", ms="M4")},
    }, ["EntityReference", "RelationshipType", "Relationship", "ChangeRequest"]),
    doc("matching", "Match review", "stewardship", "M3", "Potential matches from Splink waiting for a steward. Confirming writes `same_as` through a change request.", {
        "/v1/matches": {"get": op("Potential matches", params=PAGEP + [P("domain"), P("status", enum=["open", "confirmed", "rejected"]), P("minProbability", typ="number")], okschema=page("MatchPair"), grant="steward:<domain>", ms="M3")},
        "/v1/matches/{id}/confirm": {"post": op("Confirm a match", params=[P("id", "path")], ok="202", okschema=ref("ChangeRequest"), okdesc="Accepted as a change request", grant="steward:<domain>", ms="M3")},
        "/v1/matches/{id}/reject": {"post": op("Reject a match", params=[P("id", "path")], body={"type": "object", "properties": {"reason": {"type": "string"}}}, okschema=ref("MatchPair"), grant="steward:<domain>", ms="M3")},
    }, ["EntityReference", "MatchPair", "ChangeRequest"]),
    doc("data-quality", "Data quality", "stewardship", "M3", "Great Expectations suites, results and the quarantine.", {
        "/v1/dq/results": {"get": op("Results per run", params=[P("repository"), P("runId")] + PAGEP, okschema=page("DqResult"), grant="read:<domain>", ms="M3")},
        "/v1/quarantine": {"get": op("Quarantined records", params=[P("repository"), P("reason")] + PAGEP, okschema=page("EntityReference"), grant="steward:<domain>", ms="M3")},
    }, ["EntityReference", "DqResult"]),
    doc("ingest", "Push ingest", "integration", "M2", "FastAPI push endpoints. Batches land in `raw.<entity>` exactly as delivered; never in golden records.", {
        "/ingest/v1/{entity}/batches": {"post": op("Push a batch", "Idempotent by key; validated against the model; failures go to quarantine.", [P("entity", "path", enum=[e[1].lower() for e in ENT])], body=ref("IngestBatch"), ok="202", okschema={"type": "object", "properties": {"batchId": {"type": "string"}}}, okdesc="Accepted", grant="ingest:<repository>", ms="M2")},
        "/ingest/v1/batches/{batchId}": {"get": op("Batch status", params=[P("batchId", "path")], okschema={"type": "object", "properties": {"status": {"type": "string"}, "accepted": {"type": "integer"}, "rejected": {"type": "integer"}}}, grant="ingest:<repository>", ms="M2")},
    }, ["IngestBatch"], base="${REPOIO_INGEST_BASE_URL}"),
    doc("sync-jobs", "Data sync and jobs", "integration", "M2", "Replication flows (configuration) and job runs (execution). Replays are governed requests.", {
        "/v1/sync-flows": {"get": op("Replication flows", params=[P("folder", desc="DAG folder, e.g. customer/customer_master/sync.")], okschema={"type": "array", "items": ref("SyncFlow")}, grant="engineer", ms="M4")},
        "/v1/sync-flows/{id}/deploy": {"post": op("Deploy a flow", "Creates or updates the Airflow DAG (ADR-0005).", [P("id", "path")], ok="202", okdesc="Accepted", grant="engineer", ms="M4")},
        "/v1/sync-flows/{id}/runs": {"post": op("Run now", params=[P("id", "path")], ok="202", okschema=ref("JobRun"), okdesc="Accepted", grant="engineer", ms="M4")},
        "/v1/jobs/runs": {"get": op("Job runs", params=PAGEP + [P("status"), P("since", desc="ISO date-time.")], okschema=page("JobRun"), grant="engineer", ms="M4")},
        "/v1/jobs/runs/{runId}/replay-requests": {"post": op("Request a replay", "Scope, idempotency key, approver and reason.", [P("runId", "path")], body={"type": "object", "properties": {"scope": {"type": "string"}, "reason": {"type": "string"}, "idempotencyKey": {"type": "string"}}}, ok="202", okdesc="Accepted", grant="engineer", ms="M4")},
    }, ["SyncFlow", "JobRun"]),
    doc("connections", "Connections", "admin", "M9", "Registry of external systems. Tokens live in the secret store; the API only ever returns a reference.", {
        "/v1/connections": {"get": op("List connections", okschema={"type": "array", "items": ref("Connection")}, grant="administer connections", ms="M9"),
                            "post": op("Register a connection", "The secret is sent once and stored in the secret store.", body=ref("Connection"), ok="201", okschema=ref("Connection"), okdesc="Created", grant="administer connections", ms="M9")},
        "/v1/connections/{id}/test": {"post": op("Test connection", params=[P("id", "path")], okschema={"type": "object", "properties": {"healthy": {"type": "boolean"}, "detail": {"type": "string"}}}, grant="administer connections", ms="M9")},
    }, ["Connection"]),
    doc("workflows", "Workflows", "process", "M7", "Workflow definitions designed in the console and executed by Flowable.", {
        "/v1/workflows": {"get": op("List workflows", params=[P("status")], okschema={"type": "array", "items": ref("Workflow")}, grant="read", ms="M7")},
        "/v1/workflows/{id}/versions/{version}/bpmn": {"get": op("Export compiled BPMN 2.0", params=[P("id", "path"), P("version", "path", typ="integer")], okdesc="BPMN XML", grant="read", ms="M7")},
        "/v1/workflows/{id}/publish-requests": {"post": op("Submit for publishing", params=[P("id", "path")], ok="202", okdesc="Accepted", grant="author workflows", ms="M7")},
    }, ["EntityReference", "Workflow"]),
    doc("feeds", "Feeds and announcements", "platform", "M4", "Awareness only: a read-model over existing events, filtered by your grants. Nothing here writes master data.", {
        "/v1/activity": {"get": op("Activity feed", params=PAGEP + [P("domain"), P("kind")], okschema=page("Activity"), grant="read", ms="M4")},
        "/v1/announcements": {"get": op("Announcements for me", okschema={"type": "array", "items": ref("Announcement")}, grant="read", ms="M4"),
                              "post": op("Draft an announcement", body=ref("Announcement"), ok="201", okschema=ref("Announcement"), okdesc="Created", grant="publish announcements", ms="M4")},
    }, ["EntityReference", "Activity", "Announcement"]),
    doc("analytics", "Reports and broadcasts", "platform", "M4", "Report definitions over governed views and scheduled broadcasts. Each recipient gets only the data they may read.", {
        "/v1/reports": {"get": op("List reports", okschema={"type": "array", "items": ref("Report")}, grant="read", ms="M4")},
        "/v1/reports/{id}/query": {"post": op("Run a report query", "Evaluated as the caller.", [P("id", "path")], body={"type": "object", "properties": {"filters": {"type": "object"}}}, okschema={"type": "object", "properties": {"rows": {"type": "array", "items": {"type": "object"}}}}, grant="read:<domain>", ms="M4")},
        "/v1/broadcasts": {"get": op("List broadcasts", okschema={"type": "array", "items": ref("Broadcast")}, grant="read", ms="M4"),
                           "post": op("Create a broadcast", body=ref("Broadcast"), ok="201", okschema=ref("Broadcast"), okdesc="Created", grant="broadcast", ms="M4")},
    }, ["Report", "Broadcast"]),
    doc("api-admin", "API management", "admin", "M5", "Administrator APIs behind the API management page: tokens, app registrations, webhooks, MCP grants and usage.", {
        "/v1/admin/tokens": {"get": op("List tokens", params=[P("owner"), P("status")], okschema={"type": "array", "items": ref("Token")}, grant="administer API access", ms="M5"),
                             "post": op("Generate a token for a named owner", "The value is returned once and never stored outside the secret store. Scopes cannot exceed the owner's grants.", body={"type": "object", "properties": {"owner": {"type": "string"}, "name": {"type": "string"}, "scopes": {"type": "array", "items": {"type": "string"}}, "days": {"type": "integer", "maximum": 180}}, "required": ["owner", "name", "scopes"]}, ok="201", okschema=ref("TokenCreated"), okdesc="Created", grant="administer API access", ms="M5")},
        "/v1/admin/tokens/{id}/revoke": {"post": op("Revoke a token", "Takes effect immediately.", [P("id", "path")], ok="204", okdesc="Revoked", grant="administer API access", ms="M5")},
        "/v1/admin/webhooks": {"get": op("List webhooks", okschema={"type": "array", "items": ref("Webhook")}, grant="administer API access", ms="M5"),
                               "post": op("Create a webhook", "A signing secret is generated and kept in the secret store.", body=ref("Webhook"), ok="201", okschema=ref("Webhook"), okdesc="Created", grant="administer API access", ms="M5")},
        "/v1/admin/usage/calls": {"get": op("Call log", "Metadata only; never payloads.", PAGEP + [P("client"), P("result", enum=["ok", "denied", "limited", "error"])], okschema=page("CallLogEntry"), grant="administer API access", ms="M5")},
    }, ["EntityReference", "Token", "TokenCreated", "Webhook", "CallLogEntry"]),
    doc("audit", "Audit log", "platform", "M1", "Who did what, when, on which version. The forensic record.", {
        "/v1/audit": {"get": op("Search the audit trail", params=PAGEP + [P("actor"), P("object"), P("from"), P("to")], okschema=page("AuditEntry"), grant="read audit", ms="M1")},
    }, ["EntityReference", "AuditEntry"]),
    doc("graphql", "GraphQL", "data", "M4", "Golden records with their governed relationships in one query. Same grants as REST.", {
        "/graphql": {"post": op("Run a GraphQL query", "Example: `{ customer(masterId: \"C-10001\") { goldenId attributes { name value } relationships { type to { goldenId } } } }`", body=ref("GraphQLRequest"), okschema={"type": "object", "properties": {"data": {"type": "object"}, "errors": {"type": "array", "items": {"type": "object"}}}}, grant="read:<domain>", ms="M4")},
    }, ["GraphQLRequest"], kind="graphql"),
    doc("mcp", "MCP server", "agents", "M5", "Model Context Protocol (JSON-RPC 2.0) for AI agents. Every tool call runs with the initiating user's scopes and is audited.\n\nTools: `search_golden_records`, `get_golden_record`, `list_potential_matches`, `explain_lineage`, `query_sql`, `create_change_request` (drafts only), `confirm_match`.", {
        "/mcp": {"post": op("JSON-RPC request", "`tools/list` returns only the tools your role is granted; `tools/call` runs one.", body=ref("JsonRpc"), okschema=ref("JsonRpc"), grant="mcp", ms="M5")},
    }, ["JsonRpc"], base="${REPOIO_MCP_URL}", version="2026-06", kind="mcp"),
    doc("customer-lookup-v0", "Customer lookup (legacy)", "data", "M1", "Kept for existing clients only. Use `GET /v1/customers?q=` instead.", {
        "/v0/customer-lookup": {"get": dict(op("Look up a customer by source code", params=[P("code", req=True)], okschema=ref("GoldenRecord"), grant="read:customers", ms="M1"), deprecated=True)},
    }, ["EntityReference", "GoldenRecord"], version="v0", deprecated=True, sunset="2027-03-31"),
]

json.dump({"docs": DOCS}, open(OUT, "w"), ensure_ascii=False, indent="\t")
print(len(DOCS), "docs,", sum(len(d["paths"]) for d in DOCS), "paths,", os.path.getsize(OUT) // 1024, "KB")
