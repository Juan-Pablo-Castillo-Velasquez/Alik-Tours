"""paquetes: qué NO incluye el paquete (una línea por ítem).

Revision ID: c9e5a1b7d3f2
Revises: b8d4f2a6c9e1
Create Date: 2026-11-06 09:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c9e5a1b7d3f2"
down_revision: Union[str, None] = "b8d4f2a6c9e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("paquetes", sa.Column("no_incluye", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("paquetes", "no_incluye")
