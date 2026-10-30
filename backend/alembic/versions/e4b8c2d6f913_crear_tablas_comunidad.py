"""comunidad: publicaciones de clientes, imágenes, comentarios y videos de la agencia

Tablas nuevas (no toca ninguna existente). Reversible.

Revision ID: e4b8c2d6f913
Revises: d9e3a5b7c412
Create Date: 2026-10-29 23:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e4b8c2d6f913"
down_revision: Union[str, None] = "d9e3a5b7c412"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "publicaciones_comunidad",
        sa.Column("id_publicacion", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "id_cliente", sa.Integer(), sa.ForeignKey("clientes.id_cliente", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("titulo", sa.String(length=150), nullable=False),
        sa.Column("contenido", sa.Text(), nullable=False),
        sa.Column("calificacion", sa.Integer(), nullable=True),
        sa.Column("destino", sa.String(length=120), nullable=True),
        sa.Column("video_url", sa.String(length=500), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="pendiente"),
        sa.Column("motivo_moderacion", sa.String(length=300), nullable=True),
        sa.Column(
            "id_moderador", sa.Integer(), sa.ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.text("now()")),
        sa.Column("fecha_moderacion", sa.TIMESTAMP(), nullable=True),
        sa.CheckConstraint("calificacion BETWEEN 1 AND 5", name="ck_publicacion_calificacion"),
        sa.CheckConstraint(
            "estado IN ('pendiente', 'aprobada', 'rechazada', 'oculta')", name="ck_publicacion_estado"
        ),
    )
    op.create_index("ix_publicaciones_comunidad_id_cliente", "publicaciones_comunidad", ["id_cliente"])
    op.create_index("ix_publicaciones_comunidad_estado", "publicaciones_comunidad", ["estado"])

    op.create_table(
        "imagenes_publicacion",
        sa.Column("id_imagen", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "id_publicacion",
            sa.Integer(),
            sa.ForeignKey("publicaciones_comunidad.id_publicacion", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_imagenes_publicacion_id_publicacion", "imagenes_publicacion", ["id_publicacion"])

    op.create_table(
        "comentarios_comunidad",
        sa.Column("id_comentario", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "id_publicacion",
            sa.Integer(),
            sa.ForeignKey("publicaciones_comunidad.id_publicacion", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "id_cliente", sa.Integer(), sa.ForeignKey("clientes.id_cliente", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("contenido", sa.String(length=500), nullable=False),
        sa.Column("oculto", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.text("now()")),
    )
    op.create_index("ix_comentarios_comunidad_id_publicacion", "comentarios_comunidad", ["id_publicacion"])

    op.create_table(
        "videos_agencia",
        sa.Column("id_video", sa.Integer(), primary_key=True, index=True),
        sa.Column("titulo", sa.String(length=150), nullable=False),
        sa.Column("descripcion", sa.String(length=500), nullable=True),
        sa.Column("video_url", sa.String(length=500), nullable=False),
        sa.Column("portada_url", sa.String(length=500), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("videos_agencia")
    op.drop_index("ix_comentarios_comunidad_id_publicacion", table_name="comentarios_comunidad")
    op.drop_table("comentarios_comunidad")
    op.drop_index("ix_imagenes_publicacion_id_publicacion", table_name="imagenes_publicacion")
    op.drop_table("imagenes_publicacion")
    op.drop_index("ix_publicaciones_comunidad_estado", table_name="publicaciones_comunidad")
    op.drop_index("ix_publicaciones_comunidad_id_cliente", table_name="publicaciones_comunidad")
    op.drop_table("publicaciones_comunidad")
