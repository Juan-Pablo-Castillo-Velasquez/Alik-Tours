"""Búsqueda de texto sin distinguir tildes ni mayúsculas.

PostgreSQL compara "Medellín" y "medellin" como textos distintos (ILIKE solo
ignora mayúsculas). En lugar de exigir la extensión `unaccent`, se quita la
tilde con `translate()` (nativa en PostgreSQL; en las pruebas con SQLite se
registra una función equivalente en tests/conftest.py) tanto en la columna
como en lo que escribe la persona.
"""

from sqlalchemy import func, or_

CON_TILDE = "áéíóúüñàèìòùâêîôûÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛ"
SIN_TILDE = "aeiouunaeiouaeiouaeiouunaeiouaeiou"


def normalizar_texto(texto: str) -> str:
    return texto.strip().lower().translate(str.maketrans(CON_TILDE, SIN_TILDE))


def columna_normalizada(columna):
    return func.translate(func.lower(func.coalesce(columna, "")), CON_TILDE, SIN_TILDE)


def coincide(texto: str, *columnas):
    """Condición OR: alguna columna contiene `texto`, sin tildes ni mayúsculas."""
    patron = f"%{normalizar_texto(texto)}%"
    return or_(*[columna_normalizada(c).like(patron) for c in columnas])
