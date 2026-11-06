"""habitaciones: fotos propias y detalles (descripción, tamaño, cama,
vista, comodidades).

Revision ID: d1f7b3c9e5a8
Revises: c9e5a1b7d3f2
Create Date: 2026-11-06 19:10:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d1f7b3c9e5a8"
down_revision: Union[str, None] = "c9e5a1b7d3f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Columnas nullable: las habitaciones existentes quedan igual.
    with op.batch_alter_table("habitaciones") as b:
        b.add_column(sa.Column("descripcion", sa.Text(), nullable=True))
        b.add_column(sa.Column("tamano_m2", sa.Integer(), nullable=True))
        b.add_column(sa.Column("tipo_cama", sa.String(80), nullable=True))
        b.add_column(sa.Column("vista", sa.String(80), nullable=True))
        b.add_column(sa.Column("comodidades", sa.Text(), nullable=True))
        b.create_check_constraint("ck_habitacion_tamano_positivo", "tamano_m2 IS NULL OR tamano_m2 > 0")

    op.create_table(
        "imagenes_habitacion",
        sa.Column("id_imagen", sa.Integer(), primary_key=True),
        sa.Column(
            "id_habitacion",
            sa.Integer(),
            sa.ForeignKey("habitaciones.id_habitacion", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.func.now()),
    )
    op.create_index("ix_imagenes_habitacion_id_imagen", "imagenes_habitacion", ["id_imagen"])
    op.create_index("ix_imagenes_habitacion_id_habitacion", "imagenes_habitacion", ["id_habitacion"])


def downgrade() -> None:
    op.drop_index("ix_imagenes_habitacion_id_habitacion", table_name="imagenes_habitacion")
    op.drop_index("ix_imagenes_habitacion_id_imagen", table_name="imagenes_habitacion")
    op.drop_table("imagenes_habitacion")
    with op.batch_alter_table("habitaciones") as b:
        b.drop_constraint("ck_habitacion_tamano_positivo", type_="check")
        b.drop_column("comodidades")
        b.drop_column("vista")
        b.drop_column("tipo_cama")
        b.drop_column("tamano_m2")
        b.drop_column("descripcion")
