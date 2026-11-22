"""Contenido de ejemplo para demostraciones (app/services/contenido_ejemplo.py):
lo carga y lo quita solo un admin, sale marcado como ejemplo y nunca cuenta en
promedios, totales ni en las páginas de los hoteles."""

import pytest

from app.models.hotel_model import Habitacion, Hotel, TipoHabitacion
from app.models.resena_model import Resena
from app.models.reserva_model import Reserva

URL = "/api/comunidad/admin/contenido-ejemplo"


@pytest.fixture
def hotel(db):
    tipo = TipoHabitacion(nombre_tipo="Doble", descripcion="Dos", capacidad_personas=2)
    db.add(tipo)
    db.flush()
    h = Hotel(nombre_hotel="Hotel Real", ciudad="Cartagena", pais="Colombia", publicado=True)
    db.add(h)
    db.flush()
    db.add(
        Habitacion(
            id_hotel=h.id_hotel,
            id_tipo_habitacion=tipo.id_tipo_habitacion,
            numero_habitacion="101",
            precio_noche=200000,
            estado="disponible",
        )
    )
    db.commit()
    return h


@pytest.fixture
def resena_real(db, hotel, crear_usuario):
    usuario, _ = crear_usuario()
    reserva = Reserva(id_cliente=usuario.id_cliente, numero_personas=2, estado="finalizada")
    db.add(reserva)
    db.commit()
    r = Resena(
        id_reserva=reserva.id_reserva,
        id_cliente=usuario.id_cliente,
        id_hotel=hotel.id_hotel,
        calificacion=3,
        comentario="Estuvo bien, nada más.",
    )
    db.add(r)
    db.commit()
    return r


def test_solo_un_admin_puede_cargarlo(client, crear_usuario, hotel):
    _, cliente = crear_usuario()
    _, asesor = crear_usuario(roles=("asesor",), con_cliente=False)
    assert client.post(URL, headers=cliente).status_code == 403
    assert client.post(URL, headers=asesor).status_code == 403


def test_carga_marcado_como_ejemplo_y_sin_tocar_los_promedios(client, crear_usuario, hotel, resena_real):
    _, admin = crear_usuario(roles=("admin",), con_cliente=False)

    resp = client.post(URL, headers=admin)
    assert resp.status_code == 200
    assert resp.json() == {"perfiles": 16, "resenas": 18, "publicaciones": 50}
    # Recargar no duplica.
    client.post(URL, headers=admin)
    assert client.get(URL, headers=admin).json() == {"publicaciones": 50, "resenas": 18}

    publicaciones = client.get("/api/comunidad/publicaciones?limit=50").json()["items"]
    assert publicaciones and all(p["es_ejemplo"] for p in publicaciones)

    # Las reseñas de ejemplo se listan etiquetadas, después de las reales...
    listado = client.get("/api/resenas?limit=50").json()
    assert listado["resenas"][0]["ejemplo"] is False
    assert sum(r["ejemplo"] for r in listado["resenas"]) == 18
    # ...pero el promedio y el total solo cuentan la reseña real.
    assert listado["promedio"] == 3.0
    assert listado["total_global"] == 1
    destacadas = client.get("/api/resenas/destacadas").json()
    assert destacadas["total"] == 1
    assert all(not r["ejemplo"] for r in destacadas["resenas"])
    # La página del hotel las muestra etiquetadas, después de la real...
    del_hotel = client.get(f"/api/resenas/hotel/{hotel.id_hotel}").json()
    assert del_hotel[0]["es_ejemplo"] is False
    assert sum(r["es_ejemplo"] for r in del_hotel) == 18
    # ...pero la calificación del hotel solo cuenta la reseña real.
    detalle = client.get(f"/api/hoteles/{hotel.id_hotel}").json()
    assert detalle["total_resenas"] == 1
    assert detalle["calificacion_promedio"] == 3.0


def test_quitarlo_deja_solo_lo_real(client, crear_usuario, hotel, resena_real, db):
    _, admin = crear_usuario(roles=("admin",), con_cliente=False)
    client.post(URL, headers=admin)

    assert client.delete(URL, headers=admin).status_code == 200

    assert client.get(URL, headers=admin).json() == {"publicaciones": 0, "resenas": 0}
    assert db.query(Resena).count() == 1
