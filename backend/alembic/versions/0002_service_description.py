"""service.description

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The 0001 baseline is create_all() of the *current* models, so a fresh database may already have the column.
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("service")}
    if "description" not in columns:
        op.add_column("service", sa.Column("description", sa.String(1024), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("service", "description")
