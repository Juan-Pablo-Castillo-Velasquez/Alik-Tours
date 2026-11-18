"""GET /api/reservas/buscar: listado del panel paginado y filtrado en la BD.

Hallazgo de la auditoría de producción: un asesor solo veía en el panel las
reservas asignadas a él (el filtro era del frontend), así que el enlace a
una reserva desde el chat abría una tabla vacía. Ahora admin y asesores
consultan todas las reservas por este endpoint, con búsqueda y filtros.
"""

from datetime import date, timedelta

import pytest

from app.models.cliente_model import Cliente
from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion
from app.models.reserva_model import MetodoPago, Pago, Reserva, ReservaHabitacion


@pytest.fixture
def datos(db):
    hotel = Hotel(nombre_hotel="Hotel Caribe Azul", ciudad="Cartagena", pais="Colombia", calificacion=4)
    tipo = TipoHabitacion(nombre_tipo="Doble", capacidad_personas=2)
    db.add_all([hotel, tipo])
    db.commit()
    hab = Habitacion(
        id_hotel=hotel.id_hotel,
        id_tipo_habitacion=tipo.id_tipo_habitacion,
        numero_habitacion="101",
        precio_noche=200000,
        estado="disponible",
    )
    ana = Cliente(nombre="Ana", apellido="Ríos", cedula="52123456", correo="ana@test.com")
    luis = Cliente(nombre="Luis", apellido="Mora", cedula="80999888", correo="luis@test.com")
    metodo = MetodoPago(nombre_metodo="Nequi")
    db.add_all([hab, ana, luis, metodo])
    db.commit()
    hoy = date.today()
    reservas = []
    for i, (cliente, estado, empleado) in enumerate(
        [(ana, "pendiente", None), (ana, "confirmada", 7), (luis, "cancelada", None), (luis, "confirmada", 7)]
    ):
        r = Reserva(
            id_cliente=cliente.id_cliente,
            fecha_inicio=hoy + timedelta(days=10 * (i + 1)),
            fecha_fin=hoy + timedelta(days=10 * (i + 1) + 2),
            numero_personas=2,
            estado=estado,
            id_empleado=empleado,
            tipo_producto="hotel",
            canal_origen="web" if i % 2 == 0 else "telefono",
        )
        db.add(r)
        db.commit()
        db.add(
            ReservaHabitacion(
                id_reserva=r.id_reserva,
                id_habitacion=hab.id_habitacion,
                fecha_checkin=r.fecha_inicio,
                fecha_checkout=r.fecha_fin,
                precio_acordado=200000,
            )
        )
        reservas.append(r)
    db.add(Pago(id_reserva=reservas[1].id_reserva, id_metodo_pago=metodo.id_metodo, monto=400000, estado="pagado"))
    db.commit()
    return {"reservas": reservas, "ana": ana, "luis": luis}


@pytest.fixture
def asesor(crear_usuario):
    return crear_usuario(roles=("empleado",), con_cliente=False)[1]


def _buscar(client, headers, **params):
    r = client.get("/api/reservas/buscar", params=params, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_el_asesor_ve_todas_las_reservas_no_solo_las_suyas(client, asesor, datos):
    d = _buscar(client, asesor)
    assert d["total"] == 4
    assert d["conteos"] == {"pendiente": 1, "confirmada": 2, "cancelada": 1}
    # Lo más reciente primero, con los datos del cliente para la tabla.
    assert [i["id_reserva"] for i in d["items"]] == sorted((r.id_reserva for r in datos["reservas"]), reverse=True)
    assert d["items"][0]["cliente_nombre"] == "Luis Mora"


def test_un_cliente_no_puede_usar_el_listado_del_panel(client, crear_usuario, datos):
    _, cliente = crear_usuario()
    assert client.get("/api/reservas/buscar", headers=cliente).status_code == 403
    assert client.get("/api/reservas/buscar").status_code == 401


@pytest.mark.parametrize(
    ("q", "esperadas"),
    [("ana", 2), ("ríos", 2), ("52123456", 2), ("luis@test", 2), ("cartagena", 4), ("caribe azul", 4)],
)
def test_busqueda_por_cliente_documento_correo_y_destino(client, asesor, datos, q, esperadas):
    assert _buscar(client, asesor, q=q)["total"] == esperadas


def test_busqueda_por_codigo_de_reserva(client, asesor, datos):
    objetivo = datos["reservas"][2].id_reserva
    d = _buscar(client, asesor, q=f"#{objetivo}")
    assert objetivo in [i["id_reserva"] for i in d["items"]]


def test_filtros_combinados(client, asesor, datos):
    assert _buscar(client, asesor, estado="confirmada")["total"] == 2
    assert _buscar(client, asesor, estado="confirmada", id_empleado=7)["total"] == 2
    assert _buscar(client, asesor, sin_asesor="true")["total"] == 2
    assert _buscar(client, asesor, canal="telefono")["total"] == 2
    assert _buscar(client, asesor, estado_pago="pagado")["total"] == 1
    assert _buscar(client, asesor, tipo_producto="hotel")["total"] == 4
    assert _buscar(client, asesor, id_cliente=datos["ana"].id_cliente)["total"] == 2
    hoy = date.today()
    d = _buscar(client, asesor, fecha_desde=str(hoy + timedelta(days=15)), fecha_hasta=str(hoy + timedelta(days=35)))
    assert d["total"] == 2


def test_paginacion_real(client, asesor, datos):
    p1 = _buscar(client, asesor, por_pagina=3, pagina=1)
    p2 = _buscar(client, asesor, por_pagina=3, pagina=2)
    assert p1["total"] == p2["total"] == 4
    assert len(p1["items"]) == 3 and len(p2["items"]) == 1
    assert not {i["id_reserva"] for i in p1["items"]} & {i["id_reserva"] for i in p2["items"]}


def test_orden_por_fecha_de_viaje(client, asesor, datos):
    d = _buscar(client, asesor, orden="fechas", direccion="asc")
    fechas = [i["fecha_inicio"] for i in d["items"]]
    assert fechas == sorted(fechas)


@pytest.mark.parametrize(
    "params",
    [{"por_pagina": 101}, {"pagina": 0}, {"estado": "inventado"}, {"orden": "precio"}, {"q": "x" * 101}],
)
def test_parametros_invalidos(client, asesor, datos, params):
    assert client.get("/api/reservas/buscar", params=params, headers=asesor).status_code == 422


def test_rango_de_fechas_invertido(client, asesor, datos):
    r = client.get(
        "/api/reservas/buscar", params={"fecha_desde": "2027-02-01", "fecha_hasta": "2027-01-01"}, headers=asesor
    )
    assert r.status_code == 422


def test_el_asesor_puede_dejar_notas_internas(client, asesor, datos):
    id_reserva = datos["reservas"][0].id_reserva
    r = client.post(f"/api/reservas/{id_reserva}/notas", json={"comentario": "Llamé al cliente"}, headers=asesor)
    assert r.status_code in (200, 201), r.text


def test_el_asesor_ve_la_actividad_reciente(client, asesor, datos):
    assert client.get("/api/historial-reservas/recientes", headers=asesor).status_code == 200


def test_el_asesor_no_puede_cambiar_estado_ni_borrar(client, asesor, datos):
    id_reserva = datos["reservas"][0].id_reserva
    assert client.put(f"/api/reservas/{id_reserva}", json={"estado": "confirmada"}, headers=asesor).status_code == 403
    assert client.delete(f"/api/reservas/{id_reserva}", headers=asesor).status_code == 403


def test_totales_de_todo_el_resultado_filtrado(client, asesor, datos):
    # Cuatro reservas de hotel de 200.000; una cancelada (no suma), una pagada.
    d = _buscar(client, asesor, con_totales="true", por_pagina=1)
    assert len(d["items"]) == 1  # la página es de 1, los totales son de todo
    t = d["totales"]
    assert t["reservas"] == 4
    assert t["viajeros"] == 6
    assert t["monto_total"] == 600000
    assert t["cobrado"] == 400000
    # Pendiente (200.000) y la otra confirmada (200.000); la pagada no debe.
    assert t["por_cobrar"] == 400000
    assert t["con_saldo"] == 2


def test_totales_respetan_los_filtros_y_son_opcionales(client, asesor, datos):
    assert _buscar(client, asesor)["totales"] is None
    t = _buscar(client, asesor, con_totales="true", estado="pendiente")["totales"]
    assert t == {"reservas": 1, "viajeros": 2, "monto_total": 200000, "cobrado": 0, "por_cobrar": 200000, "con_saldo": 1}
