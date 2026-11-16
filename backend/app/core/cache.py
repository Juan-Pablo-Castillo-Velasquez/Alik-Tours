"""Caché de dos niveles: memoria local del proceso (L1) + Redis (L2).

Por qué dos niveles: en producción Redis es Upstash, un servicio EXTERNO a
Render, así que cada get/set es un viaje de red (decenas de milisegundos) y,
si Upstash tiene una intermitencia, cada llamada esperaba el timeout
completo. Ahora:

- L1 (memoria del worker): responde en microsegundos los datos más pedidos
  (listado de hoteles, paquetes, vuelos, tema, banners...). Su TTL es corto
  (CACHE_LOCAL_TTL, 20 s por defecto) y nunca mayor que el TTL pedido, para
  que un cambio hecho desde el panel en OTRO worker se vea en segundos.
- L2 (Redis): compartido entre workers e instancias, con el TTL de cada
  endpoint.
- Cortocircuito: si Redis falla, se deja de intentar durante
  REDIS_REINTENTO_SEGUNDOS (30 s) en vez de pagar un timeout por petición.
  Mientras tanto la app sigue funcionando con L1 + base de datos.

Variables de entorno (todas opcionales):
- CACHE_ENABLED=false   apaga todo el caché (útil para depurar).
- CACHE_LOCAL_TTL=20    segundos máximos en memoria local (0 = sin L1).
- CACHE_LOCAL_MAX=500   máximo de claves en memoria local por worker.
- CACHE_TTL_FACTOR=1.0  multiplica todos los TTL (ej. 2 = el doble).
- REDIS_REINTENTO_SEGUNDOS=30
"""

import fnmatch
import json
import logging
import os
import threading
import time

import redis

logger = logging.getLogger(__name__)


def _env_float(nombre: str, defecto: float) -> float:
    try:
        return float(os.getenv(nombre, defecto))
    except ValueError:
        return defecto


CACHE_ENABLED = os.getenv("CACHE_ENABLED", "true").lower() not in ("0", "false", "no")
CACHE_LOCAL_TTL = _env_float("CACHE_LOCAL_TTL", 20)
CACHE_LOCAL_MAX = int(_env_float("CACHE_LOCAL_MAX", 500))
CACHE_TTL_FACTOR = max(_env_float("CACHE_TTL_FACTOR", 1.0), 0.0)
REDIS_REINTENTO_SEGUNDOS = _env_float("REDIS_REINTENTO_SEGUNDOS", 30)

# Sin timeouts explícitos, una intermitencia de red hacia Redis (Upstash)
# podía dejar cualquier llamada colgada. health_check_interval revisa la
# conexión antes de reusarla si lleva tiempo quieta (Upstash cierra las
# conexiones inactivas).
redis_client = redis.Redis.from_url(
    os.getenv("REDIS_URL", "redis://redis:6379/0"),
    decode_responses=True,
    socket_connect_timeout=2,
    socket_timeout=2,
    health_check_interval=30,
    retry_on_timeout=False,
)


# ----------------------------- L1: memoria local -----------------------------
_local: dict[str, tuple[float, object]] = {}
_local_lock = threading.Lock()


def _local_get(key: str):
    with _local_lock:
        item = _local.get(key)
        if item is None:
            return None
        vence, valor = item
        if time.monotonic() >= vence:
            _local.pop(key, None)
            return None
        return valor


def _local_set(key: str, valor, ttl: float) -> None:
    ttl = min(ttl, CACHE_LOCAL_TTL)
    if ttl <= 0:
        return
    with _local_lock:
        if len(_local) >= CACHE_LOCAL_MAX:
            # Primero lo vencido; si no alcanza, lo más próximo a vencer.
            ahora = time.monotonic()
            for k in [k for k, (v, _) in _local.items() if v <= ahora]:
                _local.pop(k, None)
            if len(_local) >= CACHE_LOCAL_MAX:
                for k, _ in sorted(_local.items(), key=lambda kv: kv[1][0])[: max(CACHE_LOCAL_MAX // 10, 1)]:
                    _local.pop(k, None)
        _local[key] = (time.monotonic() + ttl, valor)


def _local_delete_pattern(pattern: str) -> None:
    with _local_lock:
        for k in [k for k in _local if fnmatch.fnmatchcase(k, pattern)]:
            _local.pop(k, None)


def limpiar_cache_local() -> None:
    """Vacía L1 (lo usan los tests entre caso y caso)."""
    with _local_lock:
        _local.clear()


# ----------------------------- L2: Redis + cortocircuito -----------------------------
_redis_caido_hasta = 0.0


def _redis_disponible() -> bool:
    return time.monotonic() >= _redis_caido_hasta


def _marcar_redis_caido(operacion: str, key: str) -> None:
    global _redis_caido_hasta
    _redis_caido_hasta = time.monotonic() + REDIS_REINTENTO_SEGUNDOS
    logger.warning(
        "Redis no disponible al %s '%s' -- se sigue sin Redis por %ss", operacion, key, int(REDIS_REINTENTO_SEGUNDOS)
    )


def reiniciar_estado_redis() -> None:
    """Olvida un fallo anterior de Redis (tests)."""
    global _redis_caido_hasta
    _redis_caido_hasta = 0.0


def ttl_efectivo(ttl_seconds: float) -> int:
    return max(int(ttl_seconds * CACHE_TTL_FACTOR), 0)


def get_cached(key: str):
    """Nunca deja caer una petición por un problema de caché: un fallo se
    trata igual que un cache miss y quien llama va a la base de datos."""
    if not CACHE_ENABLED:
        return None
    valor = _local_get(key)
    if valor is not None:
        return valor
    if not _redis_disponible():
        return None
    try:
        data = redis_client.get(key)
        if data:
            valor = json.loads(data)
            # Sin pedir el TTL restante a Redis (sería otro viaje de red): en
            # el peor caso L1 sirve el dato CACHE_LOCAL_TTL segundos de más.
            _local_set(key, valor, CACHE_LOCAL_TTL)
            return valor
    except redis.exceptions.RedisError:
        _marcar_redis_caido("leer", key)
    return None


def set_cached(key: str, value, ttl_seconds: int = 600):
    """Guardar en caché es una optimización: si falla, la respuesta ya se
    sirvió bien desde la base de datos."""
    if not CACHE_ENABLED:
        return
    ttl = ttl_efectivo(ttl_seconds)
    if ttl <= 0:
        return
    _local_set(key, value, ttl)
    if not _redis_disponible():
        return
    try:
        redis_client.set(key, json.dumps(value), ex=ttl)
    except redis.exceptions.RedisError:
        _marcar_redis_caido("escribir", key)


def delete_pattern(pattern: str):
    """Borra todas las keys que calcen con un patrón (ej. 'reservas:list:*'),
    en memoria local y en Redis. Si Redis no responde, lo viejo expira solo
    por su TTL."""
    _local_delete_pattern(pattern)
    if not _redis_disponible():
        return
    try:
        claves = list(redis_client.scan_iter(match=pattern, count=500))
        if claves:
            redis_client.delete(*claves)
    except redis.exceptions.RedisError:
        _marcar_redis_caido("invalidar", pattern)


def reservar_clave_unica(key: str, ttl_seconds: int = 300) -> bool:
    """SET NX: True si la clave no existía (primera vez), False si ya
    estaba. Se usa como candado de idempotencia. Si Redis no responde
    devuelve True: la idempotencia es una defensa extra, nunca debe
    impedir la operación normal."""
    try:
        return bool(redis_client.set(key, "1", nx=True, ex=ttl_seconds))
    except Exception:
        return True
