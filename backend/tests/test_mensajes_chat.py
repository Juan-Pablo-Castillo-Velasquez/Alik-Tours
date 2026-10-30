"""
Chat privado admin<->cliente (mensaje_chat_route.py /
mensaje_chat_repository.py) -- un solo hilo continuo por cliente (no uno
por reserva), bandeja compartida (cualquier admin ve/responde cualquier
hilo), sin websockets (solo polling).

No existe ningún patrón de tests async ni pytest-asyncio en esta suite
(confirmado por grep antes de escribir este archivo) -- las rutas async
(envío de mensajes, que valida/sube la imagen) se prueban con
asyncio.run() dentro de tests sync normales, mismo criterio que el resto
de backend/tests/.

La fixture `db` (SQLite en memoria, una por test) vive en conftest.py,
compartida por toda la suite.
"""

import asyncio
import inspect
import io
from datetime import date

import pytest
from fastapi import HTTPException, UploadFile
from fastapi import params as fastapi_params
from starlette.datastructures import Headers

from app.core.security import generate_token_pair
from app.models.cliente_model import Cliente
from app.models.mensaje_chat_model import MensajeChat
from app.models.reserva_model import Reserva
from app.models.user_model import Usuario
from app.routes import mensaje_chat_route


def _llamar(ruta, *args, **kwargs):
    """Llama una ruta de FastAPI como función normal. Los parámetros que el
    test no pasa toman el valor por defecto REAL de su Query/Form/File/Header
    (FastAPI solo los resuelve dentro de una petición HTTP; llamada directa,
    el "valor por defecto" sería el propio objeto Query(None)/Form(None))."""
    for nombre, parametro in inspect.signature(ruta).parameters.items():
        if nombre not in kwargs and isinstance(parametro.default, fastapi_params.Param | fastapi_params.Body):
            kwargs[nombre] = parametro.default.default
    return ruta(*args, **kwargs)


def _crear_cliente_con_usuario(db, cedula="1000000001"):
    cliente = Cliente(nombre="Cliente", apellido="Test", cedula=cedula, correo=f"{cedula}@test.com")
    db.add(cliente)
    db.commit()

    usuario = Usuario(
        username=f"cliente_{cedula}",
        correo_electronico=f"{cedula}@test.com",
        password_hash="hash-no-relevante-para-este-test",
        id_cliente=cliente.id_cliente,
        activo=True,
        verificado=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return cliente, usuario


def _crear_admin(db, username="admin_test"):
    """Cuenta admin -- el rol vive en usuarios_roles (auth_model.py), no en
    esta tabla; para las rutas que llaman require_admin directamente (sin
    decodificar un JWT) alcanza con pasar su id_usuario como admin_id, así
    que este helper no necesita sembrar ningún rol."""
    usuario = Usuario(
        username=username,
        correo_electronico=f"{username}@test.com",
        password_hash="hash-no-relevante-para-este-test",
        activo=True,
        verificado=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def _crear_empleado_sin_cliente(db, username="empleado_test"):
    """Cuenta sin rol admin y sin perfil de cliente vinculado -- caso real
    de un empleado que no debería poder usar ninguno de los dos lados del
    chat."""
    usuario = Usuario(
        username=username,
        correo_electronico=f"{username}@test.com",
        password_hash="hash-no-relevante-para-este-test",
        activo=True,
        verificado=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def _token_bearer(id_usuario: int, roles: list[str]) -> str:
    return f"Bearer {generate_token_pair(id_usuario, roles)['access_token']}"


def _crear_reserva(db, cliente, estado="pendiente"):
    """Reserva mínima -- sin paquete/habitaciones (ambos opcionales), igual
    al helper ya usado en test_reservas_pagos.py. Alcanza para probar el
    etiquetado de mensajes, que solo necesita id_reserva/id_cliente/estado
    reales."""
    reserva = Reserva(
        id_cliente=cliente.id_cliente,
        numero_personas=2,
        estado=estado,
        fecha_inicio=date(2026, 12, 1),
        fecha_fin=date(2026, 12, 5),
    )
    db.add(reserva)
    db.commit()
    db.refresh(reserva)
    return reserva


class TestEnvioDeMensajes:
    def test_cliente_envia_mensaje_de_texto_en_su_propio_hilo(self, db):
        _cliente, usuario = _crear_cliente_con_usuario(db)

        resultado = asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_cliente,
                contenido="Hola, tengo una duda con mi reserva",
                archivo=None,
                db=db,
                current_user=usuario,
            )
        )

        assert resultado["contenido"] == "Hola, tengo una duda con mi reserva"
        assert resultado["remitente_tipo"] == "cliente"
        assert resultado["id_usuario_remitente"] == usuario.id_usuario

    def test_admin_envia_mensaje_al_hilo_de_un_cliente_especifico(self, db):
        cliente, _usuario = _crear_cliente_con_usuario(db)
        admin = _crear_admin(db)

        resultado = asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_admin,
                id_cliente=cliente.id_cliente,
                contenido="Claro, dime en qué te ayudo",
                archivo=None,
                db=db,
                admin_id=admin.id_usuario,
            )
        )

        assert resultado["contenido"] == "Claro, dime en qué te ayudo"
        assert resultado["remitente_tipo"] == "admin"
        assert resultado["id_cliente"] == cliente.id_cliente


class TestAislamientoYPermisos:
    def test_cliente_no_puede_ver_el_hilo_de_otro_cliente(self, db):
        """get_mi_hilo SIEMPRE resuelve id_cliente del propio token, nunca
        de un parámetro -- este test confirma que dos clientes distintos
        obtienen cada uno solo su propio hilo."""
        cliente_a, usuario_a = _crear_cliente_con_usuario(db, cedula="1000000001")
        cliente_b, usuario_b = _crear_cliente_con_usuario(db, cedula="1000000002")
        admin = _crear_admin(db)

        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_admin,
                id_cliente=cliente_a.id_cliente,
                contenido="Para A",
                archivo=None,
                db=db,
                admin_id=admin.id_usuario,
            )
        )
        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_admin,
                id_cliente=cliente_b.id_cliente,
                contenido="Para B",
                archivo=None,
                db=db,
                admin_id=admin.id_usuario,
            )
        )

        hilo_a = _llamar(mensaje_chat_route.get_mi_hilo, after_id=None, db=db, current_user=usuario_a)
        hilo_b = _llamar(mensaje_chat_route.get_mi_hilo, after_id=None, db=db, current_user=usuario_b)

        assert [m["contenido"] for m in hilo_a] == ["Para A"]
        assert [m["contenido"] for m in hilo_b] == ["Para B"]

    def test_usuario_sin_admin_ni_cliente_recibe_403_en_ambos_lados(self, db):
        empleado = _crear_empleado_sin_cliente(db)

        with pytest.raises(HTTPException) as exc_info:
            _llamar(mensaje_chat_route.get_mi_hilo, after_id=None, db=db, current_user=empleado)
        assert exc_info.value.status_code == 403

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                _llamar(
                    mensaje_chat_route.enviar_como_cliente, contenido="hola", archivo=None, db=db, current_user=empleado
                )
            )
        assert exc_info.value.status_code == 403


class TestValidacionDeContenido:
    def test_enviar_sin_contenido_ni_imagen_es_rechazado(self, db):
        _cliente, usuario = _crear_cliente_con_usuario(db)

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                _llamar(
                    mensaje_chat_route.enviar_como_cliente, contenido=None, archivo=None, db=db, current_user=usuario
                )
            )
        assert exc_info.value.status_code == 400

    def test_archivo_invalido_es_rechazado_por_magic_bytes(self, db):
        """validar_y_leer_archivo() (file_validation.py, Fase H-05) revisa
        los bytes reales de cabecera, no solo el content_type declarado --
        este archivo dice ser un JPG pero no tiene el magic number real."""
        _cliente, usuario = _crear_cliente_con_usuario(db)

        archivo_falso = UploadFile(
            filename="captura.jpg",
            file=io.BytesIO(b"esto no es una imagen real, son bytes cualquiera"),
            headers=Headers({"content-type": "image/jpeg"}),
        )

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                _llamar(
                    mensaje_chat_route.enviar_como_cliente,
                    contenido=None,
                    archivo=archivo_falso,
                    db=db,
                    current_user=usuario,
                )
            )
        assert exc_info.value.status_code == 422


class TestHilosYPollingIncremental:
    def test_get_hilos_ordena_por_mensaje_mas_reciente_con_no_leidos_correcto(self, db):
        cliente_a, _usuario_a = _crear_cliente_con_usuario(db, cedula="1000000001")
        cliente_b, _usuario_b = _crear_cliente_con_usuario(db, cedula="1000000002")
        admin = _crear_admin(db)

        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_admin,
                id_cliente=cliente_a.id_cliente,
                contenido="Primero",
                archivo=None,
                db=db,
                admin_id=admin.id_usuario,
            )
        )
        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_admin,
                id_cliente=cliente_b.id_cliente,
                contenido="Segundo",
                archivo=None,
                db=db,
                admin_id=admin.id_usuario,
            )
        )
        # Mensaje del CLIENTE b, todavía no leído por ningún admin.
        usuario_b = db.query(Usuario).filter(Usuario.id_cliente == cliente_b.id_cliente).first()
        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_cliente,
                contenido="Respondo",
                archivo=None,
                db=db,
                current_user=usuario_b,
            )
        )

        resultado = _llamar(
            mensaje_chat_route.get_hilos, search=None, skip=0, limit=20, db=db, admin_id=admin.id_usuario
        )
        hilos = resultado["items"]

        assert hilos[0]["id_cliente"] == cliente_b.id_cliente  # el hilo con actividad más reciente va primero
        assert hilos[0]["no_leidos"] == 1
        assert hilos[1]["no_leidos"] == 0
        assert resultado["total"] == 2
        assert resultado["skip"] == 0
        assert resultado["limit"] == 20

    def test_after_id_devuelve_solo_los_mensajes_posteriores(self, db):
        """Contrato exacto que usa el polling incremental del frontend
        (cada 5s con el hilo abierto): no repetir mensajes ya cargados."""
        cliente, usuario = _crear_cliente_con_usuario(db)
        admin = _crear_admin(db)

        primero = asyncio.run(
            _llamar(mensaje_chat_route.enviar_como_cliente, contenido="uno", archivo=None, db=db, current_user=usuario)
        )
        asyncio.run(
            _llamar(mensaje_chat_route.enviar_como_cliente, contenido="dos", archivo=None, db=db, current_user=usuario)
        )
        asyncio.run(
            _llamar(mensaje_chat_route.enviar_como_cliente, contenido="tres", archivo=None, db=db, current_user=usuario)
        )

        solo_nuevos = _llamar(
            mensaje_chat_route.get_hilo_admin,
            cliente.id_cliente,
            after_id=primero["id_mensaje"],
            db=db,
            admin_id=admin.id_usuario,
        )

        assert [m["contenido"] for m in solo_nuevos] == ["dos", "tres"]


class TestMarcarLeidoYConteos:
    def test_marcar_leido_solo_afecta_los_mensajes_de_la_otra_parte(self, db):
        cliente, usuario = _crear_cliente_con_usuario(db)
        admin = _crear_admin(db)

        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_cliente,
                contenido="del cliente",
                archivo=None,
                db=db,
                current_user=usuario,
            )
        )
        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_admin,
                id_cliente=cliente.id_cliente,
                contenido="del admin",
                archivo=None,
                db=db,
                admin_id=admin.id_usuario,
            )
        )

        token_admin = _token_bearer(admin.id_usuario, ["admin"])
        _llamar(
            mensaje_chat_route.marcar_leido,
            mensaje_chat_route.MarcarLeidoRequest(id_cliente=cliente.id_cliente),
            db=db,
            current_user=admin,
            authorization=token_admin,
        )

        mensajes = db.query(MensajeChat).filter(MensajeChat.id_cliente == cliente.id_cliente).all()
        del_cliente = [m for m in mensajes if m.remitente_tipo == "cliente"][0]
        del_admin = [m for m in mensajes if m.remitente_tipo == "admin"][0]
        assert del_cliente.leido is True  # el admin marcó leído el mensaje del cliente
        assert del_admin.leido is False  # el suyo propio queda intacto

    def test_no_leidos_es_consciente_del_rol(self, db):
        cliente, usuario = _crear_cliente_con_usuario(db)
        admin = _crear_admin(db)

        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_cliente,
                contenido="del cliente",
                archivo=None,
                db=db,
                current_user=usuario,
            )
        )
        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_admin,
                id_cliente=cliente.id_cliente,
                contenido="del admin",
                archivo=None,
                db=db,
                admin_id=admin.id_usuario,
            )
        )

        token_admin = _token_bearer(admin.id_usuario, ["admin"])
        token_cliente = _token_bearer(usuario.id_usuario, ["cliente"])

        conteo_admin = _llamar(mensaje_chat_route.get_no_leidos, db=db, current_user=admin, authorization=token_admin)
        conteo_cliente = _llamar(
            mensaje_chat_route.get_no_leidos, db=db, current_user=usuario, authorization=token_cliente
        )

        assert conteo_admin["no_leidos"] == 1  # el mensaje del cliente, no leído por ningún admin
        assert conteo_cliente["no_leidos"] == 1  # el mensaje del admin, no leído por el cliente


class TestCascadaDeEliminacion:
    def test_borrar_usuario_remitente_elimina_sus_mensajes_en_cascada(self, db):
        """Corrección de esta ronda: id_usuario_remitente usa
        ondelete=CASCADE (no SET NULL, que era la suposición inicial antes
        de verificar la convención real en auth_model.py) -- prueba el
        comportamiento real a nivel de base de datos, no solo el valor
        declarado en el modelo. SQLite no aplica ON DELETE CASCADE salvo
        que se active este pragma por conexión."""
        from sqlalchemy import text

        cliente, _usuario_cliente = _crear_cliente_con_usuario(db)
        admin = _crear_admin(db)

        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_admin,
                id_cliente=cliente.id_cliente,
                contenido="mensaje del admin",
                archivo=None,
                db=db,
                admin_id=admin.id_usuario,
            )
        )
        assert db.query(MensajeChat).filter(MensajeChat.id_cliente == cliente.id_cliente).count() == 1

        db.execute(text("PRAGMA foreign_keys=ON"))
        db.delete(admin)
        db.commit()

        mensajes_restantes = db.query(MensajeChat).filter(MensajeChat.id_cliente == cliente.id_cliente).all()
        assert mensajes_restantes == []


class TestReservaAsociada:
    def test_mensaje_con_reserva_incluye_su_resumen(self, db):
        cliente, usuario = _crear_cliente_con_usuario(db)
        reserva = _crear_reserva(db, cliente)

        resultado = asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_cliente,
                contenido="Es sobre esta reserva",
                archivo=None,
                id_reserva=reserva.id_reserva,
                db=db,
                current_user=usuario,
            )
        )

        assert resultado["id_reserva"] == reserva.id_reserva
        assert resultado["reserva"]["id_reserva"] == reserva.id_reserva
        assert resultado["reserva"]["estado"] == "pendiente"
        assert resultado["reserva"]["fecha_inicio"] == date(2026, 12, 1)

    def test_admin_puede_etiquetar_su_respuesta_con_la_misma_reserva(self, db):
        cliente, _usuario = _crear_cliente_con_usuario(db)
        admin = _crear_admin(db)
        reserva = _crear_reserva(db, cliente)

        resultado = asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_admin,
                id_cliente=cliente.id_cliente,
                contenido="Ya la reviso",
                archivo=None,
                id_reserva=reserva.id_reserva,
                db=db,
                admin_id=admin.id_usuario,
            )
        )

        assert resultado["id_reserva"] == reserva.id_reserva

    def test_mensaje_sin_reserva_sigue_funcionando_igual_que_antes(self, db):
        """No romper el comportamiento previo: id_reserva es opcional."""
        _cliente, usuario = _crear_cliente_con_usuario(db)

        resultado = asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_cliente,
                contenido="Sin reserva",
                archivo=None,
                db=db,
                current_user=usuario,
            )
        )

        assert resultado["id_reserva"] is None
        assert resultado["reserva"] is None

    def test_no_se_puede_etiquetar_con_la_reserva_de_otro_cliente(self, db):
        cliente_a, usuario_a = _crear_cliente_con_usuario(db, cedula="1000000001")
        cliente_b, _usuario_b = _crear_cliente_con_usuario(db, cedula="1000000002")
        reserva_de_b = _crear_reserva(db, cliente_b)

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                _llamar(
                    mensaje_chat_route.enviar_como_cliente,
                    contenido="Intento adivinar el id",
                    archivo=None,
                    id_reserva=reserva_de_b.id_reserva,
                    db=db,
                    current_user=usuario_a,
                )
            )
        assert exc_info.value.status_code == 404

    def test_reserva_inexistente_es_rechazada(self, db):
        _cliente, usuario = _crear_cliente_con_usuario(db)

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                _llamar(
                    mensaje_chat_route.enviar_como_cliente,
                    contenido="Reserva que no existe",
                    archivo=None,
                    id_reserva=999999,
                    db=db,
                    current_user=usuario,
                )
            )
        assert exc_info.value.status_code == 404


class TestBusquedaYPaginacionDeHilos:
    def test_busqueda_filtra_por_nombre_parcial(self, db):
        admin = _crear_admin(db)
        cliente_ana, _u1 = _crear_cliente_con_usuario(db, cedula="1000000001")
        cliente_ana.nombre, cliente_ana.apellido = "Ana", "Gómez"
        cliente_luis, _u2 = _crear_cliente_con_usuario(db, cedula="1000000002")
        cliente_luis.nombre, cliente_luis.apellido = "Luis", "Pérez"
        db.commit()

        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_admin,
                id_cliente=cliente_ana.id_cliente,
                contenido="hola Ana",
                archivo=None,
                db=db,
                admin_id=admin.id_usuario,
            )
        )
        asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_admin,
                id_cliente=cliente_luis.id_cliente,
                contenido="hola Luis",
                archivo=None,
                db=db,
                admin_id=admin.id_usuario,
            )
        )

        resultado = _llamar(
            mensaje_chat_route.get_hilos, search="ana", skip=0, limit=20, db=db, admin_id=admin.id_usuario
        )

        assert resultado["total"] == 1
        assert resultado["items"][0]["id_cliente"] == cliente_ana.id_cliente

    def test_paginacion_respeta_skip_y_limit(self, db):
        admin = _crear_admin(db)
        clientes = [_crear_cliente_con_usuario(db, cedula=f"100000000{i}")[0] for i in range(3)]
        for cliente in clientes:
            asyncio.run(
                _llamar(
                    mensaje_chat_route.enviar_como_admin,
                    id_cliente=cliente.id_cliente,
                    contenido="hola",
                    archivo=None,
                    db=db,
                    admin_id=admin.id_usuario,
                )
            )

        primera_pagina = _llamar(
            mensaje_chat_route.get_hilos, search=None, skip=0, limit=2, db=db, admin_id=admin.id_usuario
        )
        segunda_pagina = _llamar(
            mensaje_chat_route.get_hilos, search=None, skip=2, limit=2, db=db, admin_id=admin.id_usuario
        )

        assert primera_pagina["total"] == 3
        assert len(primera_pagina["items"]) == 2
        assert segunda_pagina["total"] == 3
        assert len(segunda_pagina["items"]) == 1


class TestLimiteDeCaracteres:
    def test_rechaza_mensaje_de_mas_de_500_caracteres(self, db):
        _cliente, usuario = _crear_cliente_con_usuario(db)

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                _llamar(
                    mensaje_chat_route.enviar_como_cliente,
                    contenido="x" * 501,
                    archivo=None,
                    db=db,
                    current_user=usuario,
                )
            )
        assert exc_info.value.status_code == 400

    def test_acepta_mensaje_de_exactamente_500_caracteres(self, db):
        _cliente, usuario = _crear_cliente_con_usuario(db)

        resultado = asyncio.run(
            _llamar(
                mensaje_chat_route.enviar_como_cliente, contenido="x" * 500, archivo=None, db=db, current_user=usuario
            )
        )
        assert resultado["contenido"] == "x" * 500

    def test_admin_tambien_respeta_el_limite(self, db):
        cliente, _usuario = _crear_cliente_con_usuario(db)
        admin = _crear_admin(db)

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                _llamar(
                    mensaje_chat_route.enviar_como_admin,
                    id_cliente=cliente.id_cliente,
                    contenido="y" * 501,
                    archivo=None,
                    db=db,
                    admin_id=admin.id_usuario,
                )
            )
        assert exc_info.value.status_code == 400


class TestPaginacionHaciaAtras:
    def test_before_id_trae_los_mensajes_anteriores(self, db):
        _cliente, usuario = _crear_cliente_con_usuario(db)
        ids = []
        for i in range(5):
            enviado = asyncio.run(
                _llamar(
                    mensaje_chat_route.enviar_como_cliente,
                    contenido=f"mensaje {i}",
                    archivo=None,
                    db=db,
                    current_user=usuario,
                )
            )
            ids.append(enviado["id_mensaje"])

        anteriores = _llamar(mensaje_chat_route.get_mi_hilo, before_id=ids[3], db=db, current_user=usuario)

        assert [m["id_mensaje"] for m in anteriores] == ids[:3]

    def test_before_id_y_after_id_juntos_es_400(self, db):
        _cliente, usuario = _crear_cliente_con_usuario(db)

        with pytest.raises(HTTPException) as exc_info:
            _llamar(mensaje_chat_route.get_mi_hilo, after_id=1, before_id=2, db=db, current_user=usuario)
        assert exc_info.value.status_code == 400

    def test_admin_tambien_puede_paginar_hacia_atras(self, db):
        cliente, _usuario = _crear_cliente_con_usuario(db)
        admin = _crear_admin(db)
        ids = []
        for i in range(4):
            enviado = asyncio.run(
                _llamar(
                    mensaje_chat_route.enviar_como_admin,
                    id_cliente=cliente.id_cliente,
                    contenido=f"admin {i}",
                    archivo=None,
                    db=db,
                    admin_id=admin.id_usuario,
                )
            )
            ids.append(enviado["id_mensaje"])

        anteriores = _llamar(
            mensaje_chat_route.get_hilo_admin,
            id_cliente=cliente.id_cliente,
            before_id=ids[2],
            db=db,
            admin_id=admin.id_usuario,
        )

        assert [m["id_mensaje"] for m in anteriores] == ids[:2]


def test_mensaje_con_mismo_client_msg_id_no_se_guarda_dos_veces(monkeypatch):
    """Auditoría oct-2026 (P1-1): un reintento o doble Enter con el mismo
    client_msg_id se rechaza con 409 en vez de duplicar el mensaje."""
    claves = set()

    def fake_reservar(clave, ttl_seconds=300):
        if clave in claves:
            return False
        claves.add(clave)
        return True

    monkeypatch.setattr(mensaje_chat_route, "reservar_clave_unica", fake_reservar)
    mensaje_chat_route._exigir_mensaje_no_repetido(7, "abc-123")
    with pytest.raises(HTTPException) as exc:
        mensaje_chat_route._exigir_mensaje_no_repetido(7, "abc-123")
    assert exc.value.status_code == 409
    # Otro usuario con el mismo id, o sin id, no se bloquea.
    mensaje_chat_route._exigir_mensaje_no_repetido(8, "abc-123")
    mensaje_chat_route._exigir_mensaje_no_repetido(7, None)
