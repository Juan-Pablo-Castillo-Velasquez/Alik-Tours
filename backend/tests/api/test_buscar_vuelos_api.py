"""GET /api/vuelos/buscar: el buscador público de /vuelos.

Coincidencias sin tildes ni mayúsculas, filtros de trayecto, escalas y
precio, orden por precio, total para paginar y facetas para los filtros."""

from datetime import date, timedelta

import pytest

from tests.api.test_ecosistema_reservas_api import SALIDA
from tests.api.test_ecosistema_reservas_api import _oferta as _oferta_base


def _oferta(client, admin, **extra):
    """Ofertas que se venden solas (las de paquete no salen en el buscador)."""
    return _oferta_base(client, admin, **{"venta_independiente": True, **extra})


@pytest.fixture
def admin(crear_usuario):
    return crear_usuario(roles=("admin",), con_cliente=False)[1]


@pytest.fixture
def ofertas(client, admin):
    _oferta(
        client,
        admin,
        titulo="Bogotá - San Andrés",
        destino_ciudad="San Andrés",
        destino_iata="ADZ",
        aerolinea="Avianca",
        precio_adulto=780000,
        escalas=0,
    )
    _oferta(
        client,
        admin,
        titulo="Medellín - Cartagena",
        origen_ciudad="Medellín",
        origen_iata="MDE",
        aerolinea="LATAM",
        precio_adulto=520000,
        escalas=1,
    )
    _oferta(
        client,
        admin,
        titulo="Bogotá - Cartagena solo ida",
        aerolinea="Wingo",
        precio_adulto=249000,
        escalas=0,
        tipo_trayecto="solo_ida",
        fecha_regreso=None,
    )
    # No aparecen: borrador y una que ya salió.
    _oferta(client, admin, titulo="Borrador", estado="borrador")
    _oferta(client, admin, titulo="Solo en paquete", venta_independiente=False)


def _buscar(client, **params):
    r = client.get("/api/vuelos/buscar", params=params)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.usefixtures("ofertas")
class TestBuscarVuelos:
    def test_sin_tildes_ni_mayusculas(self, client):
        assert [o["destino_ciudad"] for o in _buscar(client, destino="san andres")["items"]] == ["San Andrés"]
        assert {o["titulo"] for o in _buscar(client, origen="MEDELLIN")["items"]} == {"Medellín - Cartagena"}
        assert _buscar(client, destino="ctg")["total"] == 2

    def test_texto_libre_busca_aerolinea_ciudad_y_codigo(self, client):
        assert [o["aerolinea"] for o in _buscar(client, q="wingo")["items"]] == ["Wingo"]
        assert _buscar(client, q="adz")["total"] == 1
        assert _buscar(client, q="cartagena")["total"] == 2

    def test_filtros_de_trayecto_escalas_y_precio(self, client):
        assert [o["titulo"] for o in _buscar(client, trayecto="solo_ida")["items"]] == ["Bogotá - Cartagena solo ida"]
        assert _buscar(client, solo_directos="true")["total"] == 2
        assert {o["titulo"] for o in _buscar(client, precio_max=600000)["items"]} == {
            "Medellín - Cartagena",
            "Bogotá - Cartagena solo ida",
        }

    def test_orden_por_precio_y_paginacion(self, client):
        d = _buscar(client, orden="precio", por_pagina=2)
        assert d["total"] == 3 and len(d["items"]) == 2
        assert [o["precio_adulto"] for o in d["items"]] == [249000, 520000]
        assert [o["precio_adulto"] for o in _buscar(client, orden="precio_desc")["items"]][0] == 780000
        assert len(_buscar(client, orden="precio", por_pagina=2, pagina=2)["items"]) == 1

    def test_facetas_de_lo_publicado(self, client):
        f = _buscar(client, destino="san andres")["facetas"]
        assert {a["nombre"] for a in f["aerolineas"]} == {"Avianca", "LATAM", "Wingo"}
        assert {d["nombre"]: d["total"] for d in f["destinos"]} == {"Cartagena": 2, "San Andrés": 1}
        assert (f["precio_min"], f["precio_max"]) == (249000, 780000)

    def test_rango_de_fechas_invalido(self, client):
        hoy = date.today()
        r = client.get(
            "/api/vuelos/buscar",
            params={"fecha_desde": str(hoy + timedelta(days=5)), "fecha_hasta": str(hoy)},
        )
        assert r.status_code == 422

    def test_sin_resultados(self, client):
        d = _buscar(client, destino="tokio", fecha_desde=str(SALIDA))
        assert d["total"] == 0 and d["items"] == []
