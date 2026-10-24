import csv
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.bus import InlineBus
from app.db import SessionLocal
from app.main import app
from app.models import CatalogTable, IngestError, SchemaDriftEvent, SourceRecord, SyncRun
from app.normalize import normalize_email, normalize_name, normalize_phone

IMPORTS = Path(os.environ["MDM_IMPORT_DIR"])
HEADER = ["id", "name", "phone", "email", "city", "updated"]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth(client):
    token = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "test-pass"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def write_csv(folder: str, name: str, rows: list[list], header=HEADER):
    path = IMPORTS / folder
    path.mkdir(parents=True, exist_ok=True)
    with open(path / name, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def setup_service(client, auth, name, rows, *, header=HEADER, cursor="updated"):
    write_csv(name, "customers.csv", rows, header)
    r = client.post("/api/v1/services", headers=auth, json={"name": name, "service_type": "csv", "config": {"folder": name}})
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    assert client.post(f"/api/v1/services/{sid}/discover", headers=auth).json()["status"] == "completed"
    table = client.get("/api/v1/tables", headers=auth, params={"service_id": sid}).json()[0]
    r = client.put(
        f"/api/v1/tables/{table['id']}/master", headers=auth,
        json={"column_map": {"source_id": "id", "name": "name", "phone": "phone", "email": "email", "city": "city"}, "cursor_column": cursor},
    )
    assert r.status_code == 200, r.text
    return sid, table["id"]


def sync(client, auth, table_id, mode="full"):
    r = client.post(f"/api/v1/tables/{table_id}/sync", headers=auth, json={"mode": mode})
    assert r.status_code == 202, r.text
    return client.get(f"/api/v1/sync-runs/{r.json()['id']}", headers=auth).json()  # background task already ran


def count(table_id, deleted=False):
    with SessionLocal() as db:
        return db.query(SourceRecord).filter(SourceRecord.table_id == table_id, SourceRecord.is_deleted.is_(deleted)).count()


def test_normalizers():
    assert normalize_name("أَحمد  عبد الرحمن") == normalize_name("احمد عبد الرحمن")
    assert normalize_name("مُحمّد ـ ة") == normalize_name("محمد ه")
    assert normalize_phone("01012345678") == normalize_phone("+20 101 234 5678") == normalize_phone("0020 1012345678")
    assert normalize_phone("٠١٠١٢٣٤٥٦٧٨") == normalize_phone("01012345678")
    assert normalize_email(" A@B.com ") == "a@b.com"


def test_full_pipeline_idempotent_and_deletes(client, auth):
    rows = [[i, f"عميل {i}", f"0101000{i:04d}", f"c{i}@x.com", "القاهرة", f"2026-01-{i:02d}"] for i in range(1, 6)]
    sid, tid = setup_service(client, auth, "t_full", rows)
    run = sync(client, auth, tid)
    assert run["status"] == "completed" and (run["added"], run["failed"]) == (5, 0)
    assert count(tid) == 5

    again = sync(client, auth, tid)  # nothing changed
    assert (again["added"], again["updated"], again["unchanged"]) == (0, 0, 5)

    rows[0][1] = "عميل معدل"
    rows.pop()  # id 5 disappears from the source
    write_csv("t_full", "customers.csv", rows)
    third = sync(client, auth, tid)
    assert (third["updated"], third["unchanged"], third["deleted"]) == (1, 3, 1)
    assert count(tid) == 4 and count(tid, deleted=True) == 1

    rows.append([5, "عميل 5", "01010000005", "c5@x.com", "القاهرة", "2026-01-05"])  # comes back
    write_csv("t_full", "customers.csv", rows)
    fourth = sync(client, auth, tid)
    assert fourth["updated"] == 1 and count(tid) == 5  # restored


def test_bad_rows_rejected_duplicates_ignored(client, auth):
    rows = [[1, "أحمد", "", "", "", "2026-01-01"], ["", "بدون معرف", "", "", "", "2026-01-02"],
            [1, "مكرر", "", "", "", "2026-01-03"], [2, "", "", "", "", "2026-01-04"]]
    _, tid = setup_service(client, auth, "t_bad", rows)
    run = sync(client, auth, tid)
    assert run["status"] == "completed_with_warnings"
    assert run["failed"] == 1  # the row without an id; an empty name is a data-quality finding, not an ingest failure
    assert "duplicate" in run["warning"]
    errors = client.get("/api/v1/ingest-errors", headers=auth, params={"run_id": run["id"]}).json()
    assert [e["stage"] for e in errors] == ["producer"]
    assert count(tid) == 2  # id 1 (first occurrence wins) and id 2


def test_incremental_watermark(client, auth):
    rows = [[i, f"عميل {i}", "", "", "", f"2026-02-{i:02d}"] for i in range(1, 4)]
    _, tid = setup_service(client, auth, "t_inc", rows)
    assert sync(client, auth, tid)["added"] == 3
    with SessionLocal() as db:
        assert db.get(CatalogTable, tid).watermark == "2026-02-03"
    rows.append([4, "عميل 4", "", "", "", "2026-02-10"])
    write_csv("t_inc", "customers.csv", rows)
    run = sync(client, auth, tid, "incremental")
    assert run["added"] == 1 and run["deleted"] == 0  # incremental never deletes
    assert count(tid) == 4


def test_delete_guard_skips_truncated_extract(client, auth):
    rows = [[i, f"عميل {i}", "", "", "", "2026-03-01"] for i in range(1, 41)]
    _, tid = setup_service(client, auth, "t_guard", rows)
    sync(client, auth, tid)
    write_csv("t_guard", "customers.csv", rows[:10])  # 75% of records "vanish"
    run = sync(client, auth, tid)
    assert run["status"] == "completed_with_warnings" and "delete sweep skipped" in run["warning"]
    assert count(tid) == 40 and run["deleted"] == 0


def test_schema_drift(client, auth):
    rows = [[1, "أحمد", "", "", "", "2026-01-01"]]
    sid, tid = setup_service(client, auth, "t_drift", rows)
    write_csv("t_drift", "customers.csv", [[1, "أحمد", "", "2026-01-01", "x"]], header=["id", "name", "phone", "updated", "notes"])
    run = client.post(f"/api/v1/services/{sid}/discover", headers=auth).json()
    assert run["status"] == "completed_with_warnings"  # email + city (mapped) were removed
    events = client.get("/api/v1/schema-drift", headers=auth, params={"table_id": tid}).json()
    removed = {e["column_name"]: e["affects_mapping"] for e in events if e["change_type"] == "column_removed"}
    assert removed == {"email": True, "city": True}
    assert any(e["change_type"] == "column_added" and e["column_name"] == "notes" and not e["affects_mapping"] for e in events)
    assert sync(client, auth, tid)["status"] in ("failed", "completed_with_warnings")  # never crashes on a drifted source


def test_replay_of_same_event_is_duplicate(client, auth):
    from app.events import make_raw_event
    from app.pipeline import normalize_event, write_event

    _, tid = setup_service(client, auth, "t_replay", [[1, "أحمد", "", "", "", "2026-01-01"]])
    run = sync(client, auth, tid)
    with SessionLocal() as db:
        ev = normalize_event(make_raw_event(run_id=run["id"], source_system="t_replay", table_id=tid, entity_type="customer", source_id="1", fields={"name": "أحمد"}, raw={}))
        assert write_event(db, ev) == "duplicate"


def test_api_validation_and_secrets(client, auth):
    assert client.post("/api/v1/services", headers=auth, json={"name": "bad name!", "service_type": "csv", "config": {}}).status_code == 422
    assert client.post("/api/v1/services", headers=auth, json={"name": "esc", "service_type": "csv", "config": {"folder": "../etc"}}).status_code == 422
    assert client.post("/api/v1/services", headers=auth, json={"name": "x1", "service_type": "nope"}).status_code == 422
    r = client.post("/api/v1/services", headers=auth, json={
        "name": "sap1", "service_type": "sap_c4c",
        "config": {"base_url": "https://my.example.invalid/sap/c4c/odata/v1/c4codataapi", "username": "u"}, "secrets": {"password": "SuperSecret1"}})
    assert r.status_code == 201, r.text
    assert "SuperSecret1" not in r.text and "password" in r.json()["secrets_set"]
    assert "SuperSecret1" not in client.get("/api/v1/services", headers=auth).text
    # secrets sent as plain config are refused
    assert client.post("/api/v1/services", headers=auth, json={"name": "sap2", "service_type": "sap_c4c", "config": {"password": "x"}}).status_code == 422
    assert client.get("/api/v1/services").status_code == 401


def test_register_validation(client, auth):
    _, tid = setup_service(client, auth, "t_reg", [[1, "a", "", "", "", "2026-01-01"]])
    bad = client.put(f"/api/v1/tables/{tid}/master", headers=auth, json={"column_map": {"source_id": "id", "name": "nope"}})
    assert bad.status_code == 422 and "nope" in bad.text
    assert client.put(f"/api/v1/tables/{tid}/master", headers=auth, json={"column_map": {"name": "name"}}).status_code == 422
    assert client.put(f"/api/v1/tables/{tid}/master", headers=auth, json={"column_map": {"source_id": "id", "name": "name", "evil": "x"}}).status_code == 422


def test_upload_rejects_bad_names(client, auth):
    sid = client.post("/api/v1/services", headers=auth, json={"name": "t_up", "service_type": "csv", "config": {"folder": "t_up"}}).json()["id"]
    ok = client.post(f"/api/v1/services/{sid}/files", headers=auth, files={"file": ("a.csv", b"id,name\n1,x\n")})
    assert ok.status_code == 201 and (IMPORTS / "t_up" / "a.csv").exists()
    for name in ("../evil.csv", "a.txt", ".hidden.csv"):
        assert client.post(f"/api/v1/services/{sid}/files", headers=auth, files={"file": (name, b"x")}).status_code == 422
