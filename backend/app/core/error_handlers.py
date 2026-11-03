"""Manejador de errores global de la API.

Antes vivía embebido en app/main.py, entre el registro de CORS y los dos
middlewares HTTP -- se separa acá (junto con app/middlewares/, ver ese
paquete) para que main.py quede como el punto donde se arma la app, no
donde vive la lógica de cada pieza.
"""

import logging
import re

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.cors import VERCEL_PREVIEW_REGEX, get_cors_origins, get_extra_cors_origins

logger = logging.getLogger(__name__)


async def global_exception_handler(request: Request, exc: Exception):
    """Captura cualquier excepción no controlada por una ruta. El
    traceback completo queda en los logs del servidor (exc_info=True); al
    cliente solo se le devuelve un mensaje genérico -- antes se incluía
    str(exc) también en la respuesta HTTP ("error_message"), lo que
    filtraba detalles internos (nombres de constraints de la BD, rutas del
    servidor, etc.) a cualquiera que llamara la API."""
    logger.error(f"Error no controlado en {request.url.path}: {str(exc)}", exc_info=True)
    # Solo los orígenes reales de CORS_ORIGINS (no los fijos de
    # localhost/desarrollo) — este fallback solo aplica cuando la petición
    # no trae header Origin (no es una llamada CORS de navegador), y en
    # ese caso interesa el dominio real de producción, no localhost.
    origenes_reales = get_extra_cors_origins()
    # Hallazgo de seguridad (bootcamp, semana 4): antes se devolvía el
    # Origin de la petición TAL CUAL, junto con Allow-Credentials: true, a
    # cualquier sitio. Ahora solo se repite si es un origen permitido (los
    # mismos de CORSMiddleware); si no, se responde con el origen real.
    origen = request.headers.get("origin")
    permitido = origen and (origen in get_cors_origins() or re.fullmatch(VERCEL_PREVIEW_REGEX, origen))
    origen_respuesta = origen if permitido else (origenes_reales[0] if origenes_reales else "http://localhost:5173")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Error interno del servidor. Revisa los logs del servidor para ver el detalle.",
        },
        headers={
            "Access-Control-Allow-Origin": origen_respuesta,
            "Access-Control-Allow-Credentials": "true",
        },
    )
