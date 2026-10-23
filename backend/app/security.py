import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import AccessToken, User

_bearer = HTTPBearer(auto_error=False)
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
    return hmac.compare_digest(digest.hex(), digest_hex)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_jwt(*, user: User, token_type: str, jti: str, expires_at: datetime | None) -> str:
    claims = {
        "sub": user.id,
        "email": user.email,
        "isBot": user.is_bot,
        "tokenType": token_type,  # SESSION | PERSONAL_ACCESS | BOT
        "jti": jti,
        "iat": datetime.now(timezone.utc),
        # Bot tokens have no expiry by default (exp absent == null), like OpenMetadata.
    }
    if expires_at is not None:
        claims["exp"] = expires_at
    return jwt.encode(claims, settings.jwt_secret, algorithm=ALGORITHM)


def create_session_token(user: User) -> tuple[str, int]:
    exp = datetime.now(timezone.utc) + timedelta(seconds=settings.jwt_expiry_seconds)
    return create_jwt(user=user, token_type="SESSION", jti="session", expires_at=exp), settings.jwt_expiry_seconds


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing token")
    if creds is None:
        raise unauthorized
    try:
        claims = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=[ALGORITHM], options={"require": ["sub", "jti"]})
    except jwt.PyJWTError:
        raise unauthorized from None

    if claims.get("tokenType") in ("PERSONAL_ACCESS", "BOT"):
        record = db.get(AccessToken, claims["jti"])
        if record is None or record.revoked or record.token_hash != token_hash(creds.credentials):
            raise unauthorized
    user = db.get(User, claims["sub"])
    if user is None:
        raise unauthorized
    return user


def require_role(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return checker
