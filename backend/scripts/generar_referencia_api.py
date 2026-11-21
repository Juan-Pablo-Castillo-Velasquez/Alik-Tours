"""Genera la referencia completa de la API desde el OpenAPI real de FastAPI.

Escribe:
- docs/referencia-tecnica/openapi.json  (importable en Postman / Insomnia)
- docs/referencia-tecnica/api-referencia-completa.md  (todas las rutas por módulo)

Volver a correrlo tras agregar o cambiar un endpoint:

    cd backend && python scripts/generar_referencia_api.py
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from app.main import app  # noqa: E402

DOCS = RAIZ.parent / "docs" / "referencia-tecnica"
METODOS = ("get", "post", "put", "patch", "delete")


def _auth(op: dict) -> str:
    """Quién puede llamar el endpoint, deducido de sus dependencias/cabeceras."""
    params = {p.get("name", "").lower() for p in op.get("parameters", [])}
    if "x-device-key" in params:
        return "Dispositivo (`X-Device-Key`)"
    if "authorization" in params:
        return "JWT"
    return "Pública"


def _params(op: dict) -> str:
    nombres = [
        f"`{p['name']}`{'*' if p.get('required') else ''}"
        for p in op.get("parameters", [])
        if p.get("in") in ("query", "path") and p.get("name")
    ]
    return ", ".join(nombres) or "—"


def _cuerpo(op: dict) -> str:
    contenido = op.get("requestBody", {}).get("content", {})
    for tipo, datos in contenido.items():
        ref = datos.get("schema", {}).get("$ref", "")
        nombre = ref.rsplit("/", 1)[-1] if ref else tipo
        return f"`{nombre}`"
    return "—"


def _respuestas(op: dict) -> str:
    return ", ".join(sorted(op.get("responses", {}).keys())) or "—"


def main() -> None:
    esquema = app.openapi()
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / "openapi.json").write_text(json.dumps(esquema, ensure_ascii=False, indent=2), encoding="utf-8")

    grupos: dict[str, list] = defaultdict(list)
    for ruta, operaciones in sorted(esquema["paths"].items()):
        for metodo in METODOS:
            op = operaciones.get(metodo)
            if op is None:
                continue
            etiqueta = (op.get("tags") or ["General"])[0]
            resumen = (op.get("summary") or "").strip()
            descripcion = (op.get("description") or "").strip().split("\n")[0][:140]
            grupos[etiqueta].append((metodo.upper(), ruta, resumen, descripcion, op))

    total = sum(len(v) for v in grupos.values())
    lineas = [
        "# Referencia completa de la API",
        "",
        "> Generada por `backend/scripts/generar_referencia_api.py` desde el OpenAPI",
        "> real de FastAPI (no editar a mano). Documentación interactiva: `/docs`",
        "> (Swagger UI) y `/redoc` del backend. Esquema importable en Postman:",
        "> [`openapi.json`](openapi.json).",
        "",
        f"**{total} operaciones en {len(grupos)} módulos** · versión {esquema['info'].get('version', '')}.",
        "",
        "Autenticación: `JWT` = cabecera `Authorization: Bearer <token>` de",
        "`POST /auth/login` (el rol requerido —cliente, empleado o admin— se valida",
        "en el servidor contra la base de datos). `*` = parámetro obligatorio.",
        "Errores: ver el contrato en `docs/entrega-final/03-arranque-del-backend.md`.",
        "",
        "## Módulos",
        "",
    ]
    for etiqueta in sorted(grupos):
        ancla = etiqueta.lower().replace(" ", "-").replace("/", "")
        lineas.append(f"- [{etiqueta}](#{ancla}) ({len(grupos[etiqueta])})")
    for etiqueta in sorted(grupos):
        lineas += [
            "",
            f"## {etiqueta}",
            "",
            "| Método | Ruta | Descripción | Acceso | Parámetros | Cuerpo | Respuestas |",
        ]
        lineas.append("|---|---|---|---|---|---|---|")
        for metodo, ruta, resumen, descripcion, op in grupos[etiqueta]:
            texto = descripcion or resumen
            texto = texto.replace("|", "\\|")
            lineas.append(
                f"| `{metodo}` | `{ruta}` | {texto} | {_auth(op)} | {_params(op)} | {_cuerpo(op)} | {_respuestas(op)} |"
            )
    (DOCS / "api-referencia-completa.md").write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print(f"Escrito docs/referencia-tecnica/api-referencia-completa.md ({total} operaciones) y openapi.json")


if __name__ == "__main__":
    main()
