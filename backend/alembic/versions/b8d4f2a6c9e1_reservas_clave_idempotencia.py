"""reservas: clave de idempotencia (evita reservas duplicadas por doble
envío del mismo intento).

Revision ID: b8d4f2a6c9e1
Revises: a7c3e9f1b4d2
Create Date: 2026-11-05 22:10:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8d4f2a6c9e1"
down_revision: Union[str, None] = "a7c3e9f1b4d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Solo agrega una columna nullable y una restricción única: las reservas
    # existentes quedan con NULL (en PostgreSQL varios NULL no chocan).
    with op.batch_alter_table("reservas") as b:
        b.add_column(sa.Column("clave_idempotencia", sa.String(64), nullable=True))
        b.create_unique_constraint("uq_reserva_cliente_clave_idempotencia", ["id_cliente", "clave_idempotencia"])


def downgrade() -> None:
    with op.batch_alter_table("reservas") as b:
        b.drop_constraint("uq_reserva_cliente_clave_idempotencia", type_="unique")
        b.drop_column("clave_idempotencia")
