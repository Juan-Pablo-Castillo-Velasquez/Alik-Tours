"""reservas: crear las restricciones CHECK que el modelo ya declaraba

Hallazgo de la semana 6 del bootcamp de testing (integración con
PostgreSQL real): app/models/reserva_model.py declara tres CHECK en la
tabla reservas (numero_personas > 0, estado y canal_origen dentro de sus
valores), pero la migración inicial nunca los creó. Con SQLite en memoria
los tests no lo notaban; contra la BD real se pudo guardar una reserva
con 0 personas o con un estado inventado.

Se crean NOT VALID: PostgreSQL los exige desde ya para toda fila nueva o
actualizada, sin revisar las filas viejas (así el despliegue no puede
fallar por algún dato histórico). Reversible.

Revision ID: f3c1d9a7b5e2
Revises: e4b8c2d6f913
Create Date: 2026-11-02 19:40:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "f3c1d9a7b5e2"
down_revision: Union[str, None] = "e4b8c2d6f913"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHECKS = {
    "ck_reservas_numero_personas": "numero_personas > 0",
    "ck_reservas_estado": "estado IN ('pendiente', 'confirmada', 'cancelada', 'finalizada')",
    "ck_reservas_canal_origen": "canal_origen IN ('web', 'empleado', 'telefono')",
}


def upgrade() -> None:
    for nombre, condicion in CHECKS.items():
        op.execute(f"ALTER TABLE reservas ADD CONSTRAINT {nombre} CHECK ({condicion}) NOT VALID")


def downgrade() -> None:
    for nombre in CHECKS:
        op.execute(f"ALTER TABLE reservas DROP CONSTRAINT IF EXISTS {nombre}")
