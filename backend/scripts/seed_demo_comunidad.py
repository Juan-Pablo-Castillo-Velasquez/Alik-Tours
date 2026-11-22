#!/usr/bin/env python3
"""Carga o quita el contenido de ejemplo de reseñas y comunidad.

Ver app/services/contenido_ejemplo.py: todo sale con la etiqueta "Ejemplo" y
no cuenta en promedios ni totales. También se puede hacer desde el panel de
admin, en Comunidad.

Uso:
    docker compose exec backend python scripts/seed_demo_comunidad.py
    docker compose exec backend python scripts/seed_demo_comunidad.py --borrar
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import sqlalchemy as sa  # noqa: E402

from app.services.contenido_ejemplo import borrar, sembrar  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--borrar", action="store_true", help="Quita el contenido de ejemplo")
    args = parser.parse_args()

    url = os.getenv("DATABASE_URL", "")
    if not url:
        sys.exit("Falta DATABASE_URL.")

    engine = sa.create_engine(url)
    with engine.begin() as conn:
        borrar(conn)  # idempotente: siempre deja exactamente un juego de ejemplo
        resumen = None if args.borrar else sembrar(conn)
    if resumen:
        print(
            f"Contenido de ejemplo creado: {resumen['perfiles']} perfiles, {resumen['resenas']} reseñas "
            f"y {resumen['publicaciones']} publicaciones."
        )
    else:
        print("Contenido de ejemplo eliminado.")


if __name__ == "__main__":
    main()
