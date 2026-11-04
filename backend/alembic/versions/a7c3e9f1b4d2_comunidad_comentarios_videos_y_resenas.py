"""comunidad: comentarios en videos de la agencia, respuestas y comentarios
del equipo; videos promocionales por paquete / en el inicio; respuesta de la
agencia y visibilidad en reseñas.

Revision ID: a7c3e9f1b4d2
Revises: f3c1d9a7b5e2
Create Date: 2026-11-03 21:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7c3e9f1b4d2"
down_revision: Union[str, None] = "f3c1d9a7b5e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- videos de la agencia ---
    with op.batch_alter_table("videos_agencia") as b:
        b.add_column(sa.Column("id_paquete", sa.Integer(), nullable=True))
        b.add_column(sa.Column("mostrar_inicio", sa.Boolean(), nullable=False, server_default=sa.false()))
        b.create_foreign_key(
            "fk_videos_agencia_paquete", "paquetes", ["id_paquete"], ["id_paquete"], ondelete="SET NULL"
        )
        b.create_index("ix_videos_agencia_id_paquete", ["id_paquete"])

    # --- comentarios ---
    with op.batch_alter_table("comentarios_comunidad") as b:
        b.alter_column("id_publicacion", existing_type=sa.Integer(), nullable=True)
        b.alter_column("id_cliente", existing_type=sa.Integer(), nullable=True)
        b.add_column(sa.Column("id_video", sa.Integer(), nullable=True))
        b.add_column(sa.Column("id_usuario_equipo", sa.Integer(), nullable=True))
        b.add_column(sa.Column("id_padre", sa.Integer(), nullable=True))
        b.create_foreign_key("fk_comentarios_video", "videos_agencia", ["id_video"], ["id_video"], ondelete="CASCADE")
        b.create_foreign_key(
            "fk_comentarios_usuario_equipo", "usuarios", ["id_usuario_equipo"], ["id_usuario"], ondelete="SET NULL"
        )
        b.create_foreign_key(
            "fk_comentarios_padre", "comentarios_comunidad", ["id_padre"], ["id_comentario"], ondelete="CASCADE"
        )
        b.create_index("ix_comentarios_comunidad_id_video", ["id_video"])
        b.create_index("ix_comentarios_comunidad_id_padre", ["id_padre"])
        b.create_check_constraint(
            "ck_comentario_publicacion_o_video",
            "(id_publicacion IS NOT NULL AND id_video IS NULL) OR (id_publicacion IS NULL AND id_video IS NOT NULL)",
        )
        b.create_check_constraint(
            "ck_comentario_tiene_autor", "id_cliente IS NOT NULL OR id_usuario_equipo IS NOT NULL"
        )

    # --- reseñas ---
    with op.batch_alter_table("resenas") as b:
        b.add_column(sa.Column("fecha_edicion", sa.TIMESTAMP(), nullable=True))
        b.add_column(sa.Column("respuesta_agencia", sa.Text(), nullable=True))
        b.add_column(sa.Column("fecha_respuesta", sa.TIMESTAMP(), nullable=True))
        b.add_column(sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    with op.batch_alter_table("resenas") as b:
        b.drop_column("visible")
        b.drop_column("fecha_respuesta")
        b.drop_column("respuesta_agencia")
        b.drop_column("fecha_edicion")

    # Los comentarios de videos y del equipo no caben en el esquema anterior.
    op.execute("DELETE FROM comentarios_comunidad WHERE id_video IS NOT NULL OR id_cliente IS NULL")
    with op.batch_alter_table("comentarios_comunidad") as b:
        b.drop_constraint("ck_comentario_tiene_autor", type_="check")
        b.drop_constraint("ck_comentario_publicacion_o_video", type_="check")
        b.drop_index("ix_comentarios_comunidad_id_padre")
        b.drop_index("ix_comentarios_comunidad_id_video")
        b.drop_constraint("fk_comentarios_padre", type_="foreignkey")
        b.drop_constraint("fk_comentarios_usuario_equipo", type_="foreignkey")
        b.drop_constraint("fk_comentarios_video", type_="foreignkey")
        b.drop_column("id_padre")
        b.drop_column("id_usuario_equipo")
        b.drop_column("id_video")
        b.alter_column("id_cliente", existing_type=sa.Integer(), nullable=False)
        b.alter_column("id_publicacion", existing_type=sa.Integer(), nullable=False)

    with op.batch_alter_table("videos_agencia") as b:
        b.drop_index("ix_videos_agencia_id_paquete")
        b.drop_constraint("fk_videos_agencia_paquete", type_="foreignkey")
        b.drop_column("mostrar_inicio")
        b.drop_column("id_paquete")
