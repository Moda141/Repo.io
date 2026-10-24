"""Arq worker. Runs record extraction jobs; matching (Splink) and DQ jobs are registered here from M2."""
import asyncio

from arq.connections import RedisSettings

from .bus import get_bus
from .config import settings
from .ingestion import run_records


async def ping(ctx: dict) -> str:
    return "pong"


async def run_sync(ctx: dict, run_id: str) -> None:
    # Extraction is blocking I/O (database / HTTP / file reads): keep it off the event loop.
    await asyncio.to_thread(run_records, run_id, get_bus())


class WorkerSettings:
    functions = [ping, run_sync]
    redis_settings = RedisSettings.from_dsn(settings.redis_url or "redis://localhost:6379/0")
    job_timeout = 6 * 3600  # large tables
    max_tries = 1  # run_records is idempotent per run, but a failed extract should be retried deliberately, not silently
