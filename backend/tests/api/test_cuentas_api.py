"""Cuentas: login, verificación, recuperación de contraseña y administración.

Autor (semana 7, responsable del backend al 75%): Juan Pablo Castillo.

La persona que tuvo la capa API en la semana 6 lleva el backend al umbral
de esta semana, que es de tema común (E2E). Se cubre lo que menos tests
tenía: los flujos de /auth y la administración de usuarios y roles.
"""

import re
import threading

import pytest
from sqlalchemy import text

from app.core.security import create_verification_token, hash_password
from app.models.auth_model import Permiso, Rol, UsuarioRol
from app.models.user_model import Usuario
from app.routes import auth_route

CLAVE = "Clave123"


class _HiloSincrono(threading.Thread):
    def start(self):
        self.run()


@pytest.fixture(autouse=True)
def correos_en_el_mismo_hilo(monkeypatch):
    monkeypatch.setattr(auth_route.threading, "Thread", _HiloSincrono)


@pytest.fixture
def roles(db):
    """Los roles que en la BD real siembran las migraciones."""
    filas = {nombre: Rol(nombre_rol=nombre) for nombre in ("admin", "cliente", "empleado")}
    db.add_all(filas.values())
    db.commit()
    # register_user asigna el rol con id 2 ("cliente") por SQL directo
    assert filas["cliente"].id_rol == 2
    return filas


@pytest.fixture
def cuenta(db, roles):
    """Cuenta verificada y activa con contraseña conocida y rol cliente."""

    def _crear(correo="ana@correo.com", verificado=True, activo=True, rol="cliente"):
        u = Usuario(
            username=correo,
            correo_electronico=correo,
            password_hash=hash_password(CLAVE),
            verificado=verificado,
            activo=activo,
        )
        db.add(u)
        db.flush()
        db.add(UsuarioRol(id_usuario=u.id_usuario, id_rol=roles[rol].id_rol))
        db.commit()
        return u

    return _crear


def _texto(correo):
    return "".join(p.get_payload(decode=True).decode("utf-8") for p in correo.walk() if not p.is_multipart())


def _token_del_enlace(correo):
    return re.search(r"token=([\w\-\.]+)", _texto(correo)).group(1)


class TestLogin:
    def test_con_cuenta_verificada_devuelve_tokens_y_roles(self, client, cuenta):
        cuenta()

        r = client.post("/auth/login", json={"username": "ana@correo.com", "password": CLAVE})

        assert r.status_code == 200
        cuerpo = r.json()
        assert cuerpo["roles"] == ["cliente"]
        assert cuerpo["access_token"] and cuerpo["refresh_token"]

    @pytest.mark.parametrize(
        ("correo", "clave"),
        [("ana@correo.com", "OtraClave1"), ("nadie@correo.com", CLAVE)],
        ids=["clave-equivocada", "correo-inexistente"],
    )
    def test_credenciales_malas_responden_401_igual_exista_o_no_la_cuenta(self, client, cuenta, correo, clave):
        cuenta()

        r = client.post("/auth/login", json={"username": correo, "password": clave})

        assert r.status_code == 401
        assert r.json() == {"detail": "Credenciales inválidas"}  # no deja adivinar qué correos existen

    def test_una_cuenta_sin_verificar_responde_403(self, client, cuenta):
        cuenta(verificado=False)

        r = client.post("/auth/login", json={"username": "ana@correo.com", "password": CLAVE})

        assert r.status_code == 403
        assert r.json() == {"detail": "Por favor verifica tu email antes de continuar"}

    def test_una_cuenta_desactivada_responde_403(self, client, cuenta):
        cuenta(activo=False)

        r = client.post("/auth/login", json={"username": "ana@correo.com", "password": CLAVE})

        assert r.status_code == 403
        assert "desactivada" in r.json()["detail"]


class TestVerificacion:
    def test_el_codigo_del_correo_verifica_y_deja_la_sesion_iniciada(self, client, roles, buzon, db):
        client.post(
            "/auth/register", json={"username": "eva", "correo_electronico": "eva@correo.com", "password": CLAVE}
        )
        codigo = re.search(r"\b(\d{6})\b", _texto(buzon[0])).group(1)

        r = client.post("/auth/verify-email-code", json={"correo_electronico": "eva@correo.com", "codigo": codigo})

        assert r.status_code == 200
        assert r.json()["roles"] == ["cliente"]
        assert db.query(Usuario).filter_by(correo_electronico="eva@correo.com").one().verificado is True

    def test_un_codigo_equivocado_responde_400(self, client, roles):
        client.post(
            "/auth/register", json={"username": "eva", "correo_electronico": "eva@correo.com", "password": CLAVE}
        )

        r = client.post("/auth/verify-email-code", json={"correo_electronico": "eva@correo.com", "codigo": "000000"})

        assert r.status_code == 400

    def test_el_enlace_del_correo_verifica_la_cuenta(self, client, cuenta, db):
        u = cuenta(verificado=False)

        r = client.post("/auth/verify-email", params={"token": create_verification_token(u.correo_electronico)})

        assert r.status_code == 200
        db.refresh(u)
        assert u.verificado is True

    def test_un_enlace_invalido_responde_400(self, client):
        r = client.post("/auth/verify-email", params={"token": "no-es-un-token"})

        assert r.status_code == 400

    def test_reenviar_el_codigo_solo_escribe_a_cuentas_sin_verificar(self, client, cuenta, buzon):
        cuenta(correo="pendiente@correo.com", verificado=False)
        cuenta(correo="lista@correo.com", verificado=True)

        respuestas = [
            client.post("/auth/resend-verification", json={"correo_electronico": c})
            for c in ("pendiente@correo.com", "lista@correo.com", "nadie@correo.com")
        ]

        # Misma respuesta en los tres casos (no revela si el correo existe)...
        assert len({r.text for r in respuestas}) == 1
        # ...pero solo se envió un correo, a la cuenta pendiente.
        assert [c["To"] for c in buzon] == ["pendiente@correo.com"]


class TestRecuperarContrasena:
    def test_el_enlace_del_correo_permite_poner_una_clave_nueva(self, client, cuenta, buzon):
        cuenta()
        client.post("/auth/forgot-password", json={"correo_electronico": "ana@correo.com"})
        token = _token_del_enlace(buzon[-1])

        r = client.post("/auth/reset-password", json={"token": token, "new_password": "Nueva123"})

        assert r.status_code == 200
        assert (
            client.post("/auth/login", json={"username": "ana@correo.com", "password": "Nueva123"}).status_code == 200
        )

    def test_pedir_recuperacion_de_un_correo_inexistente_no_lo_revela(self, client, cuenta, buzon):
        cuenta()

        existe = client.post("/auth/forgot-password", json={"correo_electronico": "ana@correo.com"})
        no_existe = client.post("/auth/forgot-password", json={"correo_electronico": "nadie@correo.com"})

        assert existe.json() == no_existe.json()
        assert len(buzon) == 1

    def test_el_enlace_de_recuperacion_sirve_una_sola_vez(self, client, cuenta, buzon):
        # Hallazgo de seguridad: el mismo enlace podía usarse varias veces
        # durante 24 h (quien lo viera en el correo podía volver a cambiar
        # la clave después de que la dueña ya la cambió).
        cuenta()
        client.post("/auth/forgot-password", json={"correo_electronico": "ana@correo.com"})
        token = _token_del_enlace(buzon[-1])
        assert client.post("/auth/reset-password", json={"token": token, "new_password": "Nueva123"}).status_code == 200

        r = client.post("/auth/reset-password", json={"token": token, "new_password": "Intrusa123"})

        assert r.status_code == 400

    def test_el_enlace_de_verificar_correo_no_sirve_para_cambiar_la_clave(self, client, cuenta):
        # Hallazgo de seguridad: ambos enlaces usaban el MISMO tipo de token,
        # así que el de "verifica tu correo" también cambiaba la contraseña.
        u = cuenta()

        r = client.post(
            "/auth/reset-password",
            json={"token": create_verification_token(u.correo_electronico), "new_password": "Nueva123"},
        )

        assert r.status_code == 400

    def test_la_clave_nueva_debe_cumplir_la_regla(self, client, cuenta, buzon):
        cuenta()
        client.post("/auth/forgot-password", json={"correo_electronico": "ana@correo.com"})

        r = client.post("/auth/reset-password", json={"token": _token_del_enlace(buzon[-1]), "new_password": "corta"})

        assert r.status_code == 422


class TestMiCuenta:
    @pytest.fixture
    def sesion(self, client, cuenta):
        cuenta()
        tokens = client.post("/auth/login", json={"username": "ana@correo.com", "password": CLAVE}).json()
        return {"Authorization": f"Bearer {tokens['access_token']}"}

    def test_me_devuelve_los_datos_de_quien_llama(self, client, sesion):
        r = client.get("/api/usuarios/me", headers=sesion)

        assert r.status_code == 200
        assert r.json()["correo_electronico"] == "ana@correo.com"
        assert "password_hash" not in r.json()

    def test_cambiar_la_clave_exige_la_actual(self, client, sesion):
        r = client.put(
            "/api/usuarios/me/password",
            json={"contrasena_actual": "NoEsLaMia1", "nueva_contrasena": "Nueva1234"},
            headers=sesion,
        )

        assert r.status_code == 400
        assert r.json() == {"detail": "La contraseña actual es incorrecta"}

    def test_cambiar_la_clave_con_la_actual_correcta_funciona(self, client, sesion):
        r = client.put(
            "/api/usuarios/me/password",
            json={"contrasena_actual": CLAVE, "nueva_contrasena": "Nueva1234"},
            headers=sesion,
        )

        assert r.status_code == 200
        assert (
            client.post("/auth/login", json={"username": "ana@correo.com", "password": "Nueva1234"}).status_code == 200
        )


class TestAdministrarUsuarios:
    @pytest.fixture
    def admin(self, client, cuenta):
        u = cuenta(correo="admin@alik.co", rol="admin")
        tokens = client.post("/auth/login", json={"username": "admin@alik.co", "password": CLAVE}).json()
        return u, {"Authorization": f"Bearer {tokens['access_token']}"}

    def test_crea_un_usuario_con_sus_roles(self, client, admin):
        _, h = admin

        r = client.post(
            "/api/usuarios",
            json={
                "username": "asesor1",
                "correo_electronico": "asesor1@alik.co",
                "password": "Asesor1234",
                "roles": ["empleado"],
            },
            headers=h,
        )

        assert r.status_code == 201
        assert r.json()["roles"] == ["empleado"]
        assert any(u["username"] == "asesor1" for u in client.get("/api/usuarios", headers=h).json())

    @pytest.mark.parametrize("campo", ["username", "correo_electronico"])
    def test_un_usuario_o_correo_repetido_responde_409(self, client, admin, campo):
        _, h = admin
        base = {"username": "asesor1", "correo_electronico": "asesor1@alik.co", "password": "Asesor1234"}
        client.post("/api/usuarios", json=base, headers=h)
        repetido = {
            "username": "otro",
            "correo_electronico": "otro@alik.co",
            "password": "Asesor1234",
            campo: base[campo],
        }

        r = client.post("/api/usuarios", json=repetido, headers=h)

        assert r.status_code == 409

    def test_un_rol_inexistente_responde_400_sin_crear_nada(self, client, admin, db):
        _, h = admin

        r = client.post(
            "/api/usuarios",
            json={
                "username": "x123",
                "correo_electronico": "x@alik.co",
                "password": "Asesor1234",
                "roles": ["superheroe"],
            },
            headers=h,
        )

        assert r.status_code == 400
        assert db.query(Usuario).filter_by(username="x123").count() == 0

    def test_desactivar_una_cuenta_le_impide_entrar(self, client, admin, cuenta):
        _, h = admin
        otra = cuenta(correo="eva@correo.com")

        r = client.put(f"/api/usuarios/{otra.id_usuario}", json={"activo": False}, headers=h)

        assert r.status_code == 200
        assert client.post("/auth/login", json={"username": "eva@correo.com", "password": CLAVE}).status_code == 403

    def test_un_admin_no_puede_quitarse_su_propio_rol_de_admin(self, client, admin):
        yo, h = admin

        r = client.put(f"/api/usuarios/{yo.id_usuario}", json={"roles": ["cliente"]}, headers=h)

        assert r.status_code == 400

    def test_un_admin_no_puede_eliminar_su_propia_cuenta(self, client, admin, db):
        # Hallazgo: quitarse el rol estaba bloqueado, pero borrarse no; el
        # único admin podía dejar el panel sin nadie que lo administre.
        yo, h = admin

        r = client.delete(f"/api/usuarios/{yo.id_usuario}", headers=h)

        assert r.status_code == 400
        assert db.get(Usuario, yo.id_usuario) is not None

    def test_elimina_otra_cuenta_y_404_si_no_existe(self, client, admin, cuenta):
        _, h = admin
        otra = cuenta(correo="eva@correo.com")

        assert client.delete(f"/api/usuarios/{otra.id_usuario}", headers=h).status_code == 200
        assert client.delete(f"/api/usuarios/{otra.id_usuario}", headers=h).status_code == 404
        assert client.put("/api/usuarios/99999", json={"activo": True}, headers=h).status_code == 404


class TestRolesYPermisos:
    @pytest.fixture
    def h(self, client, cuenta, db):
        cuenta(correo="admin@alik.co", rol="admin")
        db.add_all(
            [
                Permiso(clave="usuarios.gestionar", nombre="Gestionar usuarios", categoria="Usuarios"),
                Permiso(clave="reservas.ver", nombre="Ver reservas", categoria="Reservas"),
            ]
        )
        db.commit()
        tokens = client.post("/auth/login", json={"username": "admin@alik.co", "password": CLAVE}).json()
        return {"Authorization": f"Bearer {tokens['access_token']}"}

    def test_crea_un_rol_y_le_asigna_permisos(self, client, h):
        id_rol = client.post("/api/roles", json={"nombre_rol": "supervisor"}, headers=h).json()["id_rol"]

        r = client.put(f"/api/roles/{id_rol}/permisos", json={"permisos": ["reservas.ver"]}, headers=h)

        assert r.status_code == 200
        assert client.get(f"/api/roles/{id_rol}/permisos", headers=h).json()["permisos"] == ["reservas.ver"]

    def test_un_permiso_inexistente_responde_400(self, client, h):
        id_rol = client.post("/api/roles", json={"nombre_rol": "supervisor"}, headers=h).json()["id_rol"]

        r = client.put(f"/api/roles/{id_rol}/permisos", json={"permisos": ["volar"]}, headers=h)

        assert r.status_code == 400

    def test_un_rol_con_nombre_repetido_responde_409(self, client, h):
        r = client.post("/api/roles", json={"nombre_rol": "cliente"}, headers=h)

        assert r.status_code == 409

    def test_el_rol_admin_no_se_puede_eliminar(self, client, h, roles):
        r = client.delete(f"/api/roles/{roles['admin'].id_rol}", headers=h)

        assert r.status_code == 400

    def test_lista_los_permisos_y_404_para_un_rol_inexistente(self, client, h):
        assert {p["clave"] for p in client.get("/api/permisos", headers=h).json()} == {
            "usuarios.gestionar",
            "reservas.ver",
        }
        assert client.get("/api/roles/9999/permisos", headers=h).status_code == 404

    def test_un_rol_con_el_permiso_puede_gestionar_usuarios_sin_ser_admin(self, client, cuenta, db, roles, h):
        # require_permission: alguien con un rol que tenga "usuarios.gestionar"
        id_rol = client.post("/api/roles", json={"nombre_rol": "supervisor"}, headers=h).json()["id_rol"]
        client.put(f"/api/roles/{id_rol}/permisos", json={"permisos": ["usuarios.gestionar"]}, headers=h)
        u = cuenta(correo="sup@alik.co")
        db.execute(
            text("UPDATE usuarios_roles SET id_rol = :r WHERE id_usuario = :u"), {"r": id_rol, "u": u.id_usuario}
        )
        db.commit()
        tokens = client.post("/auth/login", json={"username": "sup@alik.co", "password": CLAVE}).json()

        r = client.get("/api/usuarios", headers={"Authorization": f"Bearer {tokens['access_token']}"})

        assert r.status_code == 200
