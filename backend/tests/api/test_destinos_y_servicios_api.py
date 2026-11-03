"""Búsquedas y filtros de destinos y servicios (dependen de lo guardado).

Autor (semana 4, capa BD): Fernando Gutiérrez.
"""

import pytest

from app.models.servicio_model import CategoriaServicio


@pytest.fixture
def admin(crear_usuario):
    return crear_usuario(roles=("admin",), con_cliente=False)[1]


@pytest.fixture
def destinos(client, admin):
    datos = [
        {"nombre_destino": "Ciudad amurallada", "ciudad": "Cartagena", "pais": "Colombia"},
        {"nombre_destino": "Eje cafetero", "ciudad": "Salento", "pais": "Colombia"},
        {"nombre_destino": "Machu Picchu", "ciudad": "Cusco", "pais": "Perú"},
    ]
    return [client.post("/api/destinos/", json=d, headers=admin).json() for d in datos]


class TestDestinos:
    def test_el_listado_sale_ordenado_por_nombre(self, client, destinos):
        nombres = [d["nombre_destino"] for d in client.get("/api/destinos/").json()]

        assert nombres == ["Ciudad amurallada", "Eje cafetero", "Machu Picchu"]

    @pytest.mark.parametrize(
        ("q", "esperados"),
        [
            ("cartagena", ["Ciudad amurallada"]),
            ("COLOMBIA", ["Ciudad amurallada", "Eje cafetero"]),
            ("cafe", ["Eje cafetero"]),
            ("Lima", []),
        ],
    )
    def test_la_busqueda_filtra_por_nombre_ciudad_o_pais(self, client, destinos, q, esperados):
        assert [d["nombre_destino"] for d in client.get("/api/destinos/", params={"q": q}).json()] == esperados

    def test_las_sugerencias_respetan_el_limite(self, client, destinos):
        r = client.get("/api/destinos/sugerencias", params={"q": "o", "limit": 2})

        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_paginacion_con_skip_y_limit(self, client, destinos):
        assert [d["nombre_destino"] for d in client.get("/api/destinos/", params={"skip": 1, "limit": 1}).json()] == [
            "Eje cafetero"
        ]

    def test_consultar_actualizar_y_borrar(self, client, admin, destinos):
        id_destino = destinos[0]["id_destino"]

        assert client.get(f"/api/destinos/{id_destino}").json()["ciudad"] == "Cartagena"
        assert (
            client.put(f"/api/destinos/{id_destino}", json={"descripcion": "Murallas"}, headers=admin).json()[
                "descripcion"
            ]
            == "Murallas"
        )
        assert client.delete(f"/api/destinos/{id_destino}", headers=admin).status_code == 200
        assert client.get(f"/api/destinos/{id_destino}").status_code == 404

    def test_un_destino_inexistente_responde_404(self, client, admin):
        assert client.get("/api/destinos/999").status_code == 404
        assert client.put("/api/destinos/999", json={"descripcion": "x"}, headers=admin).status_code == 404
        assert client.delete("/api/destinos/999", headers=admin).status_code == 404


class TestServicios:
    @pytest.fixture
    def categoria(self, db):
        c = CategoriaServicio(nombre_categoria="Tours")
        db.add(c)
        db.commit()
        return c

    def test_filtra_por_destino_y_por_categoria(self, client, admin, destinos, categoria):
        cartagena, salento = destinos[0]["id_destino"], destinos[1]["id_destino"]
        base = {"precio_base": 90000, "capacidad_maxima": 10}
        client.post(
            "/api/servicios/",
            json={
                **base,
                "nombre_servicio": "Islas del Rosario",
                "id_destino": cartagena,
                "id_categoria": categoria.id_categoria,
            },
            headers=admin,
        )
        client.post(
            "/api/servicios/", json={**base, "nombre_servicio": "Valle de Cocora", "id_destino": salento}, headers=admin
        )

        por_destino = client.get("/api/servicios/", params={"id_destino": salento}).json()
        por_categoria = client.get("/api/servicios/", params={"id_categoria": categoria.id_categoria}).json()

        assert [s["nombre_servicio"] for s in por_destino] == ["Valle de Cocora"]
        assert [s["nombre_servicio"] for s in por_categoria] == ["Islas del Rosario"]
        assert [c["nombre_categoria"] for c in client.get("/api/servicios/categorias").json()] == ["Tours"]

    @pytest.mark.parametrize("cambio", [{"precio_base": -1}, {"capacidad_maxima": 0}], ids=["precio", "capacidad"])
    def test_precio_negativo_o_capacidad_cero_responden_422(self, client, admin, cambio):
        datos = {"nombre_servicio": "Tour", "precio_base": 1000, "capacidad_maxima": 5, **cambio}

        assert client.post("/api/servicios/", json=datos, headers=admin).status_code == 422

    def test_consultar_actualizar_y_borrar_un_servicio(self, client, admin):
        id_servicio = client.post(
            "/api/servicios/",
            json={"nombre_servicio": "Tour", "precio_base": 1000, "capacidad_maxima": 5},
            headers=admin,
        ).json()["id_servicio"]

        assert client.get(f"/api/servicios/{id_servicio}").json()["nombre_servicio"] == "Tour"
        assert (
            client.put(f"/api/servicios/{id_servicio}", json={"precio_base": 2000}, headers=admin).json()["precio_base"]
            == 2000
        )
        assert client.delete(f"/api/servicios/{id_servicio}", headers=admin).status_code == 200
        assert client.get(f"/api/servicios/{id_servicio}").status_code == 404
        assert client.put("/api/servicios/999", json={"precio_base": 1}, headers=admin).status_code == 404
        assert client.delete("/api/servicios/999", headers=admin).status_code == 404
