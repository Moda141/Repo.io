"""Catalog / ingestion API: services (connections), catalog tables, master registration, sync runs, drift, errors."""
from __future__ import annotations

import re

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..bus import get_bus
from ..connectors import describe_connectors, get_connector_class
from ..connectors.base import ConnectorError, safe_path
from ..connectors.csv_source import FILE_NAME_RE
from ..crypto import decrypt_json, encrypt_json
from ..db import get_db
from ..events import CANONICAL_FIELDS
from ..ingestion import build_connector, run_metadata, run_records
from ..models import CatalogTable, IngestError, SchemaDriftEvent, Service, SourceRecord, SyncRun, User
from ..security import get_current_user, require_role

router = APIRouter(prefix="/api/v1", tags=["catalog"])

NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-]{0,63}$")
ENTITY_TYPES = {"customer"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
ACTIVE = ("queued", "running", "finalizing")

admin_only = require_role("admin")
steward = require_role("admin", "steward")


# -- helpers -------------------------------------------------------------------------------------
def _service_out(service: Service, tables: int = 0) -> dict:
    cls = get_connector_class(service.service_type)
    secret_names = {f.name for f in cls.fields if f.secret}
    stored = decrypt_json(service.secrets_enc) if service.secrets_enc else {}
    return {
        "id": service.id, "name": service.name, "service_type": service.service_type, "config": service.config,
        "secrets_set": sorted(n for n in secret_names if stored.get(n)),  # which secrets exist, never their values
        "tables": tables, "created_at": service.created_at, "updated_at": service.updated_at,
    }


def _table_out(t: CatalogTable) -> dict:
    return {
        "id": t.id, "service_id": t.service_id, "schema_name": t.schema_name, "table_name": t.table_name,
        "columns": t.columns, "removed": t.removed, "last_seen_at": t.last_seen_at, "master_enabled": t.master_enabled,
        "entity_type": t.entity_type, "column_map": t.column_map, "cursor_column": t.cursor_column,
        "watermark": t.watermark, "last_ingested_at": t.last_ingested_at,
    }


def _run_out(r: SyncRun) -> dict:
    keys = ("id", "service_id", "table_id", "kind", "mode", "status", "produced", "expected_distinct", "added", "updated",
            "unchanged", "deleted", "failed", "warning", "error", "watermark_before", "watermark_after", "created_at",
            "started_at", "finished_at")
    return {k: getattr(r, k) for k in keys}


def _get_service(db: Session, service_id: str) -> Service:
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(404, "Service not found")
    return service


def _get_table(db: Session, table_id: str) -> CatalogTable:
    table = db.get(CatalogTable, table_id)
    if table is None:
        raise HTTPException(404, "Table not found")
    return table


# -- connector types & services ------------------------------------------------------------------
@router.get("/connector-types")
def connector_types(_: User = Depends(get_current_user)):
    return describe_connectors()


class ServiceIn(BaseModel):
    name: str
    service_type: str
    config: dict = Field(default_factory=dict)
    secrets: dict = Field(default_factory=dict)


class ServiceUpdate(BaseModel):
    config: dict = Field(default_factory=dict)
    secrets: dict = Field(default_factory=dict)  # an empty/omitted secret keeps the stored one


@router.get("/services")
def list_services(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    counts = dict(db.execute(select(CatalogTable.service_id, func.count()).where(CatalogTable.removed.is_(False)).group_by(CatalogTable.service_id)).all())
    return [_service_out(s, counts.get(s.id, 0)) for s in db.scalars(select(Service).order_by(Service.name))]


@router.post("/services", status_code=201)
def create_service(body: ServiceIn, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    if not NAME_RE.match(body.name):
        raise HTTPException(422, "name must be letters, digits, '-' or '_' (max 64); it becomes the source system label")
    if db.scalar(select(Service).where(Service.name == body.name)):
        raise HTTPException(409, "A service with this name already exists")
    try:
        cls = get_connector_class(body.service_type)
        config, secrets = cls.validate(body.config, body.secrets)
    except ConnectorError as exc:
        raise HTTPException(422, str(exc)) from None
    service = Service(name=body.name, service_type=body.service_type, config=config, secrets_enc=encrypt_json(secrets) if secrets else "", created_by=user.id)
    db.add(service)
    db.commit()
    return _service_out(service)


@router.put("/services/{service_id}")
def update_service(service_id: str, body: ServiceUpdate, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    service = _get_service(db, service_id)
    try:
        cls = get_connector_class(service.service_type)
        existing = decrypt_json(service.secrets_enc) if service.secrets_enc else {}
        config, secrets = cls.validate(body.config, body.secrets, keep_secrets=existing)
    except ConnectorError as exc:
        raise HTTPException(422, str(exc)) from None
    service.config = config
    service.secrets_enc = encrypt_json(secrets) if secrets else ""
    db.commit()
    return _service_out(service)


@router.delete("/services/{service_id}", status_code=204)
def delete_service(service_id: str, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    service = _get_service(db, service_id)
    table_ids = list(db.scalars(select(CatalogTable.id).where(CatalogTable.service_id == service.id)))
    if table_ids and db.scalar(select(func.count()).select_from(SourceRecord).where(SourceRecord.table_id.in_(table_ids))):
        raise HTTPException(409, "This service has ingested records; unregister its tables first (record deletion is not automatic)")
    if db.scalar(select(func.count()).select_from(SyncRun).where(SyncRun.service_id == service.id, SyncRun.status.in_(ACTIVE))):
        raise HTTPException(409, "A sync is running for this service")
    for model in (SchemaDriftEvent,):
        db.query(model).filter(model.table_id.in_(table_ids)).delete(synchronize_session=False)
    run_ids = list(db.scalars(select(SyncRun.id).where(SyncRun.service_id == service.id)))
    if run_ids:
        db.query(IngestError).filter(IngestError.run_id.in_(run_ids)).delete(synchronize_session=False)
    db.query(SyncRun).filter(SyncRun.service_id == service.id).delete(synchronize_session=False)
    db.query(CatalogTable).filter(CatalogTable.service_id == service.id).delete(synchronize_session=False)
    db.delete(service)
    db.commit()


@router.post("/services/{service_id}/test")
def test_service(service_id: str, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    service = _get_service(db, service_id)
    connector = build_connector(service)
    try:
        return {"ok": True, "message": connector.test_connection()}
    except ConnectorError as exc:
        return {"ok": False, "message": str(exc)}
    except Exception:  # noqa: BLE001 - never leak driver messages (they can contain hosts or credentials)
        return {"ok": False, "message": "connection failed (see server logs)"}
    finally:
        connector.close()


@router.post("/services/{service_id}/discover")
def discover_service(service_id: str, user: User = Depends(steward), db: Session = Depends(get_db)):
    service = _get_service(db, service_id)
    if db.scalar(select(func.count()).select_from(SyncRun).where(SyncRun.service_id == service.id, SyncRun.kind == "metadata", SyncRun.status.in_(ACTIVE))):
        raise HTTPException(409, "Discovery is already running for this service")
    return _run_out(run_metadata(db, service, user.id))


@router.post("/services/{service_id}/files", status_code=201)
async def upload_csv(service_id: str, file: UploadFile = File(...), _: User = Depends(admin_only), db: Session = Depends(get_db)):
    service = _get_service(db, service_id)
    if service.service_type != "csv":
        raise HTTPException(422, "File upload is only available for CSV services")
    name = file.filename or ""
    if not FILE_NAME_RE.match(name):
        raise HTTPException(422, "File name must be letters, digits, space, '.', '-' or '_' and end in .csv")
    try:
        folder = safe_path(service.config["folder"], must_exist=False)
    except ConnectorError as exc:
        raise HTTPException(422, str(exc)) from None
    folder.mkdir(parents=True, exist_ok=True)
    target = (folder / name).resolve()
    if target.parent != folder.resolve():
        raise HTTPException(422, "Invalid file name")
    size = 0
    tmp = target.with_suffix(".part")
    try:
        with open(tmp, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
                out.write(chunk)
        tmp.replace(target)
    finally:
        tmp.unlink(missing_ok=True)
    return {"file": name, "bytes": size}


# -- tables --------------------------------------------------------------------------------------
@router.get("/tables")
def list_tables(
    service_id: str | None = None,
    master_only: bool = False,
    include_removed: bool = False,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(CatalogTable).order_by(CatalogTable.schema_name, CatalogTable.table_name)
    if service_id:
        stmt = stmt.where(CatalogTable.service_id == service_id)
    if master_only:
        stmt = stmt.where(CatalogTable.master_enabled.is_(True))
    if not include_removed:
        stmt = stmt.where(CatalogTable.removed.is_(False))
    return [_table_out(t) for t in db.scalars(stmt)]


@router.get("/tables/{table_id}")
def get_table(table_id: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    table = _get_table(db, table_id)
    records = db.scalar(select(func.count()).select_from(SourceRecord).where(SourceRecord.table_id == table.id, SourceRecord.is_deleted.is_(False))) or 0
    return {**_table_out(table), "records": records}


class MasterIn(BaseModel):
    enabled: bool = True
    entity_type: str = "customer"
    column_map: dict = Field(default_factory=dict)  # canonical field -> source column; "extra": [columns]
    cursor_column: str | None = None


@router.put("/tables/{table_id}/master")
def register_master(table_id: str, body: MasterIn, _: User = Depends(steward), db: Session = Depends(get_db)):
    table = _get_table(db, table_id)
    if not body.enabled:
        if db.scalar(select(func.count()).select_from(SyncRun).where(SyncRun.table_id == table.id, SyncRun.status.in_(ACTIVE))):
            raise HTTPException(409, "A sync is running for this table")
        table.master_enabled = False
        db.commit()
        return _table_out(table)
    if table.removed:
        raise HTTPException(422, "The table is no longer present at the source")
    if body.entity_type not in ENTITY_TYPES:
        raise HTTPException(422, f"entity_type must be one of {sorted(ENTITY_TYPES)}")
    known = {c["name"] for c in table.columns}
    mapping: dict = {}
    for key, value in body.column_map.items():
        if key == "extra":
            if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
                raise HTTPException(422, "'extra' must be a list of column names")
            mapping["extra"] = list(dict.fromkeys(value))
        elif key == "source_id" or key in CANONICAL_FIELDS:
            if not isinstance(value, str) or not value:
                raise HTTPException(422, f"'{key}' must be a column name")
            mapping[key] = value
        else:
            raise HTTPException(422, f"unknown mapping key '{key}'")
    if not mapping.get("source_id") or not mapping.get("name"):
        raise HTTPException(422, "source_id and name are required in column_map")
    used = {v for k, v in mapping.items() if k != "extra"} | set(mapping.get("extra", []))
    if body.cursor_column:
        used.add(body.cursor_column)
    missing = sorted(used - known)
    if missing:
        raise HTTPException(422, f"columns not found in the table: {', '.join(missing)}")
    if body.cursor_column != table.cursor_column:
        table.watermark = None  # a different cursor invalidates the stored watermark
    table.master_enabled, table.entity_type = True, body.entity_type
    table.column_map, table.cursor_column = mapping, body.cursor_column or None
    db.commit()
    return _table_out(table)


class SyncIn(BaseModel):
    mode: str = "full"


@router.post("/tables/{table_id}/sync", status_code=202)
def sync_table(table_id: str, background: BackgroundTasks, body: SyncIn | None = None, user: User = Depends(steward), db: Session = Depends(get_db)):
    mode = (body or SyncIn()).mode
    if mode not in ("full", "incremental"):
        raise HTTPException(422, "mode must be 'full' or 'incremental'")
    table = _get_table(db, table_id)
    if not table.master_enabled:
        raise HTTPException(422, "Register the table as a master source first")
    if mode == "incremental" and not table.cursor_column:
        raise HTTPException(422, "Incremental sync needs a cursor column")
    if db.scalar(select(func.count()).select_from(SyncRun).where(SyncRun.table_id == table.id, SyncRun.status.in_(ACTIVE))):
        raise HTTPException(409, "A sync is already running for this table")
    run = SyncRun(service_id=table.service_id, table_id=table.id, kind="records", mode=mode, status="queued", created_by=user.id)
    db.add(run)
    db.commit()
    background.add_task(run_records, run.id, get_bus())
    return _run_out(run)


# -- runs, drift, errors -------------------------------------------------------------------------
@router.get("/sync-runs")
def list_runs(
    service_id: str | None = None,
    table_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(SyncRun).order_by(SyncRun.created_at.desc()).limit(limit)
    if service_id:
        stmt = stmt.where(SyncRun.service_id == service_id)
    if table_id:
        stmt = stmt.where(SyncRun.table_id == table_id)
    return [_run_out(r) for r in db.scalars(stmt)]


@router.get("/sync-runs/{run_id}")
def get_run(run_id: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    run = db.get(SyncRun, run_id)
    if run is None:
        raise HTTPException(404, "Run not found")
    return _run_out(run)


@router.get("/schema-drift")
def list_drift(
    table_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(SchemaDriftEvent).order_by(SchemaDriftEvent.detected_at.desc()).limit(limit)
    if table_id:
        stmt = stmt.where(SchemaDriftEvent.table_id == table_id)
    keys = ("id", "table_id", "change_type", "column_name", "before", "after", "affects_mapping", "detected_at")
    return [{k: getattr(e, k) for k in keys} for e in db.scalars(stmt)]


@router.get("/ingest-errors")
def list_errors(
    run_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    _: User = Depends(steward),  # events contain raw source rows: stewards and admins only
    db: Session = Depends(get_db),
):
    stmt = select(IngestError).order_by(IngestError.created_at.desc()).limit(limit)
    if run_id:
        stmt = stmt.where(IngestError.run_id == run_id)
    keys = ("id", "run_id", "source_system", "source_id", "stage", "error", "resolved", "created_at")
    return [{k: getattr(e, k) for k in keys} for e in db.scalars(stmt)]
