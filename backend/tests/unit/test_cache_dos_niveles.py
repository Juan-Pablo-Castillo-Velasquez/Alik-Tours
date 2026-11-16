"""Caché de dos niveles (memoria local + Redis) con cortocircuito."""

import json

import redis

from app.core import cache


class RedisQueFalla:
    def __init__(self):
        self.llamadas = 0

    def _falla(self, *a, **k):
        self.llamadas += 1
        raise redis.exceptions.ConnectionError("caído")

    get = set = delete = _falla

    def scan_iter(self, *a, **k):
        self._falla()


def test_l1_responde_sin_ir_a_redis(redis_falso):
    cache.set_cached("hoteles:list:x", [{"id": 1}], ttl_seconds=120)
    redis_falso.delete("hoteles:list:x")  # aunque Redis ya no lo tenga...
    assert cache.get_cached("hoteles:list:x") == [{"id": 1}]  # ...L1 responde


def test_l2_alimenta_l1(redis_falso):
    redis_falso.set("paquetes:list:1", json.dumps({"a": 1}), ex=60)
    assert cache.get_cached("paquetes:list:1") == {"a": 1}
    redis_falso.delete("paquetes:list:1")
    assert cache.get_cached("paquetes:list:1") == {"a": 1}


def test_delete_pattern_limpia_ambos_niveles(redis_falso):
    cache.set_cached("hoteles:detalle:5", {"x": 1}, ttl_seconds=120)
    cache.set_cached("paquetes:detalle:5", {"y": 1}, ttl_seconds=120)
    cache.delete_pattern("hoteles:*")
    assert cache.get_cached("hoteles:detalle:5") is None
    assert redis_falso.get("hoteles:detalle:5") is None
    assert cache.get_cached("paquetes:detalle:5") == {"y": 1}


def test_cortocircuito_no_reintenta_redis_caido(monkeypatch):
    falso = RedisQueFalla()
    monkeypatch.setattr(cache, "redis_client", falso)
    assert cache.get_cached("a") is None
    assert falso.llamadas == 1
    # Mientras dura el cortocircuito no se vuelve a tocar Redis.
    assert cache.get_cached("b") is None
    cache.set_cached("c", 1, ttl_seconds=60)
    cache.delete_pattern("c*")
    assert falso.llamadas == 1
    # Y la memoria local sigue funcionando.
    cache.set_cached("d", {"ok": True}, ttl_seconds=60)
    assert cache.get_cached("d") == {"ok": True}


def test_cache_desactivado(monkeypatch, redis_falso):
    monkeypatch.setattr(cache, "CACHE_ENABLED", False)
    cache.set_cached("e", 1, ttl_seconds=60)
    assert cache.get_cached("e") is None
    assert redis_falso.get("e") is None
