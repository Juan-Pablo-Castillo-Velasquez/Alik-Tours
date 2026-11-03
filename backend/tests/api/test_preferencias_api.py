"""Preferencias de viaje y sugerencias personalizadas.

Autor (semana 8, capa API): Fernando Gutiérrez. Tercer archivo nacido del
análisis de ramas sin cubrir (preferencias_route.py).
"""

import pytest

from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion
from app.models.reserva_model import Paquete


def _preferencia(id_cliente, **cambios):
    datos = {
        "id_cliente": id_cliente,
        "intereses": ["playa"],
        "presupuesto": "mid",
        "ritmo": "relax",
        "clima": "calido",
    }
    datos.update(cambios)
    return datos


@pytest.fixture
def cliente(crear_usuario):
    return crear_usuario()


class TestGuardarPreferencias:
    def test_el_cliente_guarda_y_consulta_sus_preferencias(self, client, cliente):
        usuario, h = cliente

        creada = client.post("/api/preferencias-cliente/", json=_preferencia(usuario.id_cliente), headers=h)
        leida = client.get(f"/api/preferencias-cliente/{usuario.id_cliente}", headers=h)

        assert creada.status_code == 201
        assert leida.json()["intereses"] == ["playa"]

    def test_guardar_de_nuevo_actualiza_en_vez_de_duplicar(self, client, cliente):
        usuario, h = cliente
        client.post("/api/preferencias-cliente/", json=_preferencia(usuario.id_cliente), headers=h)

        client.post("/api/preferencias-cliente/", json=_preferencia(usuario.id_cliente, ritmo="active"), headers=h)

        assert client.get(f"/api/preferencias-cliente/{usuario.id_cliente}", headers=h).json()["ritmo"] == "active"

    def test_no_se_guardan_preferencias_a_nombre_de_otro(self, client, cliente, crear_usuario):
        _, h = cliente
        otro, _ = crear_usuario()

        assert (
            client.post("/api/preferencias-cliente/", json=_preferencia(otro.id_cliente), headers=h).status_code == 403
        )

    def test_una_cuenta_sin_perfil_debe_completarlo_primero(self, client, crear_usuario):
        _, h = crear_usuario(con_cliente=False)

        r = client.post("/api/preferencias-cliente/", json=_preferencia(1), headers=h)

        assert r.status_code == 400

    def test_sin_preferencias_guardadas_responde_404(self, client, cliente):
        usuario, h = cliente

        assert client.get(f"/api/preferencias-cliente/{usuario.id_cliente}", headers=h).status_code == 404
        assert client.get(f"/api/preferencias-cliente/{usuario.id_cliente}/sugerencias", headers=h).status_code == 404


class TestSugerencias:
    @pytest.fixture
    def catalogo(self, db):
        db.add_all(
            [
                Paquete(nombre_paquete="Relax en Santa Marta", duracion_dias=6, precio_base=1_500_000, activo=True),
                Paquete(nombre_paquete="Aventura express", duracion_dias=2, precio_base=9_000_000, activo=True),
                Paquete(nombre_paquete="Inactivo", duracion_dias=5, precio_base=1_000_000, activo=False),
            ]
        )
        tipo = TipoHabitacion(nombre_tipo="Doble", capacidad_personas=2)
        hotel = Hotel(nombre_hotel="Hotel Playa", ciudad="Santa Marta", calificacion=5)
        db.add_all([tipo, hotel])
        db.commit()
        db.add(
            Habitacion(
                id_hotel=hotel.id_hotel,
                id_tipo_habitacion=tipo.id_tipo_habitacion,
                numero_habitacion="1",
                precio_noche=300000,
                estado="disponible",
            )
        )
        db.commit()

    def test_sugiere_paquetes_activos_ordenados_por_afinidad(self, client, cliente, catalogo):
        usuario, h = cliente
        client.post("/api/preferencias-cliente/", json=_preferencia(usuario.id_cliente), headers=h)

        r = client.get(f"/api/preferencias-cliente/{usuario.id_cliente}/sugerencias", headers=h)

        assert r.status_code == 200
        nombres = [p["nombre_paquete"] for p in r.json()]
        assert "Inactivo" not in nombres
        assert nombres[0] == "Relax en Santa Marta"  # ritmo relax + duración larga

    def test_sugiere_hoteles_con_disponibilidad(self, client, cliente, catalogo):
        usuario, h = cliente
        client.post("/api/preferencias-cliente/", json=_preferencia(usuario.id_cliente), headers=h)

        r = client.get(f"/api/preferencias-cliente/{usuario.id_cliente}/sugerencias-hoteles", headers=h)

        assert r.status_code == 200
        assert [x["nombre_hotel"] for x in r.json()] == ["Hotel Playa"]

    def test_nadie_ve_las_sugerencias_de_otro_cliente(self, client, cliente, crear_usuario):
        _, h = cliente
        otro, _ = crear_usuario()

        assert client.get(f"/api/preferencias-cliente/{otro.id_cliente}/sugerencias", headers=h).status_code == 403
        assert (
            client.get(f"/api/preferencias-cliente/{otro.id_cliente}/sugerencias-hoteles", headers=h).status_code == 403
        )
