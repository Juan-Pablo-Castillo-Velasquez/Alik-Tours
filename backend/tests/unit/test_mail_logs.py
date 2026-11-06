"""Los logs de envío de correo no deben llevar el correo completo (dato
personal, Ley 1581)."""

from app.core.mail import _ocultar_correo


def test_oculta_el_usuario_del_correo():
    assert _ocultar_correo("juanpablo@gmail.com") == "ju***@gmail.com"


def test_correo_raro_o_vacio_no_se_muestra():
    assert _ocultar_correo("sin-arroba") == "***"
    assert _ocultar_correo("") == "***"
