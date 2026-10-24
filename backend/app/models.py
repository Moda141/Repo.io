import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "user"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255), default="")
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    # M0 uses simple roles; the full Roles & Policies engine arrives in M5.
    role: Mapped[str] = mapped_column(String(32), default="viewer")  # admin | steward | viewer
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AccessToken(Base):
    """Personal access tokens and bot tokens. Only the hash is stored; the token is shown once."""

    __tablename__ = "access_token"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)  # also the JWT jti
    user_id: Mapped[str] = mapped_column(ForeignKey("user.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    token_type: Mapped[str] = mapped_column(String(32))  # PERSONAL_ACCESS | BOT
    token_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class SourceRecord(Base):
    """Mirror of a customer record coming from a source system."""

    __tablename__ = "source_record"
    # Unique per source table (not per service): two tables of one service may reuse the same ids.
    __table_args__ = (UniqueConstraint("table_id", "source_id", name="uq_source_record"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_system: Mapped[str] = mapped_column(String(64), index=True)
    source_id: Mapped[str] = mapped_column(String(128))
    name: Mapped[str] = mapped_column(String(512), default="")
    phone: Mapped[str] = mapped_column(String(64), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    city: Mapped[str] = mapped_column(String(128), default="")
    tax_id: Mapped[str] = mapped_column(String(64), default="")
    # Standardized values used for blocking/matching (M2). The rest of the normalized fields live in payload["normalized"].
    name_norm: Mapped[str] = mapped_column(String(512), default="")
    phone_norm: Mapped[str] = mapped_column(String(32), default="", index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    record_hash: Mapped[str] = mapped_column(String(64), default="")
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    # M1 ingestion bookkeeping (null for demo-seeded rows)
    table_id: Mapped[str | None] = mapped_column(ForeignKey("catalog_table.id"), nullable=True, index=True)
    last_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Service(Base):
    """A configured connection to a source system (CSV folder, SQL database, SAP C4C OData...)."""

    __tablename__ = "service"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # also the source_system label
    service_type: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(String(1024), default="")
    config: Mapped[dict] = mapped_column(JSON, default=dict)  # non-secret settings
    secrets_enc: Mapped[str] = mapped_column(String(4096), default="")  # Fernet-encrypted JSON of secret fields
    created_by: Mapped[str] = mapped_column(ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class CatalogTable(Base):
    """Mirror of a source table / file / entity set. Columns are kept as JSON: [{name, type, nullable, primary_key}]."""

    __tablename__ = "catalog_table"
    __table_args__ = (UniqueConstraint("service_id", "schema_name", "table_name", name="uq_catalog_table"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    service_id: Mapped[str] = mapped_column(ForeignKey("service.id"), index=True)
    schema_name: Mapped[str] = mapped_column(String(128), default="")
    table_name: Mapped[str] = mapped_column(String(255))
    columns: Mapped[list] = mapped_column(JSON, default=list)
    schema_hash: Mapped[str] = mapped_column(String(64), default="")
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    removed: Mapped[bool] = mapped_column(Boolean, default=False)
    # Master source registration: only registered tables have their records mirrored.
    master_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    entity_type: Mapped[str] = mapped_column(String(32), default="customer")
    column_map: Mapped[dict] = mapped_column(JSON, default=dict)  # {source_id, name, phone, email, city, tax_id} -> column
    cursor_column: Mapped[str | None] = mapped_column(String(128), nullable=True)
    watermark: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SyncRun(Base):
    __tablename__ = "sync_run"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    service_id: Mapped[str] = mapped_column(ForeignKey("service.id"), index=True)
    table_id: Mapped[str | None] = mapped_column(ForeignKey("catalog_table.id"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(16))  # metadata | records
    mode: Mapped[str] = mapped_column(String(16), default="full")  # full | incremental
    # queued | running | completed | completed_with_warnings | failed
    status: Mapped[str] = mapped_column(String(32), default="queued")
    produced: Mapped[int] = mapped_column(Integer, default=0)  # rows read from the source
    expected_distinct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    complete_seen: Mapped[bool] = mapped_column(Boolean, default=False)
    detect_deletes: Mapped[bool] = mapped_column(Boolean, default=False)
    added: Mapped[int] = mapped_column(Integer, default=0)
    updated: Mapped[int] = mapped_column(Integer, default=0)
    unchanged: Mapped[int] = mapped_column(Integer, default=0)
    deleted: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    warning: Mapped[str] = mapped_column(String(1024), default="")
    error: Mapped[str] = mapped_column(String(2048), default="")
    watermark_before: Mapped[str | None] = mapped_column(String(255), nullable=True)
    watermark_after: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SchemaDriftEvent(Base):
    __tablename__ = "schema_drift_event"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    table_id: Mapped[str] = mapped_column(ForeignKey("catalog_table.id"), index=True)
    change_type: Mapped[str] = mapped_column(String(32))  # column_added | column_removed | type_changed | table_removed | table_restored
    column_name: Mapped[str] = mapped_column(String(255), default="")
    before: Mapped[str] = mapped_column(String(255), default="")
    after: Mapped[str] = mapped_column(String(255), default="")
    affects_mapping: Mapped[bool] = mapped_column(Boolean, default=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class IngestError(Base):
    """Events the ingest-writer could not apply (also published to the DLQ topic)."""

    __tablename__ = "ingest_error"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    source_system: Mapped[str] = mapped_column(String(64), default="")
    source_id: Mapped[str] = mapped_column(String(128), default="")
    stage: Mapped[str] = mapped_column(String(32), default="writer")
    error: Mapped[str] = mapped_column(String(2048), default="")
    event: Mapped[dict] = mapped_column(JSON, default=dict)  # kept so the event can be replayed; contains raw row data
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Domain(Base):
    """Business domain (Customer, Vendor, Product, ...). Mirrors the domain concept used in OpenMetadata."""

    __tablename__ = "domain"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(1024), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class TicketTemplate(Base):
    """A reusable request form: which domain it belongs to and which fields are mandatory vs optional.

    `fields` is a list of {key, label, type, required, options?, help?}.
    """

    __tablename__ = "ticket_template"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    description: Mapped[str] = mapped_column(String(1024), default="")
    domain_id: Mapped[str] = mapped_column(ForeignKey("domain.id"), index=True)
    request_type: Mapped[str] = mapped_column(String(64), default="new_customer")
    fields: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Ticket(Base):
    __tablename__ = "ticket"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    template_id: Mapped[str] = mapped_column(ForeignKey("ticket_template.id"), index=True)
    # Snapshot, so later template edits never change what an existing ticket was asked to contain.
    template_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    requester_id: Mapped[str] = mapped_column(ForeignKey("user.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="submitted")
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
