"""hoteles: descripcion y politicas; paquetes: condiciones

Campos de texto opcionales para que cada hotel y paquete tenga su propia
descripción y condiciones administradas desde el panel. Nullable a
propósito: los registros actuales quedan igual y la vista pública omite
la sección cuando está vacía (nunca se rellena con texto inventado).

Revision ID: c7d2f1e83a54
Revises: b1c4e7a90d21
Create Date: 2026-10-29 21:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c7d2f1e83a54"
down_revision: Union[str, None] = "b1c4e7a90d21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hoteles", sa.Column("descripcion", sa.Text(), nullable=True))
    op.add_column("hoteles", sa.Column("politicas", sa.Text(), nullable=True))
    op.add_column("paquetes", sa.Column("condiciones", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("paquetes", "condiciones")
    op.drop_column("hoteles", "politicas")
    op.drop_column("hoteles", "descripcion")
