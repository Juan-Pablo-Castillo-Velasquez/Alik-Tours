#!/usr/bin/env python3
"""Datos de PRUEBA para reseñas y comunidad (solo desarrollo / staging).

Crea 16 perfiles de clientes ficticios (cédula DEMO-..., sin foto) y con ellos:
- 18 reseñas de hoteles, cada una con su reserva finalizada (solo se reseña
  lo que se reservó); algunas con foto y con respuesta de la agencia.
- 50 publicaciones de la comunidad aprobadas, con 1 a 3 fotos de los
  destinos (Unsplash, licencia libre), comentarios entre viajeros,
  respuestas del autor y mensajes del equipo de la agencia.

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
    (3, "El hotel está bien, pero la habitación daba a la calle y había ruido. Pidan una interna."),
    (4, "Muy limpio y bien ubicado. El desayuno podría tener más variedad."),
    (5, "Viajé por trabajo y fue ideal: escritorio cómodo, buen wifi y café todo el día."),
    (5, "Celebramos el cumpleaños de mi papá y el hotel nos regaló un postre. Detallazo."),
    (4, "Buen servicio. El aire acondicionado hacía ruido, pero nos cambiaron de habitación rápido."),
    (5, "La asesora nos recomendó este hotel y acertó. Cerca de todo y muy tranquilo."),
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
    ("Bocagrande al amanecer", "Cartagena", 4, "Salimos a trotar por la playa antes del calor. La ciudad vieja se ve preciosa desde ahí.",
     ["photo-1536308037887-165852797016"]),
    ("Getsemaní de noche", "Cartagena", 5, "Música en la plaza de la Trinidad, arepas de huevo y murales por todos lados.",
     ["photo-1534943441045-1009d7cb0bb9", "photo-1781456507315-b00848df005e"]),
    ("Playa Blanca sin afán", "Cartagena", 4, "Fuimos temprano y estaba casi sola. A partir del mediodía se llena.",
     ["photo-1723502436200-6aaaa56cc1d5"]),
    ("Paseo en lancha a Rocky Cay", "San Andrés", 5, "Se puede caminar mar adentro hasta el barco hundido. Agua tibia y transparente.",
     ["photo-1754380578548-98f82e56ecf6", "photo-1576475510454-b0af18970e6d"]),
    ("Acuario y mantarrayas", "San Andrés", 5, "Nadamos con mantarrayas y peces de colores. Mi hija no quería salir del agua.",
     ["photo-1717604553797-a05d5ddac52c"]),
    ("Primer viaje en avión de mi mamá", "San Andrés", 5, "Mi mamá cumplió 60 y conoció el mar. Gracias por ayudarnos con todo el papeleo.",
     ["photo-1592782985575-a96c6e647155", "photo-1576475510454-b0af18970e6d"]),
    ("Minca entre cascadas", "Santa Marta", 5, "Subimos a Minca a ver cascadas y probar el cacao de la sierra. Muy recomendado.",
     ["photo-1659849182790-18858a40654c"]),
    ("Taganga y el Rodadero", "Santa Marta", 4, "Buen plan de un día. El pescado frito en Taganga, lo mejor.",
     ["photo-1532096182988-4a0c8a065ea5", "photo-1580670418997-46950c4877df"]),
    ("Feria de las Flores", "Medellín", 5, "Fuimos al desfile de silleteros. La ciudad entera está de fiesta.",
     ["photo-1715503234322-4edf36c85cf1"]),
    ("Parque Arví en metrocable", "Medellín", 4, "Plan perfecto para salir del calor: bosque, mercado campesino y buen café.",
     ["photo-1512250431446-d0b4b57b27ec"]),
    ("Paseo en lancha por el embalse", "Guatapé", 5, "Vimos la isla de Pablo y las fincas del embalse. Lleven chaqueta, hace viento.",
     ["photo-1598028060898-c117093edfcb", "photo-1582568742002-499ac33758ce"]),
    ("Guatapé con los abuelos", "Guatapé", 5, "Ellos se quedaron en el pueblo y nosotros subimos la piedra. Plan para todas las edades.",
     ["photo-1775584989108-835121fd7e21"]),
    ("Cabalgata en Cocora", "Salento", 4, "La cabalgata hasta la cascada fue espectacular. Los caballos bien cuidados.",
     ["photo-1768407683196-521a0764da27"]),
    ("Calle Real de Salento", "Salento", 5, "Artesanías, tejo y trucha con patacón. Un pueblo para quedarse más días.",
     ["photo-1557733686-45c927db98e9", "photo-1750967613671-297f1b63038d"]),
    ("Cata de café en Filandia", "Salento", 5, "El mirador de Filandia y la cata de café fueron mis favoritos del viaje.",
     ["photo-1672851612794-6687bf0bf1a3"]),
    ("Usaquén en domingo", "Bogotá", 4, "El mercado de pulgas y los restaurantes de Usaquén son un buen plan familiar.",
     ["photo-1759375333229-f11b52711d73"]),
    ("Bogotá en dos días", "Bogotá", 5, "Museo del Oro, Monserrate y ajiaco. El itinerario de la agencia estuvo perfecto.",
     ["photo-1720067392108-89b9485aa090", "photo-1759375253713-bde59f4f5596"]),
    ("Isla Mujeres en catamarán", "Cancún", 5, "Snorkel, barra libre y playa Norte. El mejor día del viaje.",
     ["photo-1773802467099-1433a349ef1a"]),
    ("Cenotes de la Riviera Maya", "Cancún", 5, "Nadar en un cenote es una experiencia única. El agua es helada pero vale la pena.",
     ["photo-1568402102990-bc541580b59f", "photo-1630252421399-ddde79af47b3"]),
    ("Aniversario en Cancún", "Cancún", 4, "Diez años de casados celebrados frente al Caribe. El hotel nos decoró la mesa.",
     ["photo-1630252421399-ddde79af47b3"]),
    ("Buggies en Punta Cana", "Punta Cana", 4, "Terminamos llenos de barro y felices. Paramos en una cueva para nadar.",
     ["photo-1705507972578-78537a2dda73"]),
    ("Viaje de amigas", "Punta Cana", 5, "Cinco amigas, una semana de playa. Ya estamos ahorrando para el próximo.",
     ["photo-1781901227396-34e5fc040091", "photo-1781901340491-4b7220d28f2f"]),
    ("Valle Sagrado", "Cusco", 5, "Pisac, Ollantaytambo y Moray en un solo día. Paisajes de otro mundo.",
     ["photo-1567597243073-2d274aabecec"]),
    ("Montaña de colores", "Cusco", 4, "Dura por la altura, pero llegar arriba es una emoción enorme. Vayan despacio.",
     ["photo-1664387518989-bb1d8574f078", "photo-1578594903885-51d6d8bcdbb7"]),
    ("Comida cusqueña", "Cusco", 5, "Probamos lomo saltado, cuy y chicha morada en el mercado de San Pedro.",
     ["photo-1769358730767-ea63216351b7"]),
    ("Tren a Aguas Calientes", "Cusco", 5, "El tren panorámico entre montañas fue casi tan lindo como Machu Picchu.",
     ["photo-1587595431973-160d0d94add1"]),
    ("Mi primer viaje sola", "Santa Marta", 5, "Me daba miedo viajar sola, pero todo estuvo organizado y me sentí segura.",
     ["photo-1580670418997-46950c4877df"]),
    ("Puente festivo en el Eje Cafetero", "Salento", 4, "Tres días bastan para lo principal. Reserven con tiempo porque se llena.",
     ["photo-1789009413700-1366da08ee6e"]),
]  # fmt: skip

# Perfiles de demostración: personas ficticias, sin foto (la app muestra las
# iniciales). Se marcan con cédula "DEMO-..." y correo @demo.aliktours.test
# para poder borrarlos sin tocar clientes reales.
PERFILES = [
    ("Laura", "Gómez", "Bogotá"), ("Andrés", "Restrepo", "Medellín"), ("Valentina", "Ríos", "Cali"),
    ("Camilo", "Herrera", "Barranquilla"), ("Daniela", "Martínez", "Bucaramanga"), ("Santiago", "López", "Pereira"),
    ("Mariana", "Castro", "Bogotá"), ("Julián", "Ortiz", "Cartagena"), ("Paula", "Vargas", "Manizales"),
    ("Sebastián", "Moreno", "Ibagué"), ("Natalia", "Jiménez", "Medellín"), ("Felipe", "Rojas", "Cali"),
    ("Carolina", "Mejía", "Armenia"), ("David", "Salazar", "Bogotá"), ("Isabela", "Cárdenas", "Santa Marta"),
    ("Tomás", "Peña", "Neiva"),
]  # fmt: skip

# Conversaciones: un comentario y, a veces, la respuesta del autor.
CONVERSACIONES = [
    ("¡Qué belleza! Ya lo anoté para mi próximo viaje.", "¡Vale mucho la pena! Me cuentas cómo te va."),
    ("¿Con qué paquete fueron? Se ve increíble.", "Con el de 4 noches que tiene la agencia, incluía los traslados."),
    ("¿Qué temporada recomiendan para ir?", "Nosotros fuimos en marzo y casi no llovió."),
    ("Las fotos están espectaculares 😍", "¡Gracias! Y eso que fueron con el celular."),
    ("Yo fui el año pasado y también me encantó.", None),
    ("¿Es buen plan para ir con niños pequeños?", "Sí, los míos tienen 5 y 8 años y la pasaron feliz."),
    ("¿Cuántos días recomiendas?", "Mínimo tres para no ir a las carreras."),
    ("Gracias por los consejos, muy útiles.", None),
    ("¿El hotel tenía piscina?", "Sí, y muy buena. Abría desde las 7 a. m."),
    ("Qué envidia de la buena 😅", "¡Ahorra y te vas! Yo lo pagué en cuotas."),
]

RESPUESTAS_EQUIPO = [
    "¡Gracias por compartir tu viaje! Nos alegra mucho que lo hayas disfrutado.",
    "Qué lindas fotos. Si alguien quiere ir, escríbenos y le armamos el plan.",
    "Gracias por los consejos, seguro le sirven a otros viajeros.",
]

RESPUESTAS_RESENA = [
    "¡Gracias por tu reseña! Nos alegra que el viaje haya salido como lo soñaste.",
    "Gracias por contarnos. Ya le pasamos tu comentario al hotel para que lo mejoren.",
    "¡Qué bueno leer esto! Te esperamos en el próximo viaje.",
]

FOTOS_RESENA = [
    "photo-1781456507315-b00848df005e", "photo-1630252421399-ddde79af47b3", "photo-1576475510454-b0af18970e6d",
    "photo-1781901227396-34e5fc040091", "photo-1534943441045-1009d7cb0bb9",
]  # fmt: skip


def _es_produccion(url: str) -> bool:
    return "neon.tech" in url or os.getenv("ENTORNO", "").lower() in ("produccion", "producción", "production")


def borrar(conn) -> None:
    titulos = [p[0] for p in PUBLICACIONES]
    conn.execute(sa.text("DELETE FROM publicaciones_comunidad WHERE titulo = ANY(:t)"), {"t": titulos})
    # Los pagos no se borran en cascada: si alguien probó a pagar una reserva
    # de demostración, se quita primero ese pago de prueba.
    conn.execute(
        sa.text("DELETE FROM pagos WHERE id_reserva IN (SELECT id_reserva FROM reservas WHERE notas_internas = :m)"),
        {"m": MARCA},
    )
    # Borrar las reservas borra en cascada sus reseñas y habitaciones.
    conn.execute(sa.text("DELETE FROM reservas WHERE notas_internas = :m"), {"m": MARCA})
    conn.execute(sa.text("DELETE FROM clientes WHERE cedula LIKE 'DEMO-%'"))


def _crear_perfiles(conn) -> list[int]:
    ids = []
    for i, (nombre, apellido, ciudad) in enumerate(PERFILES, start=1):
        ids.append(
            conn.execute(
                sa.text(
                    "INSERT INTO clientes (nombre, apellido, cedula, correo, ciudad, pais) "
                    "VALUES (:n, :a, :c, :e, :ci, 'Colombia') RETURNING id_cliente"
                ),
                {
                    "n": nombre,
                    "a": apellido,
                    "c": f"DEMO-{i:03d}",
                    "e": f"demo{i:02d}@demo.aliktours.test",
                    "ci": ciudad,
                },
            ).scalar_one()
        )
    return ids


def sembrar(conn) -> None:
    clientes = _crear_perfiles(conn)
    habitaciones = conn.execute(
        sa.text(
            "SELECT h.id_habitacion, h.id_hotel, h.precio_noche FROM habitaciones h "
            "JOIN hoteles o ON o.id_hotel = h.id_hotel WHERE o.publicado ORDER BY h.id_hotel, h.id_habitacion"
        )
    ).all()
    if not habitaciones:
        sys.exit("No hay habitaciones publicadas para reseñar.")
    equipo = conn.execute(sa.text("SELECT id_usuario FROM usuarios WHERE id_empleado IS NOT NULL ORDER BY 1")).scalar()

    rnd = random.Random(2026)
    hoy = dt.date.today()

    # Una habitación por hotel, recorriendo los hoteles en orden.
    por_hotel: dict[int, tuple] = {}
    for hab in habitaciones:
        por_hotel.setdefault(hab.id_hotel, hab)
    hoteles = list(por_hotel.values())

    for i in range(len(RESENAS)):
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
        calificacion, comentario = RESENAS[i]
        fecha = dt.datetime.combine(checkout + dt.timedelta(days=2), dt.time(18, 30))
        respuesta = RESPUESTAS_RESENA[i % len(RESPUESTAS_RESENA)] if i % 2 == 0 else None
        conn.execute(
            sa.text(
                "INSERT INTO resenas (id_reserva, id_cliente, id_hotel, calificacion, comentario, foto_url, "
                "fecha_creacion, visible, respuesta_agencia, fecha_respuesta) "
                "VALUES (:r, :c, :h, :cal, :com, :foto, :fecha, true, :resp, :fresp)"
            ),
            {
                "r": id_reserva, "c": id_cliente, "h": hab.id_hotel, "cal": calificacion, "com": comentario,
                "foto": U(FOTOS_RESENA[i % len(FOTOS_RESENA)]) if i % 3 == 0 else None, "fecha": fecha,
                "resp": respuesta, "fresp": fecha + dt.timedelta(hours=20) if respuesta else None,
            },
        )  # fmt: skip

    def comentar(id_pub, autor, texto, fecha, padre=None, es_equipo=False):
        return conn.execute(
            sa.text(
                "INSERT INTO comentarios_comunidad (id_publicacion, id_cliente, id_usuario_equipo, id_padre, "
                "contenido, oculto, fecha_creacion) VALUES (:p, :c, :e, :padre, :t, false, :f) RETURNING id_comentario"
            ),
            {
                "p": id_pub, "c": None if es_equipo else autor, "e": equipo if es_equipo else None,
                "padre": padre, "t": texto, "f": fecha,
            },
        ).scalar_one()  # fmt: skip

    for i, (titulo, destino, calificacion, contenido, fotos) in enumerate(PUBLICACIONES):
        autor = clientes[(i * 5) % len(clientes)]
        fecha = dt.datetime.combine(hoy - dt.timedelta(days=1 + i * 3), dt.time(9 + i % 10, 15))
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
        otros = [c for c in clientes if c != autor]
        hora = fecha
        for pregunta, respuesta in rnd.sample(CONVERSACIONES, rnd.randint(1, 3)):
            hora += dt.timedelta(hours=rnd.randint(1, 6))
            padre = comentar(id_pub, rnd.choice(otros), pregunta, hora)
            if respuesta:
                hora += dt.timedelta(minutes=rnd.randint(20, 180))
                comentar(id_pub, autor, respuesta, hora, padre=padre)
        if equipo and i % 4 == 0:
            comentar(id_pub, None, RESPUESTAS_EQUIPO[i % len(RESPUESTAS_EQUIPO)], hora + dt.timedelta(hours=2),
                     es_equipo=True)  # fmt: skip


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
    resumen = f"creados: {len(PERFILES)} perfiles demo, {len(RESENAS)} reseñas y {len(PUBLICACIONES)} publicaciones."
    print("Datos de prueba de comunidad " + ("eliminados." if args.borrar else resumen))
    print("Recuerda vaciar el caché (o esperar 10 min) para ver las reseñas destacadas del inicio.")


if __name__ == "__main__":
    main()
