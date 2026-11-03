"""Validaciones de entrada compartidas (app/schemas/validadores.py).

Autor (semana 2, capa API): Fernando Gutiérrez.

FechaValida y Celular se usan en los esquemas de registro de clientes y de
reservas: si la regla falla, entran fechas imposibles o celulares que el
asesor no puede llamar.
"""

from datetime import date

import pytest
from pydantic import BaseModel, ValidationError

from app.schemas.validadores import MENSAJE_CELULAR, Celular, FechaValida, normalizar_celular


class _ConFecha(BaseModel):
    fecha: FechaValida


class _ConCelular(BaseModel):
    celular: Celular


class TestFechaValida:
    @pytest.mark.parametrize("anio", [1900, 1901, 2026, 2099, 2100])
    def test_acepta_anios_dentro_del_rango(self, anio):
        assert _ConFecha(fecha=date(anio, 1, 1)).fecha.year == anio

    @pytest.mark.parametrize("anio", [1, 1899, 2101, 9999])
    def test_rechaza_anios_fuera_del_rango(self, anio):
        with pytest.raises(ValidationError, match="año entre 1900 y 2100"):
            _ConFecha(fecha=date(anio, 12, 31))


class TestCelular:
    @pytest.mark.parametrize(
        ("escrito", "guardado"),
        [
            ("3001234567", "3001234567"),
            ("300 123 4567", "3001234567"),
            ("(300) 123-45.67", "3001234567"),
            ("+57 300 123 4567", "3001234567"),  # se quita el +57 de un móvil colombiano
            ("+1 202 555 0143", "+12025550143"),  # internacional se conserva
        ],
    )
    def test_normaliza_y_acepta_celulares_validos(self, escrito, guardado):
        assert _ConCelular(celular=escrito).celular == guardado

    @pytest.mark.parametrize("escrito", ["300123456", "30012345678", "2001234567", "+1234567", "+1234567890123456", ""])
    def test_rechaza_celulares_invalidos_con_el_mensaje_de_la_interfaz(self, escrito):
        with pytest.raises(ValidationError) as exc:
            _ConCelular(celular=escrito)

        assert MENSAJE_CELULAR in str(exc.value)

    def test_normalizar_no_toca_valores_que_no_son_texto(self):
        assert normalizar_celular(3001234567) == 3001234567
