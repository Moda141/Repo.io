"""Baseline: all tables as of M1.

Revision ID: 0001
Revises:
"""
from alembic import op

from app import models  # noqa: F401
from app.db import Base

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The baseline snapshot is the model metadata at M1. Every later change must be its own explicit revision.
    Base.metadata.create_all(op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(op.get_bind())
