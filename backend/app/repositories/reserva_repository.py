from datetime import UTC, datetime

from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.exceptions import (
    HabitacionNoDisponibleError,
    HabitacionNoEncontradaError,
    NotFoundError,
    PaqueteDependencyError,
    PaqueteNoEncontradoError,
    ReservaDependencyError,
)
from app.models.hotel_model import Habitacion, Hotel
from app.models.reserva_model import (
    ImagenPaquete,
    MetodoPago,
    Pago,
    Paquete,
    PaqueteHotel,
    PaqueteServicio,
    Reserva,
    ReservaHabitacion,
    ReservaServicio,
)
from app.models.servicio_model import Servicio


class PaqueteRepository:
    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 10, incluir_inactivos: bool = False):
        # El sitio público solo debe ver paquetes activos (comportamiento
        # original, sin cambios) — incluir_inactivos=True es un opt-in nuevo
        # para el panel de admin, que sí necesita ver/gestionar los paquetes
        # desactivados (delete_paquete solo los desactiva, nunca los borra).
        query = db.query(Paquete)
        if not incluir_inactivos:
            query = query.filter(Paquete.activo)
        return query.order_by(Paquete.id_paquete).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, paquete_id: int):
        return db.query(Paquete).filter(Paquete.id_paquete == paquete_id).first()

    @staticmethod
    def get_similares(db: Session, paquete_id: int, limit: int = 6):
        """Paquetes que comparten ciudad de destino con este (misma ciudad
        de algún hotel real vinculado, vía paquete_hotel) para la sección
        "también te puede interesar" -- antes no existía. Nunca una
        recomendación inventada: si el paquete todavía no tiene ningún
        hotel vinculado (y por lo tanto ningún destino real), devuelve
        vacío en vez de sugerir paquetes al azar."""
        paquete = (
            db.query(Paquete)
            .options(selectinload(Paquete.paquete_hotel).joinedload(PaqueteHotel.hotel))
            .filter(Paquete.id_paquete == paquete_id)
            .first()
        )
        if not paquete:
            return []
        ciudades = {ph.hotel.ciudad for ph in paquete.paquete_hotel if ph.hotel and ph.hotel.ciudad}
        if not ciudades:
            return []
        return (
            db.query(Paquete)
            .join(PaqueteHotel, PaqueteHotel.id_paquete == Paquete.id_paquete)
            .join(Hotel, Hotel.id_hotel == PaqueteHotel.id_hotel)
            .filter(Paquete.activo, Paquete.id_paquete != paquete_id, Hotel.ciudad.in_(ciudades))
            .distinct()
            .order_by(Paquete.id_paquete)
            .limit(limit)
            .all()
        )

    @staticmethod
    def set_imagen_portada(db: Session, paquete_id: int, url: str):
        """Sube/reemplaza la portada del paquete (Paquete.imagen_url) --
        mismo patrón que HotelRepository.update, pero un método propio
        porque esto viaja aparte del PaqueteUpdate normal (el upload es
        multipart, ver POST /paquetes/{id}/imagen en reserva_route.py)."""
        paquete = db.query(Paquete).filter(Paquete.id_paquete == paquete_id).first()
        if paquete:
            paquete.imagen_url = url
            db.commit()
            db.refresh(paquete)
        return paquete

    @staticmethod
    def add_imagen_galeria(db: Session, paquete_id: int, url: str) -> ImagenPaquete:
        siguiente_orden = (
            db.query(func.max(ImagenPaquete.orden)).filter(ImagenPaquete.id_paquete == paquete_id).scalar() or 0
        ) + 1
        imagen = ImagenPaquete(id_paquete=paquete_id, url=url, orden=siguiente_orden)
        db.add(imagen)
        db.commit()
        db.refresh(imagen)
        return imagen

    @staticmethod
    def get_imagen_galeria(db: Session, paquete_id: int, id_imagen: int):
        """Busca por (id_imagen, id_paquete) juntos -- mismo criterio de
        aislamiento que HotelRepository.get_imagen_galeria."""
        return (
            db.query(ImagenPaquete)
            .filter(ImagenPaquete.id_imagen == id_imagen, ImagenPaquete.id_paquete == paquete_id)
            .first()
        )

    @staticmethod
    def delete_imagen_galeria(db: Session, imagen: ImagenPaquete) -> None:
        db.delete(imagen)
        db.commit()

    @staticmethod
    def _sync_hoteles(db: Session, paquete_id: int, hoteles_data: list):
        """Sincroniza paquete_hotel con la lista real recibida — antes esta
        tabla (ya existía en el modelo, la usa GET /paquetes/{id}/detalle)
        no tenía NINGÚN punto de escritura: un paquete nuevo creado desde el
        admin quedaba siempre sin hotel asociado, y nada impedía mezclar un
        paquete de una ciudad con un hotel de otra en Crear Reserva porque
        eran conceptos completamente desconectados. Valida que cada
        id_hotel exista de verdad antes de vincularlo (nunca confiar en el
        ID que manda el frontend sin verificar)."""
        if not hoteles_data:
            db.query(PaqueteHotel).filter(PaqueteHotel.id_paquete == paquete_id).delete()
            return

        ids_pedidos = [h["id_hotel"] for h in hoteles_data]
        hoteles_reales = {row[0] for row in db.query(Hotel.id_hotel).filter(Hotel.id_hotel.in_(ids_pedidos)).all()}
        faltantes = set(ids_pedidos) - hoteles_reales
        if faltantes:
            raise NotFoundError(f"Hotel(es) no encontrado(s): {sorted(faltantes)}")

        existentes = {
            ph.id_hotel: ph for ph in db.query(PaqueteHotel).filter(PaqueteHotel.id_paquete == paquete_id).all()
        }
        ids_nuevos = set(ids_pedidos)
        for id_hotel, ph in existentes.items():
            if id_hotel not in ids_nuevos:
                db.delete(ph)

        for h in hoteles_data:
            id_hotel = h["id_hotel"]
            noches = h.get("noches_incluidas")
            if id_hotel in existentes:
                existentes[id_hotel].noches_incluidas = noches
            else:
                db.add(PaqueteHotel(id_paquete=paquete_id, id_hotel=id_hotel, noches_incluidas=noches))

    @staticmethod
    def _sync_servicios(db: Session, paquete_id: int, servicios_data: list):
        """Igual que _sync_hoteles pero para paquete_servicios ("qué
        incluye" el paquete) — la tabla ya existía y ya la lee GET
        /paquetes/{id}/detalle, pero tampoco tenía ningún punto de
        escritura: un paquete nuevo quedaba siempre sin ningún servicio
        real asociado. Valida cada id_servicio contra la BD antes de
        vincularlo, nunca confiando en lo que manda el frontend."""
        if not servicios_data:
            db.query(PaqueteServicio).filter(PaqueteServicio.id_paquete == paquete_id).delete()
            return

        ids_pedidos = [s["id_servicio"] for s in servicios_data]
        servicios_reales = {
            row[0] for row in db.query(Servicio.id_servicio).filter(Servicio.id_servicio.in_(ids_pedidos)).all()
        }
        faltantes = set(ids_pedidos) - servicios_reales
        if faltantes:
            raise NotFoundError(f"Servicio(s) no encontrado(s): {sorted(faltantes)}")

        existentes = {
            ps.id_servicio: ps
            for ps in db.query(PaqueteServicio).filter(PaqueteServicio.id_paquete == paquete_id).all()
        }
        ids_nuevos = set(ids_pedidos)
        for id_servicio, ps in existentes.items():
            if id_servicio not in ids_nuevos:
                db.delete(ps)

        for s in servicios_data:
            id_servicio = s["id_servicio"]
            dia_actividad = s.get("dia_actividad")
            incluido = s.get("incluido", True)
            if id_servicio in existentes:
                existentes[id_servicio].dia_actividad = dia_actividad
                existentes[id_servicio].incluido = incluido
            else:
                db.add(
                    PaqueteServicio(
                        id_paquete=paquete_id,
                        id_servicio=id_servicio,
                        dia_actividad=dia_actividad,
                        incluido=incluido,
                    )
                )

    @staticmethod
    def create(db: Session, paquete_data: dict):
        # PaqueteCreate.dict() (sin exclude_unset) siempre trae las llaves
        # "hoteles"/"servicios", así que se sacan del dict antes de construir
        # Paquete() (no son columnas reales del modelo) y se sincronizan
        # aparte una vez que el paquete ya tiene id_paquete.
        hoteles_data = paquete_data.pop("hoteles", None) or []
        servicios_data = paquete_data.pop("servicios", None) or []
        paquete = Paquete(**paquete_data)
        db.add(paquete)
        db.flush()
        PaqueteRepository._sync_hoteles(db, paquete.id_paquete, hoteles_data)
        PaqueteRepository._sync_servicios(db, paquete.id_paquete, servicios_data)
        db.commit()
        db.refresh(paquete)
        return paquete

    @staticmethod
    def update(db: Session, paquete_id: int, paquete_data: dict):
        paquete = db.query(Paquete).filter(Paquete.id_paquete == paquete_id).first()
        if paquete:
            # exclude_unset=True: "hoteles"/"servicios" solo aparecen en el
            # dict si el admin realmente los mandó (ver update_paquete en
            # reserva_route.py) — si no vinieron, no se tocan los que ya
            # estaban, igual que "reactivar" solo manda {activo: true} sin
            # tocar el resto de campos.
            tiene_hoteles = "hoteles" in paquete_data
            hoteles_data = paquete_data.pop("hoteles", None) or []
            tiene_servicios = "servicios" in paquete_data
            servicios_data = paquete_data.pop("servicios", None) or []
            for key, value in paquete_data.items():
                if value is not None:
                    setattr(paquete, key, value)
            if tiene_hoteles:
                PaqueteRepository._sync_hoteles(db, paquete_id, hoteles_data)
            if tiene_servicios:
                PaqueteRepository._sync_servicios(db, paquete_id, servicios_data)
            db.commit()
            db.refresh(paquete)
        return paquete

    @staticmethod
    def delete(db: Session, paquete_id: int):
        paquete = db.query(Paquete).filter(Paquete.id_paquete == paquete_id).first()
        if not paquete:
            raise NotFoundError(f"Paquete con ID {paquete_id} no encontrado")

        # Verificar si hay reservas usando este paquete
        reservas_count = db.query(func.count(Reserva.id_reserva)).filter(Reserva.id_paquete == paquete_id).scalar() or 0

        if reservas_count > 0:
            raise PaqueteDependencyError(paquete_id, reservas_count)

        paquete.activo = False
        db.commit()
        db.refresh(paquete)
        return paquete


class ReservaRepository:
    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 10):
        # joinedload evita N+1 al resolver Reserva.precio_total / .nombre_paquete
        # / .destino / .hotel_nombre / .fecha_ultima_actualizacion (propiedades
        # usadas por ReservaResponse) para cada reserva de la lista del admin
        # — mismo criterio ya usado en get_by_cliente. Reserva.pagos va con
        # selectinload (no joinedload) porque es otra colección uno-a-muchos:
        # sumarla a los joinedload de arriba multiplicaría filas por cada
        # combinación cruzada; selectinload la trae en una query aparte.
        return (
            db.query(Reserva)
            .options(
                joinedload(Reserva.paquete).joinedload(Paquete.paquete_hotel).joinedload(PaqueteHotel.hotel),
                joinedload(Reserva.reserva_habitaciones)
                .joinedload(ReservaHabitacion.habitacion)
                .joinedload(Habitacion.hotel),
                joinedload(Reserva.reserva_servicios),
                joinedload(Reserva.historial_reservas),
                selectinload(Reserva.pagos).joinedload(Pago.metodo_pago),
            )
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, reserva_id: int):
        return db.query(Reserva).filter(Reserva.id_reserva == reserva_id).first()

    @staticmethod
    def get_by_id_for_update(db: Session, reserva_id: int):
        """Igual que get_by_id pero con SELECT ... FOR UPDATE: usar solo en
        rutas que van a decidir si cobrar/crear un Pago a partir del estado
        de la reserva (pagar_reserva, confirmar_pago). Sin este lock, dos
        requests concurrentes para la misma reserva (doble clic, reintento
        del frontend tras un timeout) podían leer estado='pendiente' y
        pasar el chequeo de existe_pago_en_proceso() los dos antes de que
        cualquiera hiciera commit, creando dos Pago para una sola reserva.
        No se usa en get_by_id genérico para no bloquear lecturas normales
        (listados, detalle) sin necesidad."""
        return db.query(Reserva).filter(Reserva.id_reserva == reserva_id).with_for_update().first()

    @staticmethod
    def get_by_cliente(db: Session, cliente_id: int, skip: int = 0, limit: int = 10):
        # joinedload evita N+1 al resolver Reserva.nombre_paquete / Reserva.destino
        # / Reserva.hotel_nombre (propiedades usadas por ReservaResponse) para
        # cada reserva del historial — incluye reserva_habitaciones porque una
        # reserva puede no tener paquete (reserva directa de habitación).
        # selectinload(Reserva.pagos) es lo que permite que ReservaResponse.pagos
        # (ver reserva_schema.py) venga poblado acá -- sin esto, TabFacturas.tsx
        # en el perfil del cliente siempre se veía vacío aunque hubiera pagos
        # confirmados con factura real, porque este endpoint nunca cargaba pagos.
        return (
            db.query(Reserva)
            .options(
                joinedload(Reserva.paquete).joinedload(Paquete.paquete_hotel).joinedload(PaqueteHotel.hotel),
                joinedload(Reserva.reserva_habitaciones)
                .joinedload(ReservaHabitacion.habitacion)
                .joinedload(Habitacion.hotel),
                selectinload(Reserva.pagos).joinedload(Pago.metodo_pago),
            )
            .filter(Reserva.id_cliente == cliente_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_by_estado(db: Session, estado: str, skip: int = 0, limit: int = 10):
        return db.query(Reserva).filter(Reserva.estado == estado).offset(skip).limit(limit).all()

    @staticmethod
    def _verificar_disponibilidad(db: Session, id_habitacion: int, fecha_checkin, fecha_checkout):
        """
        Revisa que la habitación exista, esté operativa, y que no tenga
        otra reserva activa que se cruce con el rango de fechas solicitado.
        """
        habitacion = db.query(Habitacion).filter(Habitacion.id_habitacion == id_habitacion).first()
        if not habitacion:
            raise HabitacionNoEncontradaError(id_habitacion)

        if habitacion.estado == "mantenimiento":
            raise HabitacionNoDisponibleError(id_habitacion, fecha_checkin, fecha_checkout)

        # Cruce de fechas: dos rangos se solapan si (inicio1 < fin2) y (inicio2 < fin1)
        cruce = (
            db.query(ReservaHabitacion)
            .join(Reserva, Reserva.id_reserva == ReservaHabitacion.id_reserva)
            .filter(
                ReservaHabitacion.id_habitacion == id_habitacion,
                Reserva.estado.in_(["pendiente", "confirmada"]),  # reservas activas
                and_(
                    ReservaHabitacion.fecha_checkin < fecha_checkout,
                    ReservaHabitacion.fecha_checkout > fecha_checkin,
                ),
            )
            .first()
        )
        if cruce:
            raise HabitacionNoDisponibleError(id_habitacion, fecha_checkin, fecha_checkout)

        return habitacion

    @staticmethod
    def create(db: Session, reserva_data: dict):
        """
        Crea una reserva. Si viene con `habitaciones`, valida disponibilidad real
        de cada una y guarda el precio real de la BD (nunca el que mande el frontend).
        """
        habitaciones_solicitadas = reserva_data.pop("habitaciones", None) or []

        # Si mandan id_paquete, verificar que exista de verdad
        id_paquete = reserva_data.get("id_paquete")
        if id_paquete is not None:
            paquete = db.query(Paquete).filter(Paquete.id_paquete == id_paquete).first()
            if not paquete:
                raise PaqueteNoEncontradoError(id_paquete)

        # Validar TODAS las habitaciones antes de crear nada (evita reservas a medias)
        habitaciones_validadas = []
        for h in habitaciones_solicitadas:
            habitacion = ReservaRepository._verificar_disponibilidad(
                db, h["id_habitacion"], h["fecha_checkin"], h["fecha_checkout"]
            )
            habitaciones_validadas.append((h, habitacion))

        if reserva_data.get("terminos_version"):
            reserva_data["terminos_aceptados_en"] = datetime.now(UTC).replace(tzinfo=None)
        else:
            reserva_data.pop("terminos_version", None)
        reserva = Reserva(**reserva_data, estado="pendiente")
        db.add(reserva)
        db.flush()  # asigna id_reserva sin cerrar la transacción

        for h, habitacion in habitaciones_validadas:
            # BUG real corregido: antes guardaba precio_acordado=precio_noche
            # (tarifa de UNA sola noche) sin importar cuántas noches durara la
            # estadía. Reserva.precio_total (ver reserva_model.py) suma
            # precio_acordado tal cual, y pagar_reserva (reserva_route.py)
            # cobra ese total tal cual — así que una reserva de varias noches
            # se cobraba como si fuera de una sola, mientras el checkout
            # público (Checkout.tsx) sí calculaba y mostraba al cliente el
            # total real (precio_noche * noches). Se corrige acá, en el único
            # lugar donde se fija el precio real (nunca el que mande el
            # frontend), multiplicando por las noches reales de la reserva.
            noches = (h["fecha_checkout"] - h["fecha_checkin"]).days or 1
            reserva_habitacion = ReservaHabitacion(
                id_reserva=reserva.id_reserva,
                id_habitacion=habitacion.id_habitacion,
                fecha_checkin=h["fecha_checkin"],
                fecha_checkout=h["fecha_checkout"],
                precio_acordado=habitacion.precio_noche * noches,  # precio real de la BD × noches, no el del frontend
            )
            db.add(reserva_habitacion)

        db.commit()
        db.refresh(reserva)
        return reserva

    @staticmethod
    def update(db: Session, reserva_id: int, reserva_data: dict):
        reserva = db.query(Reserva).filter(Reserva.id_reserva == reserva_id).first()
        if reserva:
            for key, value in reserva_data.items():
                if value is not None:
                    setattr(reserva, key, value)
            db.commit()
            db.refresh(reserva)
        return reserva

    @staticmethod
    def delete(db: Session, reserva_id: int):
        reserva = db.query(Reserva).filter(Reserva.id_reserva == reserva_id).first()
        if not reserva:
            raise NotFoundError(f"Reserva con ID {reserva_id} no encontrada")

        # Verificar si tiene pagos
        pagos_count = db.query(func.count(Pago.id_pago)).filter(Pago.id_reserva == reserva_id).scalar() or 0

        # Verificar si tiene habitaciones asignadas
        habitaciones_count = (
            db.query(func.count(ReservaHabitacion.id_reserva))
            .filter(ReservaHabitacion.id_reserva == reserva_id)
            .scalar()
            or 0
        )

        # Verificar si tiene servicios asignados
        servicios_count = (
            db.query(func.count(ReservaServicio.id_reserva)).filter(ReservaServicio.id_reserva == reserva_id).scalar()
            or 0
        )

        if pagos_count > 0 or habitaciones_count > 0 or servicios_count > 0:
            raise ReservaDependencyError(reserva_id, pagos_count, habitaciones_count, servicios_count)

        db.delete(reserva)
        db.commit()
        return reserva


class PagoRepository:
    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 10):
        # BUG del mismo patrón encontrado en todos los demás módulos: sin
        # order_by, Postgres no garantiza ningún orden estable, así que una
        # vez que hay más pagos que el `limit`, cuáles quedan afuera es
        # arbitrario e inestable entre requests — afecta directamente qué
        # pago "más representativo" ve el admin en ModuleReservas.tsx.
        return db.query(Pago).order_by(Pago.fecha_pago.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, pago_id: int):
        return db.query(Pago).filter(Pago.id_pago == pago_id).first()

    @staticmethod
    def get_by_reserva(db: Session, reserva_id: int):
        return db.query(Pago).filter(Pago.id_reserva == reserva_id).all()

    @staticmethod
    def existe_pago_en_proceso(db: Session, reserva_id: int) -> bool:
        """Fase 1 del plan de mejora — cierra el hueco de idempotencia real:
        para métodos async (PSE/Nequi) el Pago queda 'procesando' pero
        Reserva.estado NO cambia (sigue 'pendiente'), así que antes un
        segundo clic en "pagar" —o un reintento del frontend tras un
        timeout— pasaba igual el chequeo de `reserva.estado != "pendiente"`
        en pagar_reserva y creaba un SEGUNDO Pago para la misma reserva
        (riesgo real de cobro duplicado). Se llama antes de crear cualquier
        Pago nuevo."""
        return db.query(Pago).filter(Pago.id_reserva == reserva_id, Pago.estado == "procesando").first() is not None

    @staticmethod
    def get_by_estado(db: Session, estado: str, skip: int = 0, limit: int = 10):
        return (
            db.query(Pago)
            .filter(Pago.estado == estado)
            .order_by(Pago.fecha_pago.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def create(db: Session, pago_data: dict):
        pago = Pago(**pago_data, estado="pendiente")
        db.add(pago)
        db.commit()
        db.refresh(pago)
        return pago

    @staticmethod
    def update(db: Session, pago_id: int, pago_data: dict):
        pago = db.query(Pago).filter(Pago.id_pago == pago_id).first()
        if pago:
            for key, value in pago_data.items():
                if value is not None:
                    setattr(pago, key, value)
            db.commit()
            db.refresh(pago)
        return pago

    @staticmethod
    def delete(db: Session, pago_id: int):
        pago = db.query(Pago).filter(Pago.id_pago == pago_id).first()
        if pago:
            db.delete(pago)
            db.commit()
        return pago


class MetodoPagoRepository:
    @staticmethod
    def get_all(db: Session):
        return db.query(MetodoPago).all()

    @staticmethod
    def get_by_id(db: Session, metodo_id: int):
        return db.query(MetodoPago).filter(MetodoPago.id_metodo == metodo_id).first()

    @staticmethod
    def create(db: Session, metodo_data: dict):
        metodo = MetodoPago(**metodo_data)
        db.add(metodo)
        db.commit()
        db.refresh(metodo)
        return metodo
