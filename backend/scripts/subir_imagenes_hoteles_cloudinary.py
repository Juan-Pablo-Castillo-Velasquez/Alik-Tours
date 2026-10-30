#!/usr/bin/env python3
"""Sube a Cloudinary las 10 fotos demo de hoteles que hoy apuntan directo a
Unsplash (ver alembic/versions/6a87622a7a6e_poblar_imagen_url_hoteles_demo.py
y su corrección en 7972baf77f44_corregir_fotos_hoteles_demo.py) y deja el
resultado en dos sitios:

1. La base de datos (hoteles.imagen_url) -- efecto inmediato, sin reiniciar
   nada.
2. Un nuevo archivo de migración de Alembic en alembic/versions/, para que
   una instalación nueva del proyecto (`docker compose up --build` desde
   cero) también termine con las URLs reales de Cloudinary en vez de las
   de Unsplash.

Por qué existe este script como paso manual en vez de hacerlo el asistente
directamente: ni el entorno donde corre el asistente ni la VM local del
puente a este computador tienen salida de red hacia Cloudinary/Unsplash
(bloqueado por política de red), pero ESTE contenedor sí -- ya se probó
subiendo una foto de perfil real con la misma cuenta. Además, Cloudinary
puede descargar la imagen de origen él mismo a partir de la URL (no hace
falta bajarla nosotros primero), así que este script solo necesita que el
contenedor del backend llegue a api.cloudinary.com, exactamente lo mismo
que ya funciona para las fotos de perfil.

Uso (con los contenedores ya levantados):
    docker compose exec backend python subir_imagenes_hoteles_cloudinary.py
"""

from __future__ import annotations

import ast
import re
import secrets
import sys
from datetime import UTC, datetime
from pathlib import Path

import cloudinary.uploader

from app.core.database import SessionLocal
from app.core.image_storage import CLOUDINARY_CONFIGURADO
from app.models.hotel_model import Hotel


def _head_revision_actual() -> str:
    """Recorre alembic/versions/*.py y devuelve el ID de la revisión que
    nadie más declara como down_revision -- es decir, el head real de la
    cadena en este momento. Se calcula en vez de dejarlo fijo porque este
    script puede correrse después de que existan más migraciones nuevas
    (ver 7972baf77f44, que corrige 7 de estas 10 fotos) -- encadenar mal
    crearía dos heads y rompería `alembic upgrade head`."""
    versions_dir = Path(__file__).resolve().parent / "alembic" / "versions"
    revisiones: set[str] = set()
    down_revisiones: set[str] = set()
    patron_rev = re.compile(r"^revision:\s*str\s*=\s*(.+)$", re.MULTILINE)
    patron_down = re.compile(r"^down_revision.*=\s*(.+)$", re.MULTILINE)
    for archivo in versions_dir.glob("*.py"):
        texto = archivo.read_text(encoding="utf-8")
        m_rev = patron_rev.search(texto)
        m_down = patron_down.search(texto)
        if not m_rev:
            continue
        revisiones.add(ast.literal_eval(m_rev.group(1).strip()))
        if m_down:
            valor = ast.literal_eval(m_down.group(1).strip())
            if valor:
                down_revisiones.add(valor)
    heads = revisiones - down_revisiones
    if len(heads) != 1:
        raise RuntimeError(
            f"No se pudo determinar un único head de Alembic (candidatos: {heads}). "
            "Revisa alembic/versions/ manualmente antes de continuar."
        )
    return heads.pop()


# Mismas URLs y mismo criterio que las migraciones de datos 6a87622a7a6e +
# 7972baf77f44 (esta última corrige 7 de las 10 fotos originales, que
# resultaron ser imágenes ajenas al hotel -- ver su docstring) -- se listan
# de nuevo aquí (en vez de importarlas desde un módulo de alembic, que no
# está pensado para importarse desde afuera) para que este script sea
# independiente y se pueda borrar sin afectar el historial de migraciones.
# Cada una se verificó abriéndola antes de guardarla, no solo por el
# nombre del archivo.
FOTOS_POR_HOTEL = {
    "Hotel Paraiso": "https://images.unsplash.com/photo-1605723517503-3cadb5818a0c?w=1200&q=80",
    "Resort Sol y Arena": "https://images.unsplash.com/photo-1658591049748-4937f0a9051a?w=1200&q=80",
    "Montana Magica": "https://images.unsplash.com/photo-1570793005386-840846445fed?w=1200&q=80",
    "Gran Hotel Centro": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
    "Cabanas del Bosque": "https://images.unsplash.com/photo-1749063240369-391a2e82dc04?w=1200&q=80",
    "Plaza Mayor Hotel": "https://images.unsplash.com/photo-1788203816802-5fa9a5086f27?w=1200&q=80",
    "Boutique Santa Marta": "https://images.unsplash.com/photo-1788184851263-f832bf6c76f3?w=1200&q=80",
    "EcoLodge Tayrona": "https://images.unsplash.com/photo-1770823232388-adb591775e55?w=1200&q=80",
    "Hotel Imperial": "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80",
    "Cali Pachanguero H.": "https://images.unsplash.com/photo-1758165532022-a68f291317ba?w=1200&q=80",
}


def _slug(nombre: str) -> str:
    """'Cali Pachanguero H.' -> 'cali-pachanguero-h' -- public_id legible
    en el Media Library en vez de un uuid, ya que estas fotos SÍ tienen un
    nombre de origen fijo (no son subidas de un usuario)."""
    limpio = "".join(c.lower() if c.isalnum() else "-" for c in nombre)
    while "--" in limpio:
        limpio = limpio.replace("--", "-")
    return limpio.strip("-")


def main() -> int:
    if not CLOUDINARY_CONFIGURADO:
        print(
            "CLOUDINARY_URL no está configurada en backend/.env -- no hay "
            "ninguna cuenta de Cloudinary a la cual subir estas imágenes. "
            "Nada que hacer.",
            file=sys.stderr,
        )
        return 1

    resultados: dict[str, str] = {}
    fallos: list[str] = []

    db = SessionLocal()
    try:
        for nombre, url_unsplash in FOTOS_POR_HOTEL.items():
            print(f"Subiendo: {nombre} ...", flush=True)
            try:
                resultado = cloudinary.uploader.upload(
                    url_unsplash,  # Cloudinary descarga la imagen de esta URL él mismo
                    folder="alectours/hoteles",
                    public_id=_slug(nombre),
                    resource_type="image",
                    overwrite=True,
                )
            except Exception as exc:  # noqa: BLE001 -- se reporta y se sigue con los demás
                print(f"  ERROR subiendo '{nombre}': {exc}", file=sys.stderr)
                fallos.append(nombre)
                continue

            url_cloudinary = resultado["secure_url"]
            resultados[nombre] = url_cloudinary
            print(f"  -> {url_cloudinary}")

            hotel = db.query(Hotel).filter(Hotel.nombre_hotel == nombre).first()
            if hotel is not None:
                hotel.imagen_url = url_cloudinary
            else:
                print(f"  (aviso: no hay ningún hotel llamado '{nombre}' en la base de datos)")

        db.commit()
    finally:
        db.close()

    if resultados:
        _escribir_migracion(resultados)

    print()
    if resultados:
        print(f"Listo: {len(resultados)}/{len(FOTOS_POR_HOTEL)} fotos subidas a Cloudinary.")
        print("La base de datos ya quedó actualizada (no hace falta reiniciar nada).")
        print(
            "También se creó una nueva migración de Alembic en alembic/versions/ "
            "para que una instalación nueva del proyecto también use estas URLs "
            "reales de Cloudinary desde el principio."
        )
    if fallos:
        print(
            f"No se pudieron subir {len(fallos)} foto(s): {', '.join(fallos)}",
            file=sys.stderr,
        )
        return 1
    return 0


def _escribir_migracion(resultados: dict[str, str]) -> None:
    revision = secrets.token_hex(6)
    down_revision = _head_revision_actual()
    hoy = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S.%f")
    lineas_dict = "\n".join(f"    {nombre!r}: {url!r}," for nombre, url in resultados.items())
    contenido = f'''"""reemplazar fotos de Unsplash por las reales de Cloudinary

Revision ID: {revision}
Revises: {down_revision}
Create Date: {hoy}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = {revision!r}
down_revision: Union[str, None] = {down_revision!r}
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Generado por subir_imagenes_hoteles_cloudinary.py: estas son las URLs
# reales que Cloudinary devolvió al subir cada foto demo (antes apuntaban
# directo a Unsplash). La condición del UPDATE de abajo
# solo pisa NULL o una URL todavía de Unsplash -- nunca una foto que un
# admin ya haya subido de verdad después (ver POST /api/hoteles/{{id}}/imagen).
FOTOS_CLOUDINARY = {{
{lineas_dict}
}}

_UPDATE_SQL = sa.text(
    "UPDATE hoteles SET imagen_url = :url WHERE nombre_hotel = :nombre "
    "AND (imagen_url IS NULL OR imagen_url LIKE :unsplash_like)"
)


def upgrade() -> None:
    conn = op.get_bind()
    for nombre, url in FOTOS_CLOUDINARY.items():
        conn.execute(
            _UPDATE_SQL,
            {{"url": url, "nombre": nombre, "unsplash_like": "%unsplash.com%"}},
        )


def downgrade() -> None:
    # No revierte a las URLs de Unsplash: una vez que la cuenta de
    # Cloudinary tiene la imagen real, no tiene sentido volver atrás.
    pass
'''
    destino = (
        Path(__file__).resolve().parent / "alembic" / "versions" / f"{revision}_reemplazar_fotos_hoteles_cloudinary.py"
    )
    destino.write_text(contenido, encoding="utf-8")
    print(f"Migración nueva escrita en: {destino}")


if __name__ == "__main__":
    raise SystemExit(main())
