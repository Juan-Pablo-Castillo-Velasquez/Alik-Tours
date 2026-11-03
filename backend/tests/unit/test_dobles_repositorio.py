"""El repositorio (la sesión de SQLAlchemy) visto como dependencia.

Autor (semana 5, capa BD): Juan Pablo Castillo.

Aquí NO se usa ninguna BD: la sesión es un doble. Lo que se verifica es
el COMPORTAMIENTO del servicio frente a su repositorio: qué guarda, cuándo
NO guarda nada, y con qué datos llama. (La BD real se prueba en la semana
6 con integración; ahí se ve si lo guardado cumple las restricciones.)
"""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.models.reserva_model import HistorialReserva
from app.models.user_model import Usuario
from app.services import auth_service, pago_estado_service
from app.services.pago_estado_service import TransicionPagoInvalida, cambiar_estado_pago


def _pago(estado="pendiente", monto=480000):
    return SimpleNamespace(id_pago=None, estado=estado, monto=monto, numero_factura=None)


def _reserva(estado="pendiente"):
    return SimpleNamespace(id_reserva=12, id_cliente=7, estado=estado)


@pytest.fixture
def notificaciones(monkeypatch):
    """Spy: anota cada notificación que el servicio intenta crear."""
    espia = MagicMock(name="crear_notificacion")
    monkeypatch.setattr(pago_estado_service, "crear_notificacion", espia)
    return espia


class TestCambiarEstadoPago:
    def test_una_transicion_invalida_no_toca_la_bd_ni_notifica(self, notificaciones):
        # Mock de la sesión: si el servicio la usara, quedaría registrado.
        db = MagicMock(name="sesion")
        pago = _pago(estado="pagado")

        with pytest.raises(TransicionPagoInvalida):
            cambiar_estado_pago(db, pago, _reserva(), "pendiente", comentario="intento de reabrir")

        assert db.mock_calls == []  # verifyNoInteractions
        notificaciones.assert_not_called()

    def test_aprobar_confirma_la_reserva_numera_el_comprobante_y_deja_historial(self, notificaciones):
        # Arrange: el flush() de la sesión es el que asigna id_pago
        pago, reserva = _pago(), _reserva()
        db = MagicMock(name="sesion")
        db.flush.side_effect = lambda: setattr(pago, "id_pago", 45)

        # Act
        cambiar_estado_pago(db, pago, reserva, "pagado", comentario="Pago con tarjeta", id_empleado=3)

        # Assert: estado (lo que quedó en los objetos)
        assert reserva.estado == "confirmada"
        assert pago.numero_factura == "FAC-000045"
        # Assert: comportamiento (qué se le pidió guardar al repositorio)
        db.flush.assert_called_once()
        historial = db.add.call_args.args[0]
        assert isinstance(historial, HistorialReserva)
        assert (historial.estado_anterior, historial.estado_nuevo) == ("pendiente", "confirmada")
        assert historial.id_empleado_responsable == 3
        db.commit.assert_not_called()  # la transacción la confirma quien llama

    def test_aprobar_notifica_al_admin_y_al_cliente_con_el_monto_en_pesos(self, notificaciones):
        pago = _pago(monto=480000)
        db = MagicMock(name="sesion")
        db.flush.side_effect = lambda: setattr(pago, "id_pago", 45)

        cambiar_estado_pago(db, pago, _reserva(), "pagado", comentario="")

        assert notificaciones.call_count == 2
        al_admin, al_cliente = (c.kwargs for c in notificaciones.call_args_list)
        assert "id_cliente" not in al_admin  # sin cliente: va a la campana del admin
        assert "$480.000" in al_admin["mensaje"]
        assert al_cliente["id_cliente"] == 7
        assert al_cliente["titulo"] == "¡Pago aprobado!"
        assert al_admin["commit"] is False and al_cliente["commit"] is False

    def test_rechazar_deja_historial_pero_no_numera_ni_notifica(self, notificaciones):
        pago, reserva = _pago(estado="procesando"), _reserva()
        db = MagicMock(name="sesion")

        cambiar_estado_pago(db, pago, reserva, "rechazado", comentario="Fondos insuficientes")

        db.flush.assert_not_called()
        assert pago.numero_factura is None
        assert reserva.estado == "pendiente"
        db.add.assert_called_once()
        notificaciones.assert_not_called()

    def test_un_comprobante_ya_numerado_no_se_renumera(self, notificaciones):
        pago = _pago()
        pago.numero_factura = "FAC-000001"
        db = MagicMock(name="sesion")
        db.flush.side_effect = lambda: setattr(pago, "id_pago", 99)

        cambiar_estado_pago(db, pago, _reserva(), "pagado", comentario="")

        assert pago.numero_factura == "FAC-000001"


class TestRegistroDeUsuario:
    @pytest.fixture
    def repo(self, monkeypatch):
        """Stubs de las funciones del repositorio de usuarios."""
        stubs = SimpleNamespace(buscar_usuario=MagicMock(return_value=None), crear=MagicMock())
        monkeypatch.setattr(auth_service, "get_user_by_username", stubs.buscar_usuario)
        monkeypatch.setattr(auth_service, "create_user", stubs.crear)
        return stubs

    def test_si_el_usuario_ya_existe_no_crea_nada(self, repo):
        repo.buscar_usuario.return_value = SimpleNamespace(id_usuario=1)
        db = MagicMock(name="sesion")

        resultado = auth_service.register_user(db, "ana", "ana@correo.com", "Clave123!")

        assert resultado == {"error": "El nombre de usuario ya existe"}
        repo.crear.assert_not_called()
        db.commit.assert_not_called()

    def test_si_el_correo_ya_existe_no_crea_nada(self, repo):
        db = MagicMock(name="sesion")
        db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(id_usuario=2)

        resultado = auth_service.register_user(db, "ana", "ana@correo.com", "Clave123!")

        assert resultado == {"error": "El correo electrónico ya está registrado"}
        repo.crear.assert_not_called()

    def test_guarda_la_contrasena_hasheada_y_sin_verificar(self, repo):
        db = MagicMock(name="sesion")
        db.query.return_value.filter.return_value.first.return_value = None
        repo.crear.side_effect = lambda _db, datos: Usuario(id_usuario=5, **datos)

        resultado = auth_service.register_user(db, "ana", "ana@correo.com", "Clave123!", terminos_version="2026-10")

        datos = repo.crear.call_args.args[1]
        assert datos["password_hash"] != "Clave123!"
        assert datos["password_hash"].startswith("$2")  # bcrypt
        assert datos["verificado"] is False and datos["activo"] is True
        assert datos["terminos_version"] == "2026-10"
        assert resultado["user_id"] == 5
        assert len(resultado["verification_code"]) == 6
