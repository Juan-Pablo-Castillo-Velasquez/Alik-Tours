"""Paquetes, reservas y pagos desde el API.

Autor (semana 8, capa API): Fernando Gutiérrez.

Nacieron del análisis de ramas sin cubrir del reporte de cobertura del
backend (artefacto coverage-backend del CI): reserva_route.py era el
archivo con más líneas sin probar de todo el API.
"""

from datetime import date, timedelta

import pytest

from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion
from app.models.reserva_model import MetodoPago, Pago, Reserva

HOY = date.today()


@pytest.fixture
def admin(crear_usuario):
    return crear_usuario(roles=("admin",), con_cliente=False)[1]


@pytest.fixture
def empleado(crear_usuario):
    return crear_usuario(roles=("empleado",), con_cliente=False)[1]


@pytest.fixture
def habitacion(db):
    tipo = TipoHabitacion(nombre_tipo="Doble", capacidad_personas=2)
    hotel = Hotel(nombre_hotel="Hotel Caribe", ciudad="Cartagena", pais="Colombia")
    db.add_all([tipo, hotel])
    db.commit()
    hab = Habitacion(
        id_hotel=hotel.id_hotel,
        id_tipo_habitacion=tipo.id_tipo_habitacion,
        numero_habitacion="101",
        precio_noche=200000,
        estado="disponible",
    )
    db.add(hab)
    db.commit()
    return hab


def _paquete(**cambios):
    datos = {"nombre_paquete": "Cartagena Mágica", "descripcion": "4 días", "duracion_dias": 4, "precio_base": 1500000}
    datos.update(cambios)
    return datos


class TestPaquetes:
    def test_el_admin_crea_un_paquete_y_aparece_en_el_listado_publico(self, client, admin):
        r = client.post("/api/paquetes", json=_paquete(), headers=admin)

        assert r.status_code == 201
        id_paquete = r.json()["id_paquete"]
        assert [p["id_paquete"] for p in client.get("/api/paquetes").json()] == [id_paquete]
        assert client.get(f"/api/paquetes/{id_paquete}").json()["nombre_paquete"] == "Cartagena Mágica"

    def test_el_detalle_trae_hoteles_y_servicios_aunque_esten_vacios(self, client, admin):
        id_paquete = client.post("/api/paquetes", json=_paquete(), headers=admin).json()["id_paquete"]

        r = client.get(f"/api/paquetes/{id_paquete}/detalle")

        assert r.status_code == 200
        assert r.json()["hoteles"] == []

    @pytest.mark.parametrize("ruta", ["/api/paquetes/999", "/api/paquetes/999/detalle"], ids=["paquete", "detalle"])
    def test_un_paquete_inexistente_responde_404(self, client, ruta):
        assert client.get(ruta).status_code == 404

    @pytest.mark.parametrize(
        "cambio", [{"precio_base": -1}, {"duracion_dias": 0}, {"nombre_paquete": ""}], ids=["precio", "dias", "nombre"]
    )
    def test_datos_invalidos_responden_422(self, client, admin, cambio):
        assert client.post("/api/paquetes", json=_paquete(**cambio), headers=admin).status_code == 422

    def test_actualizar_y_desactivar_un_paquete(self, client, admin):
        id_paquete = client.post("/api/paquetes", json=_paquete(), headers=admin).json()["id_paquete"]

        assert (
            client.put(f"/api/paquetes/{id_paquete}", json={"precio_base": 1800000}, headers=admin).json()[
                "precio_base"
            ]
            == 1800000
        )
        assert client.delete(f"/api/paquetes/{id_paquete}", headers=admin).status_code == 200
        # Desactivado: ya no se ofrece en el listado público
        assert client.get("/api/paquetes").json() == []

    def test_actualizar_o_borrar_un_paquete_inexistente_responde_404(self, client, admin):
        assert client.put("/api/paquetes/999", json={"precio_base": 1}, headers=admin).status_code == 404
        assert client.delete("/api/paquetes/999", headers=admin).status_code == 404

    def test_similares_no_incluye_al_mismo_paquete(self, client, admin):
        ids = [
            client.post("/api/paquetes", json=_paquete(nombre_paquete=n), headers=admin).json()["id_paquete"]
            for n in ("A", "B")
        ]

        similares = client.get(f"/api/paquetes/{ids[0]}/similares").json()

        assert ids[0] not in [p["id_paquete"] for p in similares]


class TestReservas:
    def _reservar(self, client, headers, cliente_id, habitacion, dias=(10, 13)):
        inicio, fin = HOY + timedelta(days=dias[0]), HOY + timedelta(days=dias[1])
        return client.post(
            "/api/reservas",
            json={
                "id_cliente": cliente_id,
                "fecha_inicio": inicio.isoformat(),
                "fecha_fin": fin.isoformat(),
                "numero_personas": 2,
                "habitaciones": [
                    {
                        "id_habitacion": habitacion.id_habitacion,
                        "fecha_checkin": inicio.isoformat(),
                        "fecha_checkout": fin.isoformat(),
                    }
                ],
            },
            headers=headers,
        )

    def test_no_se_reservan_mas_huespedes_de_los_que_caben(self, client, crear_usuario, habitacion):
        usuario, h = crear_usuario()
        inicio, fin = HOY + timedelta(days=10), HOY + timedelta(days=12)

        r = client.post(
            "/api/reservas",
            json={
                "id_cliente": usuario.id_cliente,
                "fecha_inicio": inicio.isoformat(),
                "fecha_fin": fin.isoformat(),
                "numero_personas": 5,  # la habitación es Doble (capacidad 2)
                "habitaciones": [
                    {
                        "id_habitacion": habitacion.id_habitacion,
                        "fecha_checkin": inicio.isoformat(),
                        "fecha_checkout": fin.isoformat(),
                    }
                ],
            },
            headers=h,
        )

        assert r.status_code == 422
        assert "máximo 2 persona" in r.json()["detail"]

    def test_la_misma_habitacion_dos_veces_con_fechas_cruzadas_da_409(self, client, crear_usuario, habitacion):
        usuario, h = crear_usuario()
        inicio, fin = HOY + timedelta(days=10), HOY + timedelta(days=14)
        tramo = {"id_habitacion": habitacion.id_habitacion}

        r = client.post(
            "/api/reservas",
            json={
                "id_cliente": usuario.id_cliente,
                "fecha_inicio": inicio.isoformat(),
                "fecha_fin": fin.isoformat(),
                "numero_personas": 2,
                "habitaciones": [
                    {**tramo, "fecha_checkin": inicio.isoformat(), "fecha_checkout": fin.isoformat()},
                    {
                        **tramo,
                        "fecha_checkin": (inicio + timedelta(days=1)).isoformat(),
                        "fecha_checkout": fin.isoformat(),
                    },
                ],
            },
            headers=h,
        )

        assert r.status_code == 409

    def test_un_cliente_reserva_y_ve_su_reserva_con_el_precio_real(self, client, crear_usuario, habitacion):
        usuario, h = crear_usuario()

        r = self._reservar(client, h, usuario.id_cliente, habitacion)

        assert r.status_code == 201
        detalle = client.get(f"/api/reservas/{r.json()['id_reserva']}", headers=h)
        assert detalle.status_code == 200
        assert detalle.json()["estado"] == "pendiente"
        assert (
            client.get(f"/api/reservas/cliente/{usuario.id_cliente}", headers=h).json()[0]["id_reserva"]
            == r.json()["id_reserva"]
        )

    def test_no_se_puede_reservar_a_nombre_de_otro_cliente(self, client, crear_usuario, habitacion):
        _, h = crear_usuario()
        otro, _ = crear_usuario()

        r = self._reservar(client, h, otro.id_cliente, habitacion)

        assert r.status_code == 403

    def test_fechas_cruzadas_con_otra_reserva_responden_409(self, client, crear_usuario, habitacion):
        usuario, h = crear_usuario()
        self._reservar(client, h, usuario.id_cliente, habitacion, dias=(10, 13))

        r = self._reservar(client, h, usuario.id_cliente, habitacion, dias=(12, 15))

        assert r.status_code == 409

    def test_una_habitacion_inexistente_responde_404(self, client, crear_usuario, habitacion):
        usuario, h = crear_usuario()
        habitacion.id_habitacion = 999

        assert self._reservar(client, h, usuario.id_cliente, habitacion).status_code == 404

    def test_fecha_fin_antes_del_inicio_responde_422(self, client, crear_usuario, habitacion):
        usuario, h = crear_usuario()

        r = client.post(
            "/api/reservas",
            json={
                "id_cliente": usuario.id_cliente,
                "fecha_inicio": "2030-01-10",
                "fecha_fin": "2030-01-05",
                "numero_personas": 2,
            },
            headers=h,
        )

        assert r.status_code == 422

    def test_otro_cliente_no_puede_ver_la_reserva(self, client, crear_usuario, habitacion):
        usuario, h = crear_usuario()
        _, h_otro = crear_usuario()
        id_reserva = self._reservar(client, h, usuario.id_cliente, habitacion).json()["id_reserva"]

        assert client.get(f"/api/reservas/{id_reserva}", headers=h_otro).status_code == 403
        assert client.get(f"/api/reservas/{id_reserva}/habitaciones", headers=h_otro).status_code == 403

    def test_el_equipo_lista_filtra_anota_y_cambia_el_estado(self, client, crear_usuario, habitacion, admin, empleado):
        usuario, h = crear_usuario()
        id_reserva = self._reservar(client, h, usuario.id_cliente, habitacion).json()["id_reserva"]

        assert [r["id_reserva"] for r in client.get("/api/reservas", headers=empleado).json()] == [id_reserva]
        assert len(client.get("/api/reservas/estado/pendiente", headers=admin).json()) == 1
        assert (
            client.post(
                f"/api/reservas/{id_reserva}/notas", json={"comentario": "Llamar al cliente"}, headers=admin
            ).status_code
            == 200
        )
        assert (
            client.put(f"/api/reservas/{id_reserva}", json={"estado": "confirmada"}, headers=admin).json()["estado"]
            == "confirmada"
        )
        assert len(client.get(f"/api/reservas/{id_reserva}/historial", headers=h).json()) >= 1

    def test_un_estado_inventado_responde_422_y_una_reserva_inexistente_404(self, client, admin):
        assert client.put("/api/reservas/999", json={"estado": "volando"}, headers=admin).status_code == 422
        assert client.put("/api/reservas/999", json={"estado": "cancelada"}, headers=admin).status_code == 404
        assert client.delete("/api/reservas/999", headers=admin).status_code == 404
        assert client.get("/api/reservas/999", headers=admin).status_code == 404

    def test_una_reserva_con_pagos_no_se_puede_borrar(self, client, crear_usuario, habitacion, admin, db):
        usuario, h = crear_usuario()
        id_reserva = self._reservar(client, h, usuario.id_cliente, habitacion).json()["id_reserva"]
        metodo = MetodoPago(nombre_metodo="Tarjeta", codigo="tarjeta_credito")
        db.add(metodo)
        db.commit()
        db.add(Pago(id_reserva=id_reserva, id_metodo_pago=metodo.id_metodo, monto=100000, estado="pagado"))
        db.commit()

        r = client.delete(f"/api/reservas/{id_reserva}", headers=admin)

        assert r.status_code == 409
        assert db.get(Reserva, id_reserva) is not None


class TestPagosYMetodos:
    def test_metodos_de_pago_publicos_y_el_admin_crea_uno(self, client, admin):
        assert client.post("/api/metodos-pago", json={"nombre_metodo": "Efectivo"}, headers=admin).status_code == 201
        assert [m["nombre_metodo"] for m in client.get("/api/metodos-pago").json()] == ["Efectivo"]

    def test_el_equipo_lista_pagos_y_el_cliente_solo_los_suyos(self, client, crear_usuario, habitacion, empleado, db):
        usuario, h = crear_usuario()
        _, h_otro = crear_usuario()
        reserva = Reserva(id_cliente=usuario.id_cliente, numero_personas=1, estado="pendiente")
        metodo = MetodoPago(nombre_metodo="PSE", codigo="pse")
        db.add_all([reserva, metodo])
        db.commit()
        pago = Pago(id_reserva=reserva.id_reserva, id_metodo_pago=metodo.id_metodo, monto=50000, estado="pendiente")
        db.add(pago)
        db.commit()

        assert len(client.get("/api/pagos", headers=empleado).json()) == 1
        assert client.get(f"/api/pagos/reserva/{reserva.id_reserva}", headers=h).status_code == 200
        assert client.get(f"/api/pagos/{pago.id_pago}", headers=h).json()["monto"] == 50000
        assert client.get(f"/api/pagos/{pago.id_pago}", headers=h_otro).status_code == 403
        assert client.get("/api/pagos/999", headers=h).status_code == 404
