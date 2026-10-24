from __future__ import annotations

from .base import ConnectorError, SourceConnector
from .c4c_source import C4CConnector
from .csv_source import CsvConnector
from .sql_source import SqlConnector

REGISTRY: dict[str, type[SourceConnector]] = {c.type: c for c in (CsvConnector, SqlConnector, C4CConnector)}


def get_connector_class(service_type: str) -> type[SourceConnector]:
    try:
        return REGISTRY[service_type]
    except KeyError:
        raise ConnectorError(f"unknown connector type '{service_type}'") from None


def describe_connectors() -> list[dict]:
    return [{"type": c.type, "label": c.label, "fields": [f.as_dict() for f in c.fields]} for c in REGISTRY.values()]
