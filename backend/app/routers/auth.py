import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import AccessToken, User
from ..security import (
    create_jwt,
    create_session_token,
    get_current_user,
    hash_password,
    require_role,
    token_hash,
    verify_password,
)

router = APIRouter(prefix="/api/v1", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    role: str
    is_bot: bool


class TokenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    expires_in_days: int = Field(default=30, ge=1, le=365)


class BotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    role: str = Field(default="viewer", pattern="^(admin|steward|viewer)$")


class TokenOut(BaseModel):
    id: str
    name: str
    token_type: str
    expires_at: datetime | None
    revoked: bool
    created_at: datetime


class TokenCreated(TokenOut):
    token: str  # returned once, never retrievable afterwards


def _aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.post("/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower(), User.is_bot.is_(False)))
    now = datetime.now(timezone.utc)
    if user is not None and (blocked := _aware(user.blocked_until)) and blocked > now:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Account temporarily blocked, try again later")
    if user is None or not verify_password(body.password, user.password_hash):
        if user is not None:
            user.failed_attempts += 1
            if user.failed_attempts >= settings.max_login_fail_attempts:
                user.blocked_until = now + timedelta(seconds=settings.access_block_time_seconds)
                user.failed_attempts = 0
            db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    user.failed_attempts = 0
    user.blocked_until = None
    db.commit()
    token, expires_in = create_session_token(user)
    return {"access_token": token, "token_type": "bearer", "expires_in": expires_in}


@router.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


def _issue(db: Session, *, user: User, name: str, token_type: str, expires_at: datetime | None) -> TokenCreated:
    jti = str(uuid.uuid4())
    token = create_jwt(user=user, token_type=token_type, jti=jti, expires_at=expires_at)
    record = AccessToken(
        id=jti, user_id=user.id, name=name, token_type=token_type,
        token_hash=token_hash(token), expires_at=expires_at,
    )
    db.add(record)
    db.commit()
    return TokenCreated(
        id=record.id, name=record.name, token_type=record.token_type, expires_at=record.expires_at,
        revoked=False, created_at=record.created_at, token=token,
    )


@router.post("/tokens", response_model=TokenCreated, status_code=201)
def create_personal_token(body: TokenCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Personal access token; inherits the user's permissions and expires on the chosen date."""
    expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)
    return _issue(db, user=user, name=body.name, token_type="PERSONAL_ACCESS", expires_at=expires_at)


@router.get("/tokens", response_model=list[TokenOut])
def list_my_tokens(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(AccessToken).where(AccessToken.user_id == user.id).order_by(AccessToken.created_at.desc())).all()


@router.delete("/tokens/{token_id}", status_code=204)
def revoke_token(token_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.get(AccessToken, token_id)
    if record is None or (record.user_id != user.id and user.role != "admin"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
    record.revoked = True
    db.commit()


@router.post("/bots", response_model=TokenCreated, status_code=201)
def create_bot(body: BotCreate, admin: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    """Create a bot and its token (no expiry by default; rotate regularly). Admin only."""
    email = f"{body.name.lower()}-bot@bots.local"
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Bot already exists")
    bot = User(email=email, display_name=body.name, role=body.role, is_bot=True, password_hash="")
    db.add(bot)
    db.commit()
    return _issue(db, user=bot, name=body.name, token_type="BOT", expires_at=None)


@router.post("/bots/{bot_id}/rotate", response_model=TokenCreated)
def rotate_bot_token(bot_id: str, admin: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    bot = db.get(User, bot_id)
    if bot is None or not bot.is_bot:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bot not found")
    for old in db.scalars(select(AccessToken).where(AccessToken.user_id == bot.id, AccessToken.revoked.is_(False))):
        old.revoked = True
    db.commit()
    return _issue(db, user=bot, name=bot.display_name, token_type="BOT", expires_at=None)


@router.get("/bots", response_model=list[UserOut])
def list_bots(admin: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return db.scalars(select(User).where(User.is_bot.is_(True))).all()


def ensure_admin(db: Session) -> None:
    if db.scalar(select(User).where(User.email == settings.admin_email.lower())) is None:
        db.add(User(
            email=settings.admin_email.lower(), display_name="Administrator", role="admin",
            password_hash=hash_password(settings.admin_password),
        ))
        db.commit()
