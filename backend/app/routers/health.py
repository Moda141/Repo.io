from fastapi import APIRouter
from sqlalchemy import text

from ..config import settings
from ..db import engine

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
def health():
    """Read-only diagnostics, modelled on the Preferences > Health Check panel."""
    checks: dict[str, dict] = {}
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = {"ok": True}
    except Exception as exc:  # noqa: BLE001
        checks["database"] = {"ok": False, "error": str(exc)[:200]}

    if settings.redis_url:
        try:
            import redis

            redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1).ping()
            checks["queue"] = {"ok": True}
        except Exception as exc:  # noqa: BLE001
            checks["queue"] = {"ok": False, "error": str(exc)[:200]}

    return {"status": "ok" if all(c["ok"] for c in checks.values()) else "degraded", "checks": checks}
