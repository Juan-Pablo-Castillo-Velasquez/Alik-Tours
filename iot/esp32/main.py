"""Firmware MicroPython para ESP32 (prototipo físico del dispositivo IoT).

Hardware: ESP32 DevKit + GPS NEO-6M (UART2, pines 16/17) + DHT22 (pin 4).
Mismo protocolo que el simulador: JSON por HTTP(S) a /api/iot/lecturas con
la cabecera X-Device-Key. Copia config.example.py a config.py en la placa.
"""

import time

import dht
import machine
import network
import urequests

import config  # WIFI_SSID, WIFI_CLAVE, URL_BACKEND, CLAVE_DISPOSITIVO, INTERVALO_S

sensor = dht.DHT22(machine.Pin(4))
gps = machine.UART(2, baudrate=9600, rx=16, tx=17)


def conectar_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        wlan.connect(config.WIFI_SSID, config.WIFI_CLAVE)
        for _ in range(20):
            if wlan.isconnected():
                break
            time.sleep(1)
    return wlan.isconnected()


def _grados(valor, hemisferio):
    # NMEA: ddmm.mmmm -> grados decimales
    if not valor:
        return None
    punto = valor.index(".")
    grados = float(valor[: punto - 2]) + float(valor[punto - 2 :]) / 60
    return -grados if hemisferio in ("S", "W") else grados


def leer_gps():
    """Devuelve (lat, lon, km/h) de la última frase $GPRMC válida o Nones."""
    linea = gps.readline()
    while linea:
        try:
            texto = linea.decode().strip()
        except UnicodeError:
            texto = ""
        if texto.startswith("$GPRMC"):
            p = texto.split(",")
            if len(p) > 7 and p[2] == "A":
                return _grados(p[3], p[4]), _grados(p[5], p[6]), round(float(p[7] or 0) * 1.852, 1)
        linea = gps.readline()
    return None, None, None


def enviar(lectura):
    r = urequests.post(
        config.URL_BACKEND + "/api/iot/lecturas",
        json=lectura,
        headers={"X-Device-Key": config.CLAVE_DISPOSITIVO},
    )
    codigo = r.status_code
    r.close()
    return codigo


while True:
    if not conectar_wifi():
        time.sleep(10)
        continue
    sensor.measure()
    lat, lon, velocidad = leer_gps()
    lectura = {"temperatura_c": sensor.temperature(), "humedad_pct": sensor.humidity()}
    if lat is not None:
        lectura.update(latitud=lat, longitud=lon, velocidad_kmh=velocidad)
    try:
        print("lectura", enviar(lectura))
    except OSError as e:
        print("sin red", e)
    time.sleep(config.INTERVALO_S)
