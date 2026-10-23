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
    __table_args__ = (UniqueConstraint("source_system", "source_id", name="uq_source_record"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_system: Mapped[str] = mapped_column(String(64), index=True)
    source_id: Mapped[str] = mapped_column(String(128))
    name: Mapped[str] = mapped_column(String(512), default="")
    phone: Mapped[str] = mapped_column(String(64), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    city: Mapped[str] = mapped_column(String(128), default="")
    tax_id: Mapped[str] = mapped_column(String(64), default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    record_hash: Mapped[str] = mapped_column(String(64), default="")
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


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
