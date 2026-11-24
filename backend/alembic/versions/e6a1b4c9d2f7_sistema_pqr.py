"""PQRSF: tablas pqrs y pqr_actuaciones

Revision ID: e6a1b4c9d2f7
Revises: d4e9f2a3b5c8
Create Date: 2026-11-24
"""

import sqlalchemy as sa

from alembic import op

revision = "e6a1b4c9d2f7"
down_revision = "d4e9f2a3b5c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pqrs",
        sa.Column("id_pqr", sa.Integer(), primary_key=True),
        sa.Column("radicado", sa.String(30), nullable=True, unique=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("canal", sa.String(20), nullable=False, server_default="web"),
        sa.Column(
            "id_cliente", sa.Integer(), sa.ForeignKey("clientes.id_cliente", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "id_usuario_radica", sa.Integer(), sa.ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("id_reserva", sa.Integer(), sa.ForeignKey("reservas.id_reserva", ondelete="SET NULL"), nullable=True),
        sa.Column("asunto", sa.String(150), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("pretension", sa.Text(), nullable=True),
        sa.Column("autoriza_datos", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("estado", sa.String(20), nullable=False, server_default="radicada"),
        sa.Column("prioridad", sa.String(10), nullable=False, server_default="normal"),
        sa.Column(
            "id_responsable", sa.Integer(), sa.ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("dias_termino", sa.Integer(), nullable=False),
        sa.Column("fecha_radicacion", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()),
        sa.Column("fecha_inicio_termino", sa.Date(), nullable=False),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=False),
        sa.Column("fecha_vencimiento_original", sa.Date(), nullable=True),
        sa.Column("prorrogada", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("motivo_prorroga", sa.Text(), nullable=True),
        sa.Column("fecha_solicitud_informacion", sa.TIMESTAMP(), nullable=True),
        sa.Column("decision", sa.String(20), nullable=True),
        sa.Column("respuesta", sa.Text(), nullable=True),
        sa.Column("fecha_respuesta", sa.TIMESTAMP(), nullable=True),
        sa.Column(
            "id_usuario_responde", sa.Integer(), sa.ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("respondida_a_tiempo", sa.Boolean(), nullable=True),
        sa.Column("satisfaccion", sa.Integer(), nullable=True),
        sa.Column("comentario_satisfaccion", sa.Text(), nullable=True),
        sa.Column("fecha_cierre", sa.TIMESTAMP(), nullable=True),
        sa.Column("fecha_actualizacion", sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.CheckConstraint(
            "tipo IN ('peticion','informacion','consulta','queja','reclamo','sugerencia','felicitacion')",
            name="ck_pqrs_tipo",
        ),
        sa.CheckConstraint(
            "estado IN ('radicada','en_tramite','esperando_cliente','respondida','cerrada','desistida')",
            name="ck_pqrs_estado",
        ),
        sa.CheckConstraint("satisfaccion IS NULL OR (satisfaccion BETWEEN 1 AND 5)", name="ck_pqrs_satisfaccion"),
    )
    op.create_index("ix_pqrs_id_pqr", "pqrs", ["id_pqr"])
    op.create_index("ix_pqrs_radicado", "pqrs", ["radicado"])
    op.create_index("ix_pqrs_id_cliente", "pqrs", ["id_cliente"])
    op.create_index("ix_pqrs_estado", "pqrs", ["estado"])
    op.create_index("ix_pqrs_id_responsable", "pqrs", ["id_responsable"])
    op.create_index("ix_pqrs_fecha_vencimiento", "pqrs", ["fecha_vencimiento"])

    op.create_table(
        "pqr_actuaciones",
        sa.Column("id_actuacion", sa.Integer(), primary_key=True),
        sa.Column("id_pqr", sa.Integer(), sa.ForeignKey("pqrs.id_pqr", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("texto", sa.Text(), nullable=True),
        sa.Column("id_usuario", sa.Integer(), sa.ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True),
        sa.Column("autor_nombre", sa.String(120), nullable=True),
        sa.Column("visible_cliente", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fecha", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_pqr_actuaciones_id_actuacion", "pqr_actuaciones", ["id_actuacion"])
    op.create_index("ix_pqr_actuaciones_id_pqr", "pqr_actuaciones", ["id_pqr"])


def downgrade() -> None:
    op.drop_table("pqr_actuaciones")
    op.drop_table("pqrs")
