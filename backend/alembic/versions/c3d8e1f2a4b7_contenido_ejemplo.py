"""contenido de ejemplo: marca es_ejemplo en reseñas y publicaciones

Revision ID: c3d8e1f2a4b7
Revises: b7e2c9d4f1a6
Create Date: 2026-11-22
"""

import sqlalchemy as sa

from alembic import op

revision = "c3d8e1f2a4b7"
down_revision = "b7e2c9d4f1a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for tabla in ("resenas", "publicaciones_comunidad"):
        op.add_column(tabla, sa.Column("es_ejemplo", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    for tabla in ("resenas", "publicaciones_comunidad"):
        op.drop_column(tabla, "es_ejemplo")
