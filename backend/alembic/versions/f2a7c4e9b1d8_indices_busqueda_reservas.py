"""Índices para el listado paginado del panel y la disponibilidad.

GET /api/reservas/buscar filtra y ordena por estado, fecha de viaje, fecha
de creación, asesor y estado de pago; la disponibilidad de habitaciones
busca reserva_habitaciones por id_habitacion; el historial se consulta por
reserva y por fecha. Ninguna de esas columnas tenía índice.

Solo agrega índices (IF NOT EXISTS): no cambia datos. Reversible.

Revision ID: f2a7c4e9b1d8
Revises: e7b2d9c4a6f1
Create Date: 2026-11-15
"""

from alembic import op

revision = "f2a7c4e9b1d8"
down_revision = "e7b2d9c4a6f1"
branch_labels = None
depends_on = None

INDICES = [
    ("ix_reservas_estado", "reservas", ["estado"]),
    ("ix_reservas_fecha_inicio", "reservas", ["fecha_inicio"]),
    ("ix_reservas_fecha_reserva", "reservas", ["fecha_reserva"]),
    ("ix_reservas_id_empleado", "reservas", ["id_empleado"]),
    ("ix_reservas_id_paquete", "reservas", ["id_paquete"]),
    ("ix_pagos_id_reserva_estado", "pagos", ["id_reserva", "estado"]),
    ("ix_reserva_habitaciones_id_habitacion", "reserva_habitaciones", ["id_habitacion"]),
    ("ix_historial_reservas_id_reserva", "historial_reservas", ["id_reserva"]),
    ("ix_historial_reservas_fecha_cambio", "historial_reservas", ["fecha_cambio"]),
]


def upgrade() -> None:
    for nombre, tabla, columnas in INDICES:
        op.create_index(nombre, tabla, columnas, if_not_exists=True)


def downgrade() -> None:
    for nombre, tabla, _ in reversed(INDICES):
        op.drop_index(nombre, table_name=tabla, if_exists=True)
