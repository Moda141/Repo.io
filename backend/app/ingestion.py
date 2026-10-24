"""Producer side: metadata discovery (written directly, it is small) and record extraction (published as events)."""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .bus import Bus
from .connectors import get_connector_class
from .connectors.base import ConnectorError, SourceConnector, greater_than
from .crypto import decrypt_json
from .db import SessionLocal
from .events import CANONICAL_FIELDS, json_safe, make_raw_event, raw_topic
from .models import CatalogTable, IngestError, SchemaDriftEvent, Service, SyncRun
from .pipeline import finalize_run_if_complete

log = logging.getLogger(__name__)

MAX_PRODUCER_ERRORS_STORED = 100  # rejected rows beyond this are counted, not stored individually
MAX_SOURCE_ID_LENGTH = 128


def _now() -> datetime:
    return datetime.now(timezone.utc)


def build_connector(service: Service) -> SourceConnector:
    return get_connector_class(service.service_type)(service.config, decrypt_json(service.secrets_enc))


def _schema_hash(columns: list[dict]) -> str:
    return hashlib.sha256(json.dumps(columns, sort_keys=True).encode()).hexdigest()


def mapped_columns(table: CatalogTable) -> set[str]:
    """Columns the registration depends on: a drift event on one of them can break ingestion."""
    mapping = table.column_map or {}
    cols = {v for k, v in mapping.items() if k != "extra" and isinstance(v, str)} | set(mapping.get("extra") or [])
    if table.cursor_column:
        cols.add(table.cursor_column)
    return cols


# -- metadata ingestion --------------------------------------------------------------------------
def run_metadata(db: Session, service: Service, user_id: str | None = None) -> SyncRun:
    run = SyncRun(service_id=service.id, kind="metadata", mode="full", status="running", created_by=user_id, started_at=_now())
    db.add(run)
    db.commit()
    connector = build_connector(service)
    try:
        discovered = connector.discover()
    except ConnectorError as exc:
        return _fail_metadata(db, run, str(exc))
    except Exception as exc:  # noqa: BLE001
        log.exception("metadata discovery failed")
        return _fail_metadata(db, run, f"unexpected error ({type(exc).__name__}); see server logs")
    finally:
        connector.close()

    now = _now()
    existing = {(t.schema_name, t.table_name): t for t in db.scalars(select(CatalogTable).where(CatalogTable.service_id == service.id))}
    seen: set[tuple[str, str]] = set()
    breaking = 0
    for info in discovered:
        key = (info.schema, info.name)
        seen.add(key)
        columns = [c.as_dict() for c in info.columns]
        digest = _schema_hash(columns)
        table = existing.get(key)
        if table is None:
            db.add(CatalogTable(service_id=service.id, schema_name=info.schema, table_name=info.name, columns=columns, schema_hash=digest, last_seen_at=now))
            run.added += 1
            continue
        if table.removed:
            table.removed = False
            db.add(SchemaDriftEvent(table_id=table.id, change_type="table_restored"))
        if digest != table.schema_hash:
            breaking += _record_drift(db, table, columns)
            table.columns, table.schema_hash = columns, digest
            run.updated += 1
        else:
            run.unchanged += 1
        table.last_seen_at = now
    for key, table in existing.items():
        if key not in seen and not table.removed:
            table.removed = True
            db.add(SchemaDriftEvent(table_id=table.id, change_type="table_removed", affects_mapping=table.master_enabled))
            breaking += 1 if table.master_enabled else 0
            run.deleted += 1
    run.produced = len(discovered)
    run.status = "completed_with_warnings" if breaking else "completed"
    run.warning = f"{breaking} schema change(s) affect registered master sources" if breaking else ""
    run.finished_at = _now()
    db.commit()
    return run


def _fail_metadata(db: Session, run: SyncRun, message: str) -> SyncRun:
    run.status, run.error, run.finished_at = "failed", message[:2048], _now()
    db.commit()
    return run


def _record_drift(db: Session, table: CatalogTable, new_columns: list[dict]) -> int:
    old = {c["name"]: c["type"] for c in table.columns}
    new = {c["name"]: c["type"] for c in new_columns}
    watched = mapped_columns(table) if table.master_enabled else set()
    breaking = 0
    for name in sorted(new.keys() - old.keys()):
        db.add(SchemaDriftEvent(table_id=table.id, change_type="column_added", column_name=name, after=new[name]))
    for name in sorted(old.keys() - new.keys()):
        hit = name in watched
        db.add(SchemaDriftEvent(table_id=table.id, change_type="column_removed", column_name=name, before=old[name], affects_mapping=hit))
        breaking += hit
    for name in sorted(old.keys() & new.keys()):
        if old[name] != new[name]:
            hit = name in watched
            db.add(SchemaDriftEvent(table_id=table.id, change_type="type_changed", column_name=name, before=old[name], after=new[name], affects_mapping=hit))
            breaking += hit
    return breaking


# -- record ingestion ----------------------------------------------------------------------------
def _update_run(run_id: str, **values) -> None:
    """Short, separate transactions: the producer must never hold a lock on sync_run while consumers update it."""
    with SessionLocal() as db:
        db.execute(update(SyncRun).where(SyncRun.id == run_id).values(**values))
        db.commit()


def _fail_run(run_id: str, message: str) -> None:
    _update_run(run_id, status="failed", error=message[:2048], finished_at=_now())


def _text(value) -> str:
    safe = json_safe(value)
    return "" if safe is None else str(safe).strip()


def precheck(table: CatalogTable | None, run: SyncRun) -> str | None:
    if table is None:
        return "the table no longer exists in the catalog"
    if table.removed:
        return "the table is no longer present at the source"
    if not table.master_enabled:
        return "the table is not registered as a master source"
    mapping = table.column_map or {}
    if not mapping.get("source_id") or not mapping.get("name"):
        return "the column mapping needs at least source_id and name"
    if run.mode == "incremental" and not table.cursor_column:
        return "incremental sync needs a cursor column on the table registration"
    return None


def run_records(run_id: str, bus: Bus) -> None:
    """Extract one registered table and publish its rows. Safe to call twice for the same run (second call no-ops)."""
    with SessionLocal() as db:
        run = db.get(SyncRun, run_id)
        if run is None or run.status != "queued":
            return
        table = db.get(CatalogTable, run.table_id) if run.table_id else None
        service = db.get(Service, run.service_id)
        problem = precheck(table, run)
        if problem or service is None:
            _fail_run(run_id, problem or "service not found")
            return
        mapping = {k: v for k, v in table.column_map.items() if k != "extra" and isinstance(v, str)}
        columns = list(dict.fromkeys([*mapping.values(), *(table.column_map.get("extra") or [])]))
        cursor, mode = table.cursor_column, run.mode
        since = table.watermark if mode == "incremental" else None
        schema, table_name, entity_type, system, table_id = table.schema_name, table.table_name, table.entity_type, service.name, table.id
        types = {c["name"]: c["type"] for c in table.columns}
        connector = build_connector(service)
        run.status, run.started_at, run.watermark_before = "running", _now(), since
        db.commit()

    topic = raw_topic(system, entity_type)
    seen: set[str] = set()
    rows = published = rejected = duplicates = 0
    max_cursor: str | None = None
    try:
        for row in connector.iterate(schema, table_name, columns, cursor, since, types):
            rows += 1
            if cursor and row.get(cursor) is not None:
                value = _text(row.get(cursor))
                if value and (max_cursor is None or greater_than(value, max_cursor)):
                    max_cursor = value
            fields = {k: _text(row.get(col)) for k, col in mapping.items() if k in CANONICAL_FIELDS}
            source_id = _text(row.get(mapping["source_id"]))
            if not source_id or len(source_id) > MAX_SOURCE_ID_LENGTH:
                rejected += 1
                if rejected <= MAX_PRODUCER_ERRORS_STORED:
                    reason = "source_id is empty" if not source_id else f"source_id is longer than {MAX_SOURCE_ID_LENGTH} characters"
                    with SessionLocal() as db:  # keeps the row *number*, never the row values
                        db.add(IngestError(run_id=run_id, source_system=system, source_id=f"row {rows}", stage="producer", error=reason, event={"row_number": rows}))
                        db.commit()
                continue
            if source_id in seen:
                duplicates += 1  # first occurrence wins; later ones in the same extract are ignored
                continue
            seen.add(source_id)
            raw = {c: json_safe(row.get(c)) for c in columns}
            bus.publish(
                topic, source_id,
                make_raw_event(run_id=run_id, source_system=system, table_id=table_id, entity_type=entity_type, source_id=source_id, fields=fields, raw=raw),
            )
            published += 1
            if rows % 1000 == 0:
                _update_run(run_id, produced=rows)
        bus.flush()
    except ConnectorError as exc:
        _fail_run(run_id, str(exc))
        return
    except Exception as exc:  # noqa: BLE001
        log.exception("record extraction failed")
        _fail_run(run_id, f"unexpected error ({type(exc).__name__}); see server logs")
        return
    finally:
        connector.close()

    warning = f"{duplicates} duplicate source id(s) in the extract were ignored (first occurrence kept)" if duplicates else ""
    _update_run(
        run_id,
        produced=rows,
        expected_distinct=published + rejected,
        failed=SyncRun.failed + rejected,  # producer-rejected rows count as processed-with-failure
        detect_deletes=(mode == "full"),
        watermark_after=max_cursor or since,
        warning=warning,
        complete_seen=True,  # last: from here the consumers (or the call below) can finalize the run
    )
    with SessionLocal() as db:
        finalize_run_if_complete(db, run_id)
        db.commit()
