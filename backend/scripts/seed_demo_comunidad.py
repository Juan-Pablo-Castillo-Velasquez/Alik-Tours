#!/usr/bin/env python3
"""Datos de PRUEBA para reseñas y comunidad (solo desarrollo / staging).

Crea, con los clientes que ya existen en la base de datos:
- 24 reseñas de hoteles (cada una con su reserva finalizada, como exige el
  sistema: solo se reseña lo que se reservó).
- 22 publicaciones de la comunidad aprobadas, con 1 a 3 fotos y comentarios
  de otros clientes.

POR QUÉ NO CORRE EN PRODUCCIÓN: Alik Tours es una agencia real. Publicar en
el sitio público reseñas y testimonios escritos por nosotros a nombre de
clientes sería publicidad engañosa (Estatuto del Consumidor, Ley 1480 de
2011) y le quita credibilidad a las reseñas reales. En producción las
reseñas y publicaciones deben venir de clientes reales (ver
docs/historias-usuario/ HU-22 y HU-23). Este script es para que el equipo
pruebe las pantallas, el panel de moderación y los E2E con datos.

Uso (con los contenedores de desarrollo levantados):
    docker compose exec backend python scripts/seed_demo_comunidad.py
    docker compose exec backend python scripts/seed_demo_comunidad.py --borrar

Se niega a correr si DATABASE_URL apunta a Neon (producción) o si
ENTORNO=produccion.
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import sqlalchemy as sa  # noqa: E402

MARCA = "seed-demo-comunidad"


def U(photo_id: str) -> str:
    return f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w=1200&q=80"


RESENAS = [
    (5, "Todo salió perfecto: el traslado nos esperaba en el aeropuerto y la habitación estaba impecable."),
    (5, "La atención del asesor por WhatsApp fue excelente, nos resolvió todo en minutos."),
    (5, "El desayuno fue espectacular y el personal del hotel súper amable. Volveríamos sin pensarlo."),
    (4, "Muy buen hotel y excelente ubicación. La piscina se llena un poco en la tarde, pero lo recomiendo."),
    (5, "Viajamos con los niños y nos sentimos muy cómodos. La habitación familiar es amplia y limpia."),
    (5, "La vista desde el balcón valía cada peso. Gracias Alik Tours por la recomendación."),
    (4, "Buena relación calidad-precio. El check-in fue rápido y nos dieron la habitación antes de tiempo."),
    (5, "Nuestra luna de miel fue mágica. Nos tenían una sorpresa en la habitación."),
    (5, "Reservar fue facilísimo y pagamos en cuotas con el asesor. Cero estrés."),
    (5, "El hotel es tal cual las fotos. Camas muy cómodas y silencio total en la noche."),
    (4, "Nos encantó el hotel. El wifi a veces se caía, pero el resto fue de diez."),
    (5, "Excelente experiencia de principio a fin. Ya estamos planeando el próximo viaje con ustedes."),
]

PUBLICACIONES = [
    ("Atardecer en la muralla", "Cartagena", 5, "No hay nada como ver caer el sol desde la muralla. Recomendadísimo el city tour.",
     ["photo-1534943441045-1009d7cb0bb9", "photo-1536308037887-165852797016"]),
    ("Islas del Rosario en familia", "Cartagena", 5, "Los niños se enamoraron del snorkel. El almuerzo en la isla, delicioso.",
     ["photo-1723502436200-6aaaa56cc1d5"]),
    ("El mar de siete colores existe", "San Andrés", 5, "Las fotos no le hacen justicia. Johnny Cay es un paraíso.",
     ["photo-1576475510454-b0af18970e6d", "photo-1754380578548-98f82e56ecf6", "photo-1717604553797-a05d5ddac52c"]),
    ("Vuelta a la isla en chiva", "San Andrés", 4, "Divertidísimo el recorrido. Lleven bloqueador y efectivo para los cocos.",
     ["photo-1592782985575-a96c6e647155"]),
    ("Caminata a Cabo San Juan", "Santa Marta", 5, "Dos horas de selva y luego esta playa. Vale cada paso.",
     ["photo-1580670418997-46950c4877df", "photo-1659849182790-18858a40654c"]),
    ("Atardeceres en el Tayrona", "Santa Marta", 5, "Dormir en cabaña escuchando el mar fue lo mejor del viaje.",
     ["photo-1532096182988-4a0c8a065ea5"]),
    ("Medellín desde las alturas", "Medellín", 5, "El Metrocable y la Comuna 13 te cambian la forma de ver la ciudad.",
     ["photo-1512250431446-d0b4b57b27ec", "photo-1715503234322-4edf36c85cf1"]),
    ("740 escalones después", "Guatapé", 5, "Subir la Piedra del Peñol cansa, pero la vista del embalse es increíble.",
     ["photo-1582568742002-499ac33758ce", "photo-1598028060898-c117093edfcb"]),
    ("Zócalos de colores", "Guatapé", 4, "Guatapé es el pueblo más fotogénico de Colombia. Almuercen trucha.",
     ["photo-1775584989108-835121fd7e21"]),
    ("Entre palmas de cera", "Salento", 5, "El Valle de Cocora es otro mundo. La caminata circular es imperdible.",
     ["photo-1789009413700-1366da08ee6e", "photo-1768407683196-521a0764da27"]),
    ("Del grano a la taza", "Salento", 5, "Aprendimos todo el proceso del café en la finca. ¡Y qué café!",
     ["photo-1672851612794-6687bf0bf1a3", "photo-1750967613671-297f1b63038d"]),
    ("Niebla en la montaña", "Salento", 4, "Amanecer con esta vista desde la hacienda no tiene precio.",
     ["photo-1557733686-45c927db98e9"]),
    ("Monserrate al atardecer", "Bogotá", 5, "Subimos en teleférico y bajamos con la ciudad iluminada.",
     ["photo-1720067392108-89b9485aa090"]),
    ("Grafitis de La Candelaria", "Bogotá", 4, "El tour de grafitis es buenísimo para entender la historia de la ciudad.",
     ["photo-1759375253713-bde59f4f5596", "photo-1759375333229-f11b52711d73"]),
    ("Cancún todo incluido", "Cancún", 5, "Playa, piscina y comida sin parar. El resort fue un acierto.",
     ["photo-1630252421399-ddde79af47b3", "photo-1773802467099-1433a349ef1a"]),
    ("Chichén Itzá", "Cancún", 5, "Ver la pirámide de Kukulcán en persona fue un sueño cumplido.",
     ["photo-1568402102990-bc541580b59f"]),
    ("Playa Bávaro", "Punta Cana", 5, "Arena blanca, agua cristalina y cero preocupaciones. Volveremos.",
     ["photo-1781901227396-34e5fc040091", "photo-1705507972578-78537a2dda73"]),
    ("Isla Saona", "Punta Cana", 5, "La piscina natural con estrellas de mar es lo más bonito que he visto.",
     ["photo-1781901340491-4b7220d28f2f"]),
    ("Machu Picchu, por fin", "Cusco", 5, "Madrugar valió la pena: llegamos con la niebla subiendo entre las montañas.",
     ["photo-1587595431973-160d0d94add1", "photo-1567597243073-2d274aabecec"]),
    ("Llamas y ruinas", "Cusco", 5, "Las llamas posan para la foto mejor que nosotros.",
     ["photo-1664387518989-bb1d8574f078"]),
    ("Plaza de Armas de Cusco", "Cusco", 4, "Tómense el mate de coca y caminen despacio el primer día por la altura.",
     ["photo-1769358730767-ea63216351b7", "photo-1578594903885-51d6d8bcdbb7"]),
    ("Desayuno con vista al mar", "Cartagena", 5, "Así empiezan las buenas vacaciones.",
     ["photo-1781456507315-b00848df005e"]),
]  # fmt: skip

COMENTARIOS = [
    "¡Qué belleza! Ya lo anoté para mi próximo viaje.",
    "¿Con qué paquete fueron? Se ve increíble.",
    "Yo fui el año pasado y también me encantó.",
    "Las fotos están espectaculares 😍",
    "Gracias por los consejos, muy útiles.",
    "¿Qué temporada recomiendan para ir?",
]


def _es_produccion(url: str) -> bool:
    return "neon.tech" in url or os.getenv("ENTORNO", "").lower() in ("produccion", "producción", "production")


def borrar(conn) -> None:
    titulos = [p[0] for p in PUBLICACIONES]
    conn.execute(sa.text("DELETE FROM publicaciones_comunidad WHERE titulo = ANY(:t)"), {"t": titulos})
    # Borrar las reservas borra en cascada sus reseñas y habitaciones.
    conn.execute(sa.text("DELETE FROM reservas WHERE notas_internas = :m"), {"m": MARCA})


def sembrar(conn) -> None:
    clientes = [r[0] for r in conn.execute(sa.text("SELECT id_cliente FROM clientes ORDER BY id_cliente")).all()]
    if not clientes:
        sys.exit("No hay clientes en la base de datos: registra algunos usuarios primero.")
    habitaciones = conn.execute(
        sa.text(
            "SELECT h.id_habitacion, h.id_hotel, h.precio_noche FROM habitaciones h "
            "JOIN hoteles o ON o.id_hotel = h.id_hotel WHERE o.publicado ORDER BY h.id_hotel, h.id_habitacion"
        )
    ).all()
    if not habitaciones:
        sys.exit("No hay habitaciones publicadas para reseñar.")

    rnd = random.Random(2026)
    hoy = dt.date.today()

    # Una habitación por hotel, recorriendo los hoteles en orden.
    por_hotel: dict[int, tuple] = {}
    for hab in habitaciones:
        por_hotel.setdefault(hab.id_hotel, hab)
    hoteles = list(por_hotel.values())

    for i in range(24):
        hab = hoteles[i % len(hoteles)]
        id_cliente = clientes[i % len(clientes)]
        checkin = hoy - dt.timedelta(days=30 + i * 9)
        checkout = checkin + dt.timedelta(days=3)
        id_reserva = conn.execute(
            sa.text(
                "INSERT INTO reservas (id_cliente, fecha_inicio, fecha_fin, numero_personas, estado, canal_origen, "
                "tipo_producto, adultos, ninos, infantes, notas_internas) VALUES "
                "(:c, :i, :f, 2, 'finalizada', 'web', 'hotel', 2, 0, 0, :m) RETURNING id_reserva"
            ),
            {"c": id_cliente, "i": checkin, "f": checkout, "m": MARCA},
        ).scalar_one()
        conn.execute(
            sa.text(
                "INSERT INTO reserva_habitaciones (id_reserva, id_habitacion, fecha_checkin, fecha_checkout, "
                "precio_acordado) VALUES (:r, :h, :i, :f, :p)"
            ),
            {"r": id_reserva, "h": hab.id_habitacion, "i": checkin, "f": checkout, "p": hab.precio_noche},
        )
        calificacion, comentario = RESENAS[i % len(RESENAS)]
        conn.execute(
            sa.text(
                "INSERT INTO resenas (id_reserva, id_cliente, id_hotel, calificacion, comentario, fecha_creacion, "
                "visible) VALUES (:r, :c, :h, :cal, :com, :fecha, true)"
            ),
            {
                "r": id_reserva, "c": id_cliente, "h": hab.id_hotel, "cal": calificacion, "com": comentario,
                "fecha": dt.datetime.combine(checkout + dt.timedelta(days=2), dt.time(18, 30)),
            },
        )  # fmt: skip

    for i, (titulo, destino, calificacion, contenido, fotos) in enumerate(PUBLICACIONES):
        autor = clientes[(i * 3) % len(clientes)]
        fecha = dt.datetime.combine(hoy - dt.timedelta(days=2 + i * 4), dt.time(12, 0))
        id_pub = conn.execute(
            sa.text(
                "INSERT INTO publicaciones_comunidad (id_cliente, titulo, contenido, calificacion, destino, estado, "
                "fecha_creacion, fecha_moderacion) VALUES (:c, :t, :co, :cal, :d, 'aprobada', :f, :f) "
                "RETURNING id_publicacion"
            ),
            {"c": autor, "t": titulo, "co": contenido, "cal": calificacion, "d": destino, "f": fecha},
        ).scalar_one()
        for orden, foto in enumerate(fotos):
            conn.execute(
                sa.text("INSERT INTO imagenes_publicacion (id_publicacion, url, orden) VALUES (:p, :u, :o)"),
                {"p": id_pub, "u": U(foto), "o": orden},
            )
        otros = [c for c in clientes if c != autor] or clientes
        for k in range(rnd.randint(0, 3)):
            conn.execute(
                sa.text(
                    "INSERT INTO comentarios_comunidad (id_publicacion, id_cliente, contenido, oculto, fecha_creacion) "
                    "VALUES (:p, :c, :t, false, :f)"
                ),
                {
                    "p": id_pub,
                    "c": rnd.choice(otros),
                    "t": rnd.choice(COMENTARIOS),
                    "f": fecha + dt.timedelta(hours=3 + k),
                },
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--borrar", action="store_true", help="Quita los datos de prueba creados por este script")
    args = parser.parse_args()

    url = os.getenv("DATABASE_URL", "")
    if not url:
        sys.exit("Falta DATABASE_URL.")
    if _es_produccion(url):
        sys.exit("Este script es solo para desarrollo/staging: no se ejecuta contra la base de producción.")

    engine = sa.create_engine(url)
    with engine.begin() as conn:
        borrar(conn)  # idempotente: siempre deja exactamente un juego de datos de prueba
        if not args.borrar:
            sembrar(conn)
    print(
        "Datos de prueba de comunidad " + ("eliminados." if args.borrar else "creados: 24 reseñas y 22 publicaciones.")
    )
    print("Recuerda vaciar el caché (o esperar 10 min) para ver las reseñas destacadas del inicio.")


if __name__ == "__main__":
    main()
