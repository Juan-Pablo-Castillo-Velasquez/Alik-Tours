#!/usr/bin/env python3
"""Voz natural y gratuita para el video, sin internet al grabar: Kokoro.

Lee el texto por stdin y escribe un WAV en la ruta del primer argumento
(el mismo contrato que espera VOZ_CMD en guion.mjs).

Una sola vez:
    pip install kokoro-onnx soundfile
    mkdir -p ~/.cache/kokoro && cd ~/.cache/kokoro
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

Uso:
    VOZ_CMD="python3 $PWD/voz-kokoro.py" node guion.mjs

Variables opcionales: KOKORO_DIR (carpeta del modelo), KOKORO_VOZ (ef_dora,
voz femenina en español, o em_alex, masculina) y KOKORO_VELOCIDAD (1.0).
"""

import os
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

if len(sys.argv) < 2:
    sys.exit("Falta la ruta del WAV de salida")

carpeta = Path(os.environ.get("KOKORO_DIR", Path.home() / ".cache" / "kokoro"))
modelo = carpeta / "kokoro-v1.0.int8.onnx"
voces = carpeta / "voices-v1.0.bin"
if not modelo.exists() or not voces.exists():
    sys.exit(f"No encuentro el modelo en {carpeta}. Mira las instrucciones al inicio de este archivo.")

texto = sys.stdin.read().strip()
kokoro = Kokoro(str(modelo), str(voces))
audio, frecuencia = kokoro.create(
    texto,
    voice=os.environ.get("KOKORO_VOZ", "ef_dora"),
    speed=float(os.environ.get("KOKORO_VELOCIDAD", "1.0")),
    lang="es",
)
sf.write(sys.argv[1], audio, frecuencia)
