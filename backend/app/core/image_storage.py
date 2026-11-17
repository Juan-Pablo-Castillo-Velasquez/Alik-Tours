"""
Almacenamiento de imágenes subidas por la app (fotos de perfil, banners).

Si la variable de entorno CLOUDINARY_URL está configurada (ver
app/core/config.py y backend/.env.example), las imágenes se suben a
Cloudinary y se guarda la URL https:// que devuelve. Si NO está
configurada, el comportamiento es exactamente el de antes de este módulo:
se guardan en disco local bajo backend/app/static/uploads/<carpeta>/,
servidas por el mount /uploads ya existente en app/main.py.

Este fallback es intencional: el requisito general del proyecto es que
`docker compose up --build` funcione de cero sin que nadie tenga que crear
ninguna cuenta externa. Cloudinary es 100% opcional — solo se activa si
alguien define CLOUDINARY_URL en backend/.env.

Los comprobantes de pago (pueden traer datos bancarios) NO usan
guardar_imagen: van por guardar_archivo_privado (al final de este módulo),
que en Cloudinary los sube como recurso "authenticated" (sin URL pública)
y en local los deja fuera de la ruta pública /uploads.
"""

from __future__ import annotations

import contextlib
import os
import uuid

import cloudinary
import cloudinary.uploader
from cloudinary import Search as CloudinarySearch

from app.core.config import settings

# True si hay una cuenta de Cloudinary configurada. Se calcula una sola vez
# al importar el módulo — cambiar backend/.env requiere reiniciar el
# contenedor backend para que tome efecto, igual que cualquier otra
# variable de entorno de este proyecto.
CLOUDINARY_CONFIGURADO = bool(settings.CLOUDINARY_URL)

if CLOUDINARY_CONFIGURADO:
    cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)


def _directorio_local(carpeta: str) -> str:
    """backend/app/static/uploads/<carpeta> — misma ruta que se usaba antes
    de este módulo en usuario_route.py / banner_route.py."""
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", carpeta)


def guardar_imagen(
    contenido: bytes,
    extension: str,
    *,
    carpeta: str,
    public_path_prefix: str,
    resource_type: str = "image",
) -> str:
    """Guarda un archivo ya validado (bytes reales + extensión real, ver
    file_validation.py::validar_y_leer_archivo) y devuelve la URL a guardar
    en la base de datos.

    - Con Cloudinary configurado: sube el archivo y devuelve la URL https://
      completa (el frontend ya sabe mostrar una URL absoluta tal cual, ver
      resolveFotoUrl en components/admin/types.ts y resolveImagenBanner en
      services/banner.service.ts).
    - Sin Cloudinary: guarda en disco local y devuelve la ruta relativa
      "/uploads/<carpeta>/archivo.ext", como siempre.

    `resource_type` por defecto es "image" -- todos los llamadores
    existentes (fotos de perfil, banners, imagen de tema) siguen igual sin
    tocar nada. Se agregó para el video decorativo de temas (ver
    tema_route.py::subir_video_tema), que necesita resource_type="video"
    para que Cloudinary no intente procesarlo como imagen.
    """
    identificador = uuid.uuid4().hex

    if CLOUDINARY_CONFIGURADO:
        # "folder" (no un public_id con "/" a mano) es lo que de verdad
        # crea la carpeta visible en el Media Library — las cuentas nuevas
        # de Cloudinary usan "Dynamic Folder Mode" por defecto, donde un
        # public_id con barras se guarda tal cual (un nombre largo con
        # barras) pero NO arma ninguna carpeta real; hallazgo real de esta
        # cuenta (ver conversación): la primera prueba subió la foto sin
        # ninguna carpeta "alectours" en el Media Library.
        resultado = cloudinary.uploader.upload(
            contenido,
            folder=f"alectours/{carpeta}",
            public_id=identificador,
            resource_type=resource_type,
            overwrite=False,
        )
        return resultado["secure_url"]

    directorio = _directorio_local(carpeta)
    os.makedirs(directorio, exist_ok=True)
    nombre_archivo = f"{identificador}.{extension}"
    ruta_destino = os.path.join(directorio, nombre_archivo)
    with open(ruta_destino, "wb") as f:
        f.write(contenido)
    return f"{public_path_prefix}/{nombre_archivo}"


def listar_galeria_temporada(clave: str, *, limite: int = 12) -> list[str]:
    """Imágenes reales de una temporada (ej. "halloween") gestionadas
    DIRECTO en Cloudinary, en la carpeta alectours/temporadas/<clave>/ --
    a diferencia de Tema.imagen_url/video_url (un solo archivo por tema,
    subido desde el panel admin, ver tema_route.py), esta carpeta la puede
    llenar cualquiera con acceso a la cuenta de Cloudinary sin tocar
    código ni redeploy: subir o borrar un archivo ahí cambia lo que
    devuelve esta función la próxima vez que expire el caché (ver
    GALERIA_CACHE_TTL en tema_route.py).

    Usa la Search API (no cloudinary.api.resources) porque es la forma
    confiable de filtrar por carpeta en cuentas con "Dynamic Folder Mode"
    (todas las cuentas nuevas -- ver la nota de guardar_imagen() arriba
    sobre por qué el parámetro "folder" sí crea una carpeta real ahí).

    Sin Cloudinary configurado, sin resultados, o si la API de Cloudinary
    falla por cualquier motivo (credenciales, rate limit, carpeta que no
    existe todavía) devuelve una lista vacía -- nunca rompe la decoración
    del sitio, que ya sabe tratar "sin imágenes de galería" como "solo
    mostrar los acentos SVG" (ver useTemaGaleria.ts en el frontend)."""
    if not CLOUDINARY_CONFIGURADO:
        return []
    try:
        resultado = (
            CloudinarySearch()
            .expression(f'folder:"alectours/temporadas/{clave}"')
            .sort_by("created_at", "desc")
            .max_results(limite)
            .execute()
        )
        return [r["secure_url"] for r in resultado.get("resources", []) if r.get("secure_url")]
    except Exception:
        return []


def _public_id_desde_url_cloudinary(url: str) -> str | None:
    """Extrae el public_id (ej. 'alectours/perfiles/<hex>') de una URL de
    Cloudinary tipo:
    https://res.cloudinary.com/<cloud>/image/upload/v169.../alectours/perfiles/<hex>.jpg
    """
    try:
        sin_query = url.split("?", 1)[0]
        despues_upload = sin_query.split("/upload/", 1)[1]
        segmentos = despues_upload.split("/", 1)
        # El primer segmento tras /upload/ es la versión ("v1234567") si
        # Cloudinary la incluyó — se descarta, no es parte del public_id.
        if len(segmentos) == 2 and segmentos[0].startswith("v") and segmentos[0][1:].isdigit():
            despues_upload = segmentos[1]
        return despues_upload.rsplit(".", 1)[0]
    except (IndexError, ValueError):
        return None


def borrar_imagen(
    url: str | None,
    *,
    carpeta: str,
    public_path_prefix: str,
    resource_type: str = "image",
) -> None:
    """Borra el archivo anterior al reemplazarlo o eliminarlo. Revisa la
    FORMA de la url (http = Cloudinary, ruta relativa = disco local) en vez
    de asumir el modo activo ahora mismo — así una cuenta que ya tenía
    fotos guardadas en disco local antes de configurar Cloudinary no se
    queda con archivos huérfanos sin poder borrarlos.

    `resource_type` debe coincidir con el que se usó al subirlo en
    guardar_imagen() -- Cloudinary no encuentra un video si se le pide
    destroy() con resource_type="image" (por defecto)."""
    if not url:
        return

    if url.startswith("http"):
        if not CLOUDINARY_CONFIGURADO:
            return
        public_id = _public_id_desde_url_cloudinary(url)
        if public_id:
            # Nota: en cuentas con "Dynamic Folder Mode" (todas las nuevas,
            # ver guardar_imagen arriba) Cloudinary puede esperar el
            # public_id SIN el prefijo de carpeta para destroy(). Si esto
            # no borra el archivo viejo, no falla nada (try/except lo
            # traga) — solo queda una imagen huérfana en Cloudinary, sin
            # impacto funcional para la app.
            with contextlib.suppress(Exception):
                cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        return

    if not url.startswith(public_path_prefix):
        return
    filename = url.rsplit("/", 1)[-1]
    ruta = os.path.join(_directorio_local(carpeta), filename)
    if os.path.isfile(ruta):
        with contextlib.suppress(OSError):
            os.remove(ruta)


# ─── Archivos PRIVADOS (comprobantes de pago) ────────────────────────────────
# Con Cloudinary: se suben con type="authenticated" (Cloudinary no los sirve
# por URL pública; solo con una URL firmada de corta vida que genera este
# backend) y quedan guardados aunque Render reinicie el contenedor -- en
# disco local se perdían en cada despliegue. Sin Cloudinary (desarrollo): en
# disco, fuera de la ruta pública (ver bloquear_archivos_privados en main.py).
PREFIJO_PRIVADO_CLOUDINARY = "privado:cloudinary:"


def guardar_archivo_privado(
    contenido: bytes, carpeta: str, extension: str, directorio_local: str, prefijo_local: str
) -> str:
    """Guarda un archivo privado y devuelve la referencia a guardar en la BD:
    "privado:cloudinary:<tipo>:<formato>:<public_id>" o "<prefijo_local>/<archivo>"."""
    identificador = uuid.uuid4().hex
    if CLOUDINARY_CONFIGURADO:
        resultado = cloudinary.uploader.upload(
            contenido,
            folder=f"alectours/privado/{carpeta}",
            public_id=identificador,
            resource_type="auto",
            type="authenticated",
            overwrite=False,
        )
        formato = resultado.get("format") or extension
        return f"{PREFIJO_PRIVADO_CLOUDINARY}{resultado['resource_type']}:{formato}:{resultado['public_id']}"
    os.makedirs(directorio_local, exist_ok=True)
    nombre = f"{identificador}.{extension}"
    with open(os.path.join(directorio_local, nombre), "wb") as f:
        f.write(contenido)
    return f"{prefijo_local}/{nombre}"


def es_privado_cloudinary(referencia: str | None) -> bool:
    return bool(referencia) and referencia.startswith(PREFIJO_PRIVADO_CLOUDINARY)


def _partes_privado(referencia: str) -> tuple[str, str, str]:
    tipo, formato, public_id = referencia[len(PREFIJO_PRIVADO_CLOUDINARY) :].split(":", 2)
    return tipo, formato, public_id


def url_firmada_privada(referencia: str, segundos: int = 120) -> str:
    """URL de descarga firmada que vence en `segundos` (no se cachea)."""
    import time

    import cloudinary.utils

    tipo, formato, public_id = _partes_privado(referencia)
    return cloudinary.utils.private_download_url(
        public_id, formato, resource_type=tipo, type="authenticated", expires_at=int(time.time()) + segundos
    )


def leer_archivo_privado(referencia: str) -> tuple[bytes, str]:
    """Descarga desde Cloudinary un archivo privado (el backend hace de
    intermediario: el navegador nunca ve la URL firmada). Devuelve
    (contenido, extensión)."""
    import urllib.request

    _, formato, _ = _partes_privado(referencia)
    with urllib.request.urlopen(url_firmada_privada(referencia), timeout=20) as respuesta:  # noqa: S310 -- URL firmada propia de Cloudinary
        return respuesta.read(), formato


def borrar_archivo_privado(referencia: str) -> None:
    if not es_privado_cloudinary(referencia):
        return
    tipo, _, public_id = _partes_privado(referencia)
    with contextlib.suppress(Exception):
        cloudinary.uploader.destroy(public_id, resource_type=tipo, type="authenticated")
