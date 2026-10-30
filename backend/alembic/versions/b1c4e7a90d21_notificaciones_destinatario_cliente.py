"""notificaciones: destinatario cliente (id_cliente nullable)

Permite notificar al cliente (ej. "¡Pago aprobado!") reutilizando la
tabla existente. NULL = notificación interna del panel, como siempre, así
que todas las filas actuales conservan su significado. Aditiva y
reversible.

Revision ID: b1c4e7a90d21
Revises: f99809c2e56d
Create Date: 2026-10-29 21:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1c4e7a90d21"
down_revision: Union[str, None] = "f99809c2e56d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("notificaciones", sa.Column("id_cliente", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_notificaciones_id_cliente",
        "notificaciones",
        "clientes",
        ["id_cliente"],
        ["id_cliente"],
        ondelete="CASCADE",
    )
    op.create_index("ix_notificaciones_id_cliente", "notificaciones", ["id_cliente"])


def downgrade() -> None:
    op.drop_index("ix_notificaciones_id_cliente", table_name="notificaciones")
    op.drop_constraint("fk_notificaciones_id_cliente", "notificaciones", type_="foreignkey")
    op.drop_column("notificaciones", "id_cliente")
