import json

import httpx
import pytest

from app.config import settings
from app.connectors import base
from app.connectors.base import ConnectorError, safe_path
from app.connectors.c4c_source import C4CConnector

BASE = "https://tenant.example.invalid/sap/c4c/odata/v1/c4codataapi"
METADATA = """<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx"><edmx:DataServices>
<Schema xmlns="http://schemas.microsoft.com/ado/2008/09/edm">
<EntityType Name="Customer"><Key><PropertyRef Name="ObjectID"/></Key>
<Property Name="ObjectID" Type="Edm.String" Nullable="false"/><Property Name="Name" Type="Edm.String"/>
<Property Name="ChangedOn" Type="Edm.DateTime"/></EntityType>
<EntityContainer Name="c"><EntitySet Name="CustomerCollection" EntityType="x.Customer"/></EntityContainer>
</Schema></edmx:DataServices></edmx:Edmx>"""


@pytest.fixture(autouse=True)
def _no_dns(monkeypatch):
    monkeypatch.setattr(base, "_resolve", lambda host, port: ["93.184.216.34"])
    monkeypatch.setattr(C4CConnector, "retry_sleep", 0)


def connector(handler):
    C4CConnector.transport = httpx.MockTransport(handler)
    return C4CConnector({"base_url": BASE, "username": "u"}, {"password": "p"})


def teardown_function():
    C4CConnector.transport = None


def test_c4c_discover_and_paging_with_date_parsing():
    calls = []

    def handler(request: httpx.Request):
        calls.append(str(request.url))
        if request.url.path.endswith("$metadata"):
            return httpx.Response(200, text=METADATA)
        if "page2" in str(request.url):
            return httpx.Response(200, json={"d": {"results": [{"ObjectID": "3", "Name": "c", "ChangedOn": "/Date(1700000000000)/"}]}})
        return httpx.Response(200, json={"d": {"results": [{"ObjectID": "1", "Name": "a", "ChangedOn": None}, {"ObjectID": "2", "Name": "b", "ChangedOn": "/Date(1700000000000)/"}],
                                              "__next": f"{BASE}/CustomerCollection?page2=1"}})

    c = connector(handler)
    tables = c.discover()
    assert [t.name for t in tables] == ["CustomerCollection"]
    assert tables[0].columns[0].primary_key
    rows = list(c.iterate("", "CustomerCollection", ["ObjectID", "Name"], "ChangedOn", None, {}))
    assert [r["ObjectID"] for r in rows] == ["1", "2", "3"]
    assert rows[2]["ChangedOn"].startswith("2023-11-14")


def test_c4c_retries_then_fails_and_never_leaks_credentials():
    attempts = []

    def handler(request):
        attempts.append(1)
        return httpx.Response(503)

    with pytest.raises(ConnectorError) as exc:
        connector(handler).test_connection()
    assert len(attempts) == 4 and "503" in str(exc.value) and "p" != str(exc.value)

    with pytest.raises(ConnectorError, match="authentication failed"):
        connector(lambda r: httpx.Response(401)).test_connection()


def test_c4c_refuses_other_host_in_next_link():
    def handler(request):
        if request.url.path.endswith("$metadata"):
            return httpx.Response(200, text=METADATA)
        return httpx.Response(200, json={"d": {"results": [], "__next": "https://evil.invalid/steal"}})

    # an empty page with a hostile __next must not be followed with credentials
    with pytest.raises(ConnectorError, match="different host"):
        list(connector(handler).iterate("", "CustomerCollection", ["ObjectID"], None, None, {}))


def test_c4c_incremental_filter_uses_edm_literal():
    seen = {}

    def handler(request):
        seen.update(dict(request.url.params))
        return httpx.Response(200, json={"d": {"results": []}})

    list(connector(handler).iterate("", "CustomerCollection", ["ObjectID"], "ChangedOn", "2026-01-01T00:00:00", {"ChangedOn": "Edm.DateTime"}))
    assert seen["$filter"].startswith("ChangedOn gt datetime'2026-01-01T00:00:00")


def test_c4c_rejects_http_and_credentials_in_url():
    with pytest.raises(ConnectorError):
        C4CConnector.validate({"base_url": "http://x.example.invalid/a", "username": "u"}, {"password": "p"})
    with pytest.raises(ConnectorError):
        C4CConnector.validate({"base_url": "https://u:p@x.example.invalid/a", "username": "u"}, {"password": "p"})


def test_ssrf_guard_blocks_private_addresses(monkeypatch):
    monkeypatch.setattr(base, "_resolve", lambda host, port: ["169.254.169.254"])
    with pytest.raises(ConnectorError):
        connector(lambda r: httpx.Response(200, text=METADATA)).test_connection()


@pytest.mark.parametrize("p", ["../x", "/etc/passwd", "a/../../x", "C:\\x"])
def test_safe_path_rejects_escapes(p):
    with pytest.raises(ConnectorError):
        safe_path(p, must_exist=False)


def test_sql_connector_sqlite_gated_and_reads(tmp_path, monkeypatch):
    import sqlite3

    from app.connectors.sql_source import SqlConnector

    with pytest.raises(ConnectorError):
        SqlConnector.validate({"drivername": "sqlite", "database": "x.db"}, {})
    monkeypatch.setattr(settings, "allow_sqlite_connector", True)
    db = base.import_root() / "src.db"
    con = sqlite3.connect(db)
    con.execute("create table customers(id integer primary key, name text, changed text)")
    con.executemany("insert into customers values(?,?,?)", [(1, "a", "2026-01-01"), (2, "b", "2026-02-01")])
    con.commit(); con.close()
    cfg, sec = SqlConnector.validate({"drivername": "sqlite", "database": "src.db"}, {})
    c = SqlConnector(cfg, sec)
    t = c.discover()
    assert [x.name for x in t] == ["customers"]
    rows = list(c.iterate("", "customers", ["id", "name"], "changed", "2026-01-15", {"changed": "text"}))
    assert [r["id"] for r in rows] == [2]
    with pytest.raises(ConnectorError):  # identifiers must come from reflection, never from the caller
        list(c.iterate("", "customers; drop table customers", ["id"], None, None, {}))
