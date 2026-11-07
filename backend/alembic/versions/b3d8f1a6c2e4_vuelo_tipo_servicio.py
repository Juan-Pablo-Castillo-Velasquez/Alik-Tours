"""Oferta aérea: tipo de servicio y documentos que exige el proveedor.

Solo agrega columnas nullable. Reversible.

Revision ID: b3d8f1a6c2e4
Revises: a7c3e9b2d4f6
Create Date: 2026-11-07
"""

import sqlalchemy as sa

from alembic import op

revision = "b3d8f1a6c2e4"
down_revision = "a7c3e9b2d4f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("ofertas_vuelo") as batch:
        batch.add_column(sa.Column("tipo_servicio", sa.String(15)))
        batch.add_column(sa.Column("documentos_requeridos", sa.String(255)))
        batch.create_check_constraint(
            "ck_oferta_vuelo_servicio",
            "tipo_servicio IS NULL OR tipo_servicio IN ('regular', 'charter', 'bajo_costo', 'otro')",
        )


def downgrade() -> None:
    with op.batch_alter_table("ofertas_vuelo") as batch:
        batch.drop_constraint("ck_oferta_vuelo_servicio", type_="check")
        batch.drop_column("documentos_requeridos")
        batch.drop_column("tipo_servicio")
