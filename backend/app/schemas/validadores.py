"""
Validaciones de entrada compartidas por varios esquemas (auditoría oct-2026).

FechaValida: fecha con año entre 1900 y 2100. Python ya rechaza años de
5 cifras, pero aceptaba cosas como 0001-01-01 o 9999-12-31 que no tienen
sentido en una reserva, un nacimiento o una temporada. Solo se usa en los
esquemas de ENTRADA (Create/Update): las respuestas siguen leyendo los
registros históricos tal como están.

Celular: obligatorio en el registro de clientes. Acepta un móvil
colombiano (10 dígitos empezando por 3) o un número internacional con
"+" y código de país (8 a 15 dígitos). Se normaliza quitando espacios,
guiones, puntos y paréntesis.
"""

import re
from datetime import date
from typing import Annotated

from pydantic import AfterValidator, BeforeValidator

ANIO_MIN = 1900
ANIO_MAX = 2100


def _validar_fecha(v: date) -> date:
    if not (ANIO_MIN <= v.year <= ANIO_MAX):
        raise ValueError(f"La fecha debe tener un año entre {ANIO_MIN} y {ANIO_MAX}")
    return v


FechaValida = Annotated[date, AfterValidator(_validar_fecha)]

_CELULAR_CO = re.compile(r"^3\d{9}$")
_CELULAR_INTL = re.compile(r"^\+\d{8,15}$")
MENSAJE_CELULAR = (
    "Ingresa un celular válido: 10 dígitos que empiecen por 3 (ej. 3001234567) "
    "o un número internacional con + y código de país"
)


def normalizar_celular(v: object) -> object:
    if isinstance(v, str):
        v = re.sub(r"[\s\-\.\(\)]", "", v)
        if v.startswith("+57") and _CELULAR_CO.match(v[3:]):
            v = v[3:]
    return v


def _validar_celular(v: str) -> str:
    if not (_CELULAR_CO.match(v) or _CELULAR_INTL.match(v)):
        raise ValueError(MENSAJE_CELULAR)
    return v


Celular = Annotated[str, BeforeValidator(normalizar_celular), AfterValidator(_validar_celular)]
