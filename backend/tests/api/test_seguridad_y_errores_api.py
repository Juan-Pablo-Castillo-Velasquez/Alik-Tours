"""Seguridad y contrato de errores de TODO el API.

Autor (semana 4, capa E2E, ángulo transversal): Juan Pablo Castillo.

- Endpoints protegidos: sin token (401), token inválido o vencido (401),
  rol insuficiente (403) y rol correcto (pasa).
- Errores: JSON mal formado y tipos incorrectos responden 422 en JSON; un
  error interno responde 500 genérico, sin SQL, rutas ni stack traces.
"""

from datetime import timedelta

import jwt
import pytest

from app.core.security import create_access_token

# (método, ruta, rol mínimo). Uno por cada familia de protección del API.
PROTEGIDOS = [
    ("GET", "/api/clientes", "empleado"),  # require_empleado
    ("GET", "/api/dashboard/resumen", "empleado"),  # require_empleado
    ("GET", "/api/notificaciones", "empleado"),  # require_empleado
    ("POST", "/api/hoteles/caracteristicas", "admin"),  # require_admin
    ("DELETE", "/api/hoteles/999", "admin"),  # require_admin
    ("GET", "/api/clientes/1/metodos-pago", "admin"),  # require_admin
]
CORREO_DE_ERROR = "Error interno del servidor. Revisa los logs del servidor para ver el detalle."


def _token(roles, **kw):
    return {"Authorization": "Bearer " + create_access_token(data={"sub": "1", "roles": roles}, **kw)}


class TestAutenticacion:
    @pytest.mark.parametrize(("metodo", "ruta", "_rol"), PROTEGIDOS)
    def test_sin_token_responde_401(self, client, metodo, ruta, _rol):
        r = client.request(metodo, ruta, json={"nombre_caracteristica": "Piscina"})

        assert r.status_code == 401
        assert r.json() == {"detail": "No autenticado"}

    @pytest.mark.parametrize(
        "cabecera",
        [
            "Token abc",  # esquema distinto a Bearer
            "Bearer",  # sin token
            "Bearer uno dos",  # partes de más
            "Bearer no-es-un-jwt",
        ],
    )
    def test_cabecera_mal_formada_responde_401(self, client, cabecera):
        r = client.get("/api/clientes", headers={"Authorization": cabecera})

        assert r.status_code == 401

    def test_token_vencido_responde_401(self, client):
        vencido = _token(["admin"], expires_delta=timedelta(seconds=-1))

        r = client.get("/api/clientes", headers=vencido)

        assert r.status_code == 401
        assert r.json() == {"detail": "Token expirado o inválido"}

    def test_token_firmado_con_otra_clave_responde_401(self, client):
        # Alguien arma un JWT con rol admin pero sin conocer SECRET_KEY.
        falso = jwt.encode({"sub": "1", "roles": ["admin"], "type": "access"}, "otra-clave", algorithm="HS256")

        r = client.get("/api/clientes", headers={"Authorization": f"Bearer {falso}"})

        assert r.status_code == 401


class TestAutorizacion:
    @pytest.mark.parametrize(("metodo", "ruta", "rol"), PROTEGIDOS)
    def test_un_cliente_recibe_403(self, client, metodo, ruta, rol):
        r = client.request(metodo, ruta, headers=_token(["cliente"]), json={"nombre_caracteristica": "Piscina"})

        assert r.status_code == 403

    @pytest.mark.parametrize(("metodo", "ruta", "rol"), [p for p in PROTEGIDOS if p[2] == "admin"])
    def test_un_empleado_no_entra_a_lo_que_es_solo_de_admin(self, client, metodo, ruta, rol):
        r = client.request(metodo, ruta, headers=_token(["empleado"]), json={"nombre_caracteristica": "Piscina"})

        assert r.status_code == 403
        assert r.json() == {"detail": "Requiere rol de administrador"}

    @pytest.mark.parametrize(("metodo", "ruta", "rol"), PROTEGIDOS)
    def test_con_el_rol_correcto_pasa_la_proteccion(self, client, crear_usuario, metodo, ruta, rol):
        # Usuario real con el rol en la BD: los permisos se verifican contra
        # la base de datos, no solo contra el token.
        _, headers = crear_usuario(roles=(rol,), con_cliente=False)
        r = client.request(metodo, ruta, headers=headers, json={"nombre_caracteristica": "Piscina"})

        # Puede ser 200, 201 o 404 (el recurso 999 no existe), nunca 401/403.
        assert r.status_code not in (401, 403)

    def test_una_cuenta_desactivada_no_puede_usar_su_token(self, client, crear_usuario):
        usuario, headers = crear_usuario(roles=("cliente",), activo=False)

        r = client.get(f"/api/clientes/{usuario.id_cliente}", headers=headers)

        assert r.status_code == 403
        assert "desactivada" in r.json()["detail"]

    def test_un_cliente_no_puede_ver_el_perfil_de_otro(self, client, crear_usuario):
        _, headers_ana = crear_usuario()
        otro, _ = crear_usuario()

        r = client.get(f"/api/clientes/{otro.id_cliente}", headers=headers_ana)

        assert r.status_code == 403

    def test_un_cliente_si_puede_ver_su_propio_perfil(self, client, crear_usuario):
        usuario, headers = crear_usuario()

        r = client.get(f"/api/clientes/{usuario.id_cliente}", headers=headers)

        assert r.status_code == 200
        assert r.json()["id_cliente"] == usuario.id_cliente


class TestContratoDeErrores:
    def test_json_mal_formado_responde_422_en_json(self, client):
        r = client.post("/api/contacto", content=b'{"nombre": "Ana",', headers={"Content-Type": "application/json"})

        assert r.status_code == 422
        assert r.headers["content-type"] == "application/json"
        assert r.json()["detail"][0]["type"] == "json_invalid"

    def test_tipo_incorrecto_responde_422_con_el_campo(self, client):
        r = client.get("/api/hoteles/no-es-un-numero")

        assert r.status_code == 422
        assert r.json()["detail"][0]["loc"] == ["path", "hotel_id"]

    def test_campo_obligatorio_faltante_responde_422(self, client):
        r = client.post("/api/contacto", json={"correo": "ana@correo.com"})

        assert r.status_code == 422
        faltantes = {e["loc"][-1] for e in r.json()["detail"] if e["type"] == "missing"}
        assert {"nombre", "asunto", "mensaje"} <= faltantes

    def test_un_recurso_inexistente_responde_404_en_json(self, client):
        r = client.get("/api/hoteles/999")

        assert r.status_code == 404
        assert r.headers["content-type"] == "application/json"

    @pytest.fixture
    def falla_interna(self, monkeypatch):
        """Stub: el repositorio revienta con un mensaje que trae SQL, como
        haría un error real de PostgreSQL."""
        from app.repositories.hotel_repository import HotelRepository

        def _revienta(*args, **kwargs):
            raise RuntimeError('relation "hoteles_secretos" does not exist: SELECT * FROM hoteles_secretos')

        monkeypatch.setattr(HotelRepository, "get_all", _revienta)

    def test_un_error_interno_responde_500_generico_sin_detalles(self, client, falla_interna):
        r = client.get("/api/hoteles/")

        assert r.status_code == 500
        assert r.json() == {"detail": CORREO_DE_ERROR}
        for filtrado in ("SELECT", "hoteles_secretos", "Traceback", "File ", ".py"):
            assert filtrado not in r.text

    def test_el_500_responde_cors_al_frontend_permitido(self, client, falla_interna):
        r = client.get("/api/hoteles/", headers={"Origin": "http://localhost:5173"})

        assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"

    def test_el_500_no_le_abre_cors_con_credenciales_a_cualquier_sitio(self, client, falla_interna):
        # Hallazgo de seguridad: el manejador global copiaba el Origin de la
        # petición, fuera cual fuera, junto con Allow-Credentials: true.
        r = client.get("/api/hoteles/", headers={"Origin": "https://sitio-malicioso.example"})

        assert r.status_code == 500
        assert r.headers.get("access-control-allow-origin") != "https://sitio-malicioso.example"


class TestTokensYRolesVigentes:
    """Hallazgos de la auditoría de producción (nov. 2026)."""

    def test_un_refresh_token_no_sirve_en_rutas_de_admin(self, client, crear_usuario):
        from app.core.security import create_refresh_token

        usuario, _ = crear_usuario(roles=("admin",), con_cliente=False)
        refresh = create_refresh_token(data={"sub": str(usuario.id_usuario), "roles": ["admin"]})
        r = client.get("/api/usuarios", headers={"Authorization": f"Bearer {refresh}"})
        assert r.status_code == 401

    def test_un_refresh_token_no_sirve_en_rutas_de_asesor(self, client, crear_usuario):
        from app.core.security import create_refresh_token

        usuario, _ = crear_usuario(roles=("empleado",), con_cliente=False)
        refresh = create_refresh_token(data={"sub": str(usuario.id_usuario), "roles": ["empleado"]})
        r = client.get("/api/reservas/buscar", headers={"Authorization": f"Bearer {refresh}"})
        assert r.status_code == 401

    def test_quitar_el_rol_de_admin_corta_el_acceso_de_inmediato(self, client, db, crear_usuario):
        from app.models.auth_model import UsuarioRol

        usuario, headers = crear_usuario(roles=("admin",), con_cliente=False)
        assert client.get("/api/usuarios", headers=headers).status_code == 200
        db.query(UsuarioRol).filter(UsuarioRol.id_usuario == usuario.id_usuario).delete()
        db.commit()
        r = client.get("/api/usuarios", headers=headers)
        assert r.status_code == 403

    def test_un_admin_desactivado_no_entra_al_panel(self, client, db, crear_usuario):
        usuario, headers = crear_usuario(roles=("admin",), con_cliente=False)
        usuario.activo = False
        db.commit()
        assert client.get("/api/usuarios", headers=headers).status_code == 403

    def test_token_de_un_usuario_que_ya_no_existe(self, client):
        assert client.get("/api/usuarios", headers=_token(["admin"])).status_code == 401


class TestComprobantesPrivados:
    """Los comprobantes de pago ya no se sirven por la carpeta pública."""

    def _pago_con_comprobante(self, db, cliente):
        import os
        from datetime import date, timedelta

        from app.models.reserva_model import MetodoPago, Pago, Reserva
        from app.routes.reserva_route import COMPROBANTES_UPLOAD_DIR

        metodo = MetodoPago(nombre_metodo="Nequi")
        db.add(metodo)
        db.commit()
        reserva = Reserva(
            id_cliente=cliente.id_cliente,
            fecha_inicio=date.today() + timedelta(days=5),
            fecha_fin=date.today() + timedelta(days=7),
            numero_personas=1,
            estado="pendiente",
        )
        db.add(reserva)
        db.commit()
        os.makedirs(COMPROBANTES_UPLOAD_DIR, exist_ok=True)
        nombre = "prueba-comprobante-privado.pdf"
        with open(os.path.join(COMPROBANTES_UPLOAD_DIR, nombre), "wb") as f:
            f.write(b"%PDF-1.4 prueba")
        pago = Pago(
            id_reserva=reserva.id_reserva,
            id_metodo_pago=metodo.id_metodo,
            monto=100,
            estado="pendiente",
            comprobante_url=f"/uploads/comprobantes/{nombre}",
        )
        db.add(pago)
        db.commit()
        return pago, os.path.join(COMPROBANTES_UPLOAD_DIR, nombre)

    def test_la_ruta_publica_ya_no_entrega_el_archivo(self, client, db, crear_usuario):
        import os

        usuario, _ = crear_usuario()
        pago, ruta = self._pago_con_comprobante(db, usuario.cliente)
        try:
            assert client.get(pago.comprobante_url).status_code == 404
        finally:
            os.remove(ruta)

    def test_solo_el_dueno_o_el_equipo_lo_descargan(self, client, db, crear_usuario):
        import os

        dueno, h_dueno = crear_usuario()
        _, h_otro = crear_usuario()
        _, h_asesor = crear_usuario(roles=("empleado",), con_cliente=False)
        pago, ruta = self._pago_con_comprobante(db, dueno.cliente)
        try:
            url = f"/api/pagos/{pago.id_pago}/comprobante"
            r = client.get(url, headers=h_dueno)
            assert r.status_code == 200 and r.content.startswith(b"%PDF")
            assert "no-store" in r.headers["cache-control"]
            assert client.get(url, headers=h_asesor).status_code == 200
            assert client.get(url, headers=h_otro).status_code == 403
            assert client.get(url).status_code == 401
        finally:
            os.remove(ruta)


class TestCuentaSinVerificar:
    """El token provisional del registro no sirve para operaciones sensibles."""

    @pytest.mark.parametrize(
        ("metodo", "ruta"),
        [
            ("POST", "/api/reservas"),
            ("POST", "/api/reservas/1/pagar"),
            ("POST", "/api/resenas"),
            ("POST", "/api/comunidad/publicaciones"),
            ("POST", "/api/mensajes/me/enviar"),
            ("POST", "/api/metodos-pago-guardados"),
            ("POST", "/api/reservas/1/solicitud-cancelacion"),
        ],
    )
    def test_sin_verificar_responde_403(self, client, db, crear_usuario, metodo, ruta):
        usuario, headers = crear_usuario()
        usuario.verificado = False
        db.commit()
        r = client.request(metodo, ruta, headers=headers, json={})
        assert r.status_code == 403
        assert "Verifica tu correo" in r.json()["detail"]
