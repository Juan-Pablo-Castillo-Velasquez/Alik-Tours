"""Ficha completa de habitación: piso, baño, servicios, condiciones y pie de foto.

Revision ID: e4a2c8f1b6d9
Revises: d1f7b3c9e5a8
Create Date: 2026-11-06
"""

import sqlalchemy as sa

from alembic import op

revision = "e4a2c8f1b6d9"
down_revision = "d1f7b3c9e5a8"
branch_labels = None
depends_on = None

CONDICIONES = ("desayuno_incluido", "permite_fumar", "admite_mascotas", "accesible", "cama_extra")


def upgrade() -> None:
    with op.batch_alter_table("habitaciones") as batch:
        batch.add_column(sa.Column("piso", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("tipo_bano", sa.String(length=120), nullable=True))
        batch.add_column(sa.Column("servicios", sa.Text(), nullable=True))
        for nombre in CONDICIONES:
            batch.add_column(sa.Column(nombre, sa.Boolean(), nullable=True))
    with op.batch_alter_table("imagenes_habitacion") as batch:
        batch.add_column(sa.Column("descripcion", sa.String(length=120), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("imagenes_habitacion") as batch:
        batch.drop_column("descripcion")
    with op.batch_alter_table("habitaciones") as batch:
        for nombre in reversed(CONDICIONES):
            batch.drop_column(nombre)
        batch.drop_column("servicios")
        batch.drop_column("tipo_bano")
        batch.drop_column("piso")
