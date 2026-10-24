"""Consumer-side logic of the ingestion pipeline: normalizer, ingest-writer, failure handling, run finalization.

Delivery is at-least-once, so every step is idempotent:
* the writer skips an event whose record already carries this run id (a redelivery) and never double counts;
* an unchanged ``record_hash`` is not rewritten and triggers no match request;
* failures are keyed by (run, source id, stage), so a redelivered bad event is recorded once.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from .bus import Bus
from .config import settings
from .db import SessionLocal
from .events import (
    RAW_PREFIX,
    TOPIC_DLQ,
    TOPIC_MATCH,
    TOPIC_NORMALIZED,
    EventError,
    canonical_hash,
    validate_event,
)
from .models import CatalogTable, IngestError, SourceRecord, SyncRun
from .normalize import standardize

log = logging.getLogger(__name__)

_COUNTER = {"added": "added", "updated": "updated", "restored": "updated", "unchanged": "unchanged"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


# -- normalizer ----------------------------------------------------------------------------------
def normalize_event(value: dict) -> dict:
    event = validate_event(value)
    fields = event["fields"]
    normalized = standardize(fields)
    out = dict(event)  # keeps "fields": the normalized envelope must still satisfy validate_event
    out["record"] = {k: str(fields.get(k) or "") for k in ("name", "phone", "email", "city", "tax_id")}
    out["normalized"] = normalized
    out["record_hash"] = canonical_hash(fields)
    return out


# -- ingest-writer -------------------------------------------------------------------------------
def _bump(db: Session, run_id: str, counter: str) -> None:
    column = getattr(SyncRun, counter)
    db.execute(update(SyncRun).where(SyncRun.id == run_id).values({counter: column + 1}))


def write_event(db: Session, value: dict) -> str:
    """Apply one normalized event. Returns added | updated | restored | unchanged | duplicate."""
    event = validate_event(value)
    record = event.get("record")
    if not isinstance(record, dict) or "record_hash" not in event:
        raise EventError("normalized event has no record")
    run_id, table_id = event["run_id"], event["table_id"]
    source_id = str(event["source_id"]).strip()
    normalized = event.get("normalized") or {}
    existing = db.scalar(select(SourceRecord).where(SourceRecord.table_id == table_id, SourceRecord.source_id == source_id))

    def apply(row: SourceRecord) -> None:
        row.source_system = event["source_system"]
        row.name, row.phone, row.email = record.get("name", ""), record.get("phone", ""), record.get("email", "")
        row.city, row.tax_id = record.get("city", ""), record.get("tax_id", "")
        row.name_norm, row.phone_norm = normalized.get("name", ""), normalized.get("phone", "")
        row.payload = {"raw": event.get("raw") or {}, "normalized": normalized}
        row.record_hash = event["record_hash"]
        row.ingested_at = _now()

    if existing is None:
        row = SourceRecord(source_id=source_id, table_id=table_id, last_run_id=run_id)
        apply(row)
        db.add(row)
        outcome = "added"
    elif existing.last_run_id == run_id:
        return "duplicate"  # redelivery of an event this run already applied
    elif existing.is_deleted:
        apply(existing)
        existing.is_deleted, existing.deleted_at, existing.last_run_id = False, None, run_id
        outcome = "restored"
    elif existing.record_hash == event["record_hash"]:
        existing.last_run_id = run_id  # seen again: protects it from the delete sweep
        outcome = "unchanged"
    else:
        apply(existing)
        existing.last_run_id = run_id
        outcome = "updated"

    _bump(db, run_id, _COUNTER[outcome])
    db.flush()
    finalize_run_if_complete(db, run_id)
    return outcome


# -- failures ------------------------------------------------------------------------------------
def record_failure(db: Session, bus: Bus, stage: str, value, exc: Exception) -> None:
    if isinstance(exc, EventError):
        message = str(exc)
    else:
        # Unexpected errors can carry SQL parameters (row values): keep them in the server log only.
        log.exception("unexpected error in %s", stage)
        message = f"unexpected error ({type(exc).__name__}); see server logs"
    event = value if isinstance(value, dict) else {"unparseable": True}
    run_id = event.get("run_id") if isinstance(event.get("run_id"), str) else None
    source_id = str(event.get("source_id") or "")[:128]
    created = False
    existing = None
    if run_id:
        existing = db.scalar(
            select(IngestError).where(IngestError.run_id == run_id, IngestError.source_id == source_id, IngestError.stage == stage)
        )
    if existing is None:
        db.add(
            IngestError(
                run_id=run_id, source_system=str(event.get("source_system") or "")[:64], source_id=source_id,
                stage=stage, error=message[:2000], event=event,
            )
        )
        created = True
        if run_id:
            _bump(db, run_id, "failed")
            db.flush()
            finalize_run_if_complete(db, run_id)
    db.commit()
    if created:
        try:
            bus.publish(TOPIC_DLQ, f"{event.get('source_system', '')}:{source_id}", {"stage": stage, "error": message, "event": event})
        except Exception:  # noqa: BLE001 - the DLQ copy is best effort; the ingest_error row is the record
            log.warning("could not publish to the DLQ topic", exc_info=True)


# -- message dispatch (shared by InlineBus and the Kafka consumer) -------------------------------------
def process_message(bus: Bus, topic: str, value) -> None:
    """Handle one event. Bad data goes to the DLQ and never raises; infrastructure errors (database or Kafka
    down) do raise so the caller can stop without committing the offset and retry later."""
    if topic.startswith(RAW_PREFIX):
        try:
            normalized = normalize_event(value)
        except Exception as exc:  # noqa: BLE001
            with SessionLocal() as db:
                record_failure(db, bus, "normalizer", value, exc)
            return
        bus.publish(TOPIC_NORMALIZED, f"{normalized['source_system']}:{normalized['source_id']}", normalized)
    elif topic == TOPIC_NORMALIZED:
        try:
            with SessionLocal() as db:
                outcome = write_event(db, value)
                db.commit()
        except Exception as exc:  # noqa: BLE001
            with SessionLocal() as db:
                record_failure(db, bus, "writer", value, exc)
            return
        if outcome in ("added", "updated", "restored"):
            # Published after the commit: if this publish fails the record is stored but unmatched; the M2
            # matcher also scans for records newer than its last pass, so a lost request is recoverable.
            bus.publish(
                TOPIC_MATCH,
                f"{value['entity_type']}:{value['source_system']}:{value['source_id']}",
                {
                    "run_id": value["run_id"], "table_id": value["table_id"], "source_system": value["source_system"],
                    "source_id": value["source_id"], "entity_type": value["entity_type"],
                    "reason": {"added": "new", "updated": "changed", "restored": "restored"}[outcome],
                },
            )


# -- run finalization ----------------------------------------------------------------------------
def finalize_run_if_complete(db: Session, run_id: str) -> bool:
    """Called after every processed event and once by the producer. The first caller to see the run complete
    claims it (status running -> finalizing), sweeps deletes, advances the watermark and closes the run."""
    run = db.get(SyncRun, run_id)
    if run is None:
        return False
    db.refresh(run)
    if run.status != "running" or not run.complete_seen or run.expected_distinct is None:
        return False
    if run.added + run.updated + run.unchanged + run.failed < run.expected_distinct:
        return False
    claimed = db.execute(
        update(SyncRun).where(SyncRun.id == run_id, SyncRun.status == "running").values(status="finalizing")
    ).rowcount
    if claimed != 1:
        return False
    db.refresh(run)

    warnings = [run.warning] if run.warning else []
    table = db.get(CatalogTable, run.table_id) if run.table_id else None
    if run.detect_deletes and table is not None:
        warning = _sweep_deletes(db, run, table)
        if warning:
            warnings.append(warning)
    if run.failed:
        warnings.append(f"{run.failed} record(s) failed; see ingest errors")
    if table is not None:
        table.last_ingested_at = _now()
        if run.failed == 0 and run.watermark_after:  # advance only when everything applied, so failures are retried
            table.watermark = run.watermark_after
    run.warning = "; ".join(w for w in warnings if w)[:1024]
    run.status = "completed_with_warnings" if run.warning else "completed"
    run.finished_at = _now()
    db.flush()
    return True


def _sweep_deletes(db: Session, run: SyncRun, table: CatalogTable) -> str:
    """Mark records absent from a *complete* full snapshot as deleted, unless that looks like a truncated extract."""
    base = (SourceRecord.table_id == table.id, SourceRecord.is_deleted.is_(False))
    active = db.scalar(select(func.count()).select_from(SourceRecord).where(*base)) or 0
    failed_ids = set(db.scalars(select(IngestError.source_id).where(IngestError.run_id == run.id)))
    stale = [
        r for r in db.scalars(select(SourceRecord).where(*base, or_(SourceRecord.last_run_id.is_(None), SourceRecord.last_run_id != run.id)))
        if r.source_id not in failed_ids  # a record whose event failed was not "missing", we just could not apply it
    ]
    if not stale:
        return ""
    if active >= settings.min_delete_guard and len(stale) / active > settings.max_delete_ratio:
        return (
            f"delete sweep skipped: {len(stale)} of {active} active records are missing from this extract "
            f"({len(stale) / active:.0%} > {settings.max_delete_ratio:.0%}); verify the source before re-running"
        )
    now = _now()
    for record in stale:
        record.is_deleted, record.deleted_at = True, now
    run.deleted = len(stale)
    return ""
