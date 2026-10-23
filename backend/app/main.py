from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from .config import settings
from .db import Base, SessionLocal, engine
from .models import SourceRecord
from .routers import auth, customers, health, tickets
from .seed import seed_demo_records


@asynccontextmanager
async def lifespan(app: FastAPI):
    # M0 creates tables directly; Alembic migrations arrive in M1.
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        auth.ensure_admin(db)
        tickets.ensure_domains(db)
        if settings.demo_seed and db.scalar(select(func.count()).select_from(SourceRecord)) == 0:
            seed_demo_records(db)
    yield


app = FastAPI(title="MDM Platform", version="0.1.0", lifespan=lifespan)
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
