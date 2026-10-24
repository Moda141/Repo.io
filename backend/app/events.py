"""Event envelope and topic names for the ingestion pipeline (docs/design.md, section 3.5).

Flow:  connector -> mdm.raw.<system>.<entity> -> normalizer -> mdm.source.normalized -> ingest-writer
                                                                     \\-> mdm.match.requests   (consumed from M2)
       any failed event -> mdm.dlq (and an ingest_error row)
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Any

ENVELOPE_VERSION = 1
RAW_PREFIX = "mdm.raw."
RAW_PATTERN = r"^mdm\.raw\..+"
TOPIC_NORMALIZED = "mdm.source.normalized"
TOPIC_MATCH = "mdm.match.requests"
TOPIC_DLQ = "mdm.dlq"

# Canonical customer fields a source table is mapped to (column_map keys).
CANONICAL_FIELDS = ("name", "phone", "email", "city", "tax_id")
REQUIRED_EVENT_KEYS = ("v", "event_id", "run_id", "source_system", "table_id", "entity_type", "source_id", "fields")


class EventError(ValueError):
    """A bad event (validation problem). The message is safe to store and show: it never contains row values."""


def _topic_part(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", value)


def raw_topic(source_system: str, entity_type: str) -> str:
    return f"{RAW_PREFIX}{_topic_part(source_system)}.{_topic_part(entity_type)}"


def json_safe(value: Any) -> Any:
    """Convert a database/CSV/OData value into something JSON can carry, without losing precision."""
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        return None if (math.isnan(value) or math.isinf(value)) else value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, (bytes, bytearray, memoryview)):
        return "hex:" + bytes(value).hex()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (set, frozenset, tuple, list)):
        return [json_safe(v) for v in value]
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    return str(value)


def canonical_hash(fields: dict) -> str:
    """Stable hash of the canonical (un-normalized) values: unchanged hash == nothing to update."""
    body = {k: str(fields.get(k) or "") for k in CANONICAL_FIELDS}
    return hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def make_raw_event(
    *, run_id: str, source_system: str, table_id: str, entity_type: str, source_id: str, fields: dict, raw: dict
) -> dict:
    return {
        "v": ENVELOPE_VERSION,
        "event_id": str(uuid.uuid4()),
        "run_id": run_id,
        "source_system": source_system,
        "table_id": table_id,
        "entity_type": entity_type,
        "source_id": source_id,
        "fields": fields,  # canonical fields, mapped from the source columns (not yet standardized)
        "raw": raw,  # only the mapped columns (+ explicitly requested extras): data minimization
        "extracted_at": datetime.now(timezone.utc).isoformat(),
    }


def validate_event(value: Any) -> dict:
    if not isinstance(value, dict):
        raise EventError("event is not an object")
    missing = [k for k in REQUIRED_EVENT_KEYS if k not in value]
    if missing:
        raise EventError(f"event is missing keys: {', '.join(missing)}")
    if value["v"] != ENVELOPE_VERSION:
        raise EventError(f"unsupported envelope version {value['v']!r}")
    if not isinstance(value["fields"], dict):
        raise EventError("fields must be an object")
    if not str(value["source_id"]).strip():
        raise EventError("source_id is empty")
    return value
