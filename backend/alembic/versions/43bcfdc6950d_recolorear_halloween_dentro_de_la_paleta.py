"""recolorear halloween dentro de la paleta carmesi/ambar

Revision ID: 43bcfdc6950d
Revises: 9e373e0c45af
Create Date: 2026-09-05 18:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '43bcfdc6950d'
down_revision: Union[str, None] = '9e373e0c45af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# El tema Halloween sembrado originalmente (ver
# 6c564b92474a_crear_tabla_temas_color.py) usaba un violeta profundo como
# color_primario -- fuera del sistema de marca carmesi/ambar de Alik tours,
# y la causa raiz del efecto "morado sobre morado" detectado en el navbar
# esta sesion. Como color_primario_* alimenta --primary en TODO el sitio
# (ver TemaContext.tsx), un violeta ahi no es un detalle decorativo: cambia
# el color de botones, enlaces y acentos de toda la app mientras el tema
# esta activo.
#
# Nuevos valores: un rojo-naranja profundo ("calabaza quemada"), mas cerca
# en el circulo de color de nuestro propio carmesi (--primary: #6e1832,
# hue ~342) que de un violeta -- se lee como "Alik tours en modo Halloween",
# no como una marca distinta. color_secundario_* NO se toca: ya era un
# ambar/naranja calido (hue ~30, cerca de --gold en 43) que cumple el
# criterio de "un unico color de acento estacional adicional" sin
# introducir una paleta nueva.
#
# Contraste verificado con la misma formula WCAG 2.1 AA que usa
# ModuleTemas.tsx (BadgeContraste): texto blanco sobre estos fondos.
#   - claro  #8a2e14 vs #ffffff -> 8.46:1
#   - oscuro #b8551f vs #ffffff -> 4.82:1  (el propio dark-mode de marca,
#     #c24d6e, da 4.58:1 -- este queda con margen ligeramente mayor)
HALLOWEEN_PRIMARIO_CLARO_ANTERIOR = "#4b2170"
HALLOWEEN_PRIMARIO_OSCURO_ANTERIOR = "#8a5cc4"
HALLOWEEN_PRIMARIO_CLARO_NUEVO = "#8a2e14"
HALLOWEEN_PRIMARIO_OSCURO_NUEVO = "#b8551f"


def upgrade() -> None:
    temas_color = sa.table(
        "temas_color",
        sa.column("clave", sa.String),
        sa.column("color_primario_claro", sa.String),
        sa.column("color_primario_oscuro", sa.String),
    )
    op.execute(
        temas_color.update()
        .where(temas_color.c.clave == "halloween")
        .values(
            color_primario_claro=HALLOWEEN_PRIMARIO_CLARO_NUEVO,
            color_primario_oscuro=HALLOWEEN_PRIMARIO_OSCURO_NUEVO,
        )
    )


def downgrade() -> None:
    temas_color = sa.table(
        "temas_color",
        sa.column("clave", sa.String),
        sa.column("color_primario_claro", sa.String),
        sa.column("color_primario_oscuro", sa.String),
    )
    op.execute(
        temas_color.update()
        .where(temas_color.c.clave == "halloween")
        .values(
            color_primario_claro=HALLOWEEN_PRIMARIO_CLARO_ANTERIOR,
            color_primario_oscuro=HALLOWEEN_PRIMARIO_OSCURO_ANTERIOR,
        )
    )
