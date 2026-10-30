"""
Validación de archivos subidos por la API (fotos de perfil, comprobantes de
pago, banners).

Dos correcciones de seguridad (Fase H-05 del plan de mejora) que antes no se
hacían:

1. Se validaba SOLO `file.content_type` — el MIME type que declara el cliente
   en la petición. Cualquiera podía subir un ejecutable o un HTML malicioso
   renombrándolo a `.png`. Ahora se inspeccionan los bytes de cabecera reales
   (magic numbers) del archivo, que son lo único que el servidor puede
   confiar. Si los bytes no coinciden con el tipo declarado, se rechaza.

2. `await file.read()` cargaba TODO el archivo en memoria antes de comprobar
   el límite — un archivo de gigas agotaba la RAM del servidor. Ahora se lee
   en trozos pequeños (64KB) y se corta en cuanto se supera el máximo,
   evitando cargar más de lo necesario.
"""

from __future__ import annotations

from fastapi import HTTPException, UploadFile

# Tamaño de cada trozo al leer el archivo: pequeño para no acumular memoria.
_CHUNK_SIZE = 64 * 1024

# MIME type declarado -> (extensión segura, bytes de cabecera esperados).
# Se comprueba que los primeros bytes del archivo coincidan con el magic
# number de SU PROPIO content_type declarado.
#
# video/mp4 y video/webm se agregaron para el video decorativo del Hero
# por tema (ver tema_route.py::subir_video_tema) -- ninguno de los dos usa
# un prefijo fijo simple como los formatos de imagen de arriba, así que su
# firma real se comprueba aparte en _cabecera_coincide() (el bytes vacío
# acá es solo un placeholder, nunca se usa con startswith para estos dos).
_TIPOS: dict[str, tuple[str, bytes]] = {
    "image/jpeg": ("jpg", b"\xff\xd8\xff"),
    "image/jpg": ("jpg", b"\xff\xd8\xff"),
    "image/png": ("png", b"\x89PNG\r\n\x1a\n"),
    "image/webp": ("webp", b"RIFF"),  # WebP real: RIFF....WEBP (ver abajo)
    "application/pdf": ("pdf", b"%PDF"),
    "video/mp4": ("mp4", b""),
    "video/webm": ("webm", b"\x1a\x45\xdf\xa3"),  # EBML header real de WebM/Matroska
    # Videos grabados con iPhone (.mov): mismo contenedor ISO que MP4.
    "video/quicktime": ("mov", b""),
}


def _cabecera_coincide(cabecera: bytes, content_type: str) -> bool:
    """True si los bytes de cabecera corresponden al content_type declarado."""
    if content_type == "image/webp":
        return cabecera.startswith(b"RIFF") and cabecera[8:12] == b"WEBP"
    if content_type in ("video/mp4", "video/quicktime"):
        # Un MP4 real no empieza con un magic number fijo: los primeros 4
        # bytes son el tamaño de la primera "box" (varía según el archivo),
        # y recién los bytes 4-8 dicen "ftyp" (el tipo de box). Ver
        # especificación ISO/IEC 14496-12.
        return cabecera[4:8] == b"ftyp"
    if content_type in _TIPOS:
        return cabecera.startswith(_TIPOS[content_type][1])
    return False


async def validar_y_leer_archivo(
    file: UploadFile,
    *,
    tipos_permitidos: set[str],
    mensaje_tipo: str,
    tamano_maximo_bytes: int,
) -> tuple[bytes, str]:
    """Valida un archivo subido y devuelve (contenido, extension_real).

    - Comprueba que el tipo declarado (content_type) esté permitido.
    - Comprueba que los bytes de cabecera del archivo coincidan con el tipo
      declarado (magic numbers reales, no confiables en el content_type).
    - Lee en trozos y corta (422) al superar el límite de tamaño, sin cargar
      el archivo entero en memoria.
    """
    if file.content_type not in tipos_permitidos:
        raise HTTPException(status_code=422, detail=mensaje_tipo)

    # Leer la cabecera (primer trozo) para validar los bytes reales.
    primeras = await file.read(_CHUNK_SIZE)
    if not _cabecera_coincide(primeras, file.content_type):
        raise HTTPException(status_code=422, detail=mensaje_tipo)

    # Seguir leyendo el resto en trozos hasta el límite.
    contenido = primeras
    while True:
        trozo = await file.read(_CHUNK_SIZE)
        if not trozo:
            break
        contenido += trozo
        if len(contenido) > tamano_maximo_bytes:
            raise HTTPException(
                status_code=422,
                detail=f"El archivo no puede superar los {tamano_maximo_bytes // (1024 * 1024)}MB.",
            )

    extension = _TIPOS[file.content_type][0]
    return contenido, extension
