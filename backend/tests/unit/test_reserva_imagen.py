"""Reserva.imagen_url: la foto que muestra la tarjeta de Mis reservas sale
del paquete, si no del hotel y si no del vuelo (objetos en memoria, sin BD)."""

from app.models.hotel_model import Habitacion, Hotel
from app.models.reserva_model import Paquete, Reserva, ReservaHabitacion
from app.models.vuelo_model import OfertaVuelo


def test_prefiere_la_portada_del_paquete():
    r = Reserva(paquete=Paquete(nombre_paquete="Caribe", imagen_url="/paquete.jpg"))
    assert r.imagen_url == "/paquete.jpg"


def test_sin_paquete_usa_la_foto_del_hotel_de_la_habitacion():
    hotel = Hotel(nombre_hotel="La Palma", imagen_url="/hotel.jpg")
    r = Reserva(reserva_habitaciones=[ReservaHabitacion(habitacion=Habitacion(hotel=hotel))])
    assert r.imagen_url == "/hotel.jpg"


def test_un_vuelo_usa_la_imagen_de_la_oferta_y_sin_nada_es_none():
    assert Reserva(oferta_vuelo=OfertaVuelo(imagen_url="/vuelo.jpg")).imagen_url == "/vuelo.jpg"
    assert Reserva().imagen_url is None
