"""Límites de los esquemas de entrada, en su valor límite.

Autor (semana 6, capa API): Juan Pablo Castillo.

Cada uno nació de un 500 que encontró la integración con PostgreSQL
(tests/integration/test_api_con_bd_real.py): la BD rechazaba el dato y el
API respondía "error interno". La regla correcta vive en el esquema (422
con el campo), y aquí queda probada en su límite exacto, sin BD.
"""

import pytest
from pydantic import ValidationError

from app.schemas.hotel_schema import HabitacionUpdate, HotelUpdate
from app.schemas.user_schema import MENSAJE_PASSWORD, PasswordResetConfirm, UsuarioCreate

BASE = {"correo_electronico": "ana@correo.com", "password": "Clave123"}


class TestUsuarioCreate:
    def test_usuario_de_50_caracteres_es_valido(self):
        assert len(UsuarioCreate(username="u" * 50, **BASE).username) == 50

    def test_usuario_de_51_caracteres_se_rechaza(self):
        with pytest.raises(ValidationError, match="at most 50"):
            UsuarioCreate(username="u" * 51, **BASE)

    @pytest.mark.parametrize(
        ("password", "valida"),
        [
            ("Abc123", True),  # 6 caracteres: mínimo exacto
            ("Ab123", False),  # 5: uno menos
            ("abc123", False),  # sin mayúscula
            ("ABC123", False),  # sin minúscula
            ("Abcdef", False),  # sin número
            ("", False),
        ],
    )
    def test_regla_de_contrasena_igual_a_la_del_formulario(self, password, valida):
        if valida:
            UsuarioCreate(username="ana", correo_electronico="ana@correo.com", password=password)
        else:
            with pytest.raises(ValidationError, match=MENSAJE_PASSWORD):
                UsuarioCreate(username="ana", correo_electronico="ana@correo.com", password=password)

    def test_restablecer_la_contrasena_exige_la_misma_regla(self):
        with pytest.raises(ValidationError, match=MENSAJE_PASSWORD):
            PasswordResetConfirm(token="t", new_password="123")
        assert PasswordResetConfirm(token="t", new_password="Nueva123").new_password == "Nueva123"


class TestHotelYHabitacionUpdate:
    def test_nombre_de_hotel_de_100_es_valido_y_de_101_no(self):
        assert HotelUpdate(nombre_hotel="h" * 100).nombre_hotel == "h" * 100
        with pytest.raises(ValidationError, match="at most 100"):
            HotelUpdate(nombre_hotel="h" * 101)

    @pytest.mark.parametrize(("campo", "maximo"), [("telefono", 20), ("codigo_postal", 20), ("direccion", 255)])
    def test_los_demas_campos_respetan_el_tamano_de_su_columna(self, campo, maximo):
        HotelUpdate(**{campo: "9" * maximo})
        with pytest.raises(ValidationError):
            HotelUpdate(**{campo: "9" * (maximo + 1)})

    def test_numero_de_habitacion_de_20_es_valido_y_de_21_no(self):
        assert HabitacionUpdate(numero_habitacion="9" * 20).numero_habitacion == "9" * 20
        with pytest.raises(ValidationError):
            HabitacionUpdate(numero_habitacion="9" * 21)

    def test_editar_sin_mandar_un_campo_sigue_siendo_valido(self):
        assert HotelUpdate().model_dump(exclude_unset=True) == {}


def test_el_motor_de_la_bd_no_escribe_el_sql_en_el_log_por_defecto():
    # Hallazgo: con echo=True el log mostraba cada INSERT con el hash de la
    # contraseña del usuario.
    from app.core.database import engine

    assert engine.echo is False
