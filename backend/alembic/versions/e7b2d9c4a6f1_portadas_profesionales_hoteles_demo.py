"""Portadas profesionales y fichas completas para los 10 hoteles demo originales.

Los 10 hoteles del seed inicial (Hotel Paraiso, Resort Sol y Arena...)
tenían portadas que no parecían de hotel (varias se subieron a Cloudinary
desde fotos equivocadas, ver 7972baf77f44) y casi no tenían ficha. Esta
migración:

- Cambia la portada por una foto profesional del tipo de establecimiento
  (lobby, piscina, patio colonial, cabaña...) SOLO si la portada actual es
  una de las fotos demo conocidas (Cloudinary del seed o Unsplash) o está
  vacía: nunca pisa una foto que un admin haya subido.
- Agrega galería si el hotel no tiene ninguna.
- Completa la ficha (descripción, tipo, departamento, horarios) solo en los
  campos vacíos.
- Agrega fotos y ficha básica a las habitaciones que no tienen fotos.

Fotos: Unsplash (licencia libre, uso comercial permitido).

Revision ID: e7b2d9c4a6f1
Revises: c4e8a2f6b1d3
Create Date: 2026-11-15
"""

from __future__ import annotations

import datetime as dt

import sqlalchemy as sa

from alembic import op

revision = "e7b2d9c4a6f1"
down_revision = "c4e8a2f6b1d3"
branch_labels = None
depends_on = None


def U(photo_id: str) -> str:
    return f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w=1600&q=80"


F = {
    "lobby_marmol": "photo-1758448500688-3ababa93fd67",
    "lobby_ciudad": "photo-1587702068694-a909ef4aa346",
    "lobby_recepcion": "photo-1758193783649-13371d7fb8dd",
    "lobby_madera": "photo-1621293954908-907159247fc8",
    "lobby_moderno": "photo-1782890790046-2aefb0b503cb",
    "lobby_arco": "photo-1573052905904-34ad8c27f0cc",
    "resort_aereo_2": "photo-1729717949782-f40c4a07e3c4",
    "piscina_sillas": "photo-1648381196047-5a4390bcf32e",
    "playa_sillas": "photo-1725006136539-46bef885df06",
    "piscina_terraza": "photo-1776763255431-633c91b6b4b6",
    "piscina_patio_aereo": "photo-1776763255458-6200750f3930",
    "piscina_aerea": "photo-1776763255480-014a64ee137d",
    "piscina_sombrillas": "photo-1776324612262-b8d11ceada5c",
    "piscina_blanca": "photo-1596436889106-be35e843f974",
    "patio_arcos": "photo-1791398423445-a8f744958cc7",
    "patio_camas": "photo-1765910639954-27ae0c260586",
    "cabana_balcon": "photo-1775283537748-4fc2b5fb28c0",
    "cabana_bosque": "photo-1759843009272-24dc382e3d6b",
    "cabanas_arboles": "photo-1772703003096-fe4096559f81",
    "cabana_pequena": "photo-1765833667306-2dcb8430b7f3",
    "cabana_bambu_cama": "photo-1777913319909-1d27d36db93e",
    "sendero_resort": "photo-1761950116791-8bfc445e5186",
    "desayuno_mesa": "photo-1504754524776-8f4f37790ca0",
    "desayuno_buffet": "photo-1763207291832-819499e261dd",
    "desayuno_jugo": "photo-1784217066863-49aa1baaa843",
    "bog_aerea": "photo-1681145553138-816eb004b846",
    "bog_monserrate": "photo-1720067392108-89b9485aa090",
    "ctg_edificio_mar": "photo-1678794144519-9aadc02edb53",
    "mde_montanas": "photo-1548397968-8790c49522db",
    "mde_skyline": "photo-1590598016835-83cf3357ebc5",
    "cafe_niebla": "photo-1557733686-45c927db98e9",
    "tay_atardecer": "photo-1532096182988-4a0c8a065ea5",
    "tay_sendero": "photo-1659849182790-18858a40654c",
    # Habitaciones
    "cama_gris": "photo-1629140727571-9b5c6f6267b4",
    "cama_lino": "photo-1631049307264-da0ec9d70304",
    "cama_lino_3": "photo-1631048730670-ff5cd0d08f15",
    "cama_lino_4": "photo-1631049552057-403cdb8f0658",
    "cama_azul": "photo-1639678349557-ffe5bed73ce7",
    "cama_king_azul": "photo-1770232274485-b35ee5092cbe",
    "cama_cortinas": "photo-1759328257280-28bdb3050be3",
    "cama_lamparas": "photo-1776763255122-3d35e32aee64",
    "hab_sofa": "photo-1590490360182-c33d57733427",
    "hab_escritorio": "photo-1776763018821-8feeaeeee0a5",
    "bano_ducha": "photo-1584622650111-993a426fbf0a",
    "bano_espejo": "photo-1718894070114-6de0e98449a2",
    "bano_marmol": "photo-1765745518673-b562b7304a53",
    "bano_tina": "photo-1776525433347-13ffc965601a",
    "tina_mar": "photo-1779942578833-5f00dc79d6d1",
    "cabana_ducha": "photo-1788217023349-ad7763845844",
}

# nombre -> (portada, galería, tipo, departamento, descripción)
HOTELES = {
    "Hotel Paraiso": (
        "lobby_marmol", ["lobby_ciudad", "bog_aerea", "cama_lamparas", "desayuno_jugo"], "Hotel urbano", "Cundinamarca",
        "Hotel cinco estrellas en el norte de Bogotá, cerca de la zona financiera y de los centros comerciales. "
        "Lobby de mármol, gimnasio, restaurante de cocina colombiana contemporánea y traslado al aeropuerto El Dorado.",
    ),
    "Resort Sol y Arena": (
        "resort_aereo_2", ["piscina_sillas", "playa_sillas", "ctg_edificio_mar", "desayuno_buffet"], "Hotel de playa", "Bolívar",
        "Resort frente al mar con piscina, spa y club infantil, a pocos minutos del centro histórico de Cartagena. "
        "Ideal para vacaciones en familia.",
    ),
    "Montana Magica": (
        "cabana_balcon", ["mde_montanas", "cabana_bosque", "desayuno_mesa"], "Hotel campestre", "Antioquia",
        "Refugio de montaña a las afueras de Medellín, rodeado de bosque y con vista al Valle de Aburrá. Senderos, "
        "aire puro y desayuno típico antioqueño.",
    ),
    "Gran Hotel Centro": (
        "lobby_recepcion", ["lobby_madera", "bog_monserrate", "hab_escritorio", "desayuno_buffet"], "Hotel urbano", "Cundinamarca",
        "Hotel clásico en el centro de Bogotá, a pasos del Museo del Oro y de la Plaza de Bolívar. Habitaciones amplias, "
        "centro de negocios y restaurante buffet.",
    ),
    "Cabanas del Bosque": (
        "cabana_bosque", ["cabanas_arboles", "cafe_niebla", "cabana_pequena"], "Cabañas", "Quindío",
        "Cabañas de madera en medio del bosque de niebla, a 5 km de Salento y cerca del Valle de Cocora. "
        "Chimenea, hamacas y mucho silencio.",
    ),
    "Plaza Mayor Hotel": (
        "patio_arcos", ["lobby_arco", "patio_camas", "desayuno_mesa"], "Hotel colonial", "Boyacá",
        "Casona colonial a una cuadra de la Plaza Mayor de Villa de Leyva, con patio central, corredores de arcos "
        "y habitaciones con techos de madera.",
    ),
    "Boutique Santa Marta": (
        "piscina_patio_aereo", ["piscina_terraza", "tay_atardecer", "desayuno_jugo"], "Hotel boutique", "Magdalena",
        "Hotel boutique en el centro histórico de Santa Marta con piscina en el patio, terraza en la azotea y "
        "atención personalizada. Cerca de la bahía y del camellón.",
    ),
    "EcoLodge Tayrona": (
        "sendero_resort", ["tay_sendero", "cabana_bambu_cama", "tay_atardecer"], "Ecolodge", "Magdalena",
        "Ecolodge en la entrada del Parque Tayrona, con cabañas entre la vegetación, restaurante de cocina local "
        "y caminatas guiadas a las playas del parque.",
    ),
    "Hotel Imperial": (
        "lobby_moderno", ["mde_skyline", "hab_escritorio", "desayuno_jugo"], "Hotel urbano", "Antioquia",
        "Hotel moderno sobre la Avenida El Poblado, con piscina, gimnasio y fácil acceso al metro, Provenza y el "
        "Parque Lleras.",
    ),
    "Cali Pachanguero H.": (
        "piscina_aerea", ["lobby_ciudad", "desayuno_buffet", "piscina_blanca"], "Hotel urbano", "Valle del Cauca",
        "Hotel en el barrio Granada, la zona gastronómica de Cali, con piscina y a minutos de las mejores escuelas "
        "y discotecas de salsa de la capital mundial de la salsa.",
    ),
}  # fmt: skip

# Hoteles de c4e8a2f6b1d3 cuya portada era un paisaje del destino y no el
# hotel: nombre -> (foto que tenía, foto nueva). Solo se cambia si sigue
# siendo la misma foto.
PORTADAS_PAISAJE = {
    "Hotel Mar de Siete Colores": ("photo-1576475510454-b0af18970e6d", "piscina_blanca"),
    "Posada Nativa Sound Bay": ("photo-1592782985575-a96c6e647155", "playa_sillas"),
    "Refugio El Peñol": ("photo-1598028060898-c117093edfcb", "cabana_pequena"),
}

# Portadas demo conocidas (se reemplazan); cualquier otra es de un admin.
PORTADAS_DEMO_LIKE = ["https://res.cloudinary.com/urvnvwir/image/upload/%/alectours/hoteles/%", "https://images.unsplash.com/%"]

# tipo de habitación -> (fotos, nombre comercial, descripción)
HABITACIONES = {
    "Sencilla": ([("cama_gris", "Habitación"), ("bano_espejo", "Baño")], "Habitación Sencilla",
                 "Habitación cómoda para una persona, con escritorio, wifi y baño privado."),
    "Doble": ([("cama_lino", "Habitación"), ("bano_ducha", "Baño")], "Habitación Doble",
              "Cama matrimonial, aire acondicionado o calefacción según el destino, TV y baño privado."),
    "Twin": ([("cama_lino_3", "Habitación"), ("bano_ducha", "Baño")], "Habitación Twin",
             "Dos camas individuales, ideal para amigos o compañeros de viaje."),
    "Familiar": ([("cama_lino_4", "Habitación"), ("bano_tina", "Baño")], "Habitación Familiar",
                 "Habitación amplia para la familia, con varias camas y espacio para el equipaje."),
    "Suite": ([("cama_king_azul", "Habitación"), ("bano_marmol", "Baño"), ("hab_sofa", "Sala")], "Suite",
              "Suite con cama king, sala de estar y baño de lujo."),
    "Presidencial": ([("cama_cortinas", "Habitación"), ("tina_mar", "Baño"), ("hab_sofa", "Sala")], "Suite Presidencial",
                     "La mejor habitación del hotel: amplia, con sala, comedor y baño con bañera."),
    "Cuadruple": ([("cama_lino_4", "Habitación"), ("bano_espejo", "Baño")], "Habitación Cuádruple",
                  "Cuatro camas individuales, perfecta para grupos."),
    "Cabana": ([("cabana_bambu_cama", "Interior"), ("cabana_ducha", "Baño"), ("cabana_pequena", "Exterior")], "Cabaña",
               "Cabaña independiente rodeada de naturaleza, con terraza y hamaca."),
    "Penthouse": ([("cama_lamparas", "Habitación"), ("hab_sofa", "Sala"), ("bano_marmol", "Baño")], "Penthouse",
                  "Apartamento en el último piso con sala, cocina y vista panorámica."),
    "Economica": ([("cama_azul", "Habitación"), ("bano_ducha", "Baño")], "Habitación Económica",
                  "Opción sencilla y económica con todo lo necesario para descansar."),
}  # fmt: skip


def upgrade() -> None:
    conn = op.get_bind()
    for nombre, (anterior, nueva) in PORTADAS_PAISAJE.items():
        conn.execute(
            sa.text("UPDATE hoteles SET imagen_url = :nueva WHERE nombre_hotel = :n AND imagen_url = :anterior"),
            {"nueva": U(F[nueva]), "n": nombre, "anterior": U(anterior)},
        )
    for nombre, (portada, galeria, tipo, departamento, descripcion) in HOTELES.items():
        hotel = conn.execute(
            sa.text("SELECT id_hotel, imagen_url FROM hoteles WHERE nombre_hotel = :n ORDER BY id_hotel LIMIT 1"),
            {"n": nombre},
        ).first()
        if not hotel:
            continue
        id_hotel = hotel.id_hotel

        conn.execute(
            sa.text(
                "UPDATE hoteles SET imagen_url = :url WHERE id_hotel = :id "
                "AND (imagen_url IS NULL OR imagen_url LIKE :demo1 OR imagen_url LIKE :demo2)"
            ),
            {"url": U(F[portada]), "id": id_hotel, "demo1": PORTADAS_DEMO_LIKE[0], "demo2": PORTADAS_DEMO_LIKE[1]},
        )
        conn.execute(
            sa.text(
                "UPDATE hoteles SET "
                "descripcion = COALESCE(descripcion, :descripcion), "
                "tipo_alojamiento = COALESCE(tipo_alojamiento, :tipo), "
                "departamento = COALESCE(departamento, :departamento), "
                "hora_checkin = COALESCE(hora_checkin, :checkin), "
                "hora_checkout = COALESCE(hora_checkout, :checkout) "
                "WHERE id_hotel = :id"
            ),
            {
                "descripcion": descripcion, "tipo": tipo, "departamento": departamento,
                "checkin": dt.time(15, 0), "checkout": dt.time(12, 0), "id": id_hotel,
            },
        )  # fmt: skip

        tiene_galeria = conn.execute(
            sa.text("SELECT 1 FROM imagenes_hotel WHERE id_hotel = :id LIMIT 1"), {"id": id_hotel}
        ).first()
        if not tiene_galeria:
            for orden, foto in enumerate(galeria):
                conn.execute(
                    sa.text("INSERT INTO imagenes_hotel (id_hotel, url, orden) VALUES (:id, :url, :orden)"),
                    {"id": id_hotel, "url": U(F[foto]), "orden": orden},
                )

        habitaciones = conn.execute(
            sa.text(
                "SELECT h.id_habitacion, t.nombre_tipo FROM habitaciones h "
                "JOIN tipo_habitacion t ON t.id_tipo_habitacion = h.id_tipo_habitacion "
                "WHERE h.id_hotel = :id AND NOT EXISTS "
                "(SELECT 1 FROM imagenes_habitacion i WHERE i.id_habitacion = h.id_habitacion)"
            ),
            {"id": id_hotel},
        ).all()
        for id_hab, nombre_tipo in habitaciones:
            fotos, nombre_hab, desc_hab = HABITACIONES.get(nombre_tipo, HABITACIONES["Doble"])
            for orden, (foto, pie) in enumerate(fotos):
                conn.execute(
                    sa.text(
                        "INSERT INTO imagenes_habitacion (id_habitacion, url, orden, descripcion) "
                        "VALUES (:id, :url, :orden, :pie)"
                    ),
                    {"id": id_hab, "url": U(F[foto]), "orden": orden, "pie": pie},
                )
            conn.execute(
                sa.text(
                    "UPDATE habitaciones SET nombre = COALESCE(nombre, :nombre), "
                    "descripcion = COALESCE(descripcion, :descripcion) WHERE id_habitacion = :id"
                ),
                {"nombre": nombre_hab, "descripcion": desc_hab, "id": id_hab},
            )


def downgrade() -> None:
    conn = op.get_bind()
    for nombre, (anterior, nueva) in PORTADAS_PAISAJE.items():
        conn.execute(
            sa.text("UPDATE hoteles SET imagen_url = :anterior WHERE nombre_hotel = :n AND imagen_url = :nueva"),
            {"nueva": U(F[nueva]), "n": nombre, "anterior": U(anterior)},
        )
    # Solo se quitan las fotos que agregó esta migración (las de Unsplash de
    # galería y habitaciones de estos hoteles). Las portadas y textos se
    # dejan: la portada anterior era la foto equivocada que se quería
    # reemplazar.
    urls = [U(v) for v in F.values()]
    nombres = list(HOTELES)
    conn.execute(
        sa.text(
            "DELETE FROM imagenes_hotel WHERE url = ANY(:urls) AND id_hotel IN "
            "(SELECT id_hotel FROM hoteles WHERE nombre_hotel = ANY(:nombres))"
        ),
        {"urls": urls, "nombres": nombres},
    )
    conn.execute(
        sa.text(
            "DELETE FROM imagenes_habitacion WHERE url = ANY(:urls) AND id_habitacion IN "
            "(SELECT h.id_habitacion FROM habitaciones h JOIN hoteles o ON o.id_hotel = h.id_hotel "
            "WHERE o.nombre_hotel = ANY(:nombres))"
        ),
        {"urls": urls, "nombres": nombres},
    )
