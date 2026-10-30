"""aceptación de términos y condiciones: versión y fecha

Evidencia de consentimiento (Ley 1480 / Ley 527): qué versión de los
términos aceptó cada usuario al registrarse y cada reserva al pagarse, y
cuándo. Nullable: los registros anteriores no tienen esa evidencia y no
se inventa.

Revision ID: d9e3a5b7c412
Revises: c7d2f1e83a54
Create Date: 2026-10-29 22:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d9e3a5b7c412"
down_revision: Union[str, None] = "c7d2f1e83a54"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for tabla in ("usuarios", "reservas"):
        op.add_column(tabla, sa.Column("terminos_version", sa.String(length=40), nullable=True))
        op.add_column(tabla, sa.Column("terminos_aceptados_en", sa.TIMESTAMP(), nullable=True))


def downgrade() -> None:
    for tabla in ("reservas", "usuarios"):
        op.drop_column(tabla, "terminos_aceptados_en")
        op.drop_column(tabla, "terminos_version")
