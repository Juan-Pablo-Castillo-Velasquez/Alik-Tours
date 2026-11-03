"""Perfiles de cliente y empleados (panel y registro).

Autor (semana 8, capa API): Fernando Gutiérrez. Segundo archivo nacido del
análisis de ramas sin cubrir: cliente_route.py.
"""

import pytest

from app.models.cliente_model import Cliente
from app.models.reserva_model import Reserva


@pytest.fixture
def admin(crear_usuario):
    return crear_usuario(roles=("admin",), con_cliente=False)[1]


def _cliente(**cambios):
    datos = {
        "nombre": "Ana",
        "apellido": "Pérez",
        "cedula": "1020304050",
        "correo": "ana@correo.com",
        "celular": "3001234567",
    }
    datos.update(cambios)
    return datos


class TestPerfilDeCliente:
    def test_una_cuenta_nueva_crea_su_perfil_y_lo_vincula(self, client, crear_usuario, db):
        # Como lo hace RegisterModal: cuenta sin perfil -> POST /clientes -> vincular
        usuario, h = crear_usuario(con_cliente=False)
        usuario.correo_electronico = "ana@correo.com"
        db.commit()

        creado = client.post("/api/clientes", json=_cliente(), headers=h)
        vinculado = client.put(
            f"/api/usuarios/{usuario.id_usuario}/vincular-cliente",
            json={"id_cliente": creado.json()["id_cliente"]},
            headers=h,
        )

        assert creado.status_code == 201
        assert vinculado.status_code == 200
        db.refresh(usuario)
        assert usuario.id_cliente == creado.json()["id_cliente"]

    @pytest.mark.parametrize(("campo", "valor"), [("cedula", "1020304050"), ("correo", "ana@correo.com")])
    def test_cedula_o_correo_repetidos_responden_409(self, client, crear_usuario, campo, valor):
        _, h = crear_usuario(con_cliente=False)
        client.post("/api/clientes", json=_cliente(), headers=h)
        otro = _cliente(cedula="9999999999", correo="otra@correo.com")
        otro[campo] = valor

        r = client.post("/api/clientes", json=otro, headers=h)

        assert r.status_code == 409

    def test_un_celular_invalido_responde_422(self, client, crear_usuario):
        _, h = crear_usuario(con_cliente=False)

        assert client.post("/api/clientes", json=_cliente(celular="123"), headers=h).status_code == 422

    def test_nadie_puede_apropiarse_del_perfil_de_otro_cliente(self, client, crear_usuario, db):
        # Hallazgo de seguridad: cualquier cuenta podía vincularse a un perfil
        # de cliente que todavía no tuviera usuario (por ejemplo, uno creado en
        # la oficina) y desde ese momento ver sus reservas y pagos.
        perfil_ajeno = Cliente(nombre="Eva", apellido="Ruiz", cedula="5555555555", correo="eva@correo.com")
        db.add(perfil_ajeno)
        db.commit()
        intrusa, h = crear_usuario(con_cliente=False)

        r = client.put(
            f"/api/usuarios/{intrusa.id_usuario}/vincular-cliente",
            json={"id_cliente": perfil_ajeno.id_cliente},
            headers=h,
        )

        assert r.status_code == 403
        db.refresh(intrusa)
        assert intrusa.id_cliente is None

    def test_no_se_vincula_el_usuario_de_otra_persona(self, client, crear_usuario):
        _, h = crear_usuario(con_cliente=False)
        otro, _ = crear_usuario(con_cliente=False)

        r = client.put(f"/api/usuarios/{otro.id_usuario}/vincular-cliente", json={"id_cliente": 1}, headers=h)

        assert r.status_code == 403

    def test_un_perfil_ya_vinculado_no_se_puede_vincular_a_otra_cuenta(self, client, crear_usuario, admin):
        dueno, _ = crear_usuario()  # ya tiene perfil vinculado
        otro, _ = crear_usuario(con_cliente=False)

        r = client.put(
            f"/api/usuarios/{otro.id_usuario}/vincular-cliente", json={"id_cliente": dueno.id_cliente}, headers=admin
        )

        assert r.status_code == 409

    def test_el_cliente_edita_su_perfil_pero_no_el_de_otro(self, client, crear_usuario):
        usuario, h = crear_usuario()
        otro, _ = crear_usuario()

        propio = client.put(f"/api/clientes/{usuario.id_cliente}", json={"ciudad": "Medellín"}, headers=h)
        ajeno = client.put(f"/api/clientes/{otro.id_cliente}", json={"ciudad": "Cali"}, headers=h)

        assert propio.status_code == 200 and propio.json()["ciudad"] == "Medellín"
        assert ajeno.status_code == 403

    def test_cambiar_el_correo_por_el_de_otro_cliente_responde_409(self, client, crear_usuario, db):
        usuario, h = crear_usuario()
        otro, _ = crear_usuario()
        correo_ajeno = db.get(Cliente, otro.id_cliente).correo

        r = client.put(f"/api/clientes/{usuario.id_cliente}", json={"correo": correo_ajeno}, headers=h)

        assert r.status_code == 409

    def test_el_admin_lista_y_borra_un_cliente_sin_reservas(self, client, crear_usuario, admin, db):
        usuario, _ = crear_usuario()
        id_cliente = usuario.id_cliente

        assert len(client.get("/api/clientes", headers=admin).json()) == 1
        assert client.delete(f"/api/clientes/{id_cliente}", headers=admin).status_code == 200
        assert client.delete(f"/api/clientes/{id_cliente}", headers=admin).status_code == 404

    def test_un_cliente_con_reservas_no_se_puede_borrar(self, client, crear_usuario, admin, db):
        usuario, _ = crear_usuario()
        db.add(Reserva(id_cliente=usuario.id_cliente, numero_personas=1, estado="pendiente"))
        db.commit()

        assert client.delete(f"/api/clientes/{usuario.id_cliente}", headers=admin).status_code == 409

    def test_un_perfil_inexistente_responde_404(self, client, admin):
        assert client.get("/api/clientes/999", headers=admin).status_code == 404
        assert client.put("/api/clientes/999", json={"ciudad": "Cali"}, headers=admin).status_code == 404


class TestEmpleados:
    DATOS = {
        "nombre": "Andrés",
        "apellido": "Castro",
        "cedula": "80000001",
        "correo_electronico": "andres@alik.co",
        "fecha_contratacion": "2026-01-15",
    }

    def test_crud_de_empleados(self, client, admin):
        creado = client.post("/api/empleados", json=self.DATOS, headers=admin)
        assert creado.status_code == 201
        id_emp = creado.json()["id_empleado"]

        assert client.get(f"/api/empleados/{id_emp}", headers=admin).json()["nombre"] == "Andrés"
        assert len(client.get("/api/empleados", headers=admin).json()) == 1
        assert (
            client.put(f"/api/empleados/{id_emp}", json={"ciudad": "Bogotá"}, headers=admin).json()["ciudad"]
            == "Bogotá"
        )
        assert client.delete(f"/api/empleados/{id_emp}", headers=admin).status_code == 200
        assert client.get(f"/api/empleados/{id_emp}", headers=admin).status_code == 404

    def test_cedula_repetida_responde_409(self, client, admin):
        client.post("/api/empleados", json=self.DATOS, headers=admin)

        r = client.post("/api/empleados", json={**self.DATOS, "correo_electronico": "otro@alik.co"}, headers=admin)

        assert r.status_code == 409

    def test_un_empleado_inexistente_responde_404(self, client, admin):
        assert client.put("/api/empleados/999", json={"ciudad": "Cali"}, headers=admin).status_code == 404
        assert client.delete("/api/empleados/999", headers=admin).status_code == 404

    def test_un_cliente_no_ve_la_lista_de_empleados(self, client, crear_usuario):
        _, h = crear_usuario()

        assert client.get("/api/empleados", headers=h).status_code == 403


def test_usuario_inexistente_al_vincular_responde_404(client, admin):
    assert client.put("/api/usuarios/999/vincular-cliente", json={"id_cliente": 1}, headers=admin).status_code == 404
