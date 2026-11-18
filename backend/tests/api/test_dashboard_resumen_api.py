"""GET /api/dashboard/resumen: cifras del dashboard comercial del admin.

Todo sale de la base de datos real: aquí se siembra un escenario pequeño y
se comprueba cada cifra a mano (reservas, cobros, cartera, canales...)."""

from datetime import date, timedelta

import pytest

from app.models.cliente_model import Cliente, Empleado
from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion
from app.models.reserva_model import MetodoPago, Pago, Reserva, ReservaHabitacion


@pytest.fixture
def escenario(db):
    hotel = Hotel(nombre_hotel="Hotel Caribe Azul", ciudad="Cartagena", pais="Colombia", calificacion=4)
    tipo = TipoHabitacion(nombre_tipo="Doble", capacidad_personas=2)
    asesora = Empleado(nombre="Laura", apellido="Gómez", cedula="1010101010")
    db.add_all([hotel, tipo, asesora])
    db.commit()
    hab = Habitacion(
        id_hotel=hotel.id_hotel,
        id_tipo_habitacion=tipo.id_tipo_habitacion,
        numero_habitacion="101",
        precio_noche=200000,
        estado="disponible",
    )
    ana = Cliente(nombre="Ana", apellido="Ríos", cedula="52123456", correo="ana@test.com")
    metodo = MetodoPago(nombre_metodo="Nequi")
    db.add_all([hab, ana, metodo])
    db.commit()
    hoy = date.today()
    reservas = []
    # (estado, canal, asesora?)
    for i, (estado, canal, con_asesora) in enumerate(
        [
            ("pendiente", "web", False),
            ("confirmada", "empleado", True),
            ("cancelada", "web", False),
            ("confirmada", "empleado", True),
        ]
    ):
        r = Reserva(
            id_cliente=ana.id_cliente,
            fecha_inicio=hoy + timedelta(days=10 * (i + 1)),
            fecha_fin=hoy + timedelta(days=10 * (i + 1) + 2),
            numero_personas=2,
            estado=estado,
            id_empleado=asesora.id_empleado if con_asesora else None,
            tipo_producto="hotel",
            canal_origen=canal,
        )
        db.add(r)
        db.commit()
        db.add(
            ReservaHabitacion(
                id_reserva=r.id_reserva,
                id_habitacion=hab.id_habitacion,
                fecha_checkin=r.fecha_inicio,
                fecha_checkout=r.fecha_fin,
                precio_acordado=500000,
            )
        )
        reservas.append(r)
    # La segunda reserva está pagada completa; la cuarta tiene un abono.
    db.add_all(
        [
            Pago(id_reserva=reservas[1].id_reserva, id_metodo_pago=metodo.id_metodo, monto=500000, estado="pagado"),
            Pago(id_reserva=reservas[3].id_reserva, id_metodo_pago=metodo.id_metodo, monto=200000, estado="pagado"),
            Pago(id_reserva=reservas[0].id_reserva, id_metodo_pago=metodo.id_metodo, monto=90000, estado="pendiente"),
        ]
    )
    db.commit()
    return reservas


@pytest.fixture
def resumen(client, crear_usuario, escenario):
    _, admin = crear_usuario(roles=("admin",), con_cliente=False)
    r = client.get("/api/dashboard/resumen", headers=admin)
    assert r.status_code == 200, r.text
    return r.json()


def test_ventas_de_hoy_y_del_mes(resumen):
    assert resumen["reservas_hoy"] == 4
    # Solo cuentan los pagos aprobados, nunca el pendiente de 90.000.
    assert resumen["ingresos_hoy"] == 700000
    assert resumen["ingresos_totales"] == 700000
    assert len(resumen["comercial_por_mes"]) == 6
    assert resumen["comercial_por_mes"][-1] == {
        "mes": date.today().strftime("%Y-%m"),
        "reservas": 4,
        "ingresos": 700000,
    }
    assert [m["reservas"] for m in resumen["comercial_por_mes"][:-1]] == [0] * 5


def test_cartera_por_cobrar_de_reservas_vigentes(resumen):
    # Pendiente: debe 500.000. Confirmada pagada: 0. Confirmada con abono:
    # 300.000. La cancelada no cuenta.
    assert resumen["cartera_por_cobrar"] == 800000
    assert resumen["reservas_con_saldo"] == 2


def test_ventas_por_producto_canal_hotel_y_asesor(resumen):
    assert resumen["ventas_por_producto"] == [{"nombre": "Hoteles", "total": 3, "monto": 700000}]
    canales = {c["nombre"]: c["total"] for c in resumen["reservas_por_canal"]}
    assert canales == {"Sitio web": 2, "Asesor": 2}
    assert resumen["hoteles_mas_reservados"] == [{"nombre": "Hotel Caribe Azul", "total": 4, "monto": None}]
    assert resumen["asesores_top_mes"] == [{"nombre": "Laura Gómez", "total": 2, "monto": None}]


def test_conversion_cuenta_confirmadas(resumen):
    assert resumen["tasa_conversion_pct"] == 50.0
    assert resumen["tasa_cancelacion_pct"] == 25.0
    assert resumen["reservas_ultimos_14d"][-1]["total"] == 4


def test_sin_datos_no_inventa_cifras(client, crear_usuario):
    _, admin = crear_usuario(roles=("admin",), con_cliente=False)
    r = client.get("/api/dashboard/resumen", headers=admin).json()
    assert r["reservas_total"] == 0
    assert r["cartera_por_cobrar"] == 0
    assert r["ventas_por_producto"] == [] and r["asesores_top_mes"] == []
    assert r["tasa_conversion_pct"] is None and r["ticket_promedio"] is None


def test_un_cliente_no_ve_el_dashboard(client, crear_usuario):
    _, cliente = crear_usuario()
    assert client.get("/api/dashboard/resumen", headers=cliente).status_code == 403


# ---------- Panel del asesor: GET /api/dashboard/resumen-empleado ----------


@pytest.fixture
def asesora_laura(db, crear_usuario, escenario):
    """La asesora del escenario (2 reservas este mes, una pagada completa y
    otra con abono) con su usuario vinculado, más un compañero con 3."""
    laura = db.query(Empleado).filter(Empleado.cedula == "1010101010").one()
    usuario, headers = crear_usuario(roles=("empleado",), con_cliente=False)
    usuario.id_empleado = laura.id_empleado
    pedro = Empleado(nombre="Pedro", apellido="Ruiz", cedula="2020202020")
    db.add(pedro)
    db.commit()
    for i in range(3):
        db.add(
            Reserva(
                id_cliente=escenario[0].id_cliente,
                fecha_inicio=date.today() + timedelta(days=40 + i),
                fecha_fin=date.today() + timedelta(days=42 + i),
                numero_personas=1,
                estado="pendiente",
                id_empleado=pedro.id_empleado,
            )
        )
    db.commit()
    return headers


def test_el_asesor_ve_sus_numeros_del_mes(client, asesora_laura):
    r = client.get("/api/dashboard/resumen-empleado", headers=asesora_laura)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["nombre"] == "Laura"
    assert d["reservas_gestionadas"] == 2
    assert d["reservas_gestionadas_mes"] == 2
    assert d["reservas_gestionadas_mes_anterior"] == 0
    # Cobrado este mes en SUS reservas: 500.000 + 200.000 (el pendiente no cuenta).
    assert d["ventas_cobradas_mes"] == 700000
    # La confirmada con abono es la única de ella con saldo.
    assert d["mis_reservas_con_saldo"] == 1
    assert d["mis_reservas_pendientes"] == 0
    # Pedro registró 3 este mes, ella 2: va de segunda entre 2 asesores.
    assert d["posicion_ranking_mes"] == 2
    assert d["asesores_activos_mes"] == 2


def test_un_admin_sin_perfil_de_asesor_no_tiene_ranking(client, crear_usuario, escenario):
    _, admin = crear_usuario(roles=("admin",), con_cliente=False)
    d = client.get("/api/dashboard/resumen-empleado", headers=admin).json()
    assert d["reservas_gestionadas_mes"] == 0 and d["ventas_cobradas_mes"] == 0
    assert d["posicion_ranking_mes"] is None and d["nombre"] is None
