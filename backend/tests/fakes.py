"""Dobles de prueba compartidos por la suite del backend.

RedisEnMemoria (un *fake*): implementación real pero simplificada de las
pocas operaciones de Redis que usa la app (caché de listados, límite de
intentos del middleware de seguridad, candado de idempotencia del chat).
Se agregó en la semana 4 del bootcamp: los tests usaban el Redis REAL que
encontraran (el del CI o el de docker compose del desarrollador), así que
un listado cacheado por un test, o por la app de desarrollo, se colaba en
otro test, y el límite de 5 logins por minuto los tumbaba con 429 según el
orden. Con este fake cada test arranca con un Redis vacío y propio.
"""

import fnmatch
import time


class RedisEnMemoria:
    def __init__(self):
        self._datos = {}
        self._vence = {}

    def _vivo(self, clave):
        vence = self._vence.get(clave)
        if vence is not None and time.monotonic() >= vence:
            self._datos.pop(clave, None)
            self._vence.pop(clave, None)
        return clave in self._datos

    def get(self, clave):
        return self._datos.get(clave) if self._vivo(clave) else None

    def set(self, clave, valor, ex=None, nx=False):
        if nx and self._vivo(clave):
            return None
        self._datos[clave] = valor if isinstance(valor, str) else str(valor)
        if ex:
            self._vence[clave] = time.monotonic() + ex
        return True

    def delete(self, *claves):
        borradas = 0
        for clave in claves:
            if self._datos.pop(clave, None) is not None:
                borradas += 1
            self._vence.pop(clave, None)
        return borradas

    def incr(self, clave):
        valor = int(self.get(clave) or 0) + 1
        self._datos[clave] = str(valor)
        return valor

    def expire(self, clave, segundos):
        if self._vivo(clave):
            self._vence[clave] = time.monotonic() + segundos
            return True
        return False

    def keys(self, patron="*"):
        return [c for c in list(self._datos) if self._vivo(c) and fnmatch.fnmatchcase(c, patron)]

    def scan_iter(self, match="*"):
        yield from self.keys(match)
