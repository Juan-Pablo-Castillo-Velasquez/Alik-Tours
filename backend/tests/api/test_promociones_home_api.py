"""Ofertas de la página de inicio: usan la foto real de cada hotel (antes
una foto de stock rotada que no era del hotel) y solo hoteles publicados."""

import pytest

from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion


@pytest.fixture
def hoteles(db):
    tipo = TipoHabitacion(nombre_tipo="Doble", descripcion="Dos", capacidad_personas=2)
    db.add(tipo)
    db.flush()
    datos = [
        ("Con foto", 5, "/uploads/hoteles/con-foto.jpg", True),
        ("Oculto", 5, "/uploads/hoteles/oculto.jpg", False),
        ("Sin foto", 5, None, True),
        ("Segundo", 4, "https://res.cloudinary.com/x/segundo.jpg", True),
    ]
    for nombre, estrellas, foto, publicado in datos:
        h = Hotel(
            nombre_hotel=nombre,
            ciudad="Santa Marta",
            pais="Colombia",
            calificacion=estrellas,
            imagen_url=foto,
            publicado=publicado,
        )
        db.add(h)
        db.flush()
        db.add(
            Habitacion(
                id_hotel=h.id_hotel,
                id_tipo_habitacion=tipo.id_tipo_habitacion,
                numero_habitacion="101",
                precio_noche=230000,
                estado="disponible",
            )
        )
    db.commit()


def test_destacados_con_la_foto_del_hotel_y_solo_publicados_con_foto(client, hoteles):
    data = client.get("/api/promociones/destacados").json()
    assert [d["title"] for d in data] == ["Con foto", "Segundo"]
    assert data[0]["img"] == "/uploads/hoteles/con-foto.jpg"
    assert data[1]["img"] == "https://res.cloudinary.com/x/segundo.jpg"
    assert all("unsplash" not in d["img"] for d in data)


def test_seleccion_de_la_casa_no_inventa_noches(client, hoteles):
    # offset=3 deja la selección vacía con 2 hoteles válidos: no debe fallar.
    assert client.get("/api/promociones/seleccion-casa").json() == []
