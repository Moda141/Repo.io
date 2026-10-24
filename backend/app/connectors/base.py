"""Connector SPI. A connector reads one kind of source; the platform decides what to do with the rows.

* ``test_connection()``  cheap reachability/credentials check
* ``discover()``         metadata only: tables (files, entity sets) and their columns
* ``iterate(...)``       stream rows of one table as dicts (only the requested columns)

Secrets are passed separately from config; the service API stores them encrypted and never returns them.
"""
from __future__ import annotations

import ipaddress
import re
import socket
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from ..config import settings


class ConnectorError(Exception):
    """Expected connector failure. The message is safe to store and show: it never contains row values."""


@dataclass
class ColumnInfo:
    name: str
    type: str = "text"
    nullable: bool = True
    primary_key: bool = False

    def as_dict(self) -> dict:
        return {"name": self.name, "type": self.type, "nullable": self.nullable, "primary_key": self.primary_key}


@dataclass
class TableInfo:
    name: str
    schema: str = ""
    columns: list[ColumnInfo] = field(default_factory=list)


@dataclass
class FieldSpec:
    name: str
    label: str
    secret: bool = False
    required: bool = True
    help: str = ""
    default: Any = None
    choices: list[str] | None = None
    kind: str = "text"  # text | number

    def as_dict(self) -> dict:
        return {
            "name": self.name, "label": self.label, "secret": self.secret, "required": self.required,
            "help": self.help, "default": self.default, "choices": self.choices, "kind": self.kind,
        }


class SourceConnector(ABC):
    type: str = ""
    label: str = ""
    fields: list[FieldSpec] = []

    def __init__(self, config: dict, secrets: dict):
        self.config = config
        self.secrets = secrets

    # -- configuration ---------------------------------------------------------------------------
    @classmethod
    def validate(cls, config: dict, secrets: dict, *, keep_secrets: dict | None = None) -> tuple[dict, dict]:
        """Return (clean_config, clean_secrets). ``keep_secrets`` are existing secrets reused when the update
        leaves a secret field empty. Raises ConnectorError."""
        specs = {f.name: f for f in cls.fields}
        unknown = (set(config) | set(secrets)) - set(specs)
        if unknown:
            raise ConnectorError(f"unknown settings: {', '.join(sorted(unknown))}")
        clean_config: dict = {}
        clean_secrets: dict = {}
        for name, spec in specs.items():
            if spec.secret:
                if name in config:
                    raise ConnectorError(f"'{name}' is a secret: send it in 'secrets', not 'config'")
                value = secrets.get(name)
                if value in (None, "") and keep_secrets and keep_secrets.get(name):
                    value = keep_secrets[name]
                if value in (None, ""):
                    if spec.required:
                        raise ConnectorError(f"'{spec.label}' is required")
                    continue
                clean_secrets[name] = str(value)
            else:
                if name in secrets:
                    raise ConnectorError(f"'{name}' is not a secret: send it in 'config', not 'secrets'")
                value = config.get(name, spec.default)
                if value in (None, ""):
                    if spec.required:
                        raise ConnectorError(f"'{spec.label}' is required")
                    continue
                if spec.kind == "number":
                    try:
                        value = int(value)
                    except (TypeError, ValueError):
                        raise ConnectorError(f"'{spec.label}' must be a number") from None
                else:
                    value = str(value).strip()
                if spec.choices and value not in spec.choices:
                    raise ConnectorError(f"'{spec.label}' must be one of: {', '.join(spec.choices)}")
                clean_config[name] = value
        cls._validate_extra(clean_config, clean_secrets)
        return clean_config, clean_secrets

    @classmethod
    def _validate_extra(cls, config: dict, secrets: dict) -> None:
        return None

    # -- operations ------------------------------------------------------------------------------
    @abstractmethod
    def test_connection(self) -> str: ...

    @abstractmethod
    def discover(self) -> list[TableInfo]: ...

    @abstractmethod
    def iterate(
        self,
        schema: str,
        table: str,
        columns: list[str],
        cursor_column: str | None = None,
        watermark: str | None = None,
        column_types: dict[str, str] | None = None,
    ) -> Iterator[dict]: ...

    def close(self) -> None:
        return None


# -- shared helpers ------------------------------------------------------------------------------
def import_root() -> Path:
    return Path(settings.import_dir).resolve()


def safe_path(relative: str, *, must_exist: bool = True) -> Path:
    """Resolve ``relative`` inside the import directory. Rejects absolute paths and anything that escapes
    the root (``..`` or symlinks)."""
    root = import_root()
    if relative.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:", relative) or "\x00" in relative:
        raise ConnectorError("path must be relative to the import folder")
    path = (root / relative).resolve()
    if path != root and root not in path.parents:
        raise ConnectorError("path escapes the import folder")
    if must_exist and not path.exists():
        raise ConnectorError("path does not exist inside the import folder")
    return path


def _resolve(host: str, port: int) -> list[str]:
    return [info[4][0] for info in socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)]


def check_outbound_host(host: str, port: int = 443) -> None:
    """Server-side request guard (SSRF): connectors may only be pointed at hosts that resolve to routable or
    private addresses. Loopback, link-local (cloud metadata 169.254.169.254), unspecified and multicast are
    refused unless MDM_ALLOW_INSECURE_HTTP=true (development). Note: DNS can change between this check and the
    connection; network egress rules remain the real boundary."""
    if settings.allow_insecure_http:
        return
    try:
        addresses = _resolve(host, port)
    except OSError:
        raise ConnectorError(f"host '{host}' cannot be resolved") from None
    for address in addresses:
        ip = ipaddress.ip_address(address.split("%")[0])
        if ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_multicast or ip.is_reserved:
            raise ConnectorError(f"host '{host}' resolves to a disallowed address")


def coerce_like(value: str, sample_type: type | None) -> Any:
    """Turn a stored watermark string back into a comparable value."""
    if sample_type is bool or sample_type is None:
        return value
    try:
        if sample_type is int:
            return int(value)
        if sample_type is float:
            return float(value)
        if sample_type is datetime:
            return datetime.fromisoformat(value)  # keep naive/aware exactly as stored, matching the column
        if sample_type is date:
            return date.fromisoformat(value[:10])
    except ValueError:
        return value
    return value


def greater_than(value: Any, watermark: str) -> bool:
    """Compare a CSV/OData cell with a watermark: numbers numerically, ISO timestamps as times, else as text."""
    text = "" if value is None else str(value)
    for cast in (int, float):
        try:
            return cast(text) > cast(watermark)
        except ValueError:
            continue
    try:
        a, b = datetime.fromisoformat(text), datetime.fromisoformat(watermark)
        a = a if a.tzinfo else a.replace(tzinfo=timezone.utc)
        b = b if b.tzinfo else b.replace(tzinfo=timezone.utc)
        return a > b
    except ValueError:
        return text > watermark
