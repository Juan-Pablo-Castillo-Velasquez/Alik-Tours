"""Adjuntos del chat: privados, solo para el cliente dueño del hilo y el
equipo. Antes quedaban públicos en /uploads/chat/<archivo>."""

import os

import pytest

from app.core import image_storage
from app.routes.mensaje_chat_route import CHAT_PRIVADO_DIR

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.4 adjunto de prueba"


@pytest.fixture(autouse=True)
def sin_cloudinary(monkeypatch):
    monkeypatch.setattr(image_storage, "CLOUDINARY_CONFIGURADO", False)


@pytest.fixture
def limpiar_archivos():
    antes = set(os.listdir(CHAT_PRIVADO_DIR)) if os.path.isdir(CHAT_PRIVADO_DIR) else set()
    yield
    if os.path.isdir(CHAT_PRIVADO_DIR):
        for nombre in set(os.listdir(CHAT_PRIVADO_DIR)) - antes:
            os.remove(os.path.join(CHAT_PRIVADO_DIR, nombre))


def _enviar(client, headers, contenido, nombre, tipo):
    r = client.post("/api/mensajes/me/enviar", headers=headers, files={"archivo": (nombre, contenido, tipo)})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.usefixtures("limpiar_archivos")
class TestAdjuntosChatPrivados:
    def test_la_respuesta_no_expone_donde_se_guardo(self, client, crear_usuario):
        _, h = crear_usuario()
        m = _enviar(client, h, PNG, "captura.png", "image/png")
        assert m["imagen_url"] == f"/mensajes/{m['id_mensaje']}/adjunto"
        assert m["archivo_url"] is None
        # El hilo (polling) devuelve la misma ruta protegida.
        hilo = client.get("/api/mensajes/me", headers=h).json()
        assert hilo[-1]["imagen_url"] == m["imagen_url"]

    def test_solo_el_dueno_y_el_equipo_lo_descargan(self, client, crear_usuario):
        _, h_dueno = crear_usuario()
        _, h_otro = crear_usuario()
        _, h_asesor = crear_usuario(roles=("empleado",), con_cliente=False)
        m = _enviar(client, h_dueno, PDF, "voucher.pdf", "application/pdf")
        assert m["archivo_url"] == f"/mensajes/{m['id_mensaje']}/adjunto"
        url = f"/api{m['archivo_url']}"

        r = client.get(url, headers=h_dueno)
        assert r.status_code == 200 and r.content.startswith(b"%PDF")
        assert r.headers["content-type"] == "application/pdf"
        assert "no-store" in r.headers["cache-control"]
        assert client.get(url, headers=h_asesor).status_code == 200
        assert client.get(url, headers=h_otro).status_code == 403
        assert client.get(url).status_code == 401

    def test_la_carpeta_publica_no_entrega_el_archivo(self, client, crear_usuario):
        _, h = crear_usuario()
        _enviar(client, h, PNG, "captura.png", "image/png")
        nombre = sorted(os.listdir(CHAT_PRIVADO_DIR))[-1]
        assert client.get(f"/uploads/chat-privado/{nombre}").status_code == 404

    def test_mensaje_sin_adjunto_o_inexistente_da_404(self, client, crear_usuario):
        _, h = crear_usuario()
        r = client.post("/api/mensajes/me/enviar", headers=h, data={"contenido": "Hola, una consulta"})
        assert r.status_code == 201
        assert client.get(f"/api/mensajes/{r.json()['id_mensaje']}/adjunto", headers=h).status_code == 404
        assert client.get("/api/mensajes/999999/adjunto", headers=h).status_code == 404

    def test_mensajes_viejos_conservan_su_url_publica(self):
        from app.schemas.mensaje_chat_schema import MensajeChatResponse

        viejo = MensajeChatResponse(
            id_mensaje=1,
            id_cliente=1,
            id_usuario_remitente=1,
            remitente_tipo="cliente",
            imagen_url="https://res.cloudinary.com/demo/image/upload/v1/chat/x.png",
            leido=False,
        )
        assert viejo.imagen_url.startswith("https://res.cloudinary.com/")
