"""banners publicitarios del sitio (web, hoteles, paquetes, vuelos y temporada)

Revision ID: a9d3f6c1e5b7
Revises: f2a7c4e9b1d8
Create Date: 2026-11-16

Siembra el carrusel de publicidad del inicio con piezas que promocionan el
propio sitio y lo que vende (hoteles, paquetes, vuelos), más dos piezas que
solo aparecen con su tema de temporada activo (Navidad y Fin de año).

Idempotente por título: si el administrador ya creó un banner con ese
título (o lo editó), no se toca. Las fotos son de Unsplash, las mismas ya
verificadas en la migración del catálogo (c4e8a2f6b1d3). Los textos no
prometen precios ni descuentos: eso lo define el administrador desde el
panel (Banners), donde también puede desactivar o reemplazar cada pieza.
"""

import sqlalchemy as sa

from alembic import op

revision = "a9d3f6c1e5b7"
down_revision = "f2a7c4e9b1d8"
branch_labels = None
depends_on = None


def U(photo_id: str) -> str:
    return f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w=1600&q=80"


BANNERS = [
    {
        "titulo": "Tu viaje completo, en un solo lugar",
        "descripcion_corta": "Hoteles, vuelos y paquetes en Alik Tours: compara, reserva en línea y viaja con el acompañamiento de un asesor.",
        "imagen_url": U("photo-1754380578509-7a0fbe72ac4a"),
        "texto_boton": "Explorar destinos",
        "link_destino": "/search",
        "temporada": None,
        "orden": 1,
    },
    {
        "titulo": "Hoteles para cada plan de viaje",
        "descripcion_corta": "Mira fotos reales, servicios y habitaciones antes de reservar. Elige fechas y asegura tu estadía en minutos.",
        "imagen_url": U("photo-1773802467099-1433a349ef1a"),
        "texto_boton": "Ver hoteles",
        "link_destino": "/search",
        "temporada": None,
        "orden": 2,
    },
    {
        "titulo": "Paquetes con vuelo y hotel incluidos",
        "descripcion_corta": "Cartagena, San Andrés, Eje Cafetero, Cancún y más: itinerario día a día y todo resuelto en una sola reserva.",
        "imagen_url": U("photo-1536308037887-165852797016"),
        "texto_boton": "Ver paquetes",
        "link_destino": "/packages",
        "temporada": None,
        "orden": 3,
    },
    {
        "titulo": "Vuelos nacionales e internacionales",
        "descripcion_corta": "Encuentra tu ruta, revisa horarios y equipaje, y reserva tu cupo desde la web.",
        "imagen_url": U("photo-1512250431446-d0b4b57b27ec"),
        "texto_boton": "Buscar vuelos",
        "link_destino": "/vuelos",
        "temporada": None,
        "orden": 4,
    },
    {
        "titulo": "Esta Navidad, regala un viaje",
        "descripcion_corta": "Sorprende a tu familia con un destino para compartir. Elige el paquete y nosotros te acompañamos en la reserva.",
        "imagen_url": U("photo-1532096182988-4a0c8a065ea5"),
        "texto_boton": "Ver paquetes de temporada",
        "link_destino": "/packages",
        "temporada": "navidad",
        "orden": 0,
    },
    {
        "titulo": "Recibe el año nuevo frente al mar",
        "descripcion_corta": "Despide el año en la playa: hoteles y paquetes en el Caribe listos para reservar.",
        "imagen_url": U("photo-1754380578548-98f82e56ecf6"),
        "texto_boton": "Ver destinos de playa",
        "link_destino": "/packages",
        "temporada": "fin-de-anio",
        "orden": 0,
    },
]


def upgrade() -> None:
    conn = op.get_bind()
    for b in BANNERS:
        existe = conn.execute(
            sa.text("SELECT 1 FROM banners_publicitarios WHERE titulo = :t"), {"t": b["titulo"]}
        ).scalar()
        if existe:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO banners_publicitarios "
                "(titulo, descripcion_corta, imagen_url, texto_boton, link_destino, temporada, tipo, orden, activo) "
                "VALUES (:titulo, :descripcion_corta, :imagen_url, :texto_boton, :link_destino, :temporada, 'banner', :orden, :activo)"
            ),
            {**b, "activo": True},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for b in BANNERS:
        conn.execute(
            sa.text("DELETE FROM banners_publicitarios WHERE titulo = :t AND imagen_url = :u"),
            {"t": b["titulo"], "u": b["imagen_url"]},
        )
