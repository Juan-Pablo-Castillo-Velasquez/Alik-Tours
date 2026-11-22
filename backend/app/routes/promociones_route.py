from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.cache import get_cached, set_cached
from app.core.database import get_db
from app.repositories.hotel_repository import HotelRepository

router = APIRouter(prefix="/api/promociones", tags=["Promociones"])

# Antes cada tarjeta llevaba una foto de stock rotada (un templo de Bali
# para un hotel de Bogotá, un puente de París para Santa Marta) y un texto
# inventado de "3 noches · 2 adultos". Ahora: la portada real del hotel y
# el precio por noche de su habitación más económica.
TEXTO_PRECIO = "Por noche · habitación más económica"

# Bajo "hoteles:" para que cualquier cambio de un hotel en el panel las
# invalide (HOTELES_CACHE_PATTERN en hotel_route.py).
CACHE_DESTACADOS = "hoteles:promo:destacados"
CACHE_SELECCION = "hoteles:promo:seleccion_casa"


@router.get("/destacados")
def get_destacados(db: Session = Depends(get_db)):
    cached = get_cached(CACHE_DESTACADOS)
    if cached:
        return cached

    filas = HotelRepository.get_destacados(db, limit=3)

    data = []
    for fila in filas:
        precio = float(fila.precio_desde or 0)
        data.append(
            {
                "id": fila.id_hotel,
                "title": fila.nombre_hotel,
                "tag": f"{fila.ciudad}, {fila.pais}",
                "discount": f"★ {fila.calificacion}",
                "price": f"{precio:,.0f}".replace(",", "."),
                "oldPrice": "",
                "img": fila.imagen_url,
            }
        )

    set_cached(CACHE_DESTACADOS, data, ttl_seconds=600)  # 10 min
    return data


@router.get("/seleccion-casa")
def get_seleccion_casa(db: Session = Depends(get_db)):
    cached = get_cached(CACHE_SELECCION)
    if cached:
        return cached

    # offset=3 para no repetir los 3 hoteles que ya salen en /destacados
    filas = HotelRepository.get_seleccion_casa(db, limit=4, offset=3)

    data = []
    for fila in filas:
        precio = float(fila.precio_desde or 0)
        data.append(
            {
                "id": fila.id_hotel,
                "name": fila.nombre_hotel,
                "tag": f"{fila.ciudad}, {fila.pais}",
                "img": fila.imagen_url,
                "rating": float(fila.calificacion),
                "price": f"{precio:,.0f}".replace(",", "."),
                "nights": TEXTO_PRECIO,
            }
        )

    set_cached(CACHE_SELECCION, data, ttl_seconds=600)  # 10 min
    return data
