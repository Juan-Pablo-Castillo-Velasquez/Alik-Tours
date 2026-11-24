"""Días hábiles y festivos de Colombia (plazos de las PQR)."""

from datetime import UTC, date, datetime

import pytest

from app.core.dias_habiles import (
    dias_habiles_entre,
    domingo_de_pascua,
    es_dia_habil,
    festivos_colombia,
    hoy_colombia,
    sumar_dias_habiles,
)

# Calendario oficial de festivos de Colombia 2026.
FESTIVOS_2026 = {
    date(2026, 1, 1),
    date(2026, 1, 12),
    date(2026, 3, 23),
    date(2026, 4, 2),
    date(2026, 4, 3),
    date(2026, 5, 1),
    date(2026, 5, 18),
    date(2026, 6, 8),
    date(2026, 6, 15),
    date(2026, 6, 29),
    date(2026, 7, 20),
    date(2026, 8, 7),
    date(2026, 8, 17),
    date(2026, 10, 12),
    date(2026, 11, 2),
    date(2026, 11, 16),
    date(2026, 12, 8),
    date(2026, 12, 25),
}


def test_festivos_2026_coinciden_con_el_calendario_oficial():
    assert festivos_colombia(2026) == FESTIVOS_2026


@pytest.mark.parametrize(
    "anio,pascua",
    [(2024, date(2024, 3, 31)), (2025, date(2025, 4, 20)), (2026, date(2026, 4, 5)), (2027, date(2027, 3, 28))],
)
def test_domingo_de_pascua(anio, pascua):
    assert domingo_de_pascua(anio) == pascua


def test_cada_anio_tiene_18_festivos_salvo_cuando_dos_coinciden():
    for anio in (2024, 2026, 2027, 2028):
        assert len(festivos_colombia(anio)) == 18
    # 2025: San Pedro y San Pablo y Sagrado Corazón cayeron ambos el lunes 30 de junio.
    assert len(festivos_colombia(2025)) == 17
    assert date(2025, 6, 30) in festivos_colombia(2025)


def test_fines_de_semana_y_festivos_no_son_habiles():
    assert not es_dia_habil(date(2026, 11, 21))  # sábado
    assert not es_dia_habil(date(2026, 11, 22))  # domingo
    assert not es_dia_habil(date(2026, 11, 16))  # festivo trasladado
    assert es_dia_habil(date(2026, 11, 24))


def test_el_dia_de_recibo_no_cuenta():
    # Lunes 23 nov 2026 + 1 día hábil = martes 24.
    assert sumar_dias_habiles(date(2026, 11, 23), 1) == date(2026, 11, 24)


def test_quince_dias_habiles_saltan_festivos_y_fines_de_semana():
    # Radicada el martes 24 nov 2026: el 8 de diciembre es festivo.
    assert sumar_dias_habiles(date(2026, 11, 24), 15) == date(2026, 12, 16)


def test_radicada_un_sabado_empieza_a_contar_el_lunes():
    assert sumar_dias_habiles(date(2026, 11, 21), 1) == date(2026, 11, 23)


def test_plazo_que_cruza_fin_de_anio():
    # 18 dic 2026 (viernes) + 10 hábiles: salta 25 dic y 1 ene.
    assert sumar_dias_habiles(date(2026, 12, 18), 10) == date(2027, 1, 5)


def test_dias_habiles_entre_cuenta_hacia_adelante_y_hacia_atras():
    assert dias_habiles_entre(date(2026, 11, 24), date(2026, 12, 16)) == 15
    assert dias_habiles_entre(date(2026, 12, 16), date(2026, 11, 24)) == -15
    assert dias_habiles_entre(date(2026, 11, 24), date(2026, 11, 24)) == 0


def test_hoy_colombia_usa_utc_menos_5():
    # 03:00 UTC del 25 nov = 22:00 del 24 nov en Bogotá.
    assert hoy_colombia(datetime(2026, 11, 25, 3, 0, tzinfo=UTC)) == date(2026, 11, 24)
    assert hoy_colombia(datetime(2026, 11, 25, 3, 0)) == date(2026, 11, 24)


def test_restar_dias_habiles_es_el_inverso_de_sumar():
    from app.core.dias_habiles import restar_dias_habiles

    # 16 dic 2026 menos 15 hábiles = 24 nov (salta el festivo del 8 de dic).
    assert restar_dias_habiles(date(2026, 12, 16), 15) == date(2026, 11, 24)
    for dias in (1, 5, 10, 30):
        inicio = restar_dias_habiles(date(2026, 11, 24), dias)
        assert sumar_dias_habiles(inicio, dias) == date(2026, 11, 24)
