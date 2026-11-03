"""Reglas de negocio del pago simulado y de los estados de un Pago.

Autor (semana 2, capa API): Fernando Gutiérrez.

Unidades bajo prueba (sin BD ni FastAPI):
- app/services/payment_service.py: qué métodos quedan "procesando" y qué
  datos de prueba hacen que el pago se rechace.
- app/services/pago_estado_service.py: qué transiciones de estado se
  permiten, el número de comprobante y el total ya pagado de una reserva.
"""

from types import SimpleNamespace

import pytest

from app.services.pago_estado_service import (
    TransicionPagoInvalida,
    cambiar_estado_pago,
    numero_comprobante,
    total_pagado,
)
from app.services.payment_service import debe_simular_rechazo, es_pago_asincrono


class TestPagoAsincrono:
    @pytest.mark.parametrize("metodo", ["pse", "nequi"])
    def test_pse_y_nequi_quedan_procesando_hasta_confirmar(self, metodo):
        assert es_pago_asincrono(metodo) is True

    @pytest.mark.parametrize("metodo", ["tarjeta_credito", "tarjeta_debito", "paypal", "efectivo", ""])
    def test_los_demas_metodos_se_resuelven_al_instante(self, metodo):
        assert es_pago_asincrono(metodo) is False


class TestSimularRechazo:
    @pytest.mark.parametrize(
        ("metodo", "datos", "rechazado"),
        [
            # Tarjeta: solo el final 0002 se rechaza (valores vecinos aprobados)
            ("tarjeta_credito", {"ultimos4": "0002"}, True),
            ("tarjeta_debito", {"ultimos4": "0002"}, True),
            ("tarjeta_credito", {"ultimos4": "0001"}, False),
            ("tarjeta_credito", {"ultimos4": "0003"}, False),
            ("tarjeta_credito", {"ultimos4": None}, False),
            # Nequi: celular que TERMINA en 0000
            ("nequi", {"celular": "3001230000"}, True),
            ("nequi", {"celular": "3001230001"}, False),
            ("nequi", {"celular": "0000300123"}, False),  # 0000 al inicio no cuenta
            # PSE: documento exactamente 0000000000 (10 ceros)
            ("pse", {"documento": "0000000000"}, True),
            ("pse", {"documento": "000000000"}, False),  # 9 ceros
            ("pse", {"documento": "1020304050"}, False),
            # Método sin regla de rechazo
            ("paypal", {"ultimos4": "0002", "celular": "3000000000"}, False),
        ],
    )
    def test_datos_de_prueba_deciden_el_rechazo(self, metodo, datos, rechazado):
        # Arrange
        pago = SimpleNamespace(**datos)
        # Act
        resultado = debe_simular_rechazo(metodo, pago)
        # Assert
        assert resultado is rechazado

    def test_un_objeto_sin_los_campos_opcionales_se_aprueba(self):
        assert debe_simular_rechazo("tarjeta_credito", object()) is False


def _pago(estado="pendiente", monto=100000, id_pago=1):
    return SimpleNamespace(estado=estado, monto=monto, id_pago=id_pago, numero_factura=None)


class TestTransicionesDePago:
    @pytest.mark.parametrize("actual", ["pagado", "rechazado", "cancelado"])
    @pytest.mark.parametrize("nuevo", ["pendiente", "procesando", "pagado", "rechazado", "cancelado"])
    def test_un_estado_final_no_cambia_nunca(self, actual, nuevo):
        pago = _pago(estado=actual)
        if nuevo == actual:
            # Mismo estado: no es un error, simplemente no hace nada.
            cambiar_estado_pago(db=None, pago=pago, reserva=None, nuevo_estado=nuevo, comentario="")
            assert pago.estado == actual
        else:
            with pytest.raises(TransicionPagoInvalida) as exc:
                cambiar_estado_pago(db=None, pago=pago, reserva=None, nuevo_estado=nuevo, comentario="")
            assert exc.value.actual == actual
            assert exc.value.nuevo == nuevo
            assert pago.estado == actual  # no quedó a medio cambiar

    def test_procesando_no_puede_volver_a_pendiente(self):
        pago = _pago(estado="procesando")

        with pytest.raises(TransicionPagoInvalida, match="'procesando' no puede pasar a 'pendiente'"):
            cambiar_estado_pago(db=None, pago=pago, reserva=None, nuevo_estado="pendiente", comentario="")

    def test_pendiente_pasa_a_procesando_sin_tocar_la_reserva(self):
        # Arrange
        pago = _pago(estado="pendiente")
        reserva = SimpleNamespace(estado="pendiente", id_reserva=1)
        # Act: "procesando" no es final, así que no escribe historial (db=None no se usa)
        cambiar_estado_pago(db=None, pago=pago, reserva=reserva, nuevo_estado="procesando", comentario="PSE")
        # Assert
        assert pago.estado == "procesando"
        assert reserva.estado == "pendiente"


class TestNumeroComprobante:
    @pytest.mark.parametrize(
        ("id_pago", "esperado"),
        [(1, "FAC-000001"), (45, "FAC-000045"), (999999, "FAC-999999"), (1000000, "FAC-1000000")],
    )
    def test_rellena_con_ceros_hasta_seis_cifras(self, id_pago, esperado):
        assert numero_comprobante(id_pago) == esperado


class TestTotalPagado:
    def test_suma_solo_los_pagos_aprobados(self):
        reserva = SimpleNamespace(
            pagos=[_pago("pagado", 300000, 1), _pago("rechazado", 500000, 2), _pago("pagado", 200000, 3)]
        )

        assert total_pagado(reserva) == 500000.0

    def test_puede_excluir_el_pago_que_se_esta_editando(self):
        reserva = SimpleNamespace(pagos=[_pago("pagado", 300000, 1), _pago("pagado", 200000, 2)])

        assert total_pagado(reserva, excluir_id_pago=2) == 300000.0

    def test_una_reserva_sin_pagos_o_con_monto_vacio_suma_cero(self):
        assert total_pagado(SimpleNamespace(pagos=[])) == 0.0
        assert total_pagado(SimpleNamespace(pagos=[_pago("pagado", None, 1)])) == 0.0
