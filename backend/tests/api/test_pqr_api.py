"""PQRSF: flujo completo entre cliente, asesor y admin."""

from datetime import timedelta
from email.header import decode_header, make_header

import pytest

from app.core.dias_habiles import hoy_colombia, sumar_dias_habiles
from app.models.notificacion_model import Notificacion
from app.models.pqr_model import Pqr
from app.models.reserva_model import Reserva

QUEJA = {
    "tipo": "queja",
    "asunto": "Demora en la entrega de vouchers",
    "descripcion": "Pedí los vouchers del hotel hace una semana y todavía no me llegan al correo.",
    "autoriza_datos": True,
}


@pytest.fixture
def cliente(crear_usuario):
    return crear_usuario()


@pytest.fixture
def otro_cliente(crear_usuario):
    return crear_usuario()


@pytest.fixture
def asesor(crear_usuario):
    return crear_usuario(roles=("empleado",), con_cliente=False)


@pytest.fixture
def admin(crear_usuario):
    return crear_usuario(roles=("admin",), con_cliente=False)


def _texto(correo):
    return "".join(p.get_payload(decode=True).decode("utf-8") for p in correo.walk() if not p.is_multipart())


def _asunto(correo):
    return str(make_header(decode_header(correo["Subject"])))


def _tipificar(client, id_pqr, headers, categoria="pagos", motivo="Cobro doble"):
    r = client.patch(f"/api/pqr/{id_pqr}/gestion", json={"categoria": categoria, "motivo": motivo}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _radicar(client, headers, **extra):
    r = client.post("/api/pqr", json={**QUEJA, **extra}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


# ─── radicación ───────────────────────────────────────────────────────────


def test_tipos_publicos_con_sus_plazos(client):
    r = client.get("/api/pqr/tipos")
    assert r.status_code == 200
    plazos = {t["tipo"]: t["dias"] for t in r.json()}
    assert plazos == {
        "peticion": 15,
        "informacion": 10,
        "consulta": 30,
        "queja": 15,
        "reclamo": 15,
        "sugerencia": 15,
        "felicitacion": 15,
    }


def test_radicar_queja_da_radicado_plazo_y_acuse(client, cliente, buzon, db):
    _, h = cliente
    pqr = _radicar(client, h)
    assert pqr["radicado"].startswith("PQR-") and pqr["radicado"].endswith(f"{pqr['id_pqr']:06d}")
    assert pqr["estado"] == "radicada"
    assert pqr["dias_termino"] == 15
    assert pqr["fecha_vencimiento"] == str(sumar_dias_habiles(hoy_colombia(), 15))
    assert pqr["estado_plazo"] in ("a_tiempo", "por_vencer")
    assert pqr["actuaciones"][0]["tipo"] == "radicacion"
    assert pqr["actuaciones"][0]["autor_equipo"] is False
    # Acuse de recibo por correo con el radicado y la fecha límite.
    assert len(buzon) == 1
    assert pqr["radicado"] in _asunto(buzon[0])
    # El panel recibe la notificación.
    assert db.query(Notificacion).filter(Notificacion.tipo == "pqr", Notificacion.id_cliente.is_(None)).count() == 1


@pytest.mark.parametrize("tipo,dias", [("informacion", 10), ("consulta", 30), ("peticion", 15)])
def test_plazo_segun_tipo(client, cliente, tipo, dias):
    pqr = _radicar(client, cliente[1], tipo=tipo)
    assert pqr["dias_termino"] == dias
    assert pqr["fecha_vencimiento"] == str(sumar_dias_habiles(hoy_colombia(), dias))


def test_reclamo_exige_pretension_y_queda_prioridad_alta(client, cliente):
    _, h = cliente
    r = client.post("/api/pqr", json={**QUEJA, "tipo": "reclamo"}, headers=h)
    assert r.status_code == 422
    pqr = _radicar(client, h, tipo="reclamo", pretension="Que me devuelvan el valor de la noche no prestada.")
    assert pqr["prioridad"] == "alta"
    assert pqr["pretension"].startswith("Que me devuelvan")


def test_sin_autorizar_datos_no_se_radica(client, cliente):
    r = client.post("/api/pqr", json={**QUEJA, "autoriza_datos": False}, headers=cliente[1])
    assert r.status_code == 422


def test_textos_muy_cortos_se_rechazan(client, cliente):
    r = client.post("/api/pqr", json={**QUEJA, "descripcion": "Muy corto"}, headers=cliente[1])
    assert r.status_code == 422


def test_sin_sesion_no_se_radica(client):
    assert client.post("/api/pqr", json=QUEJA).status_code == 401


def test_reserva_ajena_no_se_puede_asociar(client, cliente, otro_cliente, db):
    usuario_otro, _ = otro_cliente
    reserva = Reserva(id_cliente=usuario_otro.id_cliente, numero_personas=2, estado="confirmada")
    db.add(reserva)
    db.commit()
    r = client.post("/api/pqr", json={**QUEJA, "id_reserva": reserva.id_reserva}, headers=cliente[1])
    assert r.status_code == 422


def test_reserva_propia_se_asocia(client, cliente, db):
    usuario, h = cliente
    reserva = Reserva(id_cliente=usuario.id_cliente, numero_personas=2, estado="confirmada")
    db.add(reserva)
    db.commit()
    pqr = _radicar(client, h, id_reserva=reserva.id_reserva)
    assert pqr["id_reserva"] == reserva.id_reserva
    assert pqr["reserva_titulo"].startswith(f"Reserva #{reserva.id_reserva}")


def test_limite_de_solicitudes_abiertas(client, cliente):
    for _ in range(10):
        _radicar(client, cliente[1])
    r = client.post("/api/pqr", json=QUEJA, headers=cliente[1])
    assert r.status_code == 429


def test_asesor_radica_a_nombre_de_un_cliente_que_llamo(client, cliente, asesor):
    usuario_cliente, h_cliente = cliente
    pqr = _radicar(client, asesor[1], id_cliente=usuario_cliente.id_cliente, canal="telefono")
    assert pqr["canal"] == "telefono"
    assert pqr["actuaciones"][0]["autor_equipo"] is True
    mias = client.get("/api/pqr/mias", headers=h_cliente).json()
    assert [p["id_pqr"] for p in mias] == [pqr["id_pqr"]]


def test_cliente_no_radica_a_nombre_de_otro(client, cliente, otro_cliente):
    r = client.post("/api/pqr", json={**QUEJA, "id_cliente": otro_cliente[0].id_cliente}, headers=cliente[1])
    assert r.status_code == 403


# ─── privacidad ───────────────────────────────────────────────────────────


def test_cada_cliente_solo_ve_las_suyas(client, cliente, otro_cliente):
    pqr = _radicar(client, cliente[1])
    assert client.get("/api/pqr/mias", headers=otro_cliente[1]).json() == []
    assert client.get(f"/api/pqr/{pqr['id_pqr']}", headers=otro_cliente[1]).status_code == 404
    r = client.post(f"/api/pqr/{pqr['id_pqr']}/mensajes", json={"texto": "hola"}, headers=otro_cliente[1])
    assert r.status_code == 404


def test_cliente_no_entra_a_la_gestion(client, cliente):
    assert client.get("/api/pqr/gestion", headers=cliente[1]).status_code == 403
    pqr = _radicar(client, cliente[1])
    r = client.post(
        f"/api/pqr/{pqr['id_pqr']}/responder",
        json={"decision": "favorable", "respuesta": "x" * 40},
        headers=cliente[1],
    )
    assert r.status_code == 403


def test_notas_internas_no_llegan_al_cliente(client, cliente, asesor):
    pqr = _radicar(client, cliente[1])
    r = client.post(
        f"/api/pqr/{pqr['id_pqr']}/mensajes",
        json={"texto": "Revisar con el hotel antes de responder", "interna": True},
        headers=asesor[1],
    )
    assert r.status_code == 201
    assert any(a["tipo"] == "nota_interna" for a in r.json()["actuaciones"])
    vista_cliente = client.get(f"/api/pqr/{pqr['id_pqr']}", headers=cliente[1]).json()
    assert all(a["tipo"] != "nota_interna" for a in vista_cliente["actuaciones"])
    assert vista_cliente["estado"] == "radicada"  # una nota interna no cambia el estado


def test_cliente_no_puede_dejar_notas_internas(client, cliente):
    pqr = _radicar(client, cliente[1])
    r = client.post(f"/api/pqr/{pqr['id_pqr']}/mensajes", json={"texto": "hola", "interna": True}, headers=cliente[1])
    assert r.status_code == 403


# ─── gestión del equipo ───────────────────────────────────────────────────


def test_mensaje_del_asesor_pone_en_tramite_y_lo_asigna(client, cliente, asesor, buzon, db):
    usuario_asesor, h = asesor
    pqr = _radicar(client, cliente[1])
    buzon.clear()
    r = client.post(
        f"/api/pqr/{pqr['id_pqr']}/mensajes", json={"texto": "Ya estamos revisando con el hotel."}, headers=h
    )
    datos = r.json()
    assert datos["estado"] == "en_tramite"
    assert datos["id_responsable"] == usuario_asesor.id_usuario
    assert datos["actuaciones"][-1]["autor_equipo"] is True
    assert len(buzon) == 1
    assert (
        db.query(Notificacion)
        .filter(Notificacion.id_cliente == cliente[0].id_cliente, Notificacion.tipo == "pqr")
        .count()
        == 1
    )


def test_asignar_responsable_y_prioridad(client, cliente, asesor, admin):
    usuario_asesor, _ = asesor
    pqr = _radicar(client, cliente[1])
    r = client.patch(
        f"/api/pqr/{pqr['id_pqr']}/gestion",
        json={"id_responsable": usuario_asesor.id_usuario, "prioridad": "alta", "estado": "en_tramite"},
        headers=admin[1],
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id_responsable"] == usuario_asesor.id_usuario
    assert d["responsable_nombre"] == usuario_asesor.username
    assert d["prioridad"] == "alta"
    assert d["estado"] == "en_tramite"
    # No se puede asignar a un cliente.
    r = client.patch(
        f"/api/pqr/{pqr['id_pqr']}/gestion", json={"id_responsable": cliente[0].id_usuario}, headers=admin[1]
    )
    assert r.status_code == 422
    responsables = client.get("/api/pqr/gestion/responsables", headers=asesor[1]).json()
    assert {x["id_usuario"] for x in responsables} == {usuario_asesor.id_usuario, admin[0].id_usuario}


def test_responder_queja_a_tiempo_y_calificar(client, cliente, asesor, buzon):
    pqr = _radicar(client, cliente[1])
    _tipificar(client, pqr["id_pqr"], asesor[1], "atencion", "Demora en la respuesta")
    buzon.clear()
    r = client.post(
        f"/api/pqr/{pqr['id_pqr']}/responder",
        json={"decision": "favorable", "respuesta": "Te reenviamos los vouchers y ajustamos el proceso de envío."},
        headers=asesor[1],
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["estado"] == "respondida"
    assert d["estado_plazo"] == "respondida_a_tiempo"
    assert len(buzon) == 1
    # El cliente ya no puede escribir, pero sí calificar.
    assert (
        client.post(f"/api/pqr/{pqr['id_pqr']}/mensajes", json={"texto": "gracias"}, headers=cliente[1]).status_code
        == 409
    )
    r = client.post(
        f"/api/pqr/{pqr['id_pqr']}/calificar", json={"satisfaccion": 5, "comentario": "Muy rápido"}, headers=cliente[1]
    )
    assert r.json()["estado"] == "cerrada"
    assert r.json()["satisfaccion"] == 5
    resumen = client.get("/api/pqr/gestion", headers=asesor[1]).json()["resumen"]
    assert resumen["a_tiempo_pct"] == 100
    assert resumen["satisfaccion_promedio"] == 5.0


def test_reclamo_exige_decision_expresa_y_motivos_si_se_niega(client, cliente, asesor, buzon):
    pqr = _radicar(client, cliente[1], tipo="reclamo", pretension="Reembolso de la noche que no se prestó.")
    url = f"/api/pqr/{pqr['id_pqr']}/responder"
    _tipificar(client, pqr["id_pqr"], asesor[1], "hotel", "Habitación distinta a la reservada")
    r = client.post(url, json={"decision": "informativa", "respuesta": "x" * 40}, headers=asesor[1])
    assert r.status_code == 422
    r = client.post(
        url, json={"decision": "desfavorable", "respuesta": "No procede, lo sentimos mucho."}, headers=asesor[1]
    )
    assert r.status_code == 422
    buzon.clear()
    motivo = (
        "No accedemos al reembolso porque la noche sí se prestó: el hotel registró tu ingreso a las 15:10 "
        "y la política aceptada al reservar no contempla devolución por salida anticipada."
    )
    r = client.post(url, json={"decision": "desfavorable", "respuesta": motivo}, headers=asesor[1])
    assert r.status_code == 200
    # Al negar un reclamo se le indica al cliente a dónde acudir.
    assert "Superintendencia de Industria y Comercio" in _texto(buzon[0])


def test_respuesta_tardia_queda_marcada(client, cliente, asesor, db):
    pqr = _radicar(client, cliente[1])
    fila = db.get(Pqr, pqr["id_pqr"])
    fila.fecha_vencimiento = hoy_colombia() - timedelta(days=3)
    db.commit()
    lista = client.get("/api/pqr/gestion?plazo=vencidas", headers=asesor[1]).json()
    assert lista["total"] == 1 and lista["resumen"]["vencidas"] == 1
    assert lista["items"][0]["estado_plazo"] == "vencida"
    _tipificar(client, pqr["id_pqr"], asesor[1])
    r = client.post(
        f"/api/pqr/{pqr['id_pqr']}/responder",
        json={"decision": "favorable", "respuesta": "Respuesta de fondo a la queja presentada."},
        headers=asesor[1],
    )
    assert r.json()["estado_plazo"] == "respondida_tarde"


# ─── prórroga ─────────────────────────────────────────────────────────────


def test_prorroga_una_vez_y_hasta_el_doble(client, cliente, asesor, buzon):
    pqr = _radicar(client, cliente[1])
    url = f"/api/pqr/{pqr['id_pqr']}/prorrogar"
    motivo = "Estamos esperando la respuesta formal del hotel en Cartagena."
    assert client.post(url, json={"dias_adicionales": 16, "motivo": motivo}, headers=asesor[1]).status_code == 422
    buzon.clear()
    r = client.post(url, json={"dias_adicionales": 10, "motivo": motivo}, headers=asesor[1])
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["prorrogada"] is True
    assert d["fecha_vencimiento_original"] == pqr["fecha_vencimiento"]
    assert d["fecha_vencimiento"] > pqr["fecha_vencimiento"]
    assert d["puede_prorrogar"] is False
    assert len(buzon) == 1  # se le avisa al cliente con el motivo y la nueva fecha
    assert client.post(url, json={"dias_adicionales": 2, "motivo": motivo}, headers=asesor[1]).status_code == 409


def test_no_se_prorroga_despues_de_vencido(client, cliente, asesor, db):
    pqr = _radicar(client, cliente[1])
    fila = db.get(Pqr, pqr["id_pqr"])
    fila.fecha_vencimiento = hoy_colombia() - timedelta(days=1)
    db.commit()
    r = client.post(
        f"/api/pqr/{pqr['id_pqr']}/prorrogar",
        json={"dias_adicionales": 5, "motivo": "Motivo suficientemente largo para la prórroga."},
        headers=asesor[1],
    )
    assert r.status_code == 409


# ─── petición incompleta ──────────────────────────────────────────────────


def test_pedir_informacion_pausa_y_reinicia_el_plazo(client, cliente, asesor, db):
    pqr = _radicar(client, cliente[1])
    url = f"/api/pqr/{pqr['id_pqr']}"
    r = client.post(
        f"{url}/solicitar-informacion",
        json={"texto": "Envíanos el número del voucher y la fecha de tu estadía, por favor."},
        headers=asesor[1],
    )
    assert r.status_code == 200
    assert r.json()["estado"] == "esperando_cliente"
    assert r.json()["estado_plazo"] == "pausada"
    # No se puede responder de fondo mientras se espera al cliente.
    r = client.post(f"{url}/responder", json={"decision": "favorable", "respuesta": "x" * 40}, headers=asesor[1])
    assert r.status_code == 409
    # Se mueve el vencimiento a una fecha vieja para ver que se recalcula.
    fila = db.get(Pqr, pqr["id_pqr"])
    fila.fecha_vencimiento = hoy_colombia() - timedelta(days=10)
    db.commit()
    r = client.post(f"{url}/mensajes", json={"texto": "Voucher AT-5531, del 3 al 6 de diciembre."}, headers=cliente[1])
    d = r.json()
    assert d["estado"] == "en_tramite"
    assert d["fecha_vencimiento"] == str(sumar_dias_habiles(hoy_colombia(), 15))
    # Solo se pide información una vez.
    r = client.post(
        f"{url}/solicitar-informacion", json={"texto": "Necesitamos otro dato más de tu reserva."}, headers=asesor[1]
    )
    assert r.status_code == 409


def test_archivar_por_desistimiento_tacito_solo_despues_de_un_mes(client, cliente, asesor, db):
    pqr = _radicar(client, cliente[1])
    url = f"/api/pqr/{pqr['id_pqr']}"
    client.post(
        f"{url}/solicitar-informacion",
        json={"texto": "Envíanos el número del voucher, por favor, para revisarlo."},
        headers=asesor[1],
    )
    assert (
        client.post(f"{url}/cerrar", json={"motivo": "Sin respuesta del cliente"}, headers=asesor[1]).status_code == 409
    )
    fila = db.get(Pqr, pqr["id_pqr"])
    fila.fecha_solicitud_informacion = fila.fecha_solicitud_informacion - timedelta(days=31)
    db.commit()
    r = client.post(f"{url}/cerrar", json={"motivo": "Sin respuesta del cliente"}, headers=asesor[1])
    assert r.status_code == 200
    assert r.json()["estado"] == "desistida"


# ─── cliente ──────────────────────────────────────────────────────────────


def test_desistir(client, cliente, otro_cliente):
    pqr = _radicar(client, cliente[1])
    url = f"/api/pqr/{pqr['id_pqr']}/desistir"
    assert client.post(url, json={}, headers=otro_cliente[1]).status_code == 404
    r = client.post(url, json={"motivo": "Ya me llegaron los vouchers"}, headers=cliente[1])
    assert r.json()["estado"] == "desistida"
    assert client.post(url, json={}, headers=cliente[1]).status_code == 409


def test_no_se_califica_antes_de_la_respuesta(client, cliente):
    pqr = _radicar(client, cliente[1])
    r = client.post(f"/api/pqr/{pqr['id_pqr']}/calificar", json={"satisfaccion": 4}, headers=cliente[1])
    assert r.status_code == 409


# ─── listado del equipo ───────────────────────────────────────────────────


def test_listado_con_filtros_busqueda_y_paginacion(client, cliente, otro_cliente, asesor):
    for i in range(7):
        _radicar(client, cliente[1], asunto=f"Queja número {i} del viaje")
    _radicar(client, otro_cliente[1], tipo="sugerencia", asunto="Agreguen más tours en Santa Marta")
    h = asesor[1]
    p1 = client.get("/api/pqr/gestion?page_size=5", headers=h).json()
    assert p1["total"] == 8 and len(p1["items"]) == 5
    p2 = client.get("/api/pqr/gestion?page_size=5&page=2", headers=h).json()
    assert len(p2["items"]) == 3
    assert not {x["id_pqr"] for x in p1["items"]} & {x["id_pqr"] for x in p2["items"]}
    assert client.get("/api/pqr/gestion?tipo=sugerencia", headers=h).json()["total"] == 1
    assert client.get("/api/pqr/gestion?q=Santa%20Marta", headers=h).json()["total"] == 1
    radicado = p1["items"][0]["radicado"]
    assert client.get(f"/api/pqr/gestion?q={radicado}", headers=h).json()["total"] == 1
    assert client.get("/api/pqr/gestion?responsable=sin", headers=h).json()["total"] == 8
    assert client.get("/api/pqr/gestion?responsable=yo", headers=h).json()["total"] == 0
    resumen = p1["resumen"]
    assert resumen["abiertas"] == 8 and resumen["sin_asignar"] == 8
    de_cliente = client.get(f"/api/pqr/gestion/cliente/{otro_cliente[0].id_cliente}", headers=h).json()
    assert len(de_cliente) == 1


# ─── tipificación ─────────────────────────────────────────────────────────


def test_catalogo_de_tipificacion_solo_para_el_equipo(client, cliente, asesor):
    assert client.get("/api/pqr/gestion/tipificaciones", headers=cliente[1]).status_code == 403
    catalogo = client.get("/api/pqr/gestion/tipificaciones", headers=asesor[1]).json()
    pagos = next(c for c in catalogo if c["categoria"] == "pagos")
    assert "Cobro doble" in pagos["motivos"]


def test_no_se_responde_sin_tipificar(client, cliente, asesor):
    pqr = _radicar(client, cliente[1])
    url = f"/api/pqr/{pqr['id_pqr']}/responder"
    cuerpo = {"decision": "favorable", "respuesta": "Respuesta de fondo a la queja presentada por el cliente."}
    r = client.post(url, json=cuerpo, headers=asesor[1])
    assert r.status_code == 409
    assert "Tipifica" in r.json()["detail"]
    _tipificar(client, pqr["id_pqr"], asesor[1], "atencion", "Trato del asesor")
    assert client.post(url, json=cuerpo, headers=asesor[1]).status_code == 200


def test_tipificacion_valida_y_registrada_solo_para_el_equipo(client, cliente, asesor):
    pqr = _radicar(client, cliente[1])
    url = f"/api/pqr/{pqr['id_pqr']}/gestion"
    # Motivo de otra categoría, o solo uno de los dos: no.
    assert client.patch(url, json={"categoria": "pagos", "motivo": "Equipaje"}, headers=asesor[1]).status_code == 422
    assert client.patch(url, json={"categoria": "pagos"}, headers=asesor[1]).status_code == 422
    assert (
        client.patch(url, json={"categoria": "pagos", "motivo": "Cobro doble"}, headers=cliente[1]).status_code == 403
    )
    d = _tipificar(client, pqr["id_pqr"], asesor[1], "vuelos", "Equipaje")
    assert (d["categoria"], d["categoria_nombre"], d["motivo"]) == ("vuelos", "Vuelos", "Equipaje")
    assert any(a["tipo"] == "tipificacion" and not a["visible_cliente"] for a in d["actuaciones"])
    vista_cliente = client.get(f"/api/pqr/{pqr['id_pqr']}", headers=cliente[1]).json()
    assert all(a["tipo"] != "tipificacion" for a in vista_cliente["actuaciones"])


def test_filtro_y_reporte_por_categoria(client, cliente, asesor):
    a = _radicar(client, cliente[1])
    b = _radicar(client, cliente[1])
    _radicar(client, cliente[1])
    _tipificar(client, a["id_pqr"], asesor[1], "pagos", "Cobro doble")
    _tipificar(client, b["id_pqr"], asesor[1], "pagos", "Reembolso pendiente")
    h = asesor[1]
    assert client.get("/api/pqr/gestion?categoria=pagos", headers=h).json()["total"] == 2
    datos = client.get("/api/pqr/gestion?categoria=sin", headers=h).json()
    assert datos["total"] == 1
    assert datos["resumen"]["sin_tipificar"] == 1
    assert datos["resumen"]["por_categoria"] == [{"categoria": "pagos", "nombre": "Pagos y cobros", "total": 2}]


# ─── ejemplos ─────────────────────────────────────────────────────────────


def test_ejemplos_solo_admin_y_en_todos_los_estados(client, cliente, asesor, admin, buzon):
    id_cliente = cliente[0].id_cliente
    assert (
        client.post("/api/pqr/gestion/ejemplos", json={"id_cliente": id_cliente}, headers=asesor[1]).status_code == 403
    )
    r = client.post("/api/pqr/gestion/ejemplos", json={"id_cliente": id_cliente}, headers=admin[1])
    assert r.status_code == 201
    assert r.json()["creadas"] == 8
    mias = client.get("/api/pqr/mias", headers=cliente[1]).json()
    assert len(mias) == 8 and all(p["es_ejemplo"] for p in mias)
    estados = {p["estado"] for p in mias}
    assert {"radicada", "en_tramite", "esperando_cliente", "respondida", "cerrada"} <= estados
    plazos = {p["estado_plazo"] for p in mias}
    assert {"vencida", "por_vencer", "pausada", "respondida_a_tiempo"} <= plazos
    assert any(p["prorrogada"] for p in mias)
    # Las ya respondidas le llegan al cliente por correo, marcadas como ejemplo.
    assert len(buzon) == 2 and all(_asunto(c).startswith("[Ejemplo]") for c in buzon)
    # El cliente no ve las notas internas de los ejemplos.
    for p in mias:
        detalle = client.get(f"/api/pqr/{p['id_pqr']}", headers=cliente[1]).json()
        assert all(a["visible_cliente"] for a in detalle["actuaciones"])
    resumen = client.get("/api/pqr/gestion", headers=admin[1]).json()["resumen"]
    assert resumen["ejemplos"] == 8
    r = client.delete("/api/pqr/gestion/ejemplos", headers=admin[1])
    assert r.json()["borradas"] == 8
    assert client.get("/api/pqr/mias", headers=cliente[1]).json() == []


def test_correo_de_respuesta_con_la_marca_y_la_decision(client, cliente, asesor, buzon):
    pqr = _radicar(client, cliente[1])
    acuse = _texto(buzon[0])
    assert pqr["radicado"] in acuse and "Te respondemos a más tardar el" in acuse
    _tipificar(client, pqr["id_pqr"], asesor[1], "atencion", "Demora en la respuesta")
    buzon.clear()
    client.post(
        f"/api/pqr/{pqr['id_pqr']}/responder",
        json={"decision": "favorable", "respuesta": "Te reenviamos los vouchers y ajustamos el proceso de envío."},
        headers=asesor[1],
    )
    correo = buzon[0]
    assert _asunto(correo) == f"Respondimos tu solicitud · {pqr['radicado']}"
    cuerpo = _texto(correo)
    assert "Accedemos a lo que pediste." in cuerpo
    assert "Te reenviamos los vouchers" in cuerpo
    assert "/profile?tab=pqr" in cuerpo


def test_buscar_clientes_por_nombre_cedula_o_correo(client, cliente, asesor, db):
    from app.models.cliente_model import Cliente

    c = db.get(Cliente, cliente[0].id_cliente)
    c.nombre, c.apellido = "Valentina", "Ríos Gómez"
    db.commit()
    h = asesor[1]
    assert client.get("/api/clientes/buscar?q=va", headers=cliente[1]).status_code == 403
    assert client.get("/api/clientes/buscar?q=valentina", headers=h).json()[0]["id_cliente"] == c.id_cliente
    r = client.get("/api/clientes/buscar?q=Valentina Ríos", headers=h).json()
    assert r[0]["id_cliente"] == c.id_cliente and r[0]["tiene_cuenta"] is True
    assert client.get(f"/api/clientes/buscar?q={c.cedula}", headers=h).json()[0]["id_cliente"] == c.id_cliente
    assert client.get("/api/clientes/buscar?q=zzzz-nadie", headers=h).json() == []
    assert client.get("/api/clientes/buscar?q=a", headers=h).status_code == 422
