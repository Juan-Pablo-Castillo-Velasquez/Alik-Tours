"""Reseñas: el cliente edita o borra la suya, el equipo responde u oculta,
y el listado público filtra por estrellas y trae la distribución
(app/routes/resena_route.py)."""

import pytest

from app.models.hotel_model import Hotel
from app.models.notificacion_model import Notificacion
from app.models.resena_model import Resena
from app.models.reserva_model import Reserva


@pytest.fixture
def resena_de(db):
    """Crea una reseña del cliente del usuario dado (hotel + reserva propios)."""

    def _crear(usuario, calificacion=5, comentario="Excelente viaje, todo a tiempo."):
        hotel = Hotel(nombre_hotel="Hotel Playa", ciudad="Cartagena", pais="Colombia")
        db.add(hotel)
        db.commit()
        reserva = Reserva(id_cliente=usuario.id_cliente, numero_personas=2, estado="finalizada")
        db.add(reserva)
        db.commit()
        r = Resena(
            id_reserva=reserva.id_reserva,
            id_cliente=usuario.id_cliente,
            id_hotel=hotel.id_hotel,
            calificacion=calificacion,
            comentario=comentario,
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        return r

    return _crear


class TestElClienteGestionaSuResena:
    def test_edita_su_resena_y_queda_marcada_como_editada(self, client, crear_usuario, resena_de):
        usuario, headers = crear_usuario()
        r = resena_de(usuario, calificacion=3)

        resp = client.put(f"/api/resenas/{r.id_resena}", json={"calificacion": 4}, headers=headers)

        assert resp.status_code == 200
        assert resp.json()["calificacion"] == 4
        assert resp.json()["fecha_edicion"] is not None
        assert client.get("/api/resenas").json()["resenas"][0]["editada"] is True

    def test_no_puede_editar_la_de_otro(self, client, crear_usuario, resena_de):
        autor, _ = crear_usuario()
        _, otro = crear_usuario()
        r = resena_de(autor)

        assert client.put(f"/api/resenas/{r.id_resena}", json={"calificacion": 1}, headers=otro).status_code == 404
        assert client.delete(f"/api/resenas/{r.id_resena}", headers=otro).status_code == 404

    def test_editar_sin_cambios_responde_422(self, client, crear_usuario, resena_de):
        usuario, headers = crear_usuario()
        r = resena_de(usuario)
        assert client.put(f"/api/resenas/{r.id_resena}", json={}, headers=headers).status_code == 422

    def test_borra_su_resena(self, client, crear_usuario, resena_de, db):
        usuario, headers = crear_usuario()
        r = resena_de(usuario)

        assert client.delete(f"/api/resenas/{r.id_resena}", headers=headers).status_code == 200
        assert db.query(Resena).count() == 0

    def test_ve_sus_resenas_con_la_respuesta_de_la_agencia(self, client, crear_usuario, resena_de):
        usuario, headers = crear_usuario()
        _, staff = crear_usuario(roles=("empleado",), con_cliente=False)
        r = resena_de(usuario)
        client.put(f"/api/resenas/admin/{r.id_resena}/responder", json={"respuesta": "¡Gracias!"}, headers=staff)

        mias = client.get("/api/resenas/mias", headers=headers).json()

        assert [m["respuesta_agencia"] for m in mias] == ["¡Gracias!"]
        assert mias[0]["nombre_hotel"] == "Hotel Playa"


class TestElEquipoModera:
    def test_responder_avisa_al_cliente_y_sale_en_el_listado_publico(self, client, crear_usuario, resena_de, db):
        usuario, _ = crear_usuario()
        _, staff = crear_usuario(roles=("empleado",), con_cliente=False)
        r = resena_de(usuario)

        resp = client.put(
            f"/api/resenas/admin/{r.id_resena}/responder", json={"respuesta": "  Gracias por viajar  "}, headers=staff
        )

        assert resp.status_code == 200
        publica = client.get("/api/resenas").json()["resenas"][0]
        assert publica["respuesta"] == "Gracias por viajar"
        aviso = db.query(Notificacion).filter(Notificacion.id_cliente == usuario.id_cliente).one()
        assert aviso.titulo == "Alik Tours respondió tu reseña"

    def test_respuesta_vacia_la_quita(self, client, crear_usuario, resena_de):
        usuario, _ = crear_usuario()
        _, staff = crear_usuario(roles=("empleado",), con_cliente=False)
        r = resena_de(usuario)
        client.put(f"/api/resenas/admin/{r.id_resena}/responder", json={"respuesta": "Hola"}, headers=staff)

        resp = client.put(f"/api/resenas/admin/{r.id_resena}/responder", json={"respuesta": "  "}, headers=staff)

        assert resp.json()["respuesta_agencia"] is None
        assert resp.json()["fecha_respuesta"] is None

    def test_una_resena_oculta_no_sale_ni_cuenta_en_el_promedio(self, client, crear_usuario, resena_de):
        usuario, _ = crear_usuario()
        _, staff = crear_usuario(roles=("admin",), con_cliente=False)
        buena = resena_de(usuario, calificacion=5)
        mala = resena_de(usuario, calificacion=1, comentario="Spam spam spam spam spam")

        client.put(f"/api/resenas/admin/{mala.id_resena}/visibilidad", json={"visible": False}, headers=staff)

        listado = client.get("/api/resenas").json()
        assert [x["id"] for x in listado["resenas"]] == [buena.id_resena]
        assert listado["promedio"] == 5.0
        ocultas = client.get("/api/resenas/admin/todas?filtro=ocultas", headers=staff).json()
        assert [x["id_resena"] for x in ocultas] == [mala.id_resena]

    def test_filtro_sin_responder(self, client, crear_usuario, resena_de):
        usuario, _ = crear_usuario()
        _, staff = crear_usuario(roles=("empleado",), con_cliente=False)
        a = resena_de(usuario)
        b = resena_de(usuario, calificacion=2, comentario="Faltó puntualidad en el traslado.")
        client.put(f"/api/resenas/admin/{a.id_resena}/responder", json={"respuesta": "Gracias"}, headers=staff)

        pendientes = client.get("/api/resenas/admin/todas?filtro=sin_responder", headers=staff).json()
        bajas = client.get("/api/resenas/admin/todas?filtro=bajas", headers=staff).json()

        assert [x["id_resena"] for x in pendientes] == [b.id_resena]
        assert [x["id_resena"] for x in bajas] == [b.id_resena]

    def test_un_cliente_no_puede_moderar(self, client, crear_usuario, resena_de):
        usuario, headers = crear_usuario()
        r = resena_de(usuario)
        assert (
            client.put(
                f"/api/resenas/admin/{r.id_resena}/responder", json={"respuesta": "x"}, headers=headers
            ).status_code
            == 403
        )
        assert client.get("/api/resenas/admin/todas", headers=headers).status_code == 403


def test_listado_publico_filtra_por_estrellas_y_trae_la_distribucion(client, crear_usuario, resena_de):
    usuario, _ = crear_usuario()
    resena_de(usuario, calificacion=5)
    resena_de(usuario, calificacion=5)
    resena_de(usuario, calificacion=3)

    todas = client.get("/api/resenas").json()
    solo_cinco = client.get("/api/resenas?calificacion=5").json()

    assert todas["distribucion"] == {"1": 0, "2": 0, "3": 1, "4": 0, "5": 2}
    assert todas["total_global"] == 3
    assert solo_cinco["total"] == 2
    assert {x["rating"] for x in solo_cinco["resenas"]} == {5}
