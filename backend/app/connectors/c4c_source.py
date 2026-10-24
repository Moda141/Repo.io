"""SAP Cloud for Customer (C4C) OData v2 connector.

Entity sets and property names are NOT hard-coded: they come from the tenant's own ``$metadata`` via
discover(), so what you register as a master source is whatever your tenant actually exposes.
The OData service root is typically ``https://<tenant>.crm.ondemand.com/sap/c4c/odata/v1/c4codataapi``
(verify against your tenant).
"""
from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from typing import Iterator
from urllib.parse import urlsplit

import defusedxml.ElementTree as ET
import httpx

from ..config import settings
from .base import (
    ColumnInfo,
    ConnectorError,
    FieldSpec,
    SourceConnector,
    TableInfo,
    check_outbound_host,
)

NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
ODATA_DATE_RE = re.compile(r"^/Date\((-?\d+)(?:([+-])(\d{4}))?\)/$")
RETRY_STATUS = {429, 502, 503, 504}


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _odata_literal(value: str, edm_type: str) -> str:
    if edm_type == "Edm.DateTimeOffset":
        return f"datetimeoffset'{value}'"
    if edm_type == "Edm.DateTime":
        return f"datetime'{value.split('+')[0].rstrip('Z')}'"
    if edm_type in ("Edm.Int16", "Edm.Int32", "Edm.Int64", "Edm.Decimal", "Edm.Double", "Edm.Single", "Edm.Byte"):
        float(value)  # raises ValueError for non-numbers: never splice arbitrary text into a filter
        return value
    return "'" + value.replace("'", "''") + "'"


def _clean_value(value):
    """OData v2 JSON quirks: '/Date(ms[+hhmm])/' timestamps, __deferred navigation stubs, nested results."""
    if isinstance(value, str):
        match = ODATA_DATE_RE.match(value)
        if match:
            moment = datetime.fromtimestamp(int(match.group(1)) / 1000, tz=timezone.utc)
            return moment.isoformat()
        return value
    if isinstance(value, dict):  # navigation property stub or complex value: not a column
        return None
    return value


class C4CConnector(SourceConnector):
    type = "sap_c4c"
    label = "SAP C4C (OData)"
    fields = [
        FieldSpec("base_url", "OData service root URL", help="https://<tenant>.crm.ondemand.com/sap/c4c/odata/v1/c4codataapi"),
        FieldSpec("username", "Username (technical user)"),
        FieldSpec("password", "Password", secret=True),
        FieldSpec("page_size", "Page size", required=False, default=500, kind="number"),
    ]

    # Tests inject httpx.MockTransport here; retry_sleep is zeroed in tests.
    transport: httpx.BaseTransport | None = None
    retry_sleep: float = 1.0

    @classmethod
    def _validate_extra(cls, config: dict, secrets: dict) -> None:
        parts = urlsplit(config["base_url"])
        allowed = {"https", "http"} if settings.allow_insecure_http else {"https"}
        if parts.scheme not in allowed:
            raise ConnectorError("the URL must use https")
        if not parts.hostname or parts.username or parts.password or parts.query or parts.fragment:
            raise ConnectorError("the URL must be a plain service root (no credentials, query or fragment)")
        if not 1 <= int(config.get("page_size", 500)) <= 5000:
            raise ConnectorError("'Page size' must be between 1 and 5000")
        config["base_url"] = config["base_url"].rstrip("/")

    def _client(self) -> httpx.Client:
        parts = urlsplit(self.config["base_url"])
        check_outbound_host(parts.hostname, parts.port or (443 if parts.scheme == "https" else 80))
        return httpx.Client(
            auth=(self.config["username"], self.secrets["password"]),
            timeout=60.0,
            headers={"Accept": "application/json"},
            transport=self.transport,
            follow_redirects=False,  # a redirect could carry the credentials to another host
        )

    def _get(self, client: httpx.Client, url: str, params: dict | None = None) -> httpx.Response:
        base = urlsplit(self.config["base_url"])
        target = urlsplit(url)
        if (target.scheme, target.netloc) != (base.scheme, base.netloc):
            raise ConnectorError("refusing to send credentials to a different host")
        last = "no response"
        for attempt in range(4):
            try:
                response = client.get(url, params=params)
            except httpx.HTTPError as exc:
                last = type(exc).__name__
            else:
                if response.status_code in RETRY_STATUS:
                    last = f"HTTP {response.status_code}"
                elif response.status_code in (401, 403):
                    raise ConnectorError("authentication failed (check the technical user and its authorizations)")
                elif response.status_code >= 400:
                    raise ConnectorError(f"the server answered HTTP {response.status_code}")
                else:
                    return response
            time.sleep(self.retry_sleep * (2**attempt))
        raise ConnectorError(f"the server is not reachable or keeps failing ({last})")

    def test_connection(self) -> str:
        with self._client() as client:
            response = self._get(client, f"{self.config['base_url']}/$metadata")
        if "<" not in response.text[:200]:
            raise ConnectorError("the URL did not return OData metadata; is it the service root?")
        return "connected"

    def discover(self) -> list[TableInfo]:
        with self._client() as client:
            response = self._get(client, f"{self.config['base_url']}/$metadata")
        try:
            root = ET.fromstring(response.content)
        except ET.ParseError:
            raise ConnectorError("the $metadata response is not valid XML") from None
        types: dict[str, list[ColumnInfo]] = {}
        for node in root.iter():
            if _local(node.tag) != "EntityType":
                continue
            keys = {r.get("Name") for k in node if _local(k.tag) == "Key" for r in k if _local(r.tag) == "PropertyRef"}
            props = [
                ColumnInfo(p.get("Name"), p.get("Type", "Edm.String"), p.get("Nullable", "true") != "false", p.get("Name") in keys)
                for p in node
                if _local(p.tag) == "Property"
            ]
            types[node.get("Name")] = props
        tables = []
        for node in root.iter():
            if _local(node.tag) == "EntitySet" and NAME_RE.match(node.get("Name", "")):
                type_name = (node.get("EntityType") or "").rsplit(".", 1)[-1]
                tables.append(TableInfo(name=node.get("Name"), columns=types.get(type_name, [])))
        return sorted(tables, key=lambda t: t.name)

    def iterate(self, schema, table, columns, cursor_column=None, watermark=None, column_types=None) -> Iterator[dict]:
        if not NAME_RE.match(table):
            raise ConnectorError("invalid entity set name")
        wanted = list(dict.fromkeys(columns + ([cursor_column] if cursor_column else [])))
        for name in wanted:
            if not NAME_RE.match(name):
                raise ConnectorError("invalid property name")
        page_size = int(self.config.get("page_size", 500))
        params: dict | None = {"$format": "json", "$top": str(page_size), "$skip": "0", "$select": ",".join(wanted)}
        if cursor_column and watermark is not None:
            edm = (column_types or {}).get(cursor_column, "Edm.String")
            try:
                params["$filter"] = f"{cursor_column} gt {_odata_literal(watermark, edm)}"
            except ValueError:
                raise ConnectorError("the stored watermark does not fit the cursor column type") from None
        url = f"{self.config['base_url']}/{table}"
        skip = 0
        with self._client() as client:
            while True:
                response = self._get(client, url, params)
                try:
                    body = response.json()
                except ValueError:
                    raise ConnectorError("the server did not return JSON") from None
                data = body.get("d", body) if isinstance(body, dict) else {}
                results = data.get("results") if isinstance(data, dict) else None
                if results is None:
                    results = body.get("value") if isinstance(body, dict) else None
                if not isinstance(results, list):
                    raise ConnectorError("unexpected OData response shape")
                for item in results:
                    yield {c: _clean_value(item.get(c)) for c in wanted}
                next_link = data.get("__next") if isinstance(data, dict) else None
                if next_link:
                    url, params = next_link, None  # server-driven paging; host is re-checked in _get
                elif len(results) >= page_size:
                    skip += len(results)
                    params = {**(params or {}), "$skip": str(skip)}
                else:
                    return
