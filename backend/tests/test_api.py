import os
import tempfile

_db = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["MDM_DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["MDM_REDIS_URL"] = ""
os.environ["MDM_ADMIN_PASSWORD"] = "test-pass"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import build_records  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _login(client, password="test-pass"):
    return client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": password})


def _auth(client):
    return {"Authorization": f"Bearer {_login(client).json()['access_token']}"}


def test_health(client):
    body = client.get("/api/v1/health").json()
    assert body["status"] == "ok"
    assert body["checks"]["database"]["ok"] is True


def test_seed_has_duplicates():
    records = build_records()
    entities = {r["payload"]["_truth_entity"] for r in records}
    assert len(records) > len(entities)  # intentional duplicates exist


def test_requires_auth(client):
    assert client.get("/api/v1/customers/search?q=a").status_code == 401


def test_login_and_me(client):
    me = client.get("/api/v1/auth/me", headers=_auth(client)).json()
    assert me["role"] == "admin"


def test_search_and_catalog(client):
    headers = _auth(client)
    sources = client.get("/api/v1/catalog/sources", headers=headers).json()
    assert {s["source_system"] for s in sources} == {"C4C", "S4HANA", "CRM"}
    rows = client.get("/api/v1/customers/search", params={"q": "محمد"}, headers=headers).json()
    assert rows and all("محمد" in r["name"] or "محمد" in r["email"] for r in rows)


def test_personal_token_lifecycle(client):
    headers = _auth(client)
    created = client.post("/api/v1/tokens", json={"name": "ci", "expires_in_days": 7}, headers=headers).json()
    pat = {"Authorization": f"Bearer {created['token']}"}
    assert client.get("/api/v1/auth/me", headers=pat).status_code == 200
    listed = client.get("/api/v1/tokens", headers=headers).json()
    assert all("token" not in t for t in listed)  # never retrievable after creation
    assert client.delete(f"/api/v1/tokens/{created['id']}", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=pat).status_code == 401


def test_bot_token_and_rotation(client):
    headers = _auth(client)
    bot = client.post("/api/v1/bots", json={"name": "mcp", "role": "viewer"}, headers=headers).json()
    assert bot["token_type"] == "BOT" and bot["expires_at"] is None
    bot_headers = {"Authorization": f"Bearer {bot['token']}"}
    assert client.get("/api/v1/customers/search", params={"q": "ا"}, headers=bot_headers).status_code == 200
    # viewer bots cannot create other bots
    assert client.post("/api/v1/bots", json={"name": "x"}, headers=bot_headers).status_code == 403
    bot_id = client.get("/api/v1/bots", headers=headers).json()[0]["id"]
    rotated = client.post(f"/api/v1/bots/{bot_id}/rotate", headers=headers).json()
    assert client.get("/api/v1/auth/me", headers=bot_headers).status_code == 401
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {rotated['token']}"}).status_code == 200


def _customer_domain(client, headers):
    return next(d for d in client.get("/api/v1/domains", headers=headers).json() if d["name"] == "Customer")


def _template_body(domain_id, name="New customer"):
    return {
        "name": name, "domain_id": domain_id, "request_type": "new_customer",
        "description": "Request a new customer",
        "fields": [
            {"key": "name", "label": "الاسم", "type": "text", "required": True},
            {"key": "phone", "label": "Phone", "type": "phone", "required": True},
            {"key": "email", "label": "Email", "type": "email", "required": False},
            {"key": "segment", "label": "Segment", "type": "select", "required": False, "options": ["B2B", "B2C"]},
        ],
    }


def test_domains_seeded(client):
    names = {d["name"] for d in client.get("/api/v1/domains", headers=_auth(client)).json()}
    assert {"Customer", "Vendor", "Product"} <= names


def test_template_rules(client):
    headers = _auth(client)
    domain = _customer_domain(client, headers)
    body = _template_body(domain["id"], "rules-check")
    # needs at least one mandatory field
    no_required = {**body, "fields": [{**f, "required": False} for f in body["fields"]]}
    assert client.post("/api/v1/ticket-templates", json=no_required, headers=headers).status_code == 422
    # duplicate keys
    dup = {**body, "fields": body["fields"] + [body["fields"][0]]}
    assert client.post("/api/v1/ticket-templates", json=dup, headers=headers).status_code == 422
    # select needs options
    bad_select = {**body, "fields": body["fields"] + [{"key": "x", "label": "X", "type": "select", "required": False}]}
    assert client.post("/api/v1/ticket-templates", json=bad_select, headers=headers).status_code == 422
    # unknown domain
    assert client.post("/api/v1/ticket-templates", json={**body, "domain_id": "nope"}, headers=headers).status_code == 422
    # viewers cannot create templates
    bot = client.post("/api/v1/bots", json={"name": "viewer-bot", "role": "viewer"}, headers=headers).json()
    viewer = {"Authorization": f"Bearer {bot['token']}"}
    assert client.post("/api/v1/ticket-templates", json=body, headers=viewer).status_code == 403


def test_ticket_template_flow(client):
    headers = _auth(client)
    domain = _customer_domain(client, headers)
    created = client.post("/api/v1/ticket-templates", json=_template_body(domain["id"]), headers=headers)
    assert created.status_code == 201
    template = created.json()
    assert template["domain_name"] == "Customer"
    assert [f["required"] for f in template["fields"]] == [True, True, False, False]
    assert client.post("/api/v1/ticket-templates", json=_template_body(domain["id"]), headers=headers).status_code == 409

    # mandatory fields are enforced, optional ones are not
    missing = client.post("/api/v1/tickets", json={"template_id": template["id"], "data": {"email": "a@b.co"}}, headers=headers)
    assert missing.status_code == 422
    fields = missing.json()["detail"]["fields"]
    assert fields == {"name": "required", "phone": "required"}

    invalid = client.post(
        "/api/v1/tickets",
        json={"template_id": template["id"], "data": {"name": "x", "phone": "abc", "email": "bad", "segment": "B2X", "extra": 1}},
        headers=headers,
    )
    assert invalid.status_code == 422
    assert set(invalid.json()["detail"]["fields"]) == {"phone", "email", "segment", "extra"}

    ok = client.post(
        "/api/v1/tickets",
        json={"template_id": template["id"], "data": {"name": "مكتبة النور", "phone": "01012345678"}},
        headers=headers,
    )
    assert ok.status_code == 201 and ok.json()["status"] == "submitted"

    # editing the template later does not change the snapshot stored with the ticket
    update = {**_template_body(domain["id"]), "name": "New customer v2"}
    assert client.put(f"/api/v1/ticket-templates/{template['id']}", json=update, headers=headers).status_code == 200
    tickets = client.get("/api/v1/tickets", headers=headers).json()
    assert tickets[0]["template_name"] == "New customer"


def test_inactive_template_hidden_and_blocked(client):
    headers = _auth(client)
    domain = _customer_domain(client, headers)
    body = {**_template_body(domain["id"], "to-deactivate"), "is_active": False}
    template = client.post("/api/v1/ticket-templates", json=body, headers=headers).json()
    names = {t["name"] for t in client.get("/api/v1/ticket-templates", headers=headers).json()}
    assert "to-deactivate" not in names
    names_all = {t["name"] for t in client.get("/api/v1/ticket-templates", params={"include_inactive": True}, headers=headers).json()}
    assert "to-deactivate" in names_all
    blocked = client.post("/api/v1/tickets", json={"template_id": template["id"], "data": {"name": "x", "phone": "0101234567"}}, headers=headers)
    assert blocked.status_code == 404


def test_login_lockout(client):
    for _ in range(3):
        assert _login(client, "wrong").status_code == 401
    assert _login(client).status_code == 429  # blocked even with the right password
