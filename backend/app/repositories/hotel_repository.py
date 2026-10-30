import unicodedata
from datetime import date

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import HotelDependencyError, NotFoundError
from app.models.hotel_model import Caracteristica, Habitacion, Hotel, HotelCaracteristica, ImagenHotel, TipoHabitacion
from app.models.reserva_model import PaqueteHotel, Reserva, ReservaHabitacion


def _sin_tildes(texto: str) -> str:
    """Quita tildes/diacríticos para comparar texto sin distinguir acentos
    (ej. "medellin" debe encontrar "Medellín") — se hace en Python en vez
    de con la extensión `unaccent` de Postgres porque esta última requiere
    CREATE EXTENSION, que no siempre está disponible en un Postgres
    administrado (Render) sin privilegios de superusuario."""
    descompuesto = unicodedata.normalize("NFD", texto)
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn").lower()


class HotelRepository:
    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 10, fecha_checkin=None, fecha_checkout=None, q=None):
        # GET /hoteles/ responde con HotelDetailResponse (habitaciones +
        # hotel_caracteristicas) y además expone total_resenas/
        # calificacion_promedio (propiedades sobre Hotel.resenas) para cada
        # hotel de la lista — sin esto cada hotel disparaba 3 queries
        # perezosas (N+1). selectinload (no joinedload) para las relaciones
        # de colección evita el producto cartesiano de combinar varios
        # joinedload de "muchos" a la vez; tipo_habitacion/caracteristica son
        # relaciones "uno" así que sí pueden ir con joinedload anidado.
        query = db.query(Hotel).options(
            selectinload(Hotel.habitaciones).joinedload(Habitacion.tipo_habitacion),
            selectinload(Hotel.hotel_caracteristicas).joinedload(HotelCaracteristica.caracteristica),
            selectinload(Hotel.resenas),
            selectinload(Hotel.imagenes),
        )

        if q:
            # Búsqueda en la base de datos (panel de admin y buscador): por
            # nombre, ciudad o país, sin distinguir mayúsculas.
            patron = f"%{q}%"
            query = query.filter(
                or_(Hotel.nombre_hotel.ilike(patron), Hotel.ciudad.ilike(patron), Hotel.pais.ilike(patron))
            )

        if fecha_checkin and fecha_checkout:
            # BUG real corregido: el buscador público (SearchBar/SearchResults)
            # dejaba elegir fecha_checkin/fecha_checkout pero nunca los mandaba
            # al backend — un hotel completamente reservado para esas fechas
            # aparecía igual en los resultados. Se aplica acá el mismo criterio
            # de cruce de fechas que _verificar_disponibilidad en
            # reserva_repository.py (una sola regla de disponibilidad, no dos
            # implementaciones distintas): un hotel califica si tiene al menos
            # una habitación que no esté en mantenimiento y que no tenga
            # ninguna ReservaHabitacion de una reserva activa (pendiente o
            # confirmada) que se cruce con el rango pedido.
            habitaciones_ocupadas = (
                db.query(ReservaHabitacion.id_habitacion)
                .join(Reserva, Reserva.id_reserva == ReservaHabitacion.id_reserva)
                .filter(
                    Reserva.estado.in_(["pendiente", "confirmada"]),
                    ReservaHabitacion.fecha_checkin < fecha_checkout,
                    ReservaHabitacion.fecha_checkout > fecha_checkin,
                )
            )
            hoteles_con_disponibilidad = (
                db.query(Habitacion.id_hotel)
                .filter(Habitacion.estado != "mantenimiento")
                .filter(~Habitacion.id_habitacion.in_(habitaciones_ocupadas))
                .distinct()
            )
            query = query.filter(Hotel.id_hotel.in_(hoteles_con_disponibilidad))

        return query.order_by(Hotel.id_hotel).offset(skip).limit(limit).all()

    @staticmethod
    def get_fechas_ocupadas(db: Session, hotel_id: int):
        """Fechas ya reservadas (por reserva activa) de cada habitación del
        hotel — mismo criterio de "reserva activa" ya usado en
        _verificar_disponibilidad (reserva_repository.py) y en el filtro de
        disponibilidad de GET /hoteles/ (get_all de arriba). Solo devuelve
        fechas, nunca a quién pertenece la reserva. Filtra fecha_checkout >=
        hoy para no mostrarle al cliente rangos ya pasados sin ningún valor
        informativo."""
        hoy = date.today()
        filas = (
            db.query(
                ReservaHabitacion.id_habitacion,
                ReservaHabitacion.fecha_checkin,
                ReservaHabitacion.fecha_checkout,
            )
            .join(Habitacion, Habitacion.id_habitacion == ReservaHabitacion.id_habitacion)
            .join(Reserva, Reserva.id_reserva == ReservaHabitacion.id_reserva)
            .filter(
                Habitacion.id_hotel == hotel_id,
                Reserva.estado.in_(["pendiente", "confirmada"]),
                ReservaHabitacion.fecha_checkout >= hoy,
            )
            .order_by(ReservaHabitacion.fecha_checkin)
            .all()
        )
        resultado: dict = {}
        for id_habitacion, checkin, checkout in filas:
            resultado.setdefault(id_habitacion, []).append({"fecha_checkin": checkin, "fecha_checkout": checkout})
        return resultado

    @staticmethod
    def get_destacados(db: Session, limit: int = 3):
        """Hoteles mejor calificados con su precio de habitación más bajo."""
        resultados = (
            db.query(
                Hotel.id_hotel,
                Hotel.nombre_hotel,
                Hotel.ciudad,
                Hotel.pais,
                Hotel.calificacion,
                func.min(Habitacion.precio_noche).label("precio_desde"),
            )
            .join(Habitacion, Habitacion.id_hotel == Hotel.id_hotel)
            .group_by(Hotel.id_hotel, Hotel.nombre_hotel, Hotel.ciudad, Hotel.pais, Hotel.calificacion)
            .order_by(Hotel.calificacion.desc(), func.min(Habitacion.precio_noche).asc())
            .limit(limit)
            .all()
        )
        return resultados

    @staticmethod
    def get_seleccion_casa(db: Session, limit: int = 4, offset: int = 3):
        """Siguiente tanda de hoteles después de los destacados (evita repetir)."""
        resultados = (
            db.query(
                Hotel.id_hotel,
                Hotel.nombre_hotel,
                Hotel.ciudad,
                Hotel.pais,
                Hotel.calificacion,
                func.min(Habitacion.precio_noche).label("precio_desde"),
            )
            .join(Habitacion, Habitacion.id_hotel == Hotel.id_hotel)
            .group_by(Hotel.id_hotel, Hotel.nombre_hotel, Hotel.ciudad, Hotel.pais, Hotel.calificacion)
            .order_by(Hotel.calificacion.desc(), func.min(Habitacion.precio_noche).asc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return resultados

    @staticmethod
    def get_destinos_reales(db: Session, q: str = "", limit: int = 8):
        """Ciudades/países con inventario REAL de hoteles (y por lo tanto de
        paquetes: Paquete.ciudad_destino sale del hotel vinculado, ver
        reserva_model.py) -- agrupa Hotel por ciudad/país con el conteo real
        de hoteles de cada una. Antes el autocompletado del buscador
        (SearchBar.tsx) sugería destinos de la tabla `destinos` (catálogo
        aparte, pensado para servicios/actividades, SIN relación con
        Hotel.ciudad), así que podía sugerir una ciudad para la que no
        existía ningún hotel ni paquete real -- la búsqueda en sí nunca
        inventó resultados, pero invitaba a buscar algo que nunca los iba a
        tener. El filtro de texto usa _sin_tildes (no ILIKE) para que
        también ignore tildes."""
        filas = (
            db.query(Hotel.ciudad, Hotel.pais, func.count(Hotel.id_hotel).label("total"))
            .filter(Hotel.ciudad.isnot(None), Hotel.ciudad != "")
            .group_by(Hotel.ciudad, Hotel.pais)
            .all()
        )

        q_normalizado = _sin_tildes(q.strip()) if q else ""
        coincidencias = [
            (ciudad, pais, total)
            for ciudad, pais, total in filas
            if not q_normalizado
            or q_normalizado in _sin_tildes(ciudad)
            or (pais and q_normalizado in _sin_tildes(pais))
        ]
        # Ciudades con más hoteles primero (más relevantes para sugerir), luego alfabético.
        coincidencias.sort(key=lambda item: (-item[2], item[0]))
        return coincidencias[:limit]

    @staticmethod
    def get_by_id(db: Session, hotel_id: int):
        return db.query(Hotel).filter(Hotel.id_hotel == hotel_id).first()

    @staticmethod
    def get_similares(db: Session, hotel_id: int, limit: int = 6):
        """Hoteles de la misma ciudad (excluyendo el propio) para la sección
        "también te puede interesar" de la ficha de hotel -- antes esa
        sección no existía; se calcula por ciudad real (Hotel.ciudad), nunca
        una recomendación inventada. Mismas relaciones eager-loaded que
        get_all para poder reutilizar HotelCard.tsx tal cual en el frontend
        (necesita habitaciones/hotel_caracteristicas ya cargadas)."""
        hotel = db.query(Hotel).filter(Hotel.id_hotel == hotel_id).first()
        if not hotel or not hotel.ciudad:
            return []
        return (
            db.query(Hotel)
            .options(
                selectinload(Hotel.habitaciones).joinedload(Habitacion.tipo_habitacion),
                selectinload(Hotel.hotel_caracteristicas).joinedload(HotelCaracteristica.caracteristica),
                selectinload(Hotel.resenas),
                selectinload(Hotel.imagenes),
            )
            .filter(Hotel.ciudad == hotel.ciudad, Hotel.id_hotel != hotel_id)
            .order_by(Hotel.calificacion.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def add_imagen_galeria(db: Session, hotel_id: int, url: str) -> ImagenHotel:
        """Agrega una foto al final de la galería del hotel (ver POST
        /hoteles/{id}/galeria en hotel_route.py). `orden` se calcula como
        max(orden) + 1 en vez de contar filas, para que borrar una foto del
        medio no haga que la siguiente que se suba "salte" al mismo orden
        que otra ya existente."""
        siguiente_orden = (
            db.query(func.max(ImagenHotel.orden)).filter(ImagenHotel.id_hotel == hotel_id).scalar() or 0
        ) + 1
        imagen = ImagenHotel(id_hotel=hotel_id, url=url, orden=siguiente_orden)
        db.add(imagen)
        db.commit()
        db.refresh(imagen)
        return imagen

    @staticmethod
    def get_imagen_galeria(db: Session, hotel_id: int, id_imagen: int):
        """Busca por (id_imagen, id_hotel) juntos -- nunca solo por
        id_imagen -- para que DELETE /hoteles/{id}/galeria/{id_imagen} nunca
        pueda borrar una foto de OTRO hotel aunque alguien mande un
        id_hotel de la URL que no corresponda al id_imagen real."""
        return (
            db.query(ImagenHotel).filter(ImagenHotel.id_imagen == id_imagen, ImagenHotel.id_hotel == hotel_id).first()
        )

    @staticmethod
    def delete_imagen_galeria(db: Session, imagen: ImagenHotel) -> None:
        db.delete(imagen)
        db.commit()

    @staticmethod
    def create(db: Session, hotel_data: dict):
        hotel = Hotel(**hotel_data)
        db.add(hotel)
        db.commit()
        db.refresh(hotel)
        return hotel

    @staticmethod
    def update(db: Session, hotel_id: int, hotel_data: dict):
        hotel = db.query(Hotel).filter(Hotel.id_hotel == hotel_id).first()
        if hotel:
            for key, value in hotel_data.items():
                if value is not None:
                    setattr(hotel, key, value)
            db.commit()
            db.refresh(hotel)
        return hotel

    @staticmethod
    def delete(db: Session, hotel_id: int):
        hotel = db.query(Hotel).filter(Hotel.id_hotel == hotel_id).first()
        if not hotel:
            raise NotFoundError(f"Hotel con ID {hotel_id} no encontrado")

        # Verificar dependencias
        habitaciones_count = (
            db.query(func.count(Habitacion.id_habitacion)).filter(Habitacion.id_hotel == hotel_id).scalar() or 0
        )

        caracteristicas_count = (
            db.query(func.count(HotelCaracteristica.id_hotel)).filter(HotelCaracteristica.id_hotel == hotel_id).scalar()
            or 0
        )

        # Antes no se validaba: PaqueteHotel.id_hotel es ondelete="CASCADE",
        # así que borrar un hotel vinculado a un paquete eliminaba ese
        # vínculo en silencio, dejando el paquete roto sin ningún aviso.
        paquetes_count = (
            db.query(func.count(PaqueteHotel.id_paquete)).filter(PaqueteHotel.id_hotel == hotel_id).scalar() or 0
        )

        if habitaciones_count > 0 or caracteristicas_count > 0 or paquetes_count > 0:
            raise HotelDependencyError(hotel_id, habitaciones_count, caracteristicas_count, paquetes_count)

        db.delete(hotel)
        db.commit()
        return hotel


class HabitacionRepository:
    @staticmethod
    def get_all(db: Session, hotel_id: int = None, skip: int = 0, limit: int = 10):
        query = db.query(Habitacion)
        if hotel_id:
            query = query.filter(Habitacion.id_hotel == hotel_id)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, habitacion_id: int):
        return db.query(Habitacion).filter(Habitacion.id_habitacion == habitacion_id).first()

    @staticmethod
    def get_by_hotel_and_number(db: Session, hotel_id: int, numero: str):
        return (
            db.query(Habitacion).filter(Habitacion.id_hotel == hotel_id, Habitacion.numero_habitacion == numero).first()
        )

    @staticmethod
    def create(db: Session, habitacion_data: dict):
        habitacion = Habitacion(**habitacion_data)
        db.add(habitacion)
        db.commit()
        db.refresh(habitacion)
        return habitacion

    @staticmethod
    def update(db: Session, habitacion_id: int, habitacion_data: dict):
        habitacion = db.query(Habitacion).filter(Habitacion.id_habitacion == habitacion_id).first()
        if habitacion:
            for key, value in habitacion_data.items():
                if value is not None:
                    setattr(habitacion, key, value)
            db.commit()
            db.refresh(habitacion)
        return habitacion

    @staticmethod
    def delete(db: Session, habitacion_id: int):
        habitacion = db.query(Habitacion).filter(Habitacion.id_habitacion == habitacion_id).first()
        if habitacion:
            db.delete(habitacion)
            db.commit()
        return habitacion

    @staticmethod
    def get_disponibles(db: Session, hotel_id: int, skip: int = 0, limit: int = 10):
        return (
            db.query(Habitacion)
            .filter(Habitacion.id_hotel == hotel_id, Habitacion.estado == "disponible")
            .offset(skip)
            .limit(limit)
            .all()
        )


class TipoHabitacionRepository:
    """CRUD de catálogo de tipos de habitación (Individual, Doble, Suite,
    etc.) — el modelo y su schema ya existían (los usa cada Habitacion vía
    id_tipo_habitacion) pero no había NINGÚN endpoint para listarlos ni
    crear uno nuevo: el admin no tenía forma de saber qué tipos existen al
    dar de alta una habitación."""

    @staticmethod
    def get_all(db: Session):
        return db.query(TipoHabitacion).order_by(TipoHabitacion.nombre_tipo).all()

    @staticmethod
    def get_by_id(db: Session, tipo_id: int):
        return db.query(TipoHabitacion).filter(TipoHabitacion.id_tipo_habitacion == tipo_id).first()

    @staticmethod
    def create(db: Session, tipo_data: dict):
        tipo = TipoHabitacion(**tipo_data)
        db.add(tipo)
        db.commit()
        db.refresh(tipo)
        return tipo


class CaracteristicaRepository:
    @staticmethod
    def get_all(db: Session):
        return db.query(Caracteristica).all()

    @staticmethod
    def get_by_id(db: Session, caracteristica_id: int):
        return db.query(Caracteristica).filter(Caracteristica.id_caracteristica == caracteristica_id).first()

    @staticmethod
    def create(db: Session, caracteristica_data: dict):
        caracteristica = Caracteristica(**caracteristica_data)
        db.add(caracteristica)
        db.commit()
        db.refresh(caracteristica)
        return caracteristica

    @staticmethod
    def delete(db: Session, caracteristica_id: int):
        caracteristica = db.query(Caracteristica).filter(Caracteristica.id_caracteristica == caracteristica_id).first()
        if caracteristica:
            db.delete(caracteristica)
            db.commit()
        return caracteristica


class HotelCaracteristicaRepository:
    @staticmethod
    def get_by_hotel(db: Session, hotel_id: int):
        return db.query(HotelCaracteristica).filter(HotelCaracteristica.id_hotel == hotel_id).all()

    @staticmethod
    def add_caracteristica(db: Session, hotel_id: int, caracteristica_id: int, disponible: bool = True):
        hc = HotelCaracteristica(id_hotel=hotel_id, id_caracteristica=caracteristica_id, disponible=disponible)
        db.add(hc)
        db.commit()
        db.refresh(hc)
        return hc

    @staticmethod
    def remove_caracteristica(db: Session, hotel_id: int, caracteristica_id: int):
        hc = (
            db.query(HotelCaracteristica)
            .filter(
                HotelCaracteristica.id_hotel == hotel_id, HotelCaracteristica.id_caracteristica == caracteristica_id
            )
            .first()
        )
        if hc:
            db.delete(hc)
            db.commit()
        return hc
