"""El simulador IoT (iot/simulador_traslado.py) genera lecturas que el
backend acepta: se validan contra el mismo esquema que usa la API."""

import importlib.util
from pathlib import Path

import pytest

from app.schemas.iot_schema import LecturaIoTEntrada

RUTA = Path(__file__).resolve().parents[3] / "iot" / "simulador_traslado.py"


@pytest.fixture(scope="module")
def simulador():
    spec = importlib.util.spec_from_file_location("simulador_traslado", RUTA)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


@pytest.mark.parametrize("calor", [False, True])
def test_lecturas_del_simulador_cumplen_el_esquema(simulador, calor):
    lecturas = list(simulador.generar_lecturas(20, calor=calor))
    assert len(lecturas) == 20
    for lectura in lecturas:
        LecturaIoTEntrada.model_validate(lectura)
    temperaturas = [x["temperatura_c"] for x in lecturas]
    assert (min(temperaturas) > 28) if calor else (max(temperaturas) <= 28)


def test_recorrido_empieza_en_el_aeropuerto_y_termina_en_el_centro(simulador):
    lecturas = list(simulador.generar_lecturas(10))
    assert abs(lecturas[0]["latitud"] - simulador.RUTA[0][0]) < 0.001
    assert abs(lecturas[-1]["longitud"] - simulador.RUTA[-1][1]) < 0.001
