"""Ecosistema de reservas: escenarios A-H del documento de la fase de
vuelos, hoteles, paquetes y reservas.

Cada prueba recorre un flujo completo desde el API (admin configura,
cliente cotiza y reserva) y verifica el total calculado en el backend,
que lo incluido no se cobre dos veces y que los cupos no se pasen.
"""

from datetime import date, timedelta

import pytest

from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion
from app.models.reserva_model import MetodoPago, Reserva

HOY = date.today()
SALIDA = HOY + timedelta(days=30)


@pytest.fixture
def admin(crear_usuario):
    return crear_usuario(roles=("admin",), con_cliente=False)[1]


@pytest.fixture
def hotel_con_habitacion(db):
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
    return hotel, hab


def _oferta(client, admin, **extra):
    datos = {
        "titulo": "Bogotá - Cartagena temporada",
        "origen_ciudad": "Bogotá",
        "origen_iata": "bog",
        "destino_ciudad": "Cartagena",
        "destino_iata": "CTG",
        "fecha_salida": str(SALIDA),
        "fecha_regreso": str(SALIDA + timedelta(days=3)),
        "precio_adulto": 450000,
        "precio_nino": 300000,
        "estado": "publicada",
        "cupos": 3,
        **extra,
    }
    r = client.post("/api/vuelos", json=datos, headers=admin)
    assert r.status_code == 201, r.text
    return r.json()


def _paquete(client, admin, **extra):
    datos = {
        "nombre_paquete": "Cartagena 4 días / 3 noches",
        "duracion_dias": 4,
        "noches": 3,
        "precio_base": 1200000,
        **extra,
    }
    r = client.post("/api/paquetes", json=datos, headers=admin)
    assert r.status_code == 201, r.text
    return r.json()


def _viajero(tipo="adulto", n=1, **extra):
    return {
        "tipo": tipo,
        "nombres": f"Viajero{n}",
        "apellidos": "Prueba",
        "fecha_nacimiento": "1990-01-01" if tipo == "adulto" else "2018-01-01",
        "tipo_documento": "CC",
        "numero_documento": f"10203040{n}",
        **extra,
    }


def _reservar(client, h, id_cliente, **seleccion):
    return client.post("/api/reservas", json={"id_cliente": id_cliente, **seleccion}, headers=h)


class TestVuelosAdmin:
    def test_crear_listar_filtrar_y_publicar(self, client, admin):
        oferta = _oferta(client, admin, estado="borrador", aerolinea="Avianca")
        assert oferta["origen_iata"] == "BOG"  # se normaliza
        assert client.get("/api/vuelos").json() == []  # borrador no es público

        r = client.patch(f"/api/vuelos/{oferta['id_oferta']}/estado", json={"estado": "publicada"}, headers=admin)
        assert r.status_code == 200
        publicas = client.get("/api/vuelos", params={"destino": "ctg"}).json()
        assert [o["id_oferta"] for o in publicas] == [oferta["id_oferta"]]
        assert publicas[0]["cupos_disponibles"] == 3

        pagina = client.get("/api/vuelos/admin", params={"aerolinea": "avi", "por_pagina": 5}, headers=admin).json()
        assert pagina["total"] == 1 and pagina["items"][0]["reservas_activas"] == 0

    def test_validaciones_de_la_oferta(self, client, admin):
        base = {"titulo": "X ruta", "origen_ciudad": "Bogotá", "destino_ciudad": "Cali", "precio_adulto": 1}
        sin_regreso = {**base, "fecha_salida": str(SALIDA)}
        assert client.post("/api/vuelos", json=sin_regreso, headers=admin).status_code == 422
        iata_mala = {**sin_regreso, "tipo_trayecto": "solo_ida", "origen_iata": "BO1"}
        assert client.post("/api/vuelos", json=iata_mala, headers=admin).status_code == 422
        regreso_antes = {**sin_regreso, "fecha_regreso": str(SALIDA - timedelta(days=1))}
        assert client.post("/api/vuelos", json=regreso_antes, headers=admin).status_code == 422

    def test_un_cliente_no_puede_crear_ofertas(self, client, crear_usuario):
        _, h = crear_usuario()
        r = client.post(
            "/api/vuelos",
            json={
                "titulo": "Ruta",
                "origen_ciudad": "A",
                "destino_ciudad": "B",
                "fecha_salida": str(SALIDA),
                "precio_adulto": 1,
            },
            headers=h,
        )
        assert r.status_code == 403

    def test_no_se_borra_una_oferta_asociada_a_un_paquete(self, client, admin):
        oferta = _oferta(client, admin)
        _paquete(client, admin, modalidad_vuelo="opcional", vuelos=[oferta["id_oferta"]])
        assert client.delete(f"/api/vuelos/{oferta['id_oferta']}", headers=admin).status_code == 409


class TestEscenarioA_HotelIndependiente:
    def test_hotel_cotiza_reserva_y_paga(self, client, crear_usuario, hotel_con_habitacion, db):
        _, hab = hotel_con_habitacion
        usuario, h = crear_usuario()
        seleccion = {
            "tipo_producto": "hotel",
            "adultos": 2,
            "habitaciones": [
                {
                    "id_habitacion": hab.id_habitacion,
                    "fecha_checkin": str(SALIDA),
                    "fecha_checkout": str(SALIDA + timedelta(days=3)),
                }
            ],
        }
        cot = client.post("/api/reservas/cotizar", json=seleccion).json()
        assert cot["total"] == 600000 and cot["noches"] == 3

        r = _reservar(client, h, usuario.id_cliente, **seleccion, precio_esperado=600000)
        assert r.status_code == 201, r.text
        reserva = r.json()
        assert reserva["precio_total"] == 600000 and reserva["tipo_producto"] == "hotel"

        metodo = MetodoPago(nombre_metodo="Tarjeta", codigo="tarjeta_credito")
        db.add(metodo)
        db.commit()
        pago = client.post(
            f"/api/reservas/{reserva['id_reserva']}/pagar",
            json={"id_metodo_pago": metodo.id_metodo, "ultimos4": "4242"},
            headers=h,
        )
        assert pago.status_code == 200, pago.text
        assert pago.json()["pago"]["monto"] == 600000

    def test_mas_huespedes_que_capacidad_responde_422(self, client, crear_usuario, hotel_con_habitacion):
        _, hab = hotel_con_habitacion
        usuario, h = crear_usuario()
        r = _reservar(
            client,
            h,
            usuario.id_cliente,
            tipo_producto="hotel",
            adultos=3,
            habitaciones=[
                {
                    "id_habitacion": hab.id_habitacion,
                    "fecha_checkin": str(SALIDA),
                    "fecha_checkout": str(SALIDA + timedelta(days=1)),
                }
            ],
        )
        assert r.status_code == 422


class TestEscenarioB_PaqueteSinVueloNiHotel:
    def test_paquete_solo_actividades_con_ninos(self, client, crear_usuario, admin):
        paquete = _paquete(
            client,
            admin,
            precio_nino=800000,
            itinerario=[{"dia": 1, "titulo": "Llegada"}, {"dia": 2, "titulo": "City tour"}],
            inclusiones=[
                {"tipo": "incluye", "categoria": "guia", "descripcion": "Guía bilingüe"},
                {"tipo": "no_incluye", "categoria": "gastos_personales", "descripcion": "Gastos personales"},
            ],
        )
        detalle = client.get(f"/api/paquetes/{paquete['id_paquete']}/detalle").json()
        assert [d["titulo"] for d in detalle["itinerario"]] == ["Llegada", "City tour"]
        assert detalle["modalidad_alojamiento"] == "sin" and detalle["modalidad_vuelo"] == "sin"

        usuario, h = crear_usuario()
        r = _reservar(
            client,
            h,
            usuario.id_cliente,
            tipo_producto="paquete",
            id_paquete=paquete["id_paquete"],
            fecha_inicio=str(SALIDA),
            adultos=2,
            ninos=1,
        )
        assert r.status_code == 201, r.text
        reserva = r.json()
        assert reserva["precio_total"] == 2 * 1200000 + 800000
        assert reserva["fecha_fin"] == str(SALIDA + timedelta(days=3))  # 3 noches

        detalle_reserva = client.get(f"/api/reservas/{reserva['id_reserva']}", headers=h).json()
        assert detalle_reserva["snapshot_producto"]["paquete"]["no_incluye"] == ["Gastos personales"]

    def test_no_se_pueden_agregar_habitaciones_ni_vuelo(self, client, crear_usuario, admin, hotel_con_habitacion):
        _, hab = hotel_con_habitacion
        paquete = _paquete(client, admin)
        usuario, h = crear_usuario()
        base = {"tipo_producto": "paquete", "id_paquete": paquete["id_paquete"], "fecha_inicio": str(SALIDA)}
        assert _reservar(client, h, usuario.id_cliente, **base, incluir_vuelo=True).status_code == 422
        con_hab = {
            **base,
            "habitaciones": [
                {
                    "id_habitacion": hab.id_habitacion,
                    "fecha_checkin": str(SALIDA),
                    "fecha_checkout": str(SALIDA + timedelta(days=1)),
                }
            ],
        }
        assert _reservar(client, h, usuario.id_cliente, **con_hab).status_code == 422

    def test_paquete_legado_sin_desglose_conserva_su_total(self, client, crear_usuario, db):
        # Reservas anteriores (sin conceptos) se siguen sumando como antes.
        usuario, h = crear_usuario()
        reserva = Reserva(
            id_cliente=usuario.id_cliente,
            numero_personas=1,
            estado="pendiente",
            fecha_inicio=SALIDA,
            fecha_fin=SALIDA + timedelta(days=1),
        )
        db.add(reserva)
        db.commit()
        assert client.get(f"/api/reservas/{reserva.id_reserva}", headers=h).json()["precio_total"] == 0


class TestEscenarioC_HotelIncluido:
    def test_alojamiento_incluido_no_se_cobra_dos_veces(self, client, crear_usuario, admin, hotel_con_habitacion):
        hotel, hab = hotel_con_habitacion
        paquete = _paquete(client, admin, hoteles=[{"id_hotel": hotel.id_hotel, "noches_incluidas": 3}])
        assert paquete["modalidad_alojamiento"] == "incluido"
        usuario, h = crear_usuario()
        seleccion = {
            "tipo_producto": "paquete",
            "id_paquete": paquete["id_paquete"],
            "fecha_inicio": str(SALIDA),
            "adultos": 2,
            "habitaciones": [
                {
                    "id_habitacion": hab.id_habitacion,
                    "fecha_checkin": str(SALIDA),
                    "fecha_checkout": str(SALIDA + timedelta(days=3)),
                }
            ],
        }
        cot = client.post("/api/reservas/cotizar", json=seleccion).json()
        assert cot["total"] == 2400000  # solo el paquete
        incluidos = [c for c in cot["conceptos"] if c["incluido"]]
        assert any("Hotel Caribe" in c["descripcion"] for c in incluidos)
        assert all(c["subtotal"] == 0 for c in incluidos)
        r = _reservar(client, h, usuario.id_cliente, **seleccion)
        assert r.status_code == 201 and r.json()["precio_total"] == 2400000


class TestEscenarioD_HotelOpcional:
    def test_el_cliente_elige_si_quiere_hotel(self, client, crear_usuario, admin, hotel_con_habitacion):
        hotel, hab = hotel_con_habitacion
        paquete = _paquete(client, admin, modalidad_alojamiento="opcional", hoteles=[{"id_hotel": hotel.id_hotel}])
        usuario, h = crear_usuario()
        base = {"tipo_producto": "paquete", "id_paquete": paquete["id_paquete"], "fecha_inicio": str(SALIDA)}
        sin_hotel = client.post("/api/reservas/cotizar", json=base).json()
        assert sin_hotel["total"] == 1200000
        con_hotel = {
            **base,
            "habitaciones": [
                {
                    "id_habitacion": hab.id_habitacion,
                    "fecha_checkin": str(SALIDA),
                    "fecha_checkout": str(SALIDA + timedelta(days=3)),
                }
            ],
        }
        assert client.post("/api/reservas/cotizar", json=con_hotel).json()["total"] == 1200000 + 3 * 200000
        r = _reservar(client, h, usuario.id_cliente, **con_hotel)
        assert r.status_code == 201 and r.json()["precio_total"] == 1800000

    def test_noches_fuera_del_paquete_responden_422(self, client, crear_usuario, admin, hotel_con_habitacion):
        hotel, hab = hotel_con_habitacion
        paquete = _paquete(client, admin, modalidad_alojamiento="opcional", hoteles=[{"id_hotel": hotel.id_hotel}])
        r = client.post(
            "/api/reservas/cotizar",
            json={
                "tipo_producto": "paquete",
                "id_paquete": paquete["id_paquete"],
                "fecha_inicio": str(SALIDA),
                "habitaciones": [
                    {
                        "id_habitacion": hab.id_habitacion,
                        "fecha_checkin": str(SALIDA),
                        "fecha_checkout": str(SALIDA + timedelta(days=9)),
                    }
                ],
            },
        )
        assert r.status_code == 422


class TestEscenarioE_VueloIncluido:
    def test_vuelo_incluido_va_en_cero_y_pide_pasajeros(self, client, crear_usuario, admin):
        oferta = _oferta(client, admin)
        paquete = _paquete(client, admin, modalidad_vuelo="incluido", vuelos=[oferta["id_oferta"]])
        usuario, h = crear_usuario()
        base = {
            "tipo_producto": "paquete",
            "id_paquete": paquete["id_paquete"],
            "fecha_inicio": str(SALIDA),
            "adultos": 2,
        }
        cot = client.post("/api/reservas/cotizar", json=base).json()
        assert cot["total"] == 2400000
        assert any(c["tipo"] == "vuelo_incluido" and c["subtotal"] == 0 for c in cot["conceptos"])

        sin_pasajeros = _reservar(client, h, usuario.id_cliente, **base)
        assert sin_pasajeros.status_code == 422  # el vuelo necesita los datos de todos
        r = _reservar(client, h, usuario.id_cliente, **base, viajeros=[_viajero(n=1, es_titular=True), _viajero(n=2)])
        assert r.status_code == 201, r.text
        assert r.json()["precio_total"] == 2400000 and r.json()["estado_vuelo"] == "incluido"

        # Al cliente se le devuelven los documentos enmascarados; al admin no.
        id_reserva = r.json()["id_reserva"]
        doc_cliente = client.get(f"/api/reservas/{id_reserva}", headers=h).json()["viajeros"][0]["numero_documento"]
        doc_admin = client.get(f"/api/reservas/{id_reserva}", headers=admin).json()["viajeros"][0]["numero_documento"]
        assert doc_cliente.endswith("0401") and "•" in doc_cliente
        assert doc_admin == "102030401"
        pasajeros = client.get(f"/api/vuelos/{oferta['id_oferta']}/pasajeros", headers=admin).json()
        assert len(pasajeros) == 2


class TestEscenarioF_VueloOpcional:
    def test_agregar_vuelo_suma_y_la_reserva_lo_conserva(self, client, crear_usuario, admin):
        oferta = _oferta(client, admin, cargos_adicionales=50000, impuestos_incluidos=False)
        paquete = _paquete(client, admin, modalidad_vuelo="opcional", vuelos=[oferta["id_oferta"]])
        usuario, h = crear_usuario()
        base = {
            "tipo_producto": "paquete",
            "id_paquete": paquete["id_paquete"],
            "fecha_inicio": str(SALIDA),
            "adultos": 1,
        }
        assert client.post("/api/reservas/cotizar", json=base).json()["total"] == 1200000
        con_vuelo = {**base, "incluir_vuelo": True}
        cot = client.post("/api/reservas/cotizar", json=con_vuelo).json()
        assert cot["total"] == 1200000 + 450000 + 50000
        assert any("NO incluye impuestos" in a for a in cot["advertencias"])
        r = _reservar(client, h, usuario.id_cliente, **con_vuelo, viajeros=[_viajero(es_titular=True)])
        assert r.status_code == 201, r.text
        assert r.json()["id_oferta_vuelo"] == oferta["id_oferta"] and r.json()["precio_total"] == 1700000

    def test_vuelo_sujeto_a_cotizacion_no_suma_hasta_que_la_agencia_confirma(self, client, crear_usuario, admin):
        paquete = _paquete(client, admin, modalidad_vuelo="cotizacion")
        usuario, h = crear_usuario()
        r = _reservar(
            client,
            h,
            usuario.id_cliente,
            tipo_producto="paquete",
            id_paquete=paquete["id_paquete"],
            fecha_inicio=str(SALIDA),
            incluir_vuelo=True,
        )
        assert r.status_code == 201 and r.json()["precio_total"] == 1200000
        assert r.json()["estado_vuelo"] == "cotizacion_pendiente"
        id_reserva = r.json()["id_reserva"]
        conf = client.post(
            f"/api/reservas/{id_reserva}/cotizacion-vuelo",
            json={"precio_total": 520000, "descripcion": "Avianca BOG-CTG ida y regreso"},
            headers=admin,
        )
        assert conf.status_code == 200, conf.text
        assert conf.json()["precio_total"] == 1720000 and conf.json()["estado_vuelo"] == "cotizado"
        # Solo una vez.
        otra = client.post(
            f"/api/reservas/{id_reserva}/cotizacion-vuelo",
            json={"precio_total": 1, "descripcion": "otra"},
            headers=admin,
        )
        assert otra.status_code == 409


class TestEscenarioG_ReservaAdministrativa:
    def test_el_admin_crea_con_descuento_notas_internas_y_queda_historial(self, client, crear_usuario, admin):
        paquete = _paquete(client, admin)
        cliente, h_cliente = crear_usuario()
        r = _reservar(
            client,
            admin,
            cliente.id_cliente,
            tipo_producto="paquete",
            id_paquete=paquete["id_paquete"],
            fecha_inicio=str(SALIDA),
            adultos=2,
            descuento={"monto": 100000, "motivo": "Cliente frecuente"},
            notas_internas="Llamar antes del viaje",
            solicitudes_especiales="Cama extra si es posible",
            estado_inicial="confirmada",
        )
        assert r.status_code == 201, r.text
        reserva = r.json()
        assert reserva["precio_total"] == 2300000 and reserva["estado"] == "confirmada"
        id_reserva = reserva["id_reserva"]
        assert (
            client.get(f"/api/reservas/{id_reserva}", headers=admin).json()["notas_internas"]
            == "Llamar antes del viaje"
        )
        assert client.get(f"/api/reservas/{id_reserva}", headers=h_cliente).json()["notas_internas"] is None
        historial = client.get(f"/api/reservas/{id_reserva}/historial", headers=admin).json()
        assert any("Cliente frecuente" in (x.get("comentarios") or "") for x in historial)

    def test_un_cliente_no_puede_ponerse_descuento(self, client, crear_usuario, admin):
        paquete = _paquete(client, admin)
        usuario, h = crear_usuario()
        r = _reservar(
            client,
            h,
            usuario.id_cliente,
            tipo_producto="paquete",
            id_paquete=paquete["id_paquete"],
            fecha_inicio=str(SALIDA),
            descuento={"monto": 1000, "motivo": "yo lo digo"},
        )
        assert r.status_code == 403

    def test_precio_congelado_y_transiciones_validas(self, client, crear_usuario, admin):
        paquete = _paquete(client, admin)
        usuario, h = crear_usuario()
        id_reserva = _reservar(
            client,
            h,
            usuario.id_cliente,
            tipo_producto="paquete",
            id_paquete=paquete["id_paquete"],
            fecha_inicio=str(SALIDA),
        ).json()["id_reserva"]
        # Subir el precio del paquete no cambia la reserva ya hecha.
        client.put(f"/api/paquetes/{paquete['id_paquete']}", json={"precio_base": 9999999}, headers=admin)
        assert client.get(f"/api/reservas/{id_reserva}", headers=h).json()["precio_total"] == 1200000
        # No se pueden cambiar fechas de una reserva con precio congelado.
        assert client.put(f"/api/reservas/{id_reserva}", json={"numero_personas": 5}, headers=admin).status_code == 409
        assert client.put(f"/api/reservas/{id_reserva}", json={"estado": "cancelada"}, headers=admin).status_code == 200
        assert (
            client.put(f"/api/reservas/{id_reserva}", json={"estado": "confirmada"}, headers=admin).status_code == 409
        )

    def test_precio_esperado_distinto_responde_409(self, client, crear_usuario, admin):
        paquete = _paquete(client, admin)
        usuario, h = crear_usuario()
        r = _reservar(
            client,
            h,
            usuario.id_cliente,
            tipo_producto="paquete",
            id_paquete=paquete["id_paquete"],
            fecha_inicio=str(SALIDA),
            precio_esperado=1000,
        )
        assert r.status_code == 409 and "cambió" in r.json()["detail"]


class TestEscenarioH_CuposEIntegridad:
    def test_cupos_de_salida_no_se_sobrevenden(self, client, crear_usuario, admin):
        paquete = _paquete(
            client,
            admin,
            salidas=[{"fecha_salida": str(SALIDA), "fecha_regreso": str(SALIDA + timedelta(days=3)), "cupos": 2}],
        )
        id_salida = client.get(f"/api/paquetes/{paquete['id_paquete']}/detalle").json()["salidas"][0]["id_salida"]
        u1, h1 = crear_usuario()
        u2, h2 = crear_usuario()
        base = {"tipo_producto": "paquete", "id_paquete": paquete["id_paquete"], "id_salida": id_salida}
        assert _reservar(client, h1, u1.id_cliente, **base, adultos=2).status_code == 201
        r = _reservar(client, h2, u2.id_cliente, **base, adultos=1)
        assert r.status_code == 409 and "Quedan 0" in r.json()["detail"]
        assert (
            client.get(f"/api/paquetes/{paquete['id_paquete']}/detalle").json()["salidas"][0]["cupos_disponibles"] == 0
        )

    def test_sillas_del_vuelo_no_se_sobrevenden(self, client, crear_usuario, admin):
        oferta = _oferta(client, admin, cupos=1, venta_independiente=True)
        u1, h1 = crear_usuario()
        u2, h2 = crear_usuario()
        base = {"tipo_producto": "vuelo", "id_oferta_vuelo": oferta["id_oferta"]}
        assert _reservar(client, h1, u1.id_cliente, **base, viajeros=[_viajero()]).status_code == 201
        assert _reservar(client, h2, u2.id_cliente, **base, viajeros=[_viajero()]).status_code == 409

    def test_la_ultima_habitacion_solo_la_toma_una_reserva(self, client, crear_usuario, hotel_con_habitacion):
        _, hab = hotel_con_habitacion
        u1, h1 = crear_usuario()
        u2, h2 = crear_usuario()
        sel = {
            "tipo_producto": "hotel",
            "habitaciones": [
                {
                    "id_habitacion": hab.id_habitacion,
                    "fecha_checkin": str(SALIDA),
                    "fecha_checkout": str(SALIDA + timedelta(days=2)),
                }
            ],
        }
        assert _reservar(client, h1, u1.id_cliente, **sel).status_code == 201
        assert _reservar(client, h2, u2.id_cliente, **sel).status_code == 409

    def test_vuelo_solo_en_paquete_no_se_vende_suelto(self, client, crear_usuario, admin):
        oferta = _oferta(client, admin)  # venta_independiente=False
        usuario, h = crear_usuario()
        r = _reservar(
            client,
            h,
            usuario.id_cliente,
            tipo_producto="vuelo",
            id_oferta_vuelo=oferta["id_oferta"],
            viajeros=[_viajero()],
        )
        assert r.status_code == 422

    def test_doble_envio_con_la_misma_clave_crea_una_sola_reserva(self, client, crear_usuario, admin, db):
        paquete = _paquete(client, admin)
        usuario, h = crear_usuario()
        sel = {
            "tipo_producto": "paquete",
            "id_paquete": paquete["id_paquete"],
            "fecha_inicio": str(SALIDA),
            "clave_idempotencia": "intento-abc-123",
        }
        a = _reservar(client, h, usuario.id_cliente, **sel).json()["id_reserva"]
        b = _reservar(client, h, usuario.id_cliente, **sel).json()["id_reserva"]
        assert a == b
        assert db.query(Reserva).filter(Reserva.id_cliente == usuario.id_cliente).count() == 1

    def test_coherencia_del_paquete(self, client, admin):
        r = client.post(
            "/api/paquetes",
            json={"nombre_paquete": "X", "precio_base": 1, "modalidad_vuelo": "opcional"},
            headers=admin,
        )
        assert r.status_code == 422 and "oferta aérea" in r.json()["detail"]
        r = client.post(
            "/api/paquetes",
            json={"nombre_paquete": "X", "precio_base": 1, "duracion_dias": 2, "noches": 5},
            headers=admin,
        )
        assert r.status_code == 422


class TestFichaCompletaDelHotel:
    def _hotel(self, client, admin, **extra):
        r = client.post(
            "/api/hoteles/",
            json={"nombre_hotel": "Hotel Mar", "ciudad": "Santa Marta", "pais": "Colombia", **extra},
            headers=admin,
        )
        assert r.status_code == 201, r.text
        return r.json()

    def test_ficha_politicas_y_servicios_con_estado(self, client, admin):
        h = self._hotel(
            client,
            admin,
            tipo_alojamiento="hotel",
            departamento="Magdalena",
            sitio_web="https://hotelmar.test",
            hora_checkin="15:00",
            hora_checkout="12:00",
            politica_mascotas="No se admiten",
            servicios=[
                {"nombre": "Wi-Fi", "estado": "incluido"},
                {"nombre": "Parqueadero", "estado": "de_pago", "nota": "$20.000 por noche"},
                {"nombre": "piscina", "estado": "no_disponible"},
            ],
        )
        detalle = client.get(f"/api/hoteles/{h['id_hotel']}").json()
        assert detalle["hora_checkin"] == "15:00:00" and detalle["departamento"] == "Magdalena"
        estados = {
            s["caracteristica"]["nombre_caracteristica"].lower(): s["estado"] for s in detalle["hotel_caracteristicas"]
        }
        assert estados == {"wi-fi": "incluido", "parqueadero": "de_pago", "piscina": "no_disponible"}

        # Editar: quitar un servicio (queda "no informado") y vaciar un dato.
        r = client.put(
            f"/api/hoteles/{h['id_hotel']}",
            json={"servicios": [{"nombre": "Wi-Fi", "estado": "incluido"}], "politica_mascotas": None},
            headers=admin,
        )
        assert r.status_code == 200
        detalle = client.get(f"/api/hoteles/{h['id_hotel']}").json()
        assert len(detalle["hotel_caracteristicas"]) == 1 and detalle["politica_mascotas"] is None

    def test_sitio_web_invalido_responde_422(self, client, admin):
        r = client.post("/api/hoteles/", json={"nombre_hotel": "X", "sitio_web": "hotel.com"}, headers=admin)
        assert r.status_code == 422

    def test_hotel_oculto_no_sale_al_publico_pero_si_al_panel(self, client, admin):
        h = self._hotel(client, admin, publicado=False)
        assert all(x["id_hotel"] != h["id_hotel"] for x in client.get("/api/hoteles/").json())
        assert client.get(f"/api/hoteles/{h['id_hotel']}").status_code == 404
        con_admin = client.get("/api/hoteles/", params={"todos": True}, headers=admin).json()
        assert any(x["id_hotel"] == h["id_hotel"] for x in con_admin)

    def test_habitacion_oculta_no_se_muestra_ni_se_reserva_en_linea(self, client, admin, crear_usuario, db):
        h = self._hotel(client, admin)
        tipo = TipoHabitacion(nombre_tipo="Doble", capacidad_personas=4)
        db.add(tipo)
        db.commit()
        hab = client.post(
            f"/api/hoteles/{h['id_hotel']}/habitaciones",
            json={
                "id_tipo_habitacion": tipo.id_tipo_habitacion,
                "numero_habitacion": "9",
                "precio_noche": 100000,
                "publicada": False,
                "capacidad_adultos": 2,
            },
            headers=admin,
        ).json()
        assert client.get(f"/api/hoteles/{h['id_hotel']}").json()["habitaciones"] == []
        usuario, hc = crear_usuario()
        sel = {
            "tipo_producto": "hotel",
            "adultos": 1,
            "habitaciones": [
                {
                    "id_habitacion": hab["id_habitacion"],
                    "fecha_checkin": str(SALIDA),
                    "fecha_checkout": str(SALIDA + timedelta(days=1)),
                }
            ],
        }
        assert _reservar(client, hc, usuario.id_cliente, **sel).status_code == 422
        # Publicada, pero con máximo 2 adultos: 3 adultos no caben.
        client.put(f"/api/hoteles/habitaciones/{hab['id_habitacion']}", json={"publicada": True}, headers=admin)
        assert _reservar(client, hc, usuario.id_cliente, **{**sel, "adultos": 3}).status_code == 422
        assert _reservar(client, hc, usuario.id_cliente, **{**sel, "adultos": 2}).status_code == 201
