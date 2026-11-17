"""Respuesta HTTP para descargar un archivo privado (adjuntos de chat).

El archivo vive en Cloudinary con type="authenticated" (referencia
"privado:cloudinary:...") o, sin Cloudinary configurado, en una carpeta
local que main.py bloquea para acceso público. En ambos casos el navegador
nunca ve una URL directa: el backend valida la sesión y entrega los bytes.
"""

import logging
import os

from fastapi import HTTPException
from fastapi.responses import FileResponse, Response

from app.core import image_storage

logger = logging.getLogger(__name__)

CABECERAS_PRIVADAS = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}

_TIPOS = {"pdf": "application/pdf", "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


def es_referencia_privada(referencia: str | None, prefijo_local: str) -> bool:
    return bool(referencia) and (
        image_storage.es_privado_cloudinary(referencia) or referencia.startswith(f"{prefijo_local}/")
    )


def respuesta_archivo_privado(
    referencia: str, *, directorio_local: str, prefijo_local: str, nombre_descarga: str
) -> Response:
    if image_storage.es_privado_cloudinary(referencia):
        try:
            contenido, formato = image_storage.leer_archivo_privado(referencia)
        except Exception as exc:
            logger.warning("No se pudo leer el archivo privado %s: %s", nombre_descarga, exc)
            raise HTTPException(status_code=502, detail="No se pudo obtener el archivo. Intenta de nuevo.") from exc
        return Response(
            content=contenido,
            media_type=_TIPOS.get(formato, "application/octet-stream"),
            headers={**CABECERAS_PRIVADAS, "Content-Disposition": f'inline; filename="{nombre_descarga}.{formato}"'},
        )
    if not referencia.startswith(f"{prefijo_local}/"):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    nombre = os.path.basename(referencia)
    raiz = os.path.realpath(directorio_local)
    ruta = os.path.realpath(os.path.join(raiz, nombre))
    if not ruta.startswith(raiz + os.sep) or not os.path.isfile(ruta):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    extension = os.path.splitext(nombre)[1].lstrip(".").lower()
    return FileResponse(
        ruta,
        media_type=_TIPOS.get(extension, "application/octet-stream"),
        filename=f"{nombre_descarga}.{extension}",
        content_disposition_type="inline",
        headers=CABECERAS_PRIVADAS,
    )
