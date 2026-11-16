"""Catálogo ampliado: hoteles con habitaciones, paquetes turísticos y vuelos.

Carga un catálogo de demostración amplio y coherente para que el sitio
tenga contenido real que mostrar:

- 13 hoteles en Cartagena, San Andrés, Santa Marta, Medellín, Guatapé,
  Eje Cafetero, Bogotá, Cancún, Punta Cana y Cusco, con ficha completa
  (descripción, políticas, horarios, servicios), portada y galería.
- 3-4 habitaciones por hotel con ficha completa y fotos propias.
- 20 ofertas aéreas publicadas (Avianca, LATAM, Wingo, Copa) entre las
  principales ciudades de Colombia y destinos del Caribe y Perú.
- 10 paquetes turísticos con itinerario día a día, qué incluye / qué no
  incluye, salidas programadas con cupos, galería, hotel y vuelo.

Fotos: Unsplash (licencia libre de Unsplash, uso comercial permitido).
Cada foto se eligió por su descripción para que corresponda al destino o
al tipo de espacio (habitación, baño, piscina, lobby...).

Los establecimientos son de demostración: los precios y fichas son
referenciales y se reemplazan desde el panel por los de los proveedores
reales. Los números de vuelo se dejan vacíos a propósito (no se inventan
datos que el cliente podría tomar como confirmados por la aerolínea).

Idempotente: cada hotel, paquete y oferta se crea solo si no existe uno
con el mismo nombre/título, y no toca ningún dato existente.
downgrade() borra exactamente lo que esta migración creó (por nombre).

Revision ID: c4e8a2f6b1d3
Revises: b3d8f1a6c2e4
Create Date: 2026-11-15
"""

from __future__ import annotations

import datetime as dt

import sqlalchemy as sa

from alembic import op

revision = "c4e8a2f6b1d3"
down_revision = "b3d8f1a6c2e4"
branch_labels = None
depends_on = None


def U(photo_id: str) -> str:
    """URL de Unsplash optimizada (recorte y formato automático)."""
    return f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w=1600&q=80"


D = dt.date
T = dt.time

# ---------------------------------------------------------------------------
# Fotos (Unsplash) agrupadas por tema
# ---------------------------------------------------------------------------
F = {
    # Destinos
    "ctg_calle_iglesia": "photo-1534943441045-1009d7cb0bb9",
    "ctg_casas_colores": "photo-1536308037887-165852797016",
    "ctg_callejon": "photo-1560242374-ca6dd3434522",
    "ctg_catedral": "photo-1563131896-ee67f23bbc98",
    "ctg_edificio_mar": "photo-1678794144519-9aadc02edb53",
    "ctg_balcones": "photo-1583531352515-8884af319dc1",
    "adz_isla": "photo-1576475510454-b0af18970e6d",
    "adz_palmeras": "photo-1592782985575-a96c6e647155",
    "adz_lancha": "photo-1723502436200-6aaaa56cc1d5",
    "adz_playa": "photo-1754380578548-98f82e56ecf6",
    "adz_agua_clara": "photo-1754380578509-7a0fbe72ac4a",
    "adz_cayo": "photo-1717604553797-a05d5ddac52c",
    "tay_bote_playa": "photo-1580670418997-46950c4877df",
    "tay_sendero": "photo-1659849182790-18858a40654c",
    "tay_rocas": "photo-1612815867823-85cf0957890b",
    "tay_atardecer": "photo-1532096182988-4a0c8a065ea5",
    "tay_sol_rocas": "photo-1706189422373-c322a9140928",
    "mde_atardecer": "photo-1512250431446-d0b4b57b27ec",
    "mde_montanas": "photo-1548397968-8790c49522db",
    "mde_skyline": "photo-1590598016835-83cf3357ebc5",
    "mde_vista": "photo-1715503234327-b57d32e5da0f",
    "mde_mural": "photo-1715503234322-4edf36c85cf1",
    "gtp_penol": "photo-1582568742002-499ac33758ce",
    "gtp_aerea": "photo-1598028060898-c117093edfcb",
    "gtp_escaleras": "photo-1764815685159-b3b5b371a687",
    "gtp_calle": "photo-1775584989108-835121fd7e21",
    "gtp_islas": "photo-1525088299396-2417f1366edd",
    "cafe_cocora": "photo-1789009413700-1366da08ee6e",
    "cafe_palmas": "photo-1768407683196-521a0764da27",
    "cafe_finca": "photo-1789009413826-661e2eb104e6",
    "cafe_valle": "photo-1714924732294-32964bfdd7b0",
    "cafe_niebla": "photo-1557733686-45c927db98e9",
    "cafe_granos": "photo-1672851612794-6687bf0bf1a3",
    "cafe_cerezas": "photo-1750967613671-297f1b63038d",
    "bog_ciudad": "photo-1568632234157-ce7aecd03d0d",
    "bog_monserrate": "photo-1720067392108-89b9485aa090",
    "bog_grafiti": "photo-1759375253713-bde59f4f5596",
    "bog_sombrillas": "photo-1759375333229-f11b52711d73",
    "bog_aerea": "photo-1681145553138-816eb004b846",
    "cun_playa_aerea": "photo-1630252421399-ddde79af47b3",
    "cun_resort": "photo-1773802467099-1433a349ef1a",
    "cun_palmeras": "photo-1772656945540-77583e484667",
    "cun_sombrillas": "photo-1602088113235-229c19758e9f",
    "cun_chichen": "photo-1568402102990-bc541580b59f",
    "cun_olas": "photo-1773802511837-f26812b48214",
    "puj_isla": "photo-1781901340491-4b7220d28f2f",
    "puj_sombrillas": "photo-1705507972578-78537a2dda73",
    "puj_playa": "photo-1781901227396-34e5fc040091",
    "puj_palmeras": "photo-1692017827893-f97d95397b49",
    "puj_cabanas": "photo-1546708973-b339540b5162",
    "puj_aerea": "photo-1637576305711-23d3b0f72881",
    "cuz_machu": "photo-1587595431973-160d0d94add1",
    "cuz_ventana": "photo-1567597243073-2d274aabecec",
    "cuz_llamas": "photo-1664387518989-bb1d8574f078",
    "cuz_catedral": "photo-1578594903885-51d6d8bcdbb7",
    "cuz_plaza": "photo-1769358730767-ea63216351b7",
    "cuz_tejados": "photo-1526697675318-89790adec369",
    # Hoteles: patios, piscinas, lobbies, cabañas, desayunos
    "patio_piscina": "photo-1761828122922-5a839ada5b76",
    "patio_moderno": "photo-1760262645776-633204d88ded",
    "patio_arcos": "photo-1791398423445-a8f744958cc7",
    "patio_camas": "photo-1765910639954-27ae0c260586",
    "lobby_arco": "photo-1573052905904-34ad8c27f0cc",
    "lobby_madera": "photo-1621293954908-907159247fc8",
    "lobby_moderno": "photo-1782890790046-2aefb0b503cb",
    "lobby_recepcion": "photo-1758193783649-13371d7fb8dd",
    "lobby_marmol": "photo-1758448500688-3ababa93fd67",
    "lobby_ciudad": "photo-1587702068694-a909ef4aa346",
    "piscina_sillas": "photo-1648381196047-5a4390bcf32e",
    "resort_aereo_1": "photo-1729717949712-1c51422693d1",
    "resort_aereo_2": "photo-1729717949782-f40c4a07e3c4",
    "resort_aereo_3": "photo-1729717949948-56b52db111dd",
    "resort_piscina_playa": "photo-1729707691048-722c1acf5c51",
    "piscina_palmeras": "photo-1732817207228-7d53fec17f97",
    "playa_sillas": "photo-1725006136539-46bef885df06",
    "muelle_sillas": "photo-1584132869994-873f9363a562",
    "piscina_blanca": "photo-1596436889106-be35e843f974",
    "piscina_patio_aereo": "photo-1776763255458-6200750f3930",
    "piscina_aerea": "photo-1776763255480-014a64ee137d",
    "piscina_terraza": "photo-1776763255431-633c91b6b4b6",
    "piscina_sombrillas": "photo-1776324612262-b8d11ceada5c",
    "cabana_techo_paja": "photo-1787242787556-9a12376d2cb3",
    "cabana_bambu_cama": "photo-1777913319909-1d27d36db93e",
    "cabana_bosque": "photo-1759843009272-24dc382e3d6b",
    "cabanas_arboles": "photo-1772703003096-fe4096559f81",
    "cabana_pequena": "photo-1765833667306-2dcb8430b7f3",
    "cabana_balcon": "photo-1775283537748-4fc2b5fb28c0",
    "sendero_resort": "photo-1761950116791-8bfc445e5186",
    "desayuno_mesa": "photo-1504754524776-8f4f37790ca0",
    "desayuno_buffet": "photo-1763207291832-819499e261dd",
    "desayuno_mar": "photo-1781456507315-b00848df005e",
    "desayuno_jugo": "photo-1784217066863-49aa1baaa843",
    # Habitaciones
    "cama_blanca": "photo-1618773928121-c32242e63f39",
    "cama_gris": "photo-1629140727571-9b5c6f6267b4",
    "cama_lino": "photo-1631049307264-da0ec9d70304",
    "cama_almohadas": "photo-1711059985570-4c32ed12a12c",
    "cama_lino_2": "photo-1631049421450-348ccd7f8949",
    "cama_ventana": "photo-1549638441-b787d2e11f14",
    "cama_lino_3": "photo-1631048730670-ff5cd0d08f15",
    "cama_azul": "photo-1639678349557-ffe5bed73ce7",
    "cama_jardin": "photo-1781572725438-ac8c41476752",
    "cama_teal": "photo-1611892440504-42a792e24d32",
    "cama_king_azul": "photo-1770232274485-b35ee5092cbe",
    "cama_cortinas": "photo-1759328257280-28bdb3050be3",
    "cama_lamparas": "photo-1776763255122-3d35e32aee64",
    "cama_lino_4": "photo-1631049552057-403cdb8f0658",
    "hab_escritorio": "photo-1776763018821-8feeaeeee0a5",
    "hab_sofa": "photo-1590490360182-c33d57733427",
    "balcon_mar": "photo-1702830499141-a0634d87d6af",
    "dormitorio_mar": "photo-1777017246552-8b0e36b92d52",
    "balcon_playa": "photo-1766997249333-308fe0d24b8a",
    "balcon_cielo": "photo-1772170832403-4745a393403c",
    "tina_mar": "photo-1779942578833-5f00dc79d6d1",
    "terraza_mar": "photo-1609602126247-4ab7188b4aa1",
    "ventana_playa": "photo-1560264981-911bbf4a29b4",
    "bano_ducha": "photo-1584622650111-993a426fbf0a",
    "bano_espejo": "photo-1718894070114-6de0e98449a2",
    "bano_tina": "photo-1776525433347-13ffc965601a",
    "bano_banera": "photo-1507652313519-d4e9174996dd",
    "bano_marmol": "photo-1765745518673-b562b7304a53",
    "bano_vidrio": "photo-1587527901949-ab0341697c1e",
    "cabana_ducha": "photo-1788217023349-ad7763845844",
}

# ---------------------------------------------------------------------------
# Características de hotel (se crean si no existen)
# ---------------------------------------------------------------------------
CARACTERISTICAS = [
    "Piscina al aire libre", "Gimnasio", "Spa y masajes", "Restaurante buffet",
    "Parqueadero gratuito", "Pet Friendly", "Traslado al aeropuerto", "Bar en la azotea",
    "Wifi gratis", "Recepción 24 horas", "Aire acondicionado", "Playa privada",
    "Todo incluido", "Club de niños", "Jacuzzi", "Senderos ecológicos",
    "Desayuno incluido", "Servicio a la habitación", "Lavandería", "Terraza con vista",
]  # fmt: skip

POLITICA_NINOS_STD = (
    "Niños de todas las edades son bienvenidos. Menores de 5 años se alojan gratis "
    "compartiendo cama con los padres. Cunas disponibles sin costo bajo solicitud."
)
CANCELACION_STD = (
    "Cancelación gratuita hasta 7 días antes de la llegada. Entre 6 y 2 días antes se cobra "
    "el 50% de la primera noche. Cancelaciones con menos de 48 horas o no presentación: se "
    "cobra la primera noche completa."
)
CANCELACION_TEMPORADA = (
    "En temporada alta (15 de diciembre a 15 de enero, Semana Santa y puentes festivos) la "
    "cancelación gratuita es hasta 15 días antes de la llegada; después se cobra el 100% de "
    "la primera noche."
)
IMPUESTOS_CO = (
    "Tarifas en pesos colombianos. Los extranjeros no residentes están exentos de IVA (19%) "
    "presentando pasaporte y sello de entrada. Seguro hotelero obligatorio incluido."
)

# ---------------------------------------------------------------------------
# Hoteles
# Cada habitación: (numero, tipo, nombre, precio, m2, cama, vista, piso, baño,
#                   adultos, niños, camas, desayuno, servicios, descripción,
#                   [(foto, pie), ...])
# ---------------------------------------------------------------------------
SERV_BASE = ["wifi", "aire_acondicionado", "tv_cable", "ducha", "agua_caliente", "toallas",
             "articulos_aseo", "ropa_cama", "caja_fuerte", "limpieza_diaria"]  # fmt: skip


def hab(numero, tipo, nombre, precio, m2, cama, vista, piso, bano, adultos, ninos, camas,
        desayuno, servicios, descripcion, fotos, **extra):  # fmt: skip
    return {
        "numero_habitacion": numero, "tipo": tipo, "nombre": nombre, "precio_noche": precio,
        "tamano_m2": m2, "tipo_cama": cama, "vista": vista, "piso": piso, "tipo_bano": bano,
        "capacidad_adultos": adultos, "capacidad_ninos": ninos, "cantidad_camas": camas,
        "desayuno_incluido": desayuno, "servicios": servicios, "descripcion": descripcion,
        "fotos": fotos, **extra,
    }  # fmt: skip


HOTELES = [
    {
        "nombre_hotel": "Casa Murallas Hotel Boutique",
        "calificacion": 5, "tipo_alojamiento": "Hotel boutique",
        "direccion": "Calle del Santísimo # 8-40, Centro Histórico", "ciudad": "Cartagena",
        "departamento": "Bolívar", "pais": "Colombia", "codigo_postal": "130001",
        "latitud": 10.4246, "longitud": -75.5498,
        "imagen": "patio_piscina",
        "galeria": ["patio_arcos", "ctg_calle_iglesia", "patio_camas", "lobby_arco", "desayuno_mesa", "ctg_casas_colores"],
        "descripcion": (
            "Casona colonial del siglo XVII restaurada dentro de la ciudad amurallada, a dos cuadras de "
            "la Plaza de Santo Domingo. Sus 18 habitaciones rodean un patio con piscina, buganvilias y "
            "fuentes de piedra. Techos altos de madera, balcones sobre la calle y una terraza en la "
            "azotea con vista a las cúpulas del centro y al mar Caribe. Ideal para parejas y viajeros "
            "que quieren recorrer Cartagena a pie."
        ),
        "politicas": "Hotel solo para adultos y niños mayores de 12 años. No se permite fumar en áreas cerradas.",
        "edad_minima": 12,
        "politica_ninos": "Se aceptan niños desde los 12 años, que pagan tarifa de adulto.",
        "politica_mascotas": "No se admiten mascotas.",
        "caracteristicas": [("Piscina al aire libre", "incluido"), ("Wifi gratis", "incluido"),
                            ("Bar en la azotea", "incluido"), ("Spa y masajes", "de_pago"),
                            ("Desayuno incluido", "incluido"), ("Traslado al aeropuerto", "de_pago"),
                            ("Recepción 24 horas", "incluido"), ("Aire acondicionado", "incluido"),
                            ("Servicio a la habitación", "de_pago")],
        "habitaciones": [
            hab("101", "Doble", "Habitación Colonial Patio", 680000, 28, "1 cama queen", "Patio interior", 1,
                "Baño privado con ducha tipo lluvia", 2, 0, 1, True, SERV_BASE + ["minibar", "secador", "cafetera"],
                "Habitación de techos altos con vigas de madera, piso en baldosa original y ventanas al patio con piscina. "
                "Decoración en tonos arena y blanco con muebles de anticuario.",
                [("cama_jardin", "Habitación"), ("bano_ducha", "Baño"), ("patio_piscina", "Vista al patio")]),
            hab("201", "Doble", "Habitación Balcón Colonial", 790000, 32, "1 cama king", "Calle colonial", 2,
                "Baño privado con ducha y ventana", 2, 0, 1, True, SERV_BASE + ["minibar", "secador", "cafetera", "balcon", "bata_pantuflas"],
                "Con balcón de madera sobre la calle empedrada, perfecta para ver la vida de la ciudad amurallada al atardecer.",
                [("cama_teal", "Habitación"), ("bano_vidrio", "Baño"), ("ctg_balcones", "Vista desde el balcón")]),
            hab("301", "Suite", "Suite Terraza Catedral", 1150000, 48, "1 cama king", "Cúpulas y mar", 3,
                "Baño de mármol con bañera y ducha", 2, 0, 1, True,
                SERV_BASE + ["minibar", "secador", "cafetera", "terraza", "jacuzzi", "bata_pantuflas", "zona_estar", "servicio_habitacion"],
                "Suite en el último piso con terraza privada y jacuzzi, sala de estar y vista directa a la torre de la Catedral.",
                [("cama_king_azul", "Habitación"), ("bano_marmol", "Baño"), ("ctg_catedral", "Vista desde la terraza")]),
        ],
    },
    {
        "nombre_hotel": "Bocagrande Bay Resort",
        "calificacion": 4, "tipo_alojamiento": "Hotel de playa",
        "direccion": "Carrera 1 # 9-120, Bocagrande", "ciudad": "Cartagena", "departamento": "Bolívar",
        "pais": "Colombia", "codigo_postal": "130001", "latitud": 10.4005, "longitud": -75.5560,
        "imagen": "piscina_palmeras",
        "galeria": ["resort_piscina_playa", "ctg_edificio_mar", "piscina_sillas", "lobby_moderno", "desayuno_buffet", "playa_sillas"],
        "descripcion": (
            "Hotel frente al mar en la zona de Bocagrande, con acceso directo a la playa, dos piscinas "
            "(una para niños), restaurante buffet y bar de playa. A 10 minutos en taxi del centro "
            "histórico y a 15 del aeropuerto Rafael Núñez. Perfecto para familias."
        ),
        "politicas": "Se exige brazalete de identificación en áreas comunes. Horario de piscina de 7:00 a. m. a 9:00 p. m.",
        "edad_minima": 18, "politica_ninos": POLITICA_NINOS_STD,
        "politica_mascotas": "Se admiten mascotas pequeñas (hasta 10 kg) con cargo de $60.000 por noche.",
        "caracteristicas": [("Piscina al aire libre", "incluido"), ("Playa privada", "incluido"), ("Gimnasio", "incluido"),
                            ("Restaurante buffet", "incluido"), ("Club de niños", "incluido"), ("Wifi gratis", "incluido"),
                            ("Parqueadero gratuito", "incluido"), ("Pet Friendly", "de_pago"), ("Spa y masajes", "de_pago"),
                            ("Traslado al aeropuerto", "de_pago")],
        "habitaciones": [
            hab("504", "Doble", "Estándar Vista Ciudad", 420000, 26, "1 cama queen", "Ciudad", 5,
                "Baño privado con ducha", 2, 1, 1, True, SERV_BASE + ["nevera", "secador"],
                "Habitación moderna y luminosa con escritorio, ideal para estadías cortas.",
                [("cama_lino", "Habitación"), ("bano_espejo", "Baño"), ("hab_escritorio", "Escritorio")]),
            hab("812", "Twin", "Superior Vista al Mar", 560000, 30, "2 camas dobles", "Mar Caribe", 8,
                "Baño privado con ducha", 2, 2, 2, True, SERV_BASE + ["nevera", "secador", "balcon"],
                "Dos camas dobles y balcón con vista al mar: el favorito de las familias.",
                [("cama_lino_3", "Habitación"), ("bano_ducha", "Baño"), ("balcon_mar", "Vista desde el balcón")]),
            hab("1105", "Familiar", "Familiar Frente al Mar", 780000, 45, "1 cama king + 2 sencillas", "Mar Caribe", 11,
                "Baño privado con bañera", 4, 2, 3, True, SERV_BASE + ["nevera", "secador", "balcon", "sofa", "microondas"],
                "Amplia habitación con zona de estar, sofá cama y balcón frente al mar. Capacidad para 4 adultos y 2 niños.",
                [("dormitorio_mar", "Habitación"), ("bano_tina", "Baño"), ("balcon_playa", "Balcón")]),
            hab("1501", "Suite", "Suite Ejecutiva Bahía", 1050000, 60, "1 cama king", "Bahía de Cartagena", 15,
                "Baño con bañera de hidromasaje", 2, 1, 1, True,
                SERV_BASE + ["minibar", "cafetera", "jacuzzi", "zona_estar", "bata_pantuflas", "servicio_habitacion"],
                "Suite en piso alto con sala independiente y vista panorámica a la bahía y al skyline de Bocagrande.",
                [("cama_cortinas", "Habitación"), ("tina_mar", "Baño con vista"), ("hab_sofa", "Sala")]),
        ],
    },
    {
        "nombre_hotel": "Hotel Mar de Siete Colores",
        "calificacion": 4, "tipo_alojamiento": "Hotel todo incluido",
        "direccion": "Avenida Colombia # 1-19, Spratt Bight", "ciudad": "San Andrés",
        "departamento": "San Andrés y Providencia", "pais": "Colombia", "codigo_postal": "880001",
        "latitud": 12.5847, "longitud": -81.7006,
        "imagen": "adz_isla",
        "galeria": ["adz_playa", "piscina_blanca", "adz_agua_clara", "desayuno_mar", "adz_cayo", "piscina_sombrillas"],
        "descripcion": (
            "Hotel todo incluido sobre la playa de Spratt Bight, en el corazón de San Andrés. Incluye "
            "desayuno, almuerzo y cena tipo buffet, snacks, bebidas nacionales y actividades diarias. "
            "Desde la piscina se ve el famoso mar de siete colores y Johnny Cay."
        ),
        "politicas": "Plan todo incluido de 7:00 a. m. a 11:00 p. m. Uso obligatorio de manilla.",
        "edad_minima": 18, "politica_ninos": POLITICA_NINOS_STD, "politica_mascotas": "No se admiten mascotas.",
        "informacion_adicional": "Todo visitante a San Andrés debe pagar la tarjeta de turismo (aprox. $146.000 en 2026) al llegar o al comprar el tiquete.",
        "caracteristicas": [("Todo incluido", "incluido"), ("Piscina al aire libre", "incluido"), ("Playa privada", "incluido"),
                            ("Restaurante buffet", "incluido"), ("Wifi gratis", "incluido"), ("Club de niños", "incluido"),
                            ("Traslado al aeropuerto", "incluido"), ("Spa y masajes", "de_pago")],
        "habitaciones": [
            hab("210", "Doble", "Estándar Todo Incluido", 690000, 24, "1 cama queen", "Jardín", 2,
                "Baño privado con ducha", 2, 1, 1, True, SERV_BASE + ["nevera"],
                "Habitación cómoda a pocos pasos de la piscina. Tarifa por noche para 2 personas con todo incluido.",
                [("cama_blanca", "Habitación"), ("bano_espejo", "Baño"), ("piscina_blanca", "Piscina del hotel")]),
            hab("315", "Twin", "Superior Vista al Mar Todo Incluido", 820000, 28, "2 camas dobles", "Mar de siete colores", 3,
                "Baño privado con ducha", 3, 1, 2, True, SERV_BASE + ["nevera", "balcon"],
                "Balcón con vista directa al mar de siete colores. Tarifa por noche para 2 personas.",
                [("cama_lino_2", "Habitación"), ("bano_ducha", "Baño"), ("balcon_playa", "Vista desde el balcón")]),
            hab("401", "Suite", "Junior Suite Johnny Cay", 1080000, 40, "1 cama king", "Johnny Cay", 4,
                "Baño con bañera", 2, 2, 1, True, SERV_BASE + ["minibar", "balcon", "zona_estar", "bata_pantuflas"],
                "Junior suite en el último piso con sala, balcón amplio y vista a Johnny Cay. Tarifa por noche para 2 personas.",
                [("cama_king_azul", "Habitación"), ("bano_banera", "Baño"), ("adz_cayo", "Vista a Johnny Cay")]),
        ],
    },
    {
        "nombre_hotel": "Posada Nativa Sound Bay",
        "calificacion": 3, "tipo_alojamiento": "Posada nativa",
        "direccion": "Sector Sound Bay, Km 6 vía circunvalar", "ciudad": "San Andrés",
        "departamento": "San Andrés y Providencia", "pais": "Colombia", "codigo_postal": "880001",
        "latitud": 12.5372, "longitud": -81.7105,
        "imagen": "adz_palmeras",
        "galeria": ["adz_lancha", "cabana_techo_paja", "desayuno_jugo", "adz_agua_clara"],
        "descripcion": (
            "Posada familiar raizal en la zona tranquila de San Luis, frente a una playa de arena blanca. "
            "Desayuno caribeño casero, kayaks y equipo de snorkel gratis. Una forma auténtica de vivir la "
            "isla y apoyar el turismo local."
        ),
        "politicas": "Silencio a partir de las 10:00 p. m.",
        "edad_minima": 18, "politica_ninos": POLITICA_NINOS_STD, "politica_mascotas": "Mascotas pequeñas permitidas sin costo.",
        "caracteristicas": [("Wifi gratis", "incluido"), ("Desayuno incluido", "incluido"), ("Pet Friendly", "incluido"),
                            ("Aire acondicionado", "incluido"), ("Lavandería", "de_pago")],
        "habitaciones": [
            hab("A1", "Doble", "Doble Jardín Caribeño", 260000, 20, "1 cama doble", "Jardín", 1,
                "Baño privado con ducha", 2, 1, 1, True, ["wifi", "aire_acondicionado", "ducha", "toallas", "ropa_cama", "nevera"],
                "Habitación sencilla y fresca, decorada con artesanías de la isla.",
                [("cama_azul", "Habitación"), ("bano_vidrio", "Baño")]),
            hab("B2", "Familiar", "Familiar Frente a la Playa", 420000, 38, "1 cama queen + 2 sencillas", "Playa de San Luis", 1,
                "Baño privado con ducha", 4, 2, 3, True,
                ["wifi", "aire_acondicionado", "ducha", "toallas", "ropa_cama", "nevera", "terraza", "cocineta"],
                "Con terraza propia a 20 pasos del mar y cocineta equipada.",
                [("cama_ventana", "Habitación"), ("terraza_mar", "Terraza"), ("adz_playa", "La playa frente a la posada")]),
        ],
    },
    {
        "nombre_hotel": "Selva Tayrona Ecolodge",
        "calificacion": 4, "tipo_alojamiento": "Ecolodge",
        "direccion": "Km 34 Troncal del Caribe, sector Los Naranjos", "ciudad": "Santa Marta",
        "departamento": "Magdalena", "pais": "Colombia", "codigo_postal": "470001",
        "latitud": 11.2685, "longitud": -73.8930,
        "imagen": "cabana_techo_paja",
        "galeria": ["cabana_bambu_cama", "tay_bote_playa", "sendero_resort", "tay_sendero", "tay_atardecer", "cabana_balcon"],
        "descripcion": (
            "Cabañas elevadas entre la selva y el mar, a 5 minutos de la entrada El Zaino del Parque "
            "Nacional Natural Tayrona. Energía solar, restaurante de cocina local con productos de la "
            "Sierra Nevada y guías certificados para caminatas a Cabo San Juan y Pueblito."
        ),
        "politicas": "Hotel eco-sostenible: no se entregan botellas plásticas. Se ruega ahorrar agua y energía.",
        "edad_minima": 18, "politica_ninos": POLITICA_NINOS_STD, "politica_mascotas": "No se admiten mascotas (zona de reserva natural).",
        "informacion_adicional": "El Parque Tayrona cierra cada año por temporadas cortas (normalmente febrero, junio y octubre) para recuperación ambiental. Consulte fechas con su asesor.",
        "caracteristicas": [("Senderos ecológicos", "incluido"), ("Piscina al aire libre", "incluido"), ("Desayuno incluido", "incluido"),
                            ("Wifi gratis", "incluido"), ("Spa y masajes", "de_pago"), ("Traslado al aeropuerto", "de_pago"),
                            ("Parqueadero gratuito", "incluido")],
        "habitaciones": [
            hab("C-1", "Cabana", "Cabaña Selva", 520000, 30, "1 cama queen con toldillo", "Selva", 1,
                "Baño privado semiabierto con ducha", 2, 1, 1, True, ["ducha", "ventilador", "toallas", "ropa_cama", "terraza", "articulos_aseo"],
                "Cabaña de madera y techo de palma rodeada de vegetación, con hamaca en la terraza.",
                [("cabana_bambu_cama", "Interior de la cabaña"), ("cabana_ducha", "Baño"), ("cabana_bosque", "Exterior")]),
            hab("C-5", "Cabana", "Cabaña Vista al Mar", 690000, 36, "1 cama king con toldillo", "Mar Caribe", 2,
                "Baño privado con ducha exterior", 2, 2, 2, True,
                ["ducha", "ventilador", "toallas", "ropa_cama", "terraza", "articulos_aseo", "nevera"],
                "Cabaña en la parte alta del lodge con vista al mar desde la cama y terraza con hamacas.",
                [("cabana_balcon", "Terraza"), ("tay_sol_rocas", "Vista al mar"), ("cabana_ducha", "Baño")]),
            hab("F-2", "Familiar", "Cabaña Familiar Sierra", 840000, 50, "1 cama king + 2 sencillas", "Sierra Nevada", 1,
                "Baño privado con ducha", 4, 2, 3, True, ["ducha", "ventilador", "toallas", "ropa_cama", "terraza", "nevera", "zona_estar"],
                "Dos ambientes separados, ideal para familias. Terraza con vista a la Sierra Nevada.",
                [("cabanas_arboles", "Exterior"), ("cama_jardin", "Habitación principal"), ("cabana_ducha", "Baño")]),
        ],
    },
    {
        "nombre_hotel": "Hotel Rodadero Playa",
        "calificacion": 3, "tipo_alojamiento": "Hotel de playa",
        "direccion": "Carrera 1 # 7-35, El Rodadero", "ciudad": "Santa Marta", "departamento": "Magdalena",
        "pais": "Colombia", "codigo_postal": "470006", "latitud": 11.2041, "longitud": -74.2280,
        "imagen": "piscina_sombrillas",
        "galeria": ["tay_rocas", "lobby_recepcion", "desayuno_buffet", "tay_atardecer"],
        "descripcion": (
            "Hotel sencillo y muy bien ubicado a una cuadra de la playa de El Rodadero, con piscina en la "
            "terraza, desayuno buffet y excelente relación calidad-precio. Punto de salida para Playa "
            "Blanca, el Acuario y los tours a Tayrona y Minca."
        ),
        "politicas": "", "edad_minima": 18, "politica_ninos": POLITICA_NINOS_STD, "politica_mascotas": "No se admiten mascotas.",
        "caracteristicas": [("Piscina al aire libre", "incluido"), ("Desayuno incluido", "incluido"), ("Wifi gratis", "incluido"),
                            ("Aire acondicionado", "incluido"), ("Recepción 24 horas", "incluido")],
        "habitaciones": [
            hab("302", "Doble", "Doble Estándar", 230000, 20, "1 cama doble", "Ciudad", 3, "Baño privado con ducha", 2, 1, 1, True,
                SERV_BASE, "Habitación funcional con todo lo necesario para disfrutar la playa.",
                [("cama_gris", "Habitación"), ("bano_ducha", "Baño")]),
            hab("405", "Cuadruple", "Cuádruple Vista Parcial al Mar", 380000, 30, "2 camas dobles", "Parcial al mar", 4,
                "Baño privado con ducha", 4, 0, 2, True, SERV_BASE + ["nevera", "balcon"],
                "Para grupos de amigos o familias: dos camas dobles y balcón con vista parcial al mar.",
                [("cama_lino_4", "Habitación"), ("bano_espejo", "Baño"), ("balcon_cielo", "Balcón")]),
        ],
    },
    {
        "nombre_hotel": "Poblado Skyline Hotel",
        "calificacion": 4, "tipo_alojamiento": "Hotel urbano",
        "direccion": "Carrera 37 # 8A-32, El Poblado", "ciudad": "Medellín", "departamento": "Antioquia",
        "pais": "Colombia", "codigo_postal": "050021", "latitud": 6.2088, "longitud": -75.5670,
        "imagen": "piscina_terraza",
        "galeria": ["mde_atardecer", "lobby_madera", "mde_skyline", "desayuno_jugo", "lobby_ciudad"],
        "descripcion": (
            "Hotel de diseño a pasos del Parque Lleras y Provenza, con piscina y bar en la azotea con vista "
            "a todo el Valle de Aburrá. Habitaciones insonorizadas, gimnasio 24 horas y desayuno con "
            "arepa y café de origen antioqueño."
        ),
        "politicas": "Hotel 100% libre de humo. Visitantes registrados en recepción con documento.",
        "edad_minima": 18, "politica_ninos": POLITICA_NINOS_STD,
        "politica_mascotas": "Pet friendly: mascotas hasta 15 kg con cargo de $50.000 por estadía.",
        "caracteristicas": [("Bar en la azotea", "incluido"), ("Piscina al aire libre", "incluido"), ("Gimnasio", "incluido"),
                            ("Wifi gratis", "incluido"), ("Desayuno incluido", "incluido"), ("Pet Friendly", "de_pago"),
                            ("Terraza con vista", "incluido"), ("Lavandería", "de_pago"), ("Recepción 24 horas", "incluido")],
        "habitaciones": [
            hab("702", "Doble", "Urban King", 390000, 27, "1 cama king", "Ciudad", 7, "Baño privado con ducha", 2, 0, 1, True,
                SERV_BASE + ["cafetera", "escritorio", "cortinas_blackout", "streaming"],
                "Habitación moderna con escritorio de trabajo, cortinas blackout y Smart TV con streaming.",
                [("cama_lamparas", "Habitación"), ("bano_vidrio", "Baño"), ("hab_escritorio", "Escritorio")]),
            hab("905", "Twin", "Twin Superior", 420000, 29, "2 camas semidobles", "Ciudad", 9, "Baño privado con ducha", 2, 1, 2, True,
                SERV_BASE + ["cafetera", "escritorio", "cortinas_blackout"],
                "Dos camas semidobles, ideal para amigos o viajes de trabajo.",
                [("cama_almohadas", "Habitación"), ("bano_espejo", "Baño")]),
            hab("1401", "Suite", "Suite Panorámica", 780000, 52, "1 cama king", "Valle de Aburrá", 14,
                "Baño con bañera y ducha", 2, 1, 1, True,
                SERV_BASE + ["cafetera", "minibar", "balcon", "zona_estar", "bata_pantuflas", "streaming", "servicio_habitacion"],
                "Suite de esquina con ventanales de piso a techo y balcón con vista a las montañas.",
                [("cama_ventana", "Habitación"), ("bano_banera", "Baño"), ("mde_vista", "Vista desde la suite")]),
        ],
    },
    {
        "nombre_hotel": "Refugio El Peñol",
        "calificacion": 3, "tipo_alojamiento": "Cabañas",
        "direccion": "Vereda La Piedra, Km 2 vía Guatapé - El Peñol", "ciudad": "Guatapé", "departamento": "Antioquia",
        "pais": "Colombia", "codigo_postal": "053840", "latitud": 6.2290, "longitud": -75.1770,
        "imagen": "gtp_aerea",
        "galeria": ["gtp_penol", "cabana_pequena", "gtp_islas", "gtp_calle", "desayuno_mesa"],
        "descripcion": (
            "Cabañas a orillas del embalse de Guatapé con muelle propio, kayaks y vista a la Piedra del "
            "Peñol. A 5 minutos del pueblo de los zócalos de colores. Ideal para desconectarse."
        ),
        "politicas": "Uso de kayaks con chaleco salvavidas obligatorio, de 7:00 a. m. a 5:00 p. m.",
        "edad_minima": 18, "politica_ninos": POLITICA_NINOS_STD, "politica_mascotas": "Mascotas bienvenidas sin costo.",
        "caracteristicas": [("Pet Friendly", "incluido"), ("Parqueadero gratuito", "incluido"), ("Desayuno incluido", "incluido"),
                            ("Wifi gratis", "incluido"), ("Jacuzzi", "de_pago"), ("Terraza con vista", "incluido")],
        "habitaciones": [
            hab("L-1", "Cabana", "Cabaña Lago para 2", 360000, 32, "1 cama queen", "Embalse", 1, "Baño privado con ducha", 2, 1, 1, True,
                ["wifi", "ducha", "agua_caliente", "toallas", "ropa_cama", "terraza", "cafetera", "nevera"],
                "Cabaña de madera con terraza sobre el agua y chimenea para las noches frescas.",
                [("cabana_pequena", "Exterior"), ("cama_jardin", "Interior"), ("gtp_islas", "Vista al embalse")]),
            hab("L-4", "Cabana", "Cabaña Familiar Peñol", 560000, 55, "1 cama king + 1 camarote", "Piedra del Peñol", 1,
                "Baño privado con ducha", 4, 2, 2, True,
                ["wifi", "ducha", "agua_caliente", "toallas", "ropa_cama", "terraza", "cocineta", "nevera", "jacuzzi"],
                "Cabaña de dos niveles con cocineta, jacuzzi exterior y vista a la Piedra del Peñol.",
                [("cabana_bosque", "Exterior"), ("cama_teal", "Habitación"), ("gtp_penol", "Vista a la Piedra")]),
        ],
    },
    {
        "nombre_hotel": "Hacienda Cafetera La Palma",
        "calificacion": 4, "tipo_alojamiento": "Finca cafetera",
        "direccion": "Vereda Palestina, Km 4 vía Salento - Valle de Cocora", "ciudad": "Salento", "departamento": "Quindío",
        "pais": "Colombia", "codigo_postal": "631020", "latitud": 4.6370, "longitud": -75.5160,
        "imagen": "cafe_finca",
        "galeria": ["cafe_cocora", "cafe_cerezas", "cafe_valle", "patio_arcos", "desayuno_mesa", "cafe_niebla"],
        "descripcion": (
            "Hacienda cafetera tradicional de bahareque con corredores, hamacas y jardines de orquídeas, "
            "a 10 minutos del Valle de Cocora. Incluye recorrido por el cafetal y cata de café de la "
            "propia finca. Paisaje Cultural Cafetero declarado Patrimonio de la Humanidad por la UNESCO."
        ),
        "politicas": "Recorrido de café diario a las 9:00 a. m. incluido para huéspedes.",
        "edad_minima": 18, "politica_ninos": POLITICA_NINOS_STD, "politica_mascotas": "Se admiten perros con cargo de $40.000 por noche.",
        "caracteristicas": [("Piscina al aire libre", "incluido"), ("Desayuno incluido", "incluido"), ("Senderos ecológicos", "incluido"),
                            ("Parqueadero gratuito", "incluido"), ("Wifi gratis", "incluido"), ("Pet Friendly", "de_pago"),
                            ("Jacuzzi", "incluido"), ("Restaurante buffet", "de_pago")],
        "habitaciones": [
            hab("1", "Doble", "Habitación Corredor Cafetero", 340000, 25, "1 cama queen", "Jardín", 1, "Baño privado con ducha", 2, 1, 1, True,
                ["wifi", "ducha", "agua_caliente", "toallas", "ropa_cama", "articulos_aseo", "cafetera"],
                "Habitación tradicional con piso de madera y puerta al corredor de hamacas.",
                [("cama_azul", "Habitación"), ("bano_ducha", "Baño"), ("cafe_valle", "Paisaje de la finca")]),
            hab("5", "Twin", "Habitación Twin Cafetal", 360000, 27, "2 camas semidobles", "Cafetal", 2, "Baño privado con ducha", 2, 1, 2, True,
                ["wifi", "ducha", "agua_caliente", "toallas", "ropa_cama", "articulos_aseo", "cafetera", "balcon"],
                "Balcón con vista al cafetal y a las montañas de la cordillera Central.",
                [("cama_lino_2", "Habitación"), ("bano_espejo", "Baño"), ("cafe_cerezas", "El cafetal")]),
            hab("8", "Suite", "Suite Palma de Cera", 590000, 45, "1 cama king", "Valle de Cocora", 2,
                "Baño con bañera", 2, 1, 1, True,
                ["wifi", "banera", "agua_caliente", "toallas", "ropa_cama", "articulos_aseo", "cafetera", "terraza", "zona_estar", "bata_pantuflas"],
                "Suite con terraza privada desde la que se ven las palmas de cera al amanecer.",
                [("cama_king_azul", "Habitación"), ("bano_banera", "Baño"), ("cafe_palmas", "Vista a las palmas de cera")]),
        ],
    },
    {
        "nombre_hotel": "Hotel Candelaria Colonial",
        "calificacion": 4, "tipo_alojamiento": "Hotel boutique",
        "direccion": "Calle 11 # 3-18, La Candelaria", "ciudad": "Bogotá", "departamento": "Cundinamarca",
        "pais": "Colombia", "codigo_postal": "111711", "latitud": 4.5981, "longitud": -74.0731,
        "imagen": "lobby_arco",
        "galeria": ["patio_moderno", "bog_grafiti", "bog_monserrate", "bog_sombrillas", "desayuno_jugo"],
        "descripcion": (
            "Casa republicana en La Candelaria, a pasos de la Plaza de Bolívar, el Museo del Oro y el Museo "
            "Botero. Chimenea en el salón, patio interior y desayuno con chocolate santafereño. Perfecto "
            "para conocer el centro histórico de Bogotá a pie."
        ),
        "politicas": "Se recomienda no salir con objetos de valor visibles en la noche; la recepción ofrece taxi seguro.",
        "edad_minima": 18, "politica_ninos": POLITICA_NINOS_STD, "politica_mascotas": "No se admiten mascotas.",
        "caracteristicas": [("Wifi gratis", "incluido"), ("Desayuno incluido", "incluido"), ("Recepción 24 horas", "incluido"),
                            ("Traslado al aeropuerto", "de_pago"), ("Lavandería", "de_pago"), ("Terraza con vista", "incluido")],
        "habitaciones": [
            hab("102", "Sencilla", "Sencilla Patio", 210000, 16, "1 cama semidoble", "Patio interior", 1, "Baño privado con ducha", 1, 0, 1, True,
                ["wifi", "ducha", "agua_caliente", "calefaccion", "toallas", "ropa_cama", "tv", "escritorio"],
                "Ideal para viajeros solos: acogedora, con calefacción y escritorio.",
                [("cama_gris", "Habitación"), ("bano_espejo", "Baño")]),
            hab("204", "Doble", "Doble Republicana", 320000, 24, "1 cama queen", "Calle colonial", 2, "Baño privado con ducha", 2, 1, 1, True,
                ["wifi", "ducha", "agua_caliente", "calefaccion", "toallas", "ropa_cama", "tv_cable", "cafetera", "secador"],
                "Techos altos, ventanas de madera y cobijas de lana para las noches bogotanas.",
                [("cama_cortinas", "Habitación"), ("bano_vidrio", "Baño"), ("bog_grafiti", "El barrio")]),
            hab("301", "Suite", "Suite Monserrate", 520000, 38, "1 cama king", "Cerro de Monserrate", 3, "Baño con bañera", 2, 1, 1, True,
                ["wifi", "banera", "agua_caliente", "calefaccion", "toallas", "ropa_cama", "tv_cable", "cafetera", "secador", "zona_estar", "bata_pantuflas"],
                "Suite con vista a Monserrate, sala de estar y bañera.",
                [("cama_lamparas", "Habitación"), ("bano_tina", "Baño"), ("bog_monserrate", "Vista a Monserrate")]),
        ],
    },
    {
        "nombre_hotel": "Gran Caribe Cancún Resort",
        "calificacion": 5, "tipo_alojamiento": "Resort todo incluido",
        "direccion": "Boulevard Kukulcán Km 11.5, Zona Hotelera", "ciudad": "Cancún", "departamento": "Quintana Roo",
        "pais": "México", "codigo_postal": "77500", "latitud": 21.1310, "longitud": -86.7480,
        "imagen": "resort_aereo_1",
        "galeria": ["cun_resort", "resort_aereo_2", "cun_palmeras", "piscina_aerea", "desayuno_buffet", "cun_sombrillas"],
        "descripcion": (
            "Resort todo incluido frente al mar Caribe mexicano, en plena Zona Hotelera. 5 restaurantes "
            "a la carta, 7 bares, 4 piscinas, club de niños, spa y espectáculos nocturnos. Playa de arena "
            "blanca con camastros y servicio de bebidas. Tours a Chichén Itzá, Isla Mujeres y Xcaret."
        ),
        "politicas": "Plan todo incluido 24 horas. Código de vestimenta formal en restaurantes a la carta para la cena.",
        "edad_minima": 18, "politica_ninos": "Niños de 0 a 4 años gratis. Niños de 5 a 12 años pagan tarifa de niño.",
        "politica_mascotas": "No se admiten mascotas.",
        "impuestos_cargos": "El gobierno de Quintana Roo cobra el impuesto de saneamiento ambiental y el Visitax directamente al huésped (no incluidos).",
        "caracteristicas": [("Todo incluido", "incluido"), ("Piscina al aire libre", "incluido"), ("Playa privada", "incluido"),
                            ("Club de niños", "incluido"), ("Gimnasio", "incluido"), ("Spa y masajes", "de_pago"),
                            ("Wifi gratis", "incluido"), ("Traslado al aeropuerto", "de_pago"), ("Servicio a la habitación", "incluido")],
        "habitaciones": [
            hab("3215", "Doble", "Deluxe Vista Laguna", 1350000, 42, "1 cama king", "Laguna Nichupté", 3, "Baño con ducha y bañera", 2, 2, 1, True,
                SERV_BASE + ["minibar", "cafetera", "balcon", "secador", "bata_pantuflas", "servicio_habitacion"],
                "Habitación amplia con balcón a la laguna. Tarifa por noche para 2 personas con todo incluido.",
                [("cama_lino", "Habitación"), ("bano_marmol", "Baño"), ("balcon_cielo", "Balcón")]),
            hab("5420", "Doble", "Deluxe Frente al Mar", 1690000, 42, "1 cama king", "Mar Caribe", 5, "Baño con ducha y bañera", 2, 2, 1, True,
                SERV_BASE + ["minibar", "cafetera", "balcon", "secador", "bata_pantuflas", "servicio_habitacion"],
                "Balcón frente al mar turquesa de Cancún. Tarifa por noche para 2 personas con todo incluido.",
                [("dormitorio_mar", "Habitación"), ("bano_banera", "Baño"), ("cun_olas", "Vista al mar")]),
            hab("8801", "Suite", "Master Suite Jacuzzi", 2450000, 75, "1 cama king", "Mar Caribe", 8, "Baño de mármol con jacuzzi", 2, 2, 1, True,
                SERV_BASE + ["minibar", "cafetera", "terraza", "jacuzzi", "zona_estar", "bata_pantuflas", "servicio_habitacion"],
                "Suite con terraza y jacuzzi privado frente al mar, sala y servicio de mayordomo.",
                [("cama_king_azul", "Habitación"), ("tina_mar", "Jacuzzi con vista"), ("hab_sofa", "Sala")]),
        ],
    },
    {
        "nombre_hotel": "Bávaro Palms All Inclusive",
        "calificacion": 5, "tipo_alojamiento": "Resort todo incluido",
        "direccion": "Playa Bávaro, Av. Alemania s/n", "ciudad": "Punta Cana", "departamento": "La Altagracia",
        "pais": "República Dominicana", "codigo_postal": "23000", "latitud": 18.6890, "longitud": -68.4220,
        "imagen": "puj_sombrillas",
        "galeria": ["puj_playa", "resort_aereo_3", "puj_palmeras", "piscina_patio_aereo", "puj_cabanas", "desayuno_mar"],
        "descripcion": (
            "Resort todo incluido sobre Playa Bávaro, una de las playas más famosas del Caribe. Piscina "
            "tipo laguna de 300 metros, 6 restaurantes, deportes acuáticos no motorizados, teatro y "
            "discoteca. Campo de golf a 5 minutos."
        ),
        "politicas": "Plan todo incluido 24 horas. Bebidas internacionales premium incluidas.",
        "edad_minima": 18, "politica_ninos": "Niños de 0 a 2 años gratis. Niños de 3 a 12 años pagan tarifa de niño.",
        "politica_mascotas": "No se admiten mascotas.",
        "caracteristicas": [("Todo incluido", "incluido"), ("Piscina al aire libre", "incluido"), ("Playa privada", "incluido"),
                            ("Club de niños", "incluido"), ("Gimnasio", "incluido"), ("Spa y masajes", "de_pago"),
                            ("Wifi gratis", "incluido"), ("Traslado al aeropuerto", "incluido")],
        "habitaciones": [
            hab("1120", "Doble", "Junior Suite Tropical", 1280000, 45, "1 cama king", "Jardín tropical", 1, "Baño con ducha y bañera", 2, 2, 1, True,
                SERV_BASE + ["minibar", "cafetera", "terraza", "secador", "bata_pantuflas"],
                "Junior suite rodeada de jardines tropicales con terraza. Tarifa por noche para 2 personas.",
                [("cama_jardin", "Habitación"), ("bano_banera", "Baño"), ("puj_palmeras", "Jardines")]),
            hab("2205", "Suite", "Junior Suite Swim-Up", 1590000, 48, "1 cama king", "Piscina", 1, "Baño con ducha y bañera", 2, 2, 1, True,
                SERV_BASE + ["minibar", "cafetera", "terraza", "secador", "bata_pantuflas", "servicio_habitacion"],
                "Terraza con acceso directo a la piscina. Tarifa por noche para 2 personas.",
                [("cama_teal", "Habitación"), ("bano_marmol", "Baño"), ("piscina_aerea", "Acceso a la piscina")]),
            hab("3301", "Familiar", "Suite Familiar Vista al Mar", 2100000, 70, "1 cama king + 2 dobles", "Mar Caribe", 3,
                "Dos baños completos", 4, 3, 3, True,
                SERV_BASE + ["minibar", "cafetera", "balcon", "secador", "zona_estar", "sofa"],
                "Dos habitaciones conectadas con dos baños y balcón con vista al mar. Para 4 adultos.",
                [("dormitorio_mar", "Habitación"), ("bano_tina", "Baño"), ("puj_aerea", "Vista al mar")]),
        ],
    },
    {
        "nombre_hotel": "Casona San Blas Cusco",
        "calificacion": 4, "tipo_alojamiento": "Hotel boutique",
        "direccion": "Cuesta de San Blas 520", "ciudad": "Cusco", "departamento": "Cusco",
        "pais": "Perú", "codigo_postal": "08002", "latitud": -13.5160, "longitud": -71.9760,
        "imagen": "cuz_tejados",
        "galeria": ["cuz_plaza", "patio_arcos", "cuz_catedral", "lobby_arco", "cuz_machu"],
        "descripcion": (
            "Casona colonial en el barrio artesanal de San Blas, a 5 minutos caminando de la Plaza de Armas. "
            "Mate de coca de cortesía todo el día, oxígeno disponible para el soroche y calefacción en todas "
            "las habitaciones. Punto de partida ideal para el Valle Sagrado y Machu Picchu."
        ),
        "politicas": "Cusco está a 3.400 m s. n. m.: se recomienda descansar el primer día y evitar comidas pesadas.",
        "edad_minima": 18, "politica_ninos": POLITICA_NINOS_STD, "politica_mascotas": "No se admiten mascotas.",
        "impuestos_cargos": "Los extranjeros no domiciliados en Perú están exentos del IGV (18%) presentando pasaporte y tarjeta andina.",
        "caracteristicas": [("Wifi gratis", "incluido"), ("Desayuno incluido", "incluido"), ("Recepción 24 horas", "incluido"),
                            ("Traslado al aeropuerto", "incluido"), ("Terraza con vista", "incluido"), ("Lavandería", "de_pago")],
        "habitaciones": [
            hab("12", "Doble", "Doble Colonial", 380000, 24, "1 cama queen", "Patio colonial", 1, "Baño privado con ducha", 2, 1, 1, True,
                ["wifi", "ducha", "agua_caliente", "calefaccion", "toallas", "ropa_cama", "tv", "hervidor", "caja_fuerte"],
                "Habitación con muros de adobe, vigas de madera y calefacción.",
                [("cama_azul", "Habitación"), ("bano_ducha", "Baño"), ("patio_arcos", "Patio colonial")]),
            hab("21", "Twin", "Twin Vista Tejados", 420000, 26, "2 camas semidobles", "Tejados de Cusco", 2, "Baño privado con ducha", 2, 1, 2, True,
                ["wifi", "ducha", "agua_caliente", "calefaccion", "toallas", "ropa_cama", "tv", "hervidor", "caja_fuerte"],
                "Ventana con vista a los tejados rojos del centro histórico.",
                [("cama_lino_3", "Habitación"), ("bano_espejo", "Baño"), ("cuz_tejados", "Vista de la ciudad")]),
            hab("31", "Suite", "Suite Inca", 640000, 40, "1 cama king", "Catedral", 3, "Baño con bañera", 2, 1, 1, True,
                ["wifi", "banera", "agua_caliente", "calefaccion", "toallas", "ropa_cama", "tv_cable", "hervidor", "caja_fuerte", "zona_estar", "bata_pantuflas"],
                "Suite en el último piso con sala, chimenea y vista a la Catedral.",
                [("cama_lamparas", "Habitación"), ("bano_banera", "Baño"), ("cuz_catedral", "Vista a la Catedral")]),
        ],
    },
]

# ---------------------------------------------------------------------------
# Ofertas aéreas
# ---------------------------------------------------------------------------
AEROPUERTOS = {
    "BOG": ("Colombia", "Bogotá", "Aeropuerto Internacional El Dorado", "America/Bogota"),
    "MDE": ("Colombia", "Medellín", "Aeropuerto Internacional José María Córdova (Rionegro)", "America/Bogota"),
    "CLO": ("Colombia", "Cali", "Aeropuerto Internacional Alfonso Bonilla Aragón", "America/Bogota"),
    "BAQ": ("Colombia", "Barranquilla", "Aeropuerto Internacional Ernesto Cortissoz", "America/Bogota"),
    "CTG": ("Colombia", "Cartagena", "Aeropuerto Internacional Rafael Núñez", "America/Bogota"),
    "ADZ": ("Colombia", "San Andrés", "Aeropuerto Internacional Gustavo Rojas Pinilla", "America/Bogota"),
    "SMR": ("Colombia", "Santa Marta", "Aeropuerto Internacional Simón Bolívar", "America/Bogota"),
    "AXM": ("Colombia", "Armenia", "Aeropuerto Internacional El Edén", "America/Bogota"),
    "CUN": ("México", "Cancún", "Aeropuerto Internacional de Cancún", "America/Cancun"),
    "PUJ": ("República Dominicana", "Punta Cana", "Aeropuerto Internacional de Punta Cana", "America/Santo_Domingo"),
    "CUZ": ("Perú", "Cusco", "Aeropuerto Internacional Alejandro Velasco Astete", "America/Lima"),
}

EQUIPAJE = {
    "Avianca": ("1 artículo personal (bolso o morral) — maleta de mano de 10 kg según tarifa",
                "1 maleta de 23 kg incluida en tarifa Classic"),
    "LATAM": ("1 artículo personal + maleta de mano de 10 kg", "1 maleta de 23 kg incluida en tarifa Plus"),
    "Wingo": ("1 artículo personal de 40x35x25 cm", "No incluido: se compra aparte (desde $95.000 por trayecto)"),
    "Copa Airlines": ("1 artículo personal + maleta de mano de 10 kg", "1 maleta de 23 kg incluida"),
}
CAMBIOS = {
    "Avianca": "Cambios permitidos con cargo según la tarifa más diferencia tarifaria, hasta 2 horas antes del vuelo.",
    "LATAM": "Cambios permitidos pagando la diferencia tarifaria; sin penalidad en tarifa Plus.",
    "Wingo": "Cambios con cargo fijo por trayecto más diferencia tarifaria, hasta 4 horas antes del vuelo.",
    "Copa Airlines": "Cambios con penalidad según tarifa más diferencia tarifaria.",
}
CANCELACION_VUELO = (
    "Tarifa no reembolsable: si cancela se puede conservar el valor de los impuestos reembolsables. "
    "Derecho de retracto según el Estatuto del Consumidor: dentro de las 48 horas siguientes a la "
    "compra y con mínimo 8 días antes del vuelo (vuelos nacionales)."
)


def vuelo(cod, titulo, aerolinea, origen, destino, salida, h_sal, h_lle, regreso, h_reg, h_lle_reg,
          duracion, precio, nino, infante, cargos, cupos, foto, descripcion, escalas=0, conexion=None,
          servicio="regular", llegada_dia_siguiente=False):  # fmt: skip
    po, co, ao, zo = AEROPUERTOS[origen]
    pd, cd, ad, zd = AEROPUERTOS[destino]
    internacional = po != pd
    mano, bodega = EQUIPAJE[aerolinea]
    llegada = salida + dt.timedelta(days=1) if llegada_dia_siguiente else salida
    return {
        "codigo_referencia": cod, "titulo": titulo, "descripcion": descripcion, "estado": "publicada",
        "aerolinea": aerolinea, "numero_vuelo": None, "imagen_url": U(F[foto]),
        "tipo_servicio": servicio, "venta_independiente": True,
        "documentos_requeridos": (
            "Pasaporte vigente (mínimo 6 meses). Revise requisitos migratorios del país de destino."
            if internacional else "Cédula de ciudadanía, tarjeta de identidad o pasaporte vigente."
        ),
        "origen_pais": po, "origen_ciudad": co, "origen_aeropuerto": ao, "origen_iata": origen, "origen_zona_horaria": zo,
        "destino_pais": pd, "destino_ciudad": cd, "destino_aeropuerto": ad, "destino_iata": destino, "destino_zona_horaria": zd,
        "tipo_trayecto": "ida_regreso" if regreso else "solo_ida",
        "fecha_salida": salida, "hora_salida": h_sal, "fecha_llegada": llegada, "hora_llegada": h_lle,
        "fecha_regreso": regreso, "hora_regreso": h_reg if regreso else None,
        "fecha_llegada_regreso": regreso, "hora_llegada_regreso": h_lle_reg if regreso else None,
        "duracion_estimada": duracion, "clase": "economica", "escalas": escalas,
        "aeropuertos_conexion": conexion,
        "equipaje_mano": mano, "equipaje_bodega": bodega,
        "condiciones_cambio": CAMBIOS[aerolinea], "condiciones_cancelacion": CANCELACION_VUELO,
        "restricciones": "Tarifa sujeta a disponibilidad de sillas en la clase reservada. No endosable.",
        "informacion_adicional": (
            "Presentarse en el aeropuerto 3 horas antes (vuelos internacionales)." if internacional
            else "Presentarse en el aeropuerto 2 horas antes del vuelo. Check-in en línea 24 horas antes."
        ),
        "precio_adulto": precio, "precio_nino": nino, "precio_infante": infante, "impuestos_incluidos": True,
        "cargos_adicionales": cargos, "descripcion_cargos": "Tasa aeroportuaria y cargo administrativo de la agencia" if cargos else None,
        "cupos": cupos, "vigencia_hasta": salida - dt.timedelta(days=3),
        "condiciones_comerciales": "Precio por pasajero en pesos colombianos, ida y regreso, con impuestos incluidos. Emisión sujeta a confirmación del asesor.",
    }  # fmt: skip


VUELOS = [
    vuelo("AT-V001", "Bogotá – Cartagena (ida y regreso)", "Avianca", "BOG", "CTG", D(2026, 12, 12), T(6, 15), T(7, 45),
          D(2026, 12, 16), T(19, 10), T(20, 40), "1 h 30 min", 640000, 600000, 120000, 35000, 20, "ctg_calle_iglesia",
          "Vuelo directo a la Heroica para un fin de semana largo de diciembre. Salida temprano para aprovechar el primer día."),
    vuelo("AT-V002", "Bogotá – Cartagena temporada fin de año", "LATAM", "BOG", "CTG", D(2026, 12, 27), T(10, 5), T(11, 35),
          D(2027, 1, 2), T(16, 20), T(17, 50), "1 h 30 min", 890000, 850000, 150000, 35000, 12, "ctg_casas_colores",
          "Recibe el Año Nuevo en Cartagena. Sillas limitadas en temporada alta."),
    vuelo("AT-V003", "Medellín – Cartagena (ida y regreso)", "Wingo", "MDE", "CTG", D(2027, 1, 22), T(8, 40), T(9, 55),
          D(2027, 1, 26), T(18, 30), T(19, 45), "1 h 15 min", 390000, 390000, 90000, 30000, 25, "ctg_callejon",
          "Tarifa económica desde Rionegro. Equipaje de bodega no incluido.", servicio="bajo_costo"),
    vuelo("AT-V004", "Cali – Cartagena (ida y regreso)", "Avianca", "CLO", "CTG", D(2027, 2, 5), T(7, 0), T(8, 40),
          D(2027, 2, 9), T(17, 45), T(19, 25), "1 h 40 min", 610000, 580000, 120000, 35000, 15, "ctg_catedral",
          "Vuelo directo desde Cali, ideal para el puente festivo."),
    vuelo("AT-V005", "Bogotá – San Andrés (ida y regreso)", "Avianca", "BOG", "ADZ", D(2026, 12, 14), T(7, 30), T(9, 35),
          D(2026, 12, 18), T(13, 15), T(15, 20), "2 h 05 min", 780000, 740000, 140000, 35000, 18, "adz_isla",
          "Vuelo directo al mar de siete colores. No incluye la tarjeta de turismo de la isla."),
    vuelo("AT-V006", "Medellín – San Andrés (ida y regreso)", "LATAM", "MDE", "ADZ", D(2027, 1, 15), T(9, 50), T(11, 40),
          D(2027, 1, 20), T(12, 30), T(14, 20), "1 h 50 min", 720000, 690000, 130000, 35000, 16, "adz_agua_clara",
          "Desde Rionegro directo a la isla. No incluye la tarjeta de turismo."),
    vuelo("AT-V007", "Cali – San Andrés (ida y regreso)", "Wingo", "CLO", "ADZ", D(2027, 3, 19), T(6, 50), T(9, 0),
          D(2027, 3, 23), T(10, 0), T(12, 10), "2 h 10 min", 560000, 560000, 100000, 30000, 22, "adz_palmeras",
          "Tarifa económica para el puente de marzo. Equipaje de bodega no incluido.", servicio="bajo_costo"),
    vuelo("AT-V008", "Bogotá – Santa Marta (ida y regreso)", "Avianca", "BOG", "SMR", D(2026, 12, 19), T(8, 20), T(9, 55),
          D(2026, 12, 23), T(15, 40), T(17, 15), "1 h 35 min", 590000, 560000, 110000, 35000, 20, "tay_bote_playa",
          "Directo a la puerta de entrada del Tayrona, Minca y la Sierra Nevada."),
    vuelo("AT-V009", "Medellín – Santa Marta (ida y regreso)", "LATAM", "MDE", "SMR", D(2027, 2, 12), T(11, 15), T(12, 35),
          D(2027, 2, 16), T(13, 30), T(14, 50), "1 h 20 min", 520000, 500000, 100000, 35000, 14, "tay_atardecer",
          "Escapada de fin de semana largo al Caribe samario."),
    vuelo("AT-V010", "Bogotá – Medellín (ida y regreso)", "LATAM", "BOG", "MDE", D(2026, 12, 4), T(6, 0), T(6, 55),
          D(2026, 12, 7), T(20, 10), T(21, 5), "55 min", 340000, 330000, 70000, 30000, 30, "mde_skyline",
          "Puente festivo de diciembre en la ciudad de la eterna primavera."),
    vuelo("AT-V011", "Cali – Medellín (ida y regreso)", "Avianca", "CLO", "MDE", D(2027, 1, 8), T(9, 25), T(10, 25),
          D(2027, 1, 11), T(18, 0), T(19, 0), "1 h", 380000, 360000, 70000, 30000, 20, "mde_atardecer",
          "Vuelo corto y directo entre Cali y Medellín."),
    vuelo("AT-V012", "Bogotá – Armenia, Eje Cafetero (ida y regreso)", "Avianca", "BOG", "AXM", D(2027, 1, 9), T(7, 10), T(8, 0),
          D(2027, 1, 12), T(17, 30), T(18, 20), "50 min", 360000, 340000, 70000, 30000, 18, "cafe_cocora",
          "La forma más rápida de llegar a Salento y el Valle de Cocora (a 45 minutos del aeropuerto)."),
    vuelo("AT-V013", "Barranquilla – Bogotá (ida y regreso)", "Wingo", "BAQ", "BOG", D(2027, 2, 19), T(5, 45), T(7, 15),
          D(2027, 2, 22), T(21, 0), T(22, 30), "1 h 30 min", 310000, 310000, 70000, 30000, 25, "bog_monserrate",
          "Visita la capital: museos, gastronomía y Monserrate.", servicio="bajo_costo"),
    vuelo("AT-V014", "Bogotá – Cancún (ida y regreso)", "Avianca", "BOG", "CUN", D(2027, 1, 10), T(9, 5), T(12, 50),
          D(2027, 1, 16), T(14, 20), T(19, 55), "3 h 45 min", 1850000, 1780000, 350000, 0, 15, "cun_playa_aerea",
          "Vuelo directo a Cancún. Consulte con su asesor los requisitos migratorios vigentes para ingresar a México."),
    vuelo("AT-V015", "Medellín – Cancún (ida y regreso)", "Avianca", "MDE", "CUN", D(2027, 3, 20), T(10, 30), T(14, 15),
          D(2027, 3, 26), T(15, 30), T(20, 50), "3 h 45 min", 1990000, 1920000, 380000, 0, 12, "cun_palmeras",
          "Directo desde Rionegro para Semana Santa en el Caribe mexicano."),
    vuelo("AT-V016", "Bogotá – Punta Cana vía Panamá", "Copa Airlines", "BOG", "PUJ", D(2027, 1, 17), T(6, 30), T(13, 40),
          D(2027, 1, 23), T(15, 10), T(19, 25), "5 h 50 min con conexión", 2150000, 2050000, 420000, 0, 14, "puj_playa",
          "Con conexión corta en el Hub de las Américas (Tocumen). Consulte con su asesor los requisitos migratorios "
          "vigentes para República Dominicana.",
          escalas=1, conexion="Aeropuerto Internacional de Tocumen (PTY), Ciudad de Panamá"),
    vuelo("AT-V017", "Medellín – Punta Cana vía Panamá", "Copa Airlines", "MDE", "PUJ", D(2027, 2, 21), T(7, 15), T(14, 5),
          D(2027, 2, 27), T(15, 10), T(18, 55), "5 h 30 min con conexión", 2090000, 1990000, 410000, 0, 12, "puj_isla",
          "Conexión en Ciudad de Panamá. Equipaje de 23 kg incluido.",
          escalas=1, conexion="Aeropuerto Internacional de Tocumen (PTY), Ciudad de Panamá"),
    vuelo("AT-V018", "Bogotá – Cusco vía Lima", "LATAM", "BOG", "CUZ", D(2027, 2, 6), T(5, 40), T(11, 55),
          D(2027, 2, 12), T(12, 40), T(19, 10), "6 h 15 min con conexión", 2290000, 2190000, 420000, 0, 14, "cuz_machu",
          "Conexión en Lima hacia la capital del Imperio Inca.",
          escalas=1, conexion="Aeropuerto Internacional Jorge Chávez (LIM), Lima"),
    vuelo("AT-V019", "Bogotá – Cartagena solo ida", "Wingo", "BOG", "CTG", D(2026, 12, 20), T(14, 30), T(16, 0),
          None, None, None, "1 h 30 min", 249000, 249000, 60000, 25000, 30, "ctg_edificio_mar",
          "Tarifa solo ida para quienes regresan por tierra o combinan destinos.", servicio="bajo_costo"),
    vuelo("AT-V020", "Bogotá – San Andrés Semana Santa", "LATAM", "BOG", "ADZ", D(2027, 3, 24), T(6, 40), T(8, 45),
          D(2027, 3, 28), T(16, 0), T(18, 5), "2 h 05 min", 960000, 920000, 160000, 35000, 10, "adz_cayo",
          "Semana Santa en la isla. Sillas muy limitadas: reserve con anticipación."),
]  # fmt: skip

# ---------------------------------------------------------------------------
# Paquetes turísticos
# ---------------------------------------------------------------------------
NO_INCLUYE_STD = [
    ("gastos_personales", "Gastos personales, propinas y compras"),
    ("alimentacion", "Comidas y bebidas no especificadas en el plan"),
    ("seguro", "Seguro de viaje (recomendado, se puede cotizar con el asesor)"),
]
CONDICIONES_STD = (
    "Precios por persona en acomodación doble, sujetos a disponibilidad al momento de reservar. "
    "Para confirmar se requiere un abono del 30%; el saldo se paga 15 días antes del viaje. "
    "Cambios de fecha sujetos a disponibilidad y diferencia tarifaria. Las tarifas aéreas no son "
    "reembolsables una vez emitidas."
)


def dia(n, titulo, descripcion, actividades, lugar, horario=None):
    return {"dia": n, "titulo": titulo, "descripcion": descripcion, "actividades": "\n".join(actividades),
            "lugar": lugar, "horario": horario}  # fmt: skip


PAQUETES = [
    {
        "nombre_paquete": "Cartagena Colonial y Playa",
        "descripcion": (
            "Cinco días en la ciudad más romántica de Colombia: atardeceres en la muralla, noches en "
            "Getsemaní, un día completo en las Islas del Rosario y alojamiento en una casona colonial "
            "con piscina dentro de la ciudad amurallada."
        ),
        "duracion_dias": 5, "noches": 4, "precio_base": 2890000, "precio_nino": 2390000, "precio_infante": 350000,
        "ciudad_salida": "Bogotá", "destino_ciudad": "Cartagena", "destino_pais": "Colombia",
        "destinos_secundarios": "Islas del Rosario, Getsemaní", "categoria": "Playa y cultura",
        "modalidad_alojamiento": "incluido", "modalidad_vuelo": "incluido", "min_viajeros": 1, "max_viajeros": 8,
        "imagen": "ctg_calle_iglesia", "galeria": ["patio_piscina", "ctg_casas_colores", "adz_lancha", "ctg_catedral", "ctg_callejon"],
        "hoteles": [("Casa Murallas Hotel Boutique", 4)], "vuelos": ["AT-V001"],
        "itinerario": [
            dia(1, "Llegada a Cartagena", "Recepción en el aeropuerto y traslado al hotel en el centro histórico.",
                ["Traslado aeropuerto - hotel", "Check-in desde las 3:00 p. m.", "Atardecer en el Café del Mar sobre la muralla"], "Cartagena"),
            dia(2, "City tour histórico", "Recorrido guiado por la ciudad amurallada y el Castillo de San Felipe.",
                ["Castillo de San Felipe de Barajas", "Convento de La Popa", "Caminata por la ciudad amurallada", "Tarde libre"],
                "Centro Histórico", "8:00 a. m. - 1:00 p. m."),
            dia(3, "Islas del Rosario", "Día completo de playa en lancha rápida con almuerzo típico.",
                ["Lancha desde el muelle La Bodeguita", "Snorkel en arrecife coralino", "Almuerzo de pescado frito, arroz con coco y patacón",
                 "Playa en isla privada"], "Islas del Rosario", "7:30 a. m. - 4:00 p. m."),
            dia(4, "Getsemaní y día libre", "Mañana libre para la piscina del hotel; en la tarde, recorrido por el barrio de moda.",
                ["Tour de grafitis por Getsemaní", "Plaza de la Trinidad", "Noche de salsa (opcional)"], "Getsemaní"),
            dia(5, "Regreso", "Desayuno y traslado al aeropuerto para el vuelo de regreso.",
                ["Check-out a las 12:00 m.", "Traslado hotel - aeropuerto"], "Cartagena"),
        ],
        "incluye": [("transporte_aereo", "Tiquete aéreo Bogotá - Cartagena - Bogotá con Avianca, equipaje de 23 kg"),
                    ("alojamiento", "4 noches en Casa Murallas Hotel Boutique (habitación Colonial Patio)"),
                    ("desayuno", "Desayuno diario"),
                    ("traslados", "Traslados aeropuerto - hotel - aeropuerto"),
                    ("actividades", "City tour con Castillo de San Felipe y tour a Islas del Rosario con almuerzo"),
                    ("guia", "Guía local certificado en los tours"),
                    ("seguro", "Tarjeta de asistencia médica nacional")],
        "no_incluye": NO_INCLUYE_STD + [("impuestos", "Impuesto de muelle de Islas del Rosario (aprox. $28.000, pago en efectivo)")],
        "salidas": [(D(2026, 12, 12), D(2026, 12, 16), 20), (D(2027, 1, 22), D(2027, 1, 26), 16), (D(2027, 2, 5), D(2027, 2, 9), 16)],
    },
    {
        "nombre_paquete": "San Andrés Todo Incluido",
        "descripcion": (
            "El mar de siete colores con todo incluido: comidas, bebidas, vuelta a la isla en chiva, "
            "tour a Johnny Cay y el Acuario y snorkel. Solo te preocupas por el bloqueador."
        ),
        "duracion_dias": 5, "noches": 4, "precio_base": 3290000, "precio_nino": 2490000, "precio_infante": 390000,
        "ciudad_salida": "Bogotá", "destino_ciudad": "San Andrés", "destino_pais": "Colombia",
        "destinos_secundarios": "Johnny Cay, Acuario, Haynes Cay", "categoria": "Playa",
        "modalidad_alojamiento": "incluido", "modalidad_vuelo": "incluido", "min_viajeros": 1, "max_viajeros": 10,
        "imagen": "adz_isla", "galeria": ["adz_playa", "adz_cayo", "piscina_blanca", "adz_lancha", "adz_agua_clara"],
        "hoteles": [("Hotel Mar de Siete Colores", 4)], "vuelos": ["AT-V005", "AT-V020"],
        "itinerario": [
            dia(1, "Bienvenidos a la isla", "Llegada, traslado y tarde de playa en Spratt Bight.",
                ["Traslado aeropuerto - hotel", "Almuerzo en el hotel", "Atardecer en la playa"], "San Andrés"),
            dia(2, "Vuelta a la isla", "Recorrido en chiva típica por los principales atractivos.",
                ["Hoyo Soplador", "Cueva de Morgan", "Piscinita / West View para snorkel", "La Loma y la Iglesia Bautista"],
                "Vuelta a la isla", "9:00 a. m. - 3:00 p. m."),
            dia(3, "Johnny Cay y Acuario", "Lancha a los cayos más famosos del archipiélago.",
                ["Johnny Cay", "Acuario y Haynes Cay", "Caminata entre mantarrayas (temporada)"], "Cayos", "8:30 a. m. - 3:30 p. m."),
            dia(4, "Día libre", "Día para disfrutar la piscina, compras libres de impuestos o actividades opcionales.",
                ["Opcional: buceo, parasail o semisubmarino"], "San Andrés"),
            dia(5, "Regreso", "Traslado al aeropuerto.", ["Check-out", "Traslado hotel - aeropuerto"], "San Andrés"),
        ],
        "incluye": [("transporte_aereo", "Tiquete aéreo Bogotá - San Andrés - Bogotá"),
                    ("alojamiento", "4 noches en Hotel Mar de Siete Colores, plan todo incluido"),
                    ("alimentacion", "Desayunos, almuerzos y cenas buffet, snacks y bebidas nacionales ilimitadas"),
                    ("traslados", "Traslados aeropuerto - hotel - aeropuerto"),
                    ("actividades", "Vuelta a la isla en chiva y tour Johnny Cay + Acuario"),
                    ("seguro", "Tarjeta de asistencia médica nacional")],
        "no_incluye": NO_INCLUYE_STD + [("impuestos", "Tarjeta de turismo de San Andrés (se paga al llegar o al comprar el tiquete)"),
                                        ("entradas", "Entrada a Johnny Cay (aprox. $10.000)")],
        "salidas": [(D(2026, 12, 14), D(2026, 12, 18), 18), (D(2027, 1, 15), D(2027, 1, 19), 20), (D(2027, 3, 24), D(2027, 3, 28), 10)],
    },
    {
        "nombre_paquete": "Tayrona Selva y Mar",
        "descripcion": (
            "Naturaleza pura en el Caribe: caminata a Cabo San Juan, noches en un ecolodge entre la selva "
            "y el mar, y una tarde en Minca entre cascadas y café. Vuelo opcional."
        ),
        "duracion_dias": 4, "noches": 3, "precio_base": 1690000, "precio_nino": 1290000, "precio_infante": 0,
        "ciudad_salida": "Santa Marta", "destino_ciudad": "Santa Marta", "destino_pais": "Colombia",
        "destinos_secundarios": "Parque Tayrona, Minca", "categoria": "Naturaleza y aventura",
        "modalidad_alojamiento": "incluido", "modalidad_vuelo": "opcional", "min_viajeros": 2, "max_viajeros": 12,
        "imagen": "tay_bote_playa", "galeria": ["cabana_techo_paja", "tay_sendero", "tay_rocas", "tay_atardecer", "cabana_balcon"],
        "hoteles": [("Selva Tayrona Ecolodge", 3)], "vuelos": ["AT-V008", "AT-V009"],
        "itinerario": [
            dia(1, "Llegada al ecolodge", "Traslado desde Santa Marta y bienvenida con jugo de frutas.",
                ["Traslado aeropuerto - ecolodge", "Caminata corta de reconocimiento", "Cena con productos de la Sierra"], "Los Naranjos"),
            dia(2, "Cabo San Juan", "Caminata guiada por el Parque Tayrona hasta sus playas más famosas.",
                ["Ingreso por El Zaino", "Arrecifes y La Piscina", "Baño en Cabo San Juan", "Regreso a caballo (opcional)"],
                "Parque Tayrona", "6:30 a. m. - 4:00 p. m."),
            dia(3, "Minca: cascadas y café", "Excursión a la Sierra Nevada.",
                ["Cascada Pozo Azul", "Finca cafetera con degustación", "Avistamiento de aves"], "Minca", "8:00 a. m. - 3:00 p. m."),
            dia(4, "Regreso", "Mañana libre y traslado al aeropuerto.", ["Check-out", "Traslado al aeropuerto"], "Santa Marta"),
        ],
        "incluye": [("alojamiento", "3 noches en Selva Tayrona Ecolodge (Cabaña Selva)"),
                    ("alimentacion", "Desayunos y cenas"),
                    ("traslados", "Traslados aeropuerto de Santa Marta - ecolodge - aeropuerto"),
                    ("actividades", "Caminata a Cabo San Juan y excursión a Minca"),
                    ("guia", "Guía bilingüe certificado"),
                    ("seguro", "Tarjeta de asistencia médica nacional")],
        "no_incluye": NO_INCLUYE_STD + [("transporte_aereo", "Tiquetes aéreos (opcionales, se agregan al reservar)"),
                                        ("entradas", "Entrada al Parque Tayrona (tarifa oficial de Parques Nacionales)")],
        "salidas": [(D(2026, 12, 19), D(2026, 12, 22), 12), (D(2027, 2, 12), D(2027, 2, 15), 12)],
    },
    {
        "nombre_paquete": "Medellín y Guatapé",
        "descripcion": (
            "La ciudad de la eterna primavera y el pueblo más colorido de Antioquia: Comuna 13, Metrocable, "
            "Parque Arví y la subida a los 740 escalones de la Piedra del Peñol."
        ),
        "duracion_dias": 4, "noches": 3, "precio_base": 1890000, "precio_nino": 1490000, "precio_infante": 200000,
        "ciudad_salida": "Bogotá", "destino_ciudad": "Medellín", "destino_pais": "Colombia",
        "destinos_secundarios": "Guatapé, El Peñol", "categoria": "Ciudad y cultura",
        "modalidad_alojamiento": "incluido", "modalidad_vuelo": "incluido", "min_viajeros": 1, "max_viajeros": 10,
        "imagen": "gtp_aerea", "galeria": ["mde_skyline", "gtp_escaleras", "mde_mural", "gtp_calle", "piscina_terraza"],
        "hoteles": [("Poblado Skyline Hotel", 2), ("Refugio El Peñol", 1)], "vuelos": ["AT-V010"],
        "itinerario": [
            dia(1, "Llegada a Medellín", "Traslado a El Poblado y noche en Provenza.",
                ["Traslado aeropuerto - hotel", "Bar en la azotea del hotel"], "El Poblado"),
            dia(2, "City tour y Comuna 13", "La transformación de Medellín en un recorrido.",
                ["Plaza Botero y Museo de Antioquia", "Metro y Metrocable", "Tour de grafitis en la Comuna 13", "Parque Arví"],
                "Medellín", "8:00 a. m. - 5:00 p. m."),
            dia(3, "Guatapé y la Piedra del Peñol", "Excursión al oriente antioqueño con paseo en lancha por el embalse.",
                ["Subida a la Piedra del Peñol", "Paseo en lancha por el embalse", "Calles de zócalos de Guatapé", "Noche en cabaña junto al lago"],
                "Guatapé", "7:00 a. m."),
            dia(4, "Regreso", "Kayak al amanecer y traslado al aeropuerto de Rionegro.",
                ["Kayak en el embalse", "Traslado al aeropuerto"], "Guatapé"),
        ],
        "incluye": [("transporte_aereo", "Tiquete aéreo Bogotá - Medellín - Bogotá con LATAM"),
                    ("alojamiento", "2 noches en Poblado Skyline Hotel y 1 noche en Refugio El Peñol"),
                    ("desayuno", "Desayuno diario"),
                    ("transporte_terrestre", "Transporte privado a Guatapé"),
                    ("actividades", "City tour, Comuna 13, Metrocable y paseo en lancha en Guatapé"),
                    ("guia", "Guía local"),
                    ("seguro", "Tarjeta de asistencia médica nacional")],
        "no_incluye": NO_INCLUYE_STD + [("entradas", "Entrada a la Piedra del Peñol (aprox. $25.000)")],
        "salidas": [(D(2026, 12, 4), D(2026, 12, 7), 14), (D(2027, 1, 8), D(2027, 1, 11), 14), (D(2027, 3, 5), D(2027, 3, 8), 14)],
    },
    {
        "nombre_paquete": "Eje Cafetero: Cocora y Café",
        "descripcion": (
            "Vive el Paisaje Cultural Cafetero: duerme en una hacienda tradicional, camina entre las palmas "
            "de cera más altas del mundo en el Valle de Cocora y aprende el proceso del café del grano a la taza."
        ),
        "duracion_dias": 4, "noches": 3, "precio_base": 1590000, "precio_nino": 1190000, "precio_infante": 150000,
        "ciudad_salida": "Bogotá", "destino_ciudad": "Salento", "destino_pais": "Colombia",
        "destinos_secundarios": "Valle de Cocora, Filandia, Armenia", "categoria": "Naturaleza y cultura",
        "modalidad_alojamiento": "incluido", "modalidad_vuelo": "incluido", "min_viajeros": 1, "max_viajeros": 10,
        "imagen": "cafe_cocora", "galeria": ["cafe_finca", "cafe_palmas", "cafe_granos", "cafe_valle", "cafe_niebla"],
        "hoteles": [("Hacienda Cafetera La Palma", 3)], "vuelos": ["AT-V012"],
        "itinerario": [
            dia(1, "Llegada al Quindío", "Traslado desde Armenia a la hacienda y tarde en Salento.",
                ["Traslado aeropuerto El Edén - hacienda", "Calle Real y mirador de Salento"], "Salento"),
            dia(2, "Valle de Cocora", "Caminata entre palmas de cera y bosque de niebla.",
                ["Willys desde la plaza de Salento", "Caminata circular de 5 horas", "Casa de los colibríes", "Trucha al almuerzo"],
                "Valle de Cocora", "7:30 a. m. - 3:00 p. m."),
            dia(3, "Tour del café y Filandia", "Del grano a la taza en la propia finca.",
                ["Recorrido por el cafetal", "Recolección y cata de café", "Tarde en Filandia y mirador Colina Iluminada"], "Hacienda y Filandia"),
            dia(4, "Regreso", "Desayuno campesino y traslado al aeropuerto.", ["Check-out", "Traslado al aeropuerto"], "Armenia"),
        ],
        "incluye": [("transporte_aereo", "Tiquete aéreo Bogotá - Armenia - Bogotá con Avianca"),
                    ("alojamiento", "3 noches en Hacienda Cafetera La Palma"),
                    ("desayuno", "Desayuno campesino diario"),
                    ("traslados", "Traslados aeropuerto - hacienda - aeropuerto"),
                    ("actividades", "Caminata al Valle de Cocora, tour del café con cata y visita a Filandia"),
                    ("seguro", "Tarjeta de asistencia médica nacional")],
        "no_incluye": NO_INCLUYE_STD + [("entradas", "Ingreso a la reserva privada del Valle de Cocora (aprox. $20.000)")],
        "salidas": [(D(2027, 1, 9), D(2027, 1, 12), 12), (D(2027, 2, 26), D(2027, 3, 1), 12)],
    },
    {
        "nombre_paquete": "Bogotá Cultural y Monserrate",
        "descripcion": (
            "Escapada urbana a la capital: La Candelaria, Museo del Oro, Monserrate, la Catedral de Sal "
            "de Zipaquirá y la mejor gastronomía de Colombia. Sin vuelo: ideal para quien ya está en Bogotá "
            "o llega por su cuenta."
        ),
        "duracion_dias": 3, "noches": 2, "precio_base": 990000, "precio_nino": 690000, "precio_infante": 0,
        "ciudad_salida": "Bogotá", "destino_ciudad": "Bogotá", "destino_pais": "Colombia",
        "destinos_secundarios": "Zipaquirá", "categoria": "Ciudad y cultura",
        "modalidad_alojamiento": "incluido", "modalidad_vuelo": "sin", "min_viajeros": 1, "max_viajeros": 12,
        "imagen": "bog_monserrate", "galeria": ["bog_grafiti", "lobby_arco", "bog_sombrillas", "bog_ciudad"],
        "hoteles": [("Hotel Candelaria Colonial", 2)], "vuelos": [],
        "itinerario": [
            dia(1, "La Candelaria", "Recorrido a pie por el centro histórico.",
                ["Plaza de Bolívar", "Museo del Oro", "Museo Botero", "Chorro de Quevedo"], "La Candelaria", "9:00 a. m. - 2:00 p. m."),
            dia(2, "Zipaquirá y Monserrate", "Catedral de Sal en la mañana y Monserrate al atardecer.",
                ["Catedral de Sal de Zipaquirá", "Almuerzo típico", "Subida en teleférico a Monserrate"], "Zipaquirá y Monserrate",
                "8:00 a. m. - 7:00 p. m."),
            dia(3, "Usaquén y regreso", "Mercado de pulgas de Usaquén (domingos) y check-out.", ["Usaquén", "Check-out"], "Bogotá"),
        ],
        "incluye": [("alojamiento", "2 noches en Hotel Candelaria Colonial"),
                    ("desayuno", "Desayuno santafereño diario"),
                    ("actividades", "Tour a pie por La Candelaria y excursión a Zipaquirá"),
                    ("entradas", "Entradas a Museo del Oro, Catedral de Sal y teleférico de Monserrate"),
                    ("transporte_terrestre", "Transporte a Zipaquirá"),
                    ("guia", "Guía local")],
        "no_incluye": NO_INCLUYE_STD + [("transporte_aereo", "Tiquetes aéreos o terrestres hasta Bogotá")],
        "salidas": [],
    },
    {
        "nombre_paquete": "Cancún Todo Incluido",
        "descripcion": (
            "Seis días en el Caribe mexicano con todo incluido frente al mar, vuelo directo desde Bogotá y "
            "excursión a Chichén Itzá, una de las nuevas siete maravillas del mundo."
        ),
        "duracion_dias": 7, "noches": 6, "precio_base": 6490000, "precio_nino": 3990000, "precio_infante": 690000,
        "ciudad_salida": "Bogotá", "destino_ciudad": "Cancún", "destino_pais": "México",
        "destinos_secundarios": "Chichén Itzá, Isla Mujeres", "categoria": "Internacional - Playa",
        "modalidad_alojamiento": "incluido", "modalidad_vuelo": "incluido", "min_viajeros": 1, "max_viajeros": 8,
        "imagen": "cun_resort", "galeria": ["resort_aereo_1", "cun_chichen", "cun_palmeras", "cun_sombrillas", "piscina_aerea"],
        "hoteles": [("Gran Caribe Cancún Resort", 6)], "vuelos": ["AT-V014", "AT-V015"],
        "itinerario": [
            dia(1, "Llegada a Cancún", "Vuelo directo y traslado al resort.", ["Traslado aeropuerto - hotel", "Cena de bienvenida"], "Cancún"),
            dia(2, "Playa y resort", "Día libre para disfrutar el todo incluido.", ["Piscinas", "Actividades acuáticas", "Show nocturno"], "Zona Hotelera"),
            dia(3, "Chichén Itzá", "Excursión de día completo a la zona arqueológica maya.",
                ["Pirámide de Kukulcán", "Cenote Ik Kil", "Almuerzo buffet", "Valladolid"], "Yucatán", "7:00 a. m. - 8:00 p. m."),
            dia(4, "Isla Mujeres", "Catamarán con snorkel y barra libre.", ["Catamarán", "Snorkel", "Playa Norte"], "Isla Mujeres"),
            dia(5, "Día libre", "Opcional: Xcaret, Xel-Há o Tulum.", ["Actividad opcional"], "Riviera Maya"),
            dia(6, "Día libre", "Último día de playa y spa (opcional).", ["Spa (opcional)", "Cena a la carta"], "Cancún"),
            dia(7, "Regreso", "Traslado al aeropuerto.", ["Check-out", "Traslado al aeropuerto"], "Cancún"),
        ],
        "incluye": [("transporte_aereo", "Tiquete aéreo Bogotá - Cancún - Bogotá directo con Avianca, equipaje de 23 kg"),
                    ("alojamiento", "6 noches en Gran Caribe Cancún Resort, habitación Deluxe Vista Laguna"),
                    ("alimentacion", "Plan todo incluido 24 horas: comidas, bebidas y snacks"),
                    ("traslados", "Traslados aeropuerto - hotel - aeropuerto"),
                    ("actividades", "Excursión a Chichén Itzá y catamarán a Isla Mujeres"),
                    ("seguro", "Asistencia médica internacional")],
        "no_incluye": NO_INCLUYE_STD[:2] + [("impuestos", "Visitax y saneamiento ambiental de Quintana Roo (pago directo)"),
                                            ("otro", "Trámites migratorios que exija México al viajero")],
        "salidas": [(D(2027, 1, 10), D(2027, 1, 16), 15), (D(2027, 3, 20), D(2027, 3, 26), 12)],
    },
    {
        "nombre_paquete": "Punta Cana Todo Incluido",
        "descripcion": (
            "Playa Bávaro con todo incluido: arena blanca, palmeras y aguas turquesa. Incluye excursión a "
            "Isla Saona en catamarán y vuelo con Copa Airlines vía Panamá."
        ),
        "duracion_dias": 7, "noches": 6, "precio_base": 6890000, "precio_nino": 4290000, "precio_infante": 720000,
        "ciudad_salida": "Bogotá", "destino_ciudad": "Punta Cana", "destino_pais": "República Dominicana",
        "destinos_secundarios": "Isla Saona", "categoria": "Internacional - Playa",
        "modalidad_alojamiento": "incluido", "modalidad_vuelo": "incluido", "min_viajeros": 1, "max_viajeros": 8,
        "imagen": "puj_playa", "galeria": ["puj_sombrillas", "resort_aereo_3", "puj_isla", "puj_palmeras", "piscina_patio_aereo"],
        "hoteles": [("Bávaro Palms All Inclusive", 6)], "vuelos": ["AT-V016", "AT-V017"],
        "itinerario": [
            dia(1, "Llegada a Punta Cana", "Vuelo vía Panamá y traslado al resort.", ["Traslado aeropuerto - hotel"], "Punta Cana"),
            dia(2, "Playa Bávaro", "Día libre en el resort.", ["Piscina laguna", "Deportes acuáticos no motorizados"], "Bávaro"),
            dia(3, "Isla Saona", "Catamarán por el Parque Nacional del Este.",
                ["Catamarán con barra libre", "Piscina natural con estrellas de mar", "Almuerzo en la playa"], "Isla Saona",
                "7:00 a. m. - 6:00 p. m."),
            dia(4, "Día libre", "Opcional: buggies, nado con delfines o golf.", ["Actividad opcional"], "Punta Cana"),
            dia(5, "Día libre", "Playa y spa.", ["Spa (opcional)"], "Bávaro"),
            dia(6, "Día libre", "Última noche con cena a la carta.", ["Cena a la carta"], "Bávaro"),
            dia(7, "Regreso", "Traslado al aeropuerto.", ["Check-out", "Traslado al aeropuerto"], "Punta Cana"),
        ],
        "incluye": [("transporte_aereo", "Tiquete aéreo Bogotá - Punta Cana - Bogotá con Copa Airlines (vía Panamá), equipaje de 23 kg"),
                    ("alojamiento", "6 noches en Bávaro Palms All Inclusive, Junior Suite Tropical"),
                    ("alimentacion", "Plan todo incluido 24 horas con bebidas premium"),
                    ("traslados", "Traslados aeropuerto - hotel - aeropuerto"),
                    ("actividades", "Excursión a Isla Saona en catamarán"),
                    ("seguro", "Asistencia médica internacional")],
        "no_incluye": NO_INCLUYE_STD[:2] + [("impuestos", "Tarjeta de turista dominicana si aplica (USD 10)"),
                                            ("otro", "Trámites migratorios que exija República Dominicana al viajero")],
        "salidas": [(D(2027, 1, 17), D(2027, 1, 23), 14), (D(2027, 2, 21), D(2027, 2, 27), 12)],
    },
    {
        "nombre_paquete": "Cusco y Machu Picchu",
        "descripcion": (
            "La ruta del Imperio Inca: Cusco colonial, el Valle Sagrado con Pisac y Ollantaytambo, el tren "
            "panorámico a Aguas Calientes y la visita guiada a Machu Picchu."
        ),
        "duracion_dias": 7, "noches": 6, "precio_base": 7290000, "precio_nino": 5890000, "precio_infante": 690000,
        "ciudad_salida": "Bogotá", "destino_ciudad": "Cusco", "destino_pais": "Perú",
        "destinos_secundarios": "Valle Sagrado, Machu Picchu, Aguas Calientes", "categoria": "Internacional - Cultura",
        "modalidad_alojamiento": "incluido", "modalidad_vuelo": "incluido", "min_viajeros": 2, "max_viajeros": 10,
        "imagen": "cuz_machu", "galeria": ["cuz_ventana", "cuz_llamas", "cuz_plaza", "cuz_tejados", "cuz_catedral"],
        "hoteles": [("Casona San Blas Cusco", 6)], "vuelos": ["AT-V018"],
        "itinerario": [
            dia(1, "Llegada a Cusco", "Traslado al hotel y descanso para aclimatarse a la altura.",
                ["Traslado aeropuerto - hotel", "Mate de coca de bienvenida"], "Cusco"),
            dia(2, "City tour", "Recorrido por la ciudad y sitios arqueológicos cercanos.",
                ["Plaza de Armas y Catedral", "Qoricancha", "Sacsayhuamán", "Q'enqo y Tambomachay"], "Cusco", "1:30 p. m. - 6:30 p. m."),
            dia(3, "Valle Sagrado", "Día completo por el valle de los incas.",
                ["Mercado y ruinas de Pisac", "Almuerzo buffet en Urubamba", "Fortaleza de Ollantaytambo"], "Valle Sagrado",
                "7:30 a. m. - 7:00 p. m."),
            dia(4, "Machu Picchu", "Tren panorámico y visita guiada a la ciudadela.",
                ["Tren Ollantaytambo - Aguas Calientes", "Bus de subida a Machu Picchu", "Visita guiada de 2,5 horas", "Regreso a Cusco"],
                "Machu Picchu", "5:00 a. m. - 10:00 p. m."),
            dia(5, "Día libre", "Opcional: Montaña de 7 Colores o Laguna Humantay.", ["Actividad opcional"], "Cusco"),
            dia(6, "San Blas y compras", "Barrio de artesanos y mercado de San Pedro.", ["Barrio de San Blas", "Mercado de San Pedro"], "Cusco"),
            dia(7, "Regreso", "Traslado al aeropuerto.", ["Check-out", "Traslado al aeropuerto"], "Cusco"),
        ],
        "incluye": [("transporte_aereo", "Tiquete aéreo Bogotá - Cusco - Bogotá con LATAM (vía Lima), equipaje de 23 kg"),
                    ("alojamiento", "6 noches en Casona San Blas Cusco"),
                    ("desayuno", "Desayuno diario y almuerzo buffet en el Valle Sagrado"),
                    ("traslados", "Traslados aeropuerto - hotel - aeropuerto"),
                    ("transporte_terrestre", "Tren Expedition ida y vuelta y bus Consettur a Machu Picchu"),
                    ("entradas", "Entradas a Machu Picchu y boleto turístico parcial de Cusco"),
                    ("guia", "Guía profesional en español"),
                    ("seguro", "Asistencia médica internacional")],
        "no_incluye": NO_INCLUYE_STD[:2] + [("otro", "Actividades opcionales del día libre")],
        "salidas": [(D(2027, 2, 6), D(2027, 2, 12), 14), (D(2027, 4, 10), D(2027, 4, 16), 14)],
    },
    {
        "nombre_paquete": "Caribe Colombiano: Cartagena y Santa Marta",
        "descripcion": (
            "Lo mejor de dos ciudades del Caribe en una semana: playas de Bocagrande, la ciudad amurallada, "
            "las Islas del Rosario, El Rodadero y el Parque Tayrona. Traslado terrestre entre ciudades incluido."
        ),
        "duracion_dias": 7, "noches": 6, "precio_base": 3590000, "precio_nino": 2790000, "precio_infante": 300000,
        "ciudad_salida": "Bogotá", "destino_ciudad": "Cartagena", "destino_pais": "Colombia",
        "destinos_secundarios": "Santa Marta, Islas del Rosario, Parque Tayrona", "categoria": "Playa y cultura",
        "modalidad_alojamiento": "incluido", "modalidad_vuelo": "cotizacion", "min_viajeros": 2, "max_viajeros": 12,
        "imagen": "resort_piscina_playa", "galeria": ["ctg_edificio_mar", "tay_rocas", "piscina_palmeras", "ctg_casas_colores", "tay_sol_rocas"],
        "hoteles": [("Bocagrande Bay Resort", 3), ("Hotel Rodadero Playa", 3)], "vuelos": [],
        "itinerario": [
            dia(1, "Llegada a Cartagena", "Traslado al hotel en Bocagrande.", ["Traslado aeropuerto - hotel", "Tarde de playa"], "Cartagena"),
            dia(2, "City tour", "Ciudad amurallada y Castillo de San Felipe.", ["Castillo de San Felipe", "Centro histórico"], "Cartagena"),
            dia(3, "Islas del Rosario", "Día de playa en las islas.", ["Lancha a Islas del Rosario", "Almuerzo típico"], "Islas del Rosario"),
            dia(4, "Rumbo a Santa Marta", "Traslado terrestre por la vía al mar con parada en Barranquilla.",
                ["Traslado Cartagena - Santa Marta (4 horas)", "Parada en el Malecón de Barranquilla"], "Vía al mar"),
            dia(5, "Parque Tayrona", "Caminata a Arrecifes y Cabo San Juan.", ["Parque Tayrona", "Playa Cabo San Juan"], "Tayrona"),
            dia(6, "Playa Blanca y Rodadero", "Lancha a Playa Blanca y tarde libre.", ["Playa Blanca", "Acuario del Rodadero"], "El Rodadero"),
            dia(7, "Regreso", "Traslado al aeropuerto de Santa Marta.", ["Check-out", "Traslado al aeropuerto"], "Santa Marta"),
        ],
        "incluye": [("alojamiento", "3 noches en Bocagrande Bay Resort y 3 noches en Hotel Rodadero Playa"),
                    ("desayuno", "Desayuno buffet diario"),
                    ("traslados", "Traslados de llegada (Cartagena) y salida (Santa Marta)"),
                    ("transporte_terrestre", "Traslado terrestre Cartagena - Santa Marta"),
                    ("actividades", "City tour en Cartagena, Islas del Rosario y Parque Tayrona"),
                    ("seguro", "Tarjeta de asistencia médica nacional")],
        "no_incluye": NO_INCLUYE_STD + [("transporte_aereo", "Tiquetes aéreos (llegada a Cartagena y salida desde Santa Marta): se cotizan con el asesor"),
                                        ("entradas", "Entrada al Parque Tayrona e impuesto de muelle")],
        "salidas": [(D(2027, 1, 23), D(2027, 1, 29), 16), (D(2027, 3, 6), D(2027, 3, 12), 16)],
    },
]  # fmt: skip


# ---------------------------------------------------------------------------
# Helpers de inserción
# ---------------------------------------------------------------------------
def _insert(conn, tabla: str, datos: dict, pk: str | None = None):
    cols = ", ".join(datos)
    vals = ", ".join(f":{k}" for k in datos)
    sql = f"INSERT INTO {tabla} ({cols}) VALUES ({vals})"
    if pk:
        sql += f" RETURNING {pk}"
        return conn.execute(sa.text(sql), datos).scalar_one()
    conn.execute(sa.text(sql), datos)
    return None


def _scalar(conn, sql: str, **params):
    return conn.execute(sa.text(sql), params).scalar()


def _id_caracteristica(conn, nombre: str) -> int:
    cid = _scalar(conn, "SELECT id_caracteristica FROM caracteristicas_hotel WHERE nombre_caracteristica = :n", n=nombre)
    if cid is None:
        cid = _insert(conn, "caracteristicas_hotel", {"nombre_caracteristica": nombre}, "id_caracteristica")
    return cid


def _id_tipo(conn, nombre: str) -> int:
    tid = _scalar(conn, "SELECT id_tipo_habitacion FROM tipo_habitacion WHERE nombre_tipo = :n ORDER BY 1 LIMIT 1", n=nombre)
    if tid is None:
        capacidades = {"Sencilla": 1, "Doble": 2, "Twin": 2, "Familiar": 4, "Suite": 2, "Cuadruple": 4, "Cabana": 5}
        tid = _insert(
            conn, "tipo_habitacion",
            {"nombre_tipo": nombre, "descripcion": None, "capacidad_personas": capacidades.get(nombre, 2)},
            "id_tipo_habitacion",
        )  # fmt: skip
    return tid


def _crear_hoteles(conn) -> None:
    for c in CARACTERISTICAS:
        _id_caracteristica(conn, c)

    for h in HOTELES:
        if _scalar(conn, "SELECT 1 FROM hoteles WHERE nombre_hotel = :n", n=h["nombre_hotel"]):
            continue
        datos = {
            "nombre_hotel": h["nombre_hotel"], "calificacion": h["calificacion"], "direccion": h["direccion"],
            "ciudad": h["ciudad"], "pais": h["pais"], "codigo_postal": h["codigo_postal"],
            "imagen_url": U(F[h["imagen"]]), "descripcion": h["descripcion"], "politicas": h.get("politicas") or None,
            "tipo_alojamiento": h["tipo_alojamiento"], "departamento": h["departamento"],
            "latitud": h["latitud"], "longitud": h["longitud"],
            "fuente_calificacion": "Categoría declarada por el establecimiento", "publicado": True,
            "hora_checkin": T(15, 0), "hora_checkout": T(12, 0) if h["calificacion"] < 5 else T(11, 0),
            "politica_entrada_anticipada": "Sujeta a disponibilidad el mismo día, sin costo. Garantizada desde las 8:00 a. m. pagando media noche.",
            "politica_salida_tardia": "Hasta las 3:00 p. m. sujeta a disponibilidad con cargo del 30% de la noche; después se cobra la noche completa.",
            "edad_minima": h["edad_minima"], "politica_ninos": h["politica_ninos"], "politica_mascotas": h["politica_mascotas"],
            "politica_cancelacion": f"{CANCELACION_STD} {CANCELACION_TEMPORADA}",
            "condiciones_reserva": "Para garantizar la reserva se requiere el pago del 30% del valor total. El saldo se paga 15 días antes de la llegada.",
            "impuestos_cargos": h.get("impuestos_cargos", IMPUESTOS_CO),
            "restricciones": "Documento de identidad obligatorio al hacer check-in para todos los huéspedes (incluidos menores).",
            "informacion_adicional": h.get("informacion_adicional"),
        }  # fmt: skip
        id_hotel = _insert(conn, "hoteles", datos, "id_hotel")

        for orden, foto in enumerate(h["galeria"]):
            _insert(conn, "imagenes_hotel", {"id_hotel": id_hotel, "url": U(F[foto]), "orden": orden})

        for nombre, estado in h["caracteristicas"]:
            _insert(
                conn, "hotel_caracteristicas",
                {"id_hotel": id_hotel, "id_caracteristica": _id_caracteristica(conn, nombre), "disponible": True,
                 "estado": estado, "nota": None},
            )  # fmt: skip

        for r in h["habitaciones"]:
            id_hab = _insert(
                conn, "habitaciones",
                {
                    "id_hotel": id_hotel, "id_tipo_habitacion": _id_tipo(conn, r["tipo"]),
                    "numero_habitacion": r["numero_habitacion"], "precio_noche": r["precio_noche"], "estado": "disponible",
                    "descripcion": r["descripcion"], "tamano_m2": r["tamano_m2"], "tipo_cama": r["tipo_cama"],
                    "vista": r["vista"], "comodidades": None, "piso": r["piso"], "tipo_bano": r["tipo_bano"],
                    "servicios": ",".join(dict.fromkeys(r["servicios"])), "desayuno_incluido": r["desayuno_incluido"],
                    "permite_fumar": False, "admite_mascotas": "Pet" in " ".join(c for c, _ in h["caracteristicas"]),
                    "accesible": r["piso"] == 1, "cama_extra": r["capacidad_ninos"] > 0,
                    "nombre": r["nombre"], "capacidad_adultos": r["capacidad_adultos"], "capacidad_ninos": r["capacidad_ninos"],
                    "cantidad_camas": r["cantidad_camas"], "politica_cancelacion": None, "publicada": True,
                },
                "id_habitacion",
            )  # fmt: skip
            for orden, (foto, pie) in enumerate(r["fotos"]):
                _insert(conn, "imagenes_habitacion", {"id_habitacion": id_hab, "url": U(F[foto]), "orden": orden, "descripcion": pie})


def _crear_vuelos(conn) -> dict[str, int]:
    ids: dict[str, int] = {}
    for v in VUELOS:
        existente = _scalar(conn, "SELECT id_oferta FROM ofertas_vuelo WHERE titulo = :t", t=v["titulo"])
        ids[v["codigo_referencia"]] = existente or _insert(conn, "ofertas_vuelo", dict(v), "id_oferta")
    return ids


def _crear_paquetes(conn, ids_vuelo: dict[str, int]) -> None:
    for p in PAQUETES:
        if _scalar(conn, "SELECT 1 FROM paquetes WHERE nombre_paquete = :n", n=p["nombre_paquete"]):
            continue
        fechas = [s[0] for s in p["salidas"]]
        datos = {
            k: p[k]
            for k in (
                "nombre_paquete", "descripcion", "duracion_dias", "noches", "precio_base", "precio_nino", "precio_infante",
                "ciudad_salida", "destino_ciudad", "destino_pais", "destinos_secundarios", "categoria",
                "modalidad_alojamiento", "modalidad_vuelo", "min_viajeros", "max_viajeros",
            )
        }  # fmt: skip
        datos.update(
            {
                "activo": True, "imagen_url": U(F[p["imagen"]]), "condiciones": CONDICIONES_STD,
                "no_incluye": "\n".join(d for _, d in p["no_incluye"]), "unidad_precio": "por_persona",
                "vigencia_desde": D(2026, 11, 15), "vigencia_hasta": max(fechas) if fechas else D(2027, 6, 30),
            }
        )  # fmt: skip
        id_paq = _insert(conn, "paquetes", datos, "id_paquete")

        for orden, foto in enumerate(p["galeria"]):
            _insert(conn, "imagenes_paquete", {"id_paquete": id_paq, "url": U(F[foto]), "orden": orden})
        for nombre_hotel, noches in p["hoteles"]:
            id_hotel = _scalar(conn, "SELECT id_hotel FROM hoteles WHERE nombre_hotel = :n ORDER BY 1 LIMIT 1", n=nombre_hotel)
            if id_hotel:
                _insert(conn, "paquete_hotel", {"id_paquete": id_paq, "id_hotel": id_hotel, "noches_incluidas": noches})
        for cod in p["vuelos"]:
            _insert(conn, "paquete_vuelos", {"id_paquete": id_paq, "id_oferta": ids_vuelo[cod]})
        for d in p["itinerario"]:
            _insert(conn, "itinerario_paquete", {"id_paquete": id_paq, "informacion_adicional": None, **d})
        orden = 0
        for tipo, items in (("incluye", p["incluye"]), ("no_incluye", p["no_incluye"])):
            for categoria, descripcion in items:
                _insert(
                    conn, "paquete_inclusiones",
                    {"id_paquete": id_paq, "tipo": tipo, "categoria": categoria, "descripcion": descripcion, "orden": orden},
                )  # fmt: skip
                orden += 1
        for salida, regreso, cupos in p["salidas"]:
            _insert(
                conn, "salidas_paquete",
                {"id_paquete": id_paq, "fecha_salida": salida, "fecha_regreso": regreso, "cupos": cupos, "estado": "abierta", "notas": None},
            )  # fmt: skip


def upgrade() -> None:
    conn = op.get_bind()
    _crear_hoteles(conn)
    ids_vuelo = _crear_vuelos(conn)
    _crear_paquetes(conn, ids_vuelo)


def downgrade() -> None:
    conn = op.get_bind()
    # Los paquetes primero (sus vínculos con hoteles y vuelos caen en cascada).
    conn.execute(
        sa.text("DELETE FROM paquetes WHERE nombre_paquete = ANY(:n)"), {"n": [p["nombre_paquete"] for p in PAQUETES]}
    )
    conn.execute(sa.text("DELETE FROM ofertas_vuelo WHERE titulo = ANY(:t)"), {"t": [v["titulo"] for v in VUELOS]})
    conn.execute(sa.text("DELETE FROM hoteles WHERE nombre_hotel = ANY(:n)"), {"n": [h["nombre_hotel"] for h in HOTELES]})
    # Las características y tipos de habitación nuevos se dejan: pueden estar
    # en uso por hoteles creados desde el panel después de esta migración.
