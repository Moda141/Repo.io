from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import SourceRecord, User
from ..security import get_current_user

router = APIRouter(prefix="/api/v1", tags=["customers"])


class SourceRecordOut(BaseModel):
    id: int
    source_system: str
    source_id: str
    name: str
    phone: str
    email: str
    city: str
    tax_id: str
    table_id: str | None = None

    model_config = {"from_attributes": True}


@router.get("/customers/search", response_model=list[SourceRecordOut])
def search_customers(
    q: str = Query(min_length=1),
    limit: int = Query(default=25, ge=1, le=200),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """M0: simple substring search over mirrored source records. Golden-record search arrives in M3."""
    like = f"%{q}%"
    stmt = (
        select(SourceRecord)
        .where(SourceRecord.is_deleted.is_(False), or_(SourceRecord.name.ilike(like), SourceRecord.phone.ilike(like), SourceRecord.email.ilike(like)))
        .order_by(SourceRecord.name)
        .limit(limit)
    )
    return db.scalars(stmt).all()


@router.get("/catalog/sources")
def source_summary(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """M0 Catalog stub: mirrored record counts per source system."""
    rows = db.execute(select(SourceRecord.source_system, func.count()).where(SourceRecord.is_deleted.is_(False)).group_by(SourceRecord.source_system)).all()
    return [{"source_system": s, "records": n} for s, n in rows]
