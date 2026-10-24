from alembic import context
from sqlalchemy import create_engine

from app import models  # noqa: F401  (registers all tables on Base.metadata)
from app.config import settings
from app.db import Base

target_metadata = Base.metadata


def run_migrations_online() -> None:
    connectable = context.config.attributes.get("connection")
    if connectable is not None:  # reuse the application's connection (tests, startup)
        context.configure(connection=connectable, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
        return
    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
        connection.commit()


run_migrations_online()
