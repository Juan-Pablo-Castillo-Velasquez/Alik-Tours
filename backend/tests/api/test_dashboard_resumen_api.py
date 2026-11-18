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
