import json
import logging
import os

import redis

logger = logging.getLogger(__name__)

# Sin timeouts explícitos, una intermitencia de red hacia Redis (el REDIS_URL
# de producción apunta a Upstash, un servicio externo, no un contenedor en
# la misma red que Render) podía dejar CUALQUIER llamada a get_cached/
# set_cached colgada por mucho tiempo -- y como prácticamente todos los
# endpoints públicos pasan por aquí (dashboard, hoteles, temas, banners,
# promociones, reseñas), eso se sentía como "toda la página va lenta" en
# vez de solo una consulta puntual.
redis_client = redis.Redis.from_url(
    os.getenv("REDIS_URL", "redis://redis:6379/0"),
    decode_responses=True,
    socket_connect_timeout=2,
    socket_timeout=2,
)


def get_cached(key: str):
    """Nunca deja caer una petición por un problema de Redis: si el caché
    no responde a tiempo (o está caído), se trata igual que un cache miss
    -- quien llama sigue su camino normal a la base de datos, en vez de
    que el error se propague y tumbe el endpoint entero."""
    try:
        data = redis_client.get(key)
    except redis.exceptions.RedisError:
        logger.warning("Redis no disponible al leer '%s' -- se sigue sin caché", key)
        return None
    return json.loads(data) if data else None


def set_cached(key: str, value, ttl_seconds: int = 600):
    """Guardar en caché es una optimización, no un requisito -- si falla,
    la respuesta ya se sirvió bien desde la base de datos, así que no vale
    la pena romper la petición por esto."""
    try:
        redis_client.set(key, json.dumps(value), ex=ttl_seconds)
    except redis.exceptions.RedisError:
        logger.warning("Redis no disponible al escribir '%s' -- se sigue sin caché", key)


def delete_pattern(pattern: str):
    """Borra todas las keys que calcen con un patrón (ej. 'reservas:list:*').
    Usado para invalidar cachés de listados paginados de admin donde
    skip/limit (y a veces otro filtro) varían, así que no alcanza con
    borrar una sola key exacta como hace home:destacados."""
    try:
        for key in redis_client.scan_iter(match=pattern):
            redis_client.delete(key)
    except redis.exceptions.RedisError:
        logger.warning("Redis no disponible al invalidar '%s' -- el caché viejo expira solo por su TTL", pattern)


def reservar_clave_unica(key: str, ttl_seconds: int = 300) -> bool:
    """SET NX: True si la clave no existía (primera vez), False si ya
    estaba. Se usa como candado de idempotencia (ej. un mensaje de chat
    enviado dos veces por doble clic o reintento). Si Redis no responde
    devuelve True: la idempotencia es una defensa extra, nunca debe
    impedir la operación normal."""
    try:
        return bool(redis_client.set(key, "1", nx=True, ex=ttl_seconds))
    except Exception:
        return True
