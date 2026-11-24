"""PQR: tipificación (categoría y motivo) y PQR de ejemplo

Revision ID: f7b2c5d8e1a3
Revises: e6a1b4c9d2f7
Create Date: 2026-11-24
"""

import sqlalchemy as sa

from alembic import op

revision = "f7b2c5d8e1a3"
down_revision = "e6a1b4c9d2f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pqrs", sa.Column("categoria", sa.String(30), nullable=True))
    op.add_column("pqrs", sa.Column("motivo", sa.String(80), nullable=True))
    op.add_column(
        "pqrs",
        sa.Column(
            "id_usuario_tipifica",
            sa.Integer(),
            sa.ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("pqrs", sa.Column("fecha_tipificacion", sa.TIMESTAMP(), nullable=True))
    op.add_column("pqrs", sa.Column("es_ejemplo", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index("ix_pqrs_categoria", "pqrs", ["categoria"])


def downgrade() -> None:
    op.drop_index("ix_pqrs_categoria", table_name="pqrs")
    for col in ("es_ejemplo", "fecha_tipificacion", "id_usuario_tipifica", "motivo", "categoria"):
        op.drop_column("pqrs", col)
