"""Simulador del dispositivo IoT de un vehículo de traslados de Alik Tours.

Reproduce lo que haría el ESP32 de `iot/esp32/main.py`: recorre la ruta
Aeropuerto Rafael Núñez -> Centro Histórico de Cartagena y cada N segundos
envía una lectura (posición, velocidad, temperatura y humedad de cabina,
pasajeros y batería) a POST /api/iot/lecturas con su clave.

Solo usa la biblioteca estándar de Python (no hay que instalar nada).

Uso:
    python iot/simulador_traslado.py --clave <CLAVE_DEL_PANEL>
    python iot/simulador_traslado.py --url https://<backend>.onrender.com --clave <CLAVE> --intervalo 5
    python iot/simulador_traslado.py --clave <CLAVE> --calor     # fuerza una alerta de temperatura

La clave la entrega el panel (POST /api/iot/dispositivos) una sola vez.
"""

import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime

# Puntos de la ruta (lat, lon): aeropuerto -> Crespo -> Bocagrande -> Centro.
RUTA = [
    (10.4424, -75.5130),
    (10.4380, -75.5180),
    (10.4300, -75.5290),
    (10.4235, -75.5420),
    (10.4180, -75.5480),
    (10.4236, -75.5510),
    (10.4250, -75.5490),
]


def interpolar(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def generar_lecturas(total, calor=False):
    """Genera `total` lecturas recorriendo la ruta de forma continua."""
    bateria = 96.0
    pasajeros = random.randint(2, 7)
    tramos = len(RUTA) - 1
    for i in range(total):
        progreso = (i / max(total - 1, 1)) * tramos
        tramo = min(int(progreso), tramos - 1)
        lat, lon = interpolar(RUTA[tramo], RUTA[tramo + 1], progreso - tramo)
        bateria = max(5.0, bateria - random.uniform(0.2, 0.6))
        yield {
            "medido_en": datetime.now(UTC).isoformat(),
            "latitud": round(lat + random.uniform(-0.0002, 0.0002), 6),
            "longitud": round(lon + random.uniform(-0.0002, 0.0002), 6),
            "velocidad_kmh": round(random.uniform(18, 55), 1),
            "temperatura_c": round(random.uniform(29, 33) if calor else random.uniform(21, 25), 1),
            "humedad_pct": round(random.uniform(55, 80), 1),
            "pasajeros": pasajeros,
            "bateria_pct": round(bateria, 1),
        }


def enviar(url, clave, lectura, timeout=10):
    """POST JSON con la cabecera X-Device-Key. Devuelve (código, cuerpo)."""
    peticion = urllib.request.Request(
        f"{url.rstrip('/')}/api/iot/lecturas",
        data=json.dumps(lectura).encode(),
        headers={"Content-Type": "application/json", "X-Device-Key": clave},
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", default="http://localhost:8000", help="URL del backend (sin /api)")
    p.add_argument("--clave", required=True, help="Clave del dispositivo (X-Device-Key)")
    p.add_argument("--lecturas", type=int, default=12, help="Cuántas lecturas enviar")
    p.add_argument("--intervalo", type=float, default=3, help="Segundos entre lecturas")
    p.add_argument("--calor", action="store_true", help="Simula la cabina caliente (alerta)")
    args = p.parse_args(argv)

    errores = 0
    for n, lectura in enumerate(generar_lecturas(args.lecturas, args.calor), start=1):
        reintentos = 0
        while True:
            try:
                codigo, cuerpo = enviar(args.url, args.clave, lectura)
            except (urllib.error.URLError, TimeoutError) as e:
                # Sin red: reintenta con espera creciente (como el ESP32).
                reintentos += 1
                if reintentos > 3:
                    print(f"[{n}] sin conexión con {args.url}: {e}", file=sys.stderr)
                    errores += 1
                    break
                time.sleep(2**reintentos)
                continue
            if codigo == 201:
                alertas = f" ALERTAS: {'; '.join(cuerpo['alertas'])}" if cuerpo.get("alertas") else ""
                print(
                    f"[{n}] 201 lectura #{cuerpo['id_lectura']} "
                    f"({lectura['latitud']}, {lectura['longitud']}) {lectura['temperatura_c']} °C{alertas}"
                )
            else:
                print(f"[{n}] {codigo} {cuerpo.get('detail')}", file=sys.stderr)
                errores += 1
                if codigo == 401:
                    return 2  # clave inválida o dispositivo desactivado: no tiene sentido seguir
            break
        if n < args.lecturas:
            time.sleep(args.intervalo)
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
