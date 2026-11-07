"""Ficha completa del hotel, estado de servicios y datos comerciales de habitación.

Solo agrega columnas nullable o con default (publicado/publicada = true:
todo lo existente sigue visible). Reversible.

Revision ID: a7c3e9b2d4f6
Revises: f5b9d2e7a1c3
Create Date: 2026-11-06
"""

import sqlalchemy as sa

from alembic import op

revision = "a7c3e9b2d4f6"
down_revision = "f5b9d2e7a1c3"
branch_labels = None
depends_on = None

HOTEL_TEXTO = (
    "politica_entrada_anticipada",
    "politica_salida_tardia",
    "politica_ninos",
    "politica_mascotas",
    "politica_cancelacion",
    "condiciones_reserva",
    "impuestos_cargos",
    "restricciones",
    "informacion_adicional",
)


def upgrade() -> None:
    with op.batch_alter_table("hoteles") as batch:
        batch.add_column(sa.Column("tipo_alojamiento", sa.String(40)))
        batch.add_column(sa.Column("departamento", sa.String(100)))
        batch.add_column(sa.Column("sitio_web", sa.String(255)))
        batch.add_column(sa.Column("latitud", sa.Numeric(9, 6)))
        batch.add_column(sa.Column("longitud", sa.Numeric(9, 6)))
        batch.add_column(sa.Column("fuente_calificacion", sa.String(120)))
        batch.add_column(sa.Column("publicado", sa.Boolean(), nullable=False, server_default=sa.true()))
        batch.add_column(sa.Column("hora_checkin", sa.Time()))
        batch.add_column(sa.Column("hora_checkout", sa.Time()))
        batch.add_column(sa.Column("edad_minima", sa.Integer()))
        for col in HOTEL_TEXTO:
            batch.add_column(sa.Column(col, sa.Text()))
        batch.create_check_constraint("ck_hotel_edad_minima", "edad_minima IS NULL OR (edad_minima >= 0 AND edad_minima <= 99)")
        batch.create_check_constraint("ck_hotel_latitud", "latitud IS NULL OR (latitud >= -90 AND latitud <= 90)")
        batch.create_check_constraint("ck_hotel_longitud", "longitud IS NULL OR (longitud >= -180 AND longitud <= 180)")
    with op.batch_alter_table("hotel_caracteristicas") as batch:
        batch.add_column(sa.Column("estado", sa.String(15)))
        batch.add_column(sa.Column("nota", sa.String(150)))
        batch.create_check_constraint(
            "ck_hotel_caract_estado", "estado IS NULL OR estado IN ('incluido', 'de_pago', 'no_disponible')"
        )
    with op.batch_alter_table("habitaciones") as batch:
        batch.add_column(sa.Column("nombre", sa.String(100)))
        batch.add_column(sa.Column("capacidad_adultos", sa.Integer()))
        batch.add_column(sa.Column("capacidad_ninos", sa.Integer()))
        batch.add_column(sa.Column("cantidad_camas", sa.Integer()))
        batch.add_column(sa.Column("politica_cancelacion", sa.Text()))
        batch.add_column(sa.Column("publicada", sa.Boolean(), nullable=False, server_default=sa.true()))
        batch.create_check_constraint(
            "ck_habitacion_capacidades",
            "(capacidad_adultos IS NULL OR capacidad_adultos >= 0) AND (capacidad_ninos IS NULL OR capacidad_ninos >= 0)"
            " AND (cantidad_camas IS NULL OR cantidad_camas >= 0)",
        )


def downgrade() -> None:
    with op.batch_alter_table("habitaciones") as batch:
        batch.drop_constraint("ck_habitacion_capacidades", type_="check")
        for col in ("publicada", "politica_cancelacion", "cantidad_camas", "capacidad_ninos", "capacidad_adultos", "nombre"):
            batch.drop_column(col)
    with op.batch_alter_table("hotel_caracteristicas") as batch:
        batch.drop_constraint("ck_hotel_caract_estado", type_="check")
        batch.drop_column("nota")
        batch.drop_column("estado")
    with op.batch_alter_table("hoteles") as batch:
        for ck in ("ck_hotel_longitud", "ck_hotel_latitud", "ck_hotel_edad_minima"):
            batch.drop_constraint(ck, type_="check")
        for col in (*reversed(HOTEL_TEXTO), "edad_minima", "hora_checkout", "hora_checkin", "publicado",
                    "fuente_calificacion", "longitud", "latitud", "sitio_web", "departamento", "tipo_alojamiento"):
            batch.drop_column(col)
