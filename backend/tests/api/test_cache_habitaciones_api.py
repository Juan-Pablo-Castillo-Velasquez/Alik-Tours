"""Las habitaciones de un hotel se sirven desde la caché (Redis), pero un
cambio en el panel se ve de inmediato: la escritura invalida la caché."""

import pytest

from app.models.hotel_model import TipoHabitacion


@pytest.fixture
def admin(crear_usuario):
    return crear_usuario(roles=("admin",), con_cliente=False)[1]


@pytest.fixture
def hotel(client, db, admin):
    tipo = TipoHabitacion(nombre_tipo="Doble", descripcion="Dos personas", capacidad_personas=2)
    db.add(tipo)
    db.commit()
    datos = {
        "nombre_hotel": "Hotel Caché",
        "calificacion": 4,
        "ciudad": "Santa Marta",
        "pais": "Colombia",
        "habitaciones": [
            {"id_tipo_habitacion": tipo.id_tipo_habitacion, "numero_habitacion": "302", "precio_noche": 230000}
        ],
    }
    r = client.post("/api/hoteles/", json=datos, headers=admin)
    assert r.status_code in (200, 201), r.text
    return r.json()


def test_se_cachea_y_un_cambio_de_precio_se_ve_al_instante(client, admin, hotel, redis_falso):
    hid = hotel["id_hotel"]
    primera = client.get(f"/api/hoteles/{hid}/habitaciones").json()
    assert primera[0]["precio_noche"] == 230000
    assert any(k.startswith(f"hoteles:habitaciones:{hid}:") for k in redis_falso._datos)

    id_hab = primera[0]["id_habitacion"]
    assert client.get(f"/api/hoteles/habitaciones/{id_hab}").json()["numero_habitacion"] == "302"

    r = client.put(f"/api/hoteles/habitaciones/{id_hab}", json={"precio_noche": 250000}, headers=admin)
    assert r.status_code == 200, r.text
    assert client.get(f"/api/hoteles/{hid}/habitaciones").json()[0]["precio_noche"] == 250000
    assert client.get(f"/api/hoteles/habitaciones/{id_hab}").json()["precio_noche"] == 250000


def test_hotel_inexistente_sigue_siendo_404(client):
    assert client.get("/api/hoteles/99999/habitaciones").status_code == 404
    assert client.get("/api/hoteles/habitaciones/99999").status_code == 404
