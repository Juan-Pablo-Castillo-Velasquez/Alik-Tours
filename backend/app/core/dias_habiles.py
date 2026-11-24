"""Días hábiles en Colombia, para los plazos de las PQR.

En Colombia los plazos de respuesta de peticiones, quejas y reclamos se
cuentan en días hábiles: no cuentan sábados, domingos ni festivos. Los
festivos salen de la Ley 51 de 1983 ("Ley Emiliani"), que traslada varios
al lunes siguiente, más los que dependen de la Semana Santa.

No se usa ninguna librería externa: el cálculo es corto, no cambia y así
la imagen de Docker no depende de un paquete más.
"""

from datetime import UTC, date, datetime, timedelta, timezone
from functools import lru_cache

# Colombia no tiene horario de verano: UTC-5 todo el año.
ZONA_COLOMBIA = timezone(timedelta(hours=-5), "America/Bogota")

# Fijos: no se mueven.
_FIJOS = [(1, 1), (5, 1), (7, 20), (8, 7), (12, 8), (12, 25)]
# Se trasladan al lunes siguiente si no caen en lunes (Ley 51 de 1983).
_TRASLADABLES = [(1, 6), (3, 19), (6, 29), (8, 15), (10, 12), (11, 1), (11, 11)]


def domingo_de_pascua(anio: int) -> date:
    """Domingo de Pascua (algoritmo gregoriano anónimo, Meeus/Jones/Butcher)."""
    a = anio % 19
    b, c = divmod(anio, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l_ = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l_) // 451
    mes = (h + l_ - 7 * m + 114) // 31
    dia = (h + l_ - 7 * m + 114) % 31 + 1
    return date(anio, mes, dia)


def _al_lunes(d: date) -> date:
    return d + timedelta(days=(7 - d.weekday()) % 7)


@lru_cache(maxsize=64)
def festivos_colombia(anio: int) -> frozenset[date]:
    """Los 18 festivos nacionales de Colombia de ese año."""
    festivos = {date(anio, m, d) for m, d in _FIJOS}
    festivos |= {_al_lunes(date(anio, m, d)) for m, d in _TRASLADABLES}
    pascua = domingo_de_pascua(anio)
    festivos.add(pascua - timedelta(days=3))  # Jueves Santo
    festivos.add(pascua - timedelta(days=2))  # Viernes Santo
    festivos.add(_al_lunes(pascua + timedelta(days=39)))  # Ascensión del Señor
    festivos.add(_al_lunes(pascua + timedelta(days=60)))  # Corpus Christi
    festivos.add(_al_lunes(pascua + timedelta(days=68)))  # Sagrado Corazón
    return frozenset(festivos)


def es_dia_habil(d: date) -> bool:
    return d.weekday() < 5 and d not in festivos_colombia(d.year)


def sumar_dias_habiles(desde: date, dias: int) -> date:
    """Último día del plazo: el término empieza a correr el día hábil
    SIGUIENTE a `desde` (el día de recibo no cuenta) y se cuentan `dias`
    días hábiles."""
    actual = desde
    contados = 0
    while contados < dias:
        actual += timedelta(days=1)
        if es_dia_habil(actual):
            contados += 1
    return actual


def restar_dias_habiles(hasta: date, dias: int) -> date:
    """Inverso de sumar_dias_habiles: el día desde el que, sumando `dias`
    días hábiles, se llega a `hasta` (o a un día hábil anterior)."""
    actual = hasta
    contados = 0
    while contados < dias:
        if es_dia_habil(actual):
            contados += 1
        actual -= timedelta(days=1)
    return actual


def dias_habiles_entre(desde: date, hasta: date) -> int:
    """Días hábiles que quedan desde `desde` (exclusive) hasta `hasta`
    (inclusive). Negativo si `hasta` ya pasó: cuántos días hábiles de mora."""
    if hasta == desde:
        return 0
    signo = 1 if hasta > desde else -1
    inicio, fin = (desde, hasta) if signo == 1 else (hasta, desde)
    n = 0
    actual = inicio
    while actual < fin:
        actual += timedelta(days=1)
        if es_dia_habil(actual):
            n += 1
    return n * signo


def hoy_colombia(ahora: datetime | None = None) -> date:
    ahora = ahora or datetime.now(UTC)
    if ahora.tzinfo is None:
        ahora = ahora.replace(tzinfo=UTC)
    return ahora.astimezone(ZONA_COLOMBIA).date()
