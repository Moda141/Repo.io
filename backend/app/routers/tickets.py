import re
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Domain, Ticket, TicketTemplate, User
from ..security import get_current_user, require_role

router = APIRouter(prefix="/api/v1", tags=["tickets"])

FIELD_TYPES = {"text", "textarea", "number", "email", "phone", "date", "select", "boolean"}
KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[+\d][\d\s\-()]{5,24}$")


class FieldDef(BaseModel):
    key: str
    label: str = Field(min_length=1, max_length=255)
    type: str = "text"
    required: bool = False  # True = mandatory, False = optional
    options: list[str] = Field(default_factory=list)
    help: str = ""

    @field_validator("key")
    @classmethod
    def _key(cls, v: str) -> str:
        if not KEY_RE.match(v):
            raise ValueError("key must be lowercase latin letters, digits or underscores, starting with a letter")
        return v

    @field_validator("type")
    @classmethod
    def _type(cls, v: str) -> str:
        if v not in FIELD_TYPES:
            raise ValueError(f"type must be one of {sorted(FIELD_TYPES)}")
        return v


class TemplateIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    domain_id: str
    request_type: str = Field(default="new_customer", max_length=64)
    fields: list[FieldDef] = Field(min_length=1)
    is_active: bool = True

    @field_validator("fields")
    @classmethod
    def _fields(cls, fields: list[FieldDef]) -> list[FieldDef]:
        keys = [f.key for f in fields]
        if len(keys) != len(set(keys)):
            raise ValueError("field keys must be unique within a template")
        for f in fields:
            if f.type == "select" and not f.options:
                raise ValueError(f"select field '{f.key}' needs at least one option")
        if not any(f.required for f in fields):
            raise ValueError("a template needs at least one mandatory field")
        return fields


class TemplateOut(BaseModel):
    id: str
    name: str
    description: str
    domain_id: str
    domain_name: str
    request_type: str
    fields: list[FieldDef]
    is_active: bool


class DomainIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str = ""


class DomainOut(BaseModel):
    id: str
    name: str
    description: str

    model_config = {"from_attributes": True}


class TicketIn(BaseModel):
    template_id: str
    data: dict = Field(default_factory=dict)


class TicketOut(BaseModel):
    id: str
    template_id: str
    template_name: str
    domain_name: str
    requester_email: str
    status: str
    data: dict
    created_at: datetime


def _template_out(t: TemplateOut | TicketTemplate, domain_name: str) -> TemplateOut:
    return TemplateOut(
        id=t.id, name=t.name, description=t.description, domain_id=t.domain_id, domain_name=domain_name,
        request_type=t.request_type, fields=[FieldDef(**f) for f in t.fields], is_active=t.is_active,
    )


def validate_ticket_data(fields: list[dict], data: dict) -> dict[str, str]:
    """Return {field_key: error}. Mandatory fields must be present and non-empty; unknown keys are rejected."""
    errors: dict[str, str] = {}
    known = {f["key"] for f in fields}
    for key in data:
        if key not in known:
            errors[key] = "unknown field"
    for f in fields:
        key, value = f["key"], data.get(f["key"])
        empty = value is None or (isinstance(value, str) and not value.strip())
        if empty:
            if f["required"]:
                errors[key] = "required"
            continue
        kind = f["type"]
        if kind in ("text", "textarea", "email", "phone", "select", "date") and not isinstance(value, str):
            errors[key] = "must be text"
        elif kind == "number" and (isinstance(value, bool) or not isinstance(value, (int, float))):
            errors[key] = "must be a number"
        elif kind == "boolean" and not isinstance(value, bool):
            errors[key] = "must be true or false"
        elif kind == "email" and not EMAIL_RE.match(value):
            errors[key] = "invalid email"
        elif kind == "phone" and not PHONE_RE.match(value):
            errors[key] = "invalid phone"
        elif kind == "select" and value not in f.get("options", []):
            errors[key] = "not one of the allowed options"
        elif kind == "date":
            try:
                date.fromisoformat(value)
            except ValueError:
                errors[key] = "use YYYY-MM-DD"
    return errors


@router.get("/domains", response_model=list[DomainOut])
def list_domains(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Domain).order_by(Domain.name)).all()


@router.post("/domains", response_model=DomainOut, status_code=201)
def create_domain(body: DomainIn, _: User = Depends(require_role("admin", "steward")), db: Session = Depends(get_db)):
    if db.scalar(select(Domain).where(Domain.name == body.name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Domain already exists")
    domain = Domain(name=body.name, description=body.description)
    db.add(domain)
    db.commit()
    return domain


def _domain_name(db: Session, domain_id: str) -> str:
    domain = db.get(Domain, domain_id)
    if domain is None:
        raise HTTPException(422, "Unknown domain")
    return domain.name


@router.post("/ticket-templates", response_model=TemplateOut, status_code=201)
def create_template(body: TemplateIn, user: User = Depends(require_role("admin", "steward")), db: Session = Depends(get_db)):
    domain_name = _domain_name(db, body.domain_id)
    if db.scalar(select(TicketTemplate).where(TicketTemplate.name == body.name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Template name already exists")
    template = TicketTemplate(
        name=body.name, description=body.description, domain_id=body.domain_id, request_type=body.request_type,
        fields=[f.model_dump() for f in body.fields], is_active=body.is_active, created_by=user.id,
    )
    db.add(template)
    db.commit()
    return _template_out(template, domain_name)


@router.get("/ticket-templates", response_model=list[TemplateOut])
def list_templates(
    domain_id: str | None = None,
    include_inactive: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(TicketTemplate).order_by(TicketTemplate.name)
    if domain_id:
        stmt = stmt.where(TicketTemplate.domain_id == domain_id)
    if not (include_inactive and user.role in ("admin", "steward")):
        stmt = stmt.where(TicketTemplate.is_active.is_(True))
    return [_template_out(t, _domain_name(db, t.domain_id)) for t in db.scalars(stmt)]


@router.get("/ticket-templates/{template_id}", response_model=TemplateOut)
def get_template(template_id: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    template = db.get(TicketTemplate, template_id)
    if template is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    return _template_out(template, _domain_name(db, template.domain_id))


@router.put("/ticket-templates/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: str, body: TemplateIn,
    _: User = Depends(require_role("admin", "steward")), db: Session = Depends(get_db),
):
    template = db.get(TicketTemplate, template_id)
    if template is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    domain_name = _domain_name(db, body.domain_id)
    clash = db.scalar(select(TicketTemplate).where(TicketTemplate.name == body.name, TicketTemplate.id != template_id))
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, "Template name already exists")
    template.name, template.description, template.domain_id = body.name, body.description, body.domain_id
    template.request_type, template.is_active = body.request_type, body.is_active
    template.fields = [f.model_dump() for f in body.fields]
    db.commit()
    return _template_out(template, domain_name)


@router.post("/tickets", response_model=TicketOut, status_code=201)
def create_ticket(body: TicketIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    template = db.get(TicketTemplate, body.template_id)
    if template is None or not template.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    errors = validate_ticket_data(template.fields, body.data)
    if errors:
        raise HTTPException(422, {"message": "Invalid ticket data", "fields": errors})
    domain_name = _domain_name(db, template.domain_id)
    ticket = Ticket(
        template_id=template.id, requester_id=user.id, data=body.data,
        template_snapshot={"name": template.name, "domain": domain_name, "fields": template.fields},
    )
    db.add(ticket)
    db.commit()
    return TicketOut(
        id=ticket.id, template_id=template.id, template_name=template.name, domain_name=domain_name,
        requester_email=user.email, status=ticket.status, data=ticket.data, created_at=ticket.created_at,
    )


@router.get("/tickets", response_model=list[TicketOut])
def list_tickets(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Requesters see their own tickets; admins and stewards see all."""
    stmt = select(Ticket).order_by(Ticket.created_at.desc()).limit(200)
    if user.role not in ("admin", "steward"):
        stmt = stmt.where(Ticket.requester_id == user.id)
    out = []
    for t in db.scalars(stmt):
        requester = db.get(User, t.requester_id)
        out.append(TicketOut(
            id=t.id, template_id=t.template_id, template_name=t.template_snapshot.get("name", ""),
            domain_name=t.template_snapshot.get("domain", ""), requester_email=requester.email if requester else "",
            status=t.status, data=t.data, created_at=t.created_at,
        ))
    return out


def ensure_domains(db: Session) -> None:
    for name, description in (("Customer", "Customer master data"), ("Vendor", "Vendor master data"), ("Product", "Product master data")):
        if db.scalar(select(Domain).where(Domain.name == name)) is None:
            db.add(Domain(name=name, description=description))
    db.commit()
