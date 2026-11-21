"""prototipo IoT: dispositivos y lecturas de telemetría de los traslados

Revision ID: b7e2c9d4f1a6
Revises: a9d3f6c1e5b7
Create Date: 2026-11-20
"""

import sqlalchemy as sa

from alembic import op

revision = "b7e2c9d4f1a6"
down_revision = "a9d3f6c1e5b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dispositivos_iot",
        sa.Column("id_dispositivo", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("descripcion", sa.String(255), nullable=True),
        sa.Column("clave_hash", sa.String(64), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("ultima_conexion", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("creado_en", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_dispositivos_iot_id_dispositivo", "dispositivos_iot", ["id_dispositivo"])
    op.create_index("ix_dispositivos_iot_clave_hash", "dispositivos_iot", ["clave_hash"], unique=True)

    op.create_table(
        "lecturas_iot",
        sa.Column("id_lectura", sa.Integer(), primary_key=True),
        sa.Column(
            "id_dispositivo",
            sa.Integer(),
            sa.ForeignKey("dispositivos_iot.id_dispositivo", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("medido_en", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("recibido_en", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("latitud", sa.Float(), nullable=True),
        sa.Column("longitud", sa.Float(), nullable=True),
        sa.Column("velocidad_kmh", sa.Float(), nullable=True),
        sa.Column("temperatura_c", sa.Float(), nullable=True),
        sa.Column("humedad_pct", sa.Float(), nullable=True),
        sa.Column("pasajeros", sa.Integer(), nullable=True),
        sa.Column("bateria_pct", sa.Float(), nullable=True),
        sa.CheckConstraint("latitud IS NULL OR latitud BETWEEN -90 AND 90", name="ck_lecturas_iot_latitud"),
        sa.CheckConstraint("longitud IS NULL OR longitud BETWEEN -180 AND 180", name="ck_lecturas_iot_longitud"),
    )
    op.create_index("ix_lecturas_iot_id_lectura", "lecturas_iot", ["id_lectura"])
    op.create_index("ix_lecturas_iot_id_dispositivo", "lecturas_iot", ["id_dispositivo"])
    op.create_index("ix_lecturas_iot_recibido_en", "lecturas_iot", ["recibido_en"])


def downgrade() -> None:
    op.drop_table("lecturas_iot")
    op.drop_table("dispositivos_iot")
