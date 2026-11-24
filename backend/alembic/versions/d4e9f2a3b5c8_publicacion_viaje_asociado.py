"""comunidad: la publicación guarda el viaje del que habla (reserva, paquete u hotel)

Revision ID: d4e9f2a3b5c8
Revises: c3d8e1f2a4b7
Create Date: 2026-11-23
"""

import sqlalchemy as sa

from alembic import op

revision = "d4e9f2a3b5c8"
down_revision = "c3d8e1f2a4b7"
branch_labels = None
depends_on = None

TABLA = "publicaciones_comunidad"


def upgrade() -> None:
    op.add_column(TABLA, sa.Column("id_reserva", sa.Integer(), nullable=True))
    op.add_column(TABLA, sa.Column("id_paquete", sa.Integer(), nullable=True))
    op.add_column(TABLA, sa.Column("id_hotel", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_publicacion_reserva", TABLA, "reservas", ["id_reserva"], ["id_reserva"], ondelete="SET NULL"
    )
    op.create_foreign_key(
        "fk_publicacion_paquete", TABLA, "paquetes", ["id_paquete"], ["id_paquete"], ondelete="SET NULL"
    )
    op.create_foreign_key("fk_publicacion_hotel", TABLA, "hoteles", ["id_hotel"], ["id_hotel"], ondelete="SET NULL")
    op.create_index("ix_publicaciones_comunidad_id_paquete", TABLA, ["id_paquete"])
    op.create_index("ix_publicaciones_comunidad_id_hotel", TABLA, ["id_hotel"])


def downgrade() -> None:
    op.drop_index("ix_publicaciones_comunidad_id_hotel", table_name=TABLA)
    op.drop_index("ix_publicaciones_comunidad_id_paquete", table_name=TABLA)
    for fk in ("fk_publicacion_hotel", "fk_publicacion_paquete", "fk_publicacion_reserva"):
        op.drop_constraint(fk, TABLA, type_="foreignkey")
    for col in ("id_hotel", "id_paquete", "id_reserva"):
        op.drop_column(TABLA, col)
