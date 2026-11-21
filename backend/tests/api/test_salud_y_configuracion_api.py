"""Arranque del backend: /health con estados y mensajes claros cuando falta
una variable de entorno (criterio de inicialización sin errores)."""

import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]


def test_health_ok_con_base_de_datos_y_cache(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "up", "cache": "up"}


def test_health_degradado_si_la_cache_no_responde(client, redis_falso, monkeypatch):
    def caido():
        raise ConnectionError("redis caído")

    monkeypatch.setattr(redis_falso, "ping", caido)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "degradado" and r.json()["cache"] == "down"


def test_falta_una_variable_de_entorno_explica_cual(tmp_path):
    # Proceso aparte, sin .env y sin DATABASE_URL: no debe salir un traceback
    # de Pydantic sino un mensaje que nombre la variable y la guía.
    entorno = {"PATH": "/usr/bin:/bin", "SECRET_KEY": "x" * 40, "PYTHONPATH": str(BACKEND)}
    r = subprocess.run(
        [sys.executable, "-c", "import app.core.config"],
        cwd=tmp_path,
        env=entorno,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert r.returncode == 1
    assert "DATABASE_URL: falta definirla" in r.stderr
    assert "Traceback" not in r.stderr


def test_secret_key_corta_se_rechaza_con_mensaje(tmp_path):
    entorno = {
        "PATH": "/usr/bin:/bin",
        "PYTHONPATH": str(BACKEND),
        "DATABASE_URL": "sqlite://",
        "SECRET_KEY": "corta",
        "ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": "30",
        "MAIL_FROM": "a@b.co",
        "MAIL_PORT": "1025",
        "MAIL_SERVER": "localhost",
        "MAIL_FROM_NAME": "Alik",
    }
    r = subprocess.run(
        [sys.executable, "-c", "import app.core.config"],
        cwd=tmp_path,
        env=entorno,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert r.returncode == 1
    assert "SECRET_KEY" in r.stderr and "mínimo 32 caracteres" in r.stderr
