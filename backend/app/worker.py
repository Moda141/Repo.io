"""Arq worker (M0 stub). Ingestion, matching (Splink) and DQ jobs are registered here from M1 onwards."""
from arq.connections import RedisSettings

from .config import settings


async def ping(ctx: dict) -> str:
    return "pong"


class WorkerSettings:
    functions = [ping]
    redis_settings = RedisSettings.from_dsn(settings.redis_url or "redis://localhost:6379/0")
