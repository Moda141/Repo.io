from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from .config import settings
from .db import SessionLocal, engine
from .models import SourceRecord
from .routers import auth, customers, health, ingestion, tickets
from .seed import seed_demo_records


def run_migrations() -> None:
    from pathlib import Path

    from alembic import command
    from alembic.config import Config

    root = Path(__file__).resolve().parent.parent
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    with engine.begin() as connection:
        cfg.attributes["connection"] = connection
        command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    with SessionLocal() as db:
        auth.ensure_admin(db)
        tickets.ensure_domains(db)
        if settings.demo_seed and db.scalar(select(func.count()).select_from(SourceRecord)) == 0:
            seed_demo_records(db)
    yield


app = FastAPI(title="MDM Platform", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(tickets.router)
app.include_router(ingestion.router)
