"""Environment is fixed before any `app` import so every test module shares one temp database and import folder."""
import os
import tempfile

_root = tempfile.mkdtemp()
os.environ["MDM_DATABASE_URL"] = f"sqlite:///{os.path.join(_root, 'test.db')}"
os.environ["MDM_REDIS_URL"] = ""
os.environ["MDM_ADMIN_PASSWORD"] = "test-pass"
os.environ["MDM_IMPORT_DIR"] = os.path.join(_root, "imports")
os.makedirs(os.environ["MDM_IMPORT_DIR"], exist_ok=True)
os.environ["MDM_INGEST_BUS"] = "inline"

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _unlock_admin():
    """The lockout test blocks the admin for 30s; later tests must not inherit that."""
    yield
    from app.db import SessionLocal
    from app.models import User

    with SessionLocal() as db:
        for user in db.query(User).all():
            user.failed_attempts, user.blocked_until = 0, None
        db.commit()
