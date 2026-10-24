"""Encryption for connection secrets stored in the database (symmetric, Fernet)."""
import base64
import hashlib
import json

from cryptography.fernet import Fernet, InvalidToken

from .config import settings


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    return Fernet(key)


def encrypt_json(data: dict) -> str:
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def decrypt_json(token: str) -> dict:
    if not token:
        return {}
    try:
        return json.loads(_fernet().decrypt(token.encode()).decode())
    except InvalidToken as exc:
        raise ValueError("Stored secrets cannot be decrypted (MDM_SECRET_KEY changed?)") from exc
