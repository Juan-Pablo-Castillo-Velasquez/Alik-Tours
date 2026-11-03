"""
Repositorio del chat privado admin<->cliente. Un solo hilo por cliente: no
hay tabla de "hilo" separada, el hilo de un cliente es "todos los
MensajeChat con ese id_cliente" -- ver app/models/mensaje_chat_model.py.
"""

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.cliente_model import Cliente
from app.models.mensaje_chat_model import MensajeChat
from app.models.reserva_model import Reserva
from app.models.user_model import Usuario


def _remitente_nombre_y_foto(db: Session, mensaje: MensajeChat) -> tuple[str, str | None]:
    """Nombre/foto reales de quien envió, según remitente_tipo -- nunca se
    inventa un nombre genérico ("Admin"): si el usuario remitente ya no
    existe (cuenta borrada), cae a un texto honesto en vez de romper."""
    usuario = db.query(Usuario).filter(Usuario.id_usuario == mensaje.id_usuario_remitente).first()
    if not usuario:
        return "Usuario eliminado", None
    if mensaje.remitente_tipo == "cliente" and usuario.cliente:
        return f"{usuario.cliente.nombre} {usuario.cliente.apellido}", usuario.foto_perfil
    return usuario.username, usuario.foto_perfil


def _reserva_resumen(db: Session, id_reserva: int | None) -> dict | None:
    """Resumen mínimo de la reserva etiquetada en un mensaje, reutilizando
    las properties ya calculadas en el modelo Reserva (nombre_paquete,
    destino, hotel_nombre) -- nunca se reimplementa esa lógica aquí. None
    si el mensaje no tiene reserva asociada, o si la tenía y esa reserva ya
    no existe (id_reserva quedó en NULL por el ondelete="SET NULL" de la
    FK)."""
    if id_reserva is None:
        return None
    reserva = db.query(Reserva).filter(Reserva.id_reserva == id_reserva).first()
    if not reserva:
        return None
    return {
        "id_reserva": reserva.id_reserva,
        "nombre_paquete": reserva.nombre_paquete,
        "destino": reserva.destino,
        "hotel_nombre": reserva.hotel_nombre,
        "estado": reserva.estado,
        "fecha_inicio": reserva.fecha_inicio,
        "fecha_fin": reserva.fecha_fin,
    }


def _a_response_dict(db: Session, mensaje: MensajeChat) -> dict:
    nombre, foto = _remitente_nombre_y_foto(db, mensaje)
    return {
        "id_mensaje": mensaje.id_mensaje,
        "id_cliente": mensaje.id_cliente,
        "id_usuario_remitente": mensaje.id_usuario_remitente,
        "remitente_tipo": mensaje.remitente_tipo,
        "contenido": mensaje.contenido,
        "imagen_url": mensaje.imagen_url,
        "archivo_url": mensaje.archivo_url,
        "archivo_nombre": mensaje.archivo_nombre,
        "id_reserva": mensaje.id_reserva,
        "reserva": _reserva_resumen(db, mensaje.id_reserva),
        "leido": mensaje.leido,
        "fecha_envio": mensaje.fecha_envio,
        "remitente_nombre": nombre,
        "remitente_foto": foto,
    }


class MensajeChatRepository:
    @staticmethod
    def get_hilos(db: Session, *, search: str | None = None, skip: int = 0, limit: int = 20) -> tuple[list[dict], int]:
        """Bandeja compartida del admin, paginada y con búsqueda opcional
        por nombre/apellido/correo del cliente (contrato skip/limit, mismo
        que reserva_route.py -- nunca page/page_size). Un cliente por fila
        (solo los que ya tienen al menos un mensaje), ordenados por fecha
        del último mensaje descendente.

        El conteo de no-leídos se resuelve con UNA sola consulta agrupada
        para toda la página, nunca con una consulta por fila -- la versión
        anterior de este método hacía exactamente eso (N+1: una query de
        conteo por cada cliente de la bandeja)."""
        ultimo_por_cliente = (
            db.query(
                MensajeChat.id_cliente,
                func.max(MensajeChat.id_mensaje).label("ultimo_id"),
            )
            .group_by(MensajeChat.id_cliente)
            .subquery()
        )

        query = (
            db.query(MensajeChat, Cliente)
            .join(ultimo_por_cliente, MensajeChat.id_mensaje == ultimo_por_cliente.c.ultimo_id)
            .join(Cliente, Cliente.id_cliente == MensajeChat.id_cliente)
        )

        if search:
            patron = f"%{search}%"
            query = query.filter(
                or_(
                    Cliente.nombre.ilike(patron),
                    Cliente.apellido.ilike(patron),
                    Cliente.correo.ilike(patron),
                )
            )

        total = query.count()

        # Desempate por id_mensaje: dos mensajes con la misma fecha_envio
        # (mismo segundo en SQLite, mismo instante en una carga masiva) no
        # tenían un orden garantizado, y la bandeja podía mostrar los hilos
        # en un orden distinto en cada consulta o repetir uno entre páginas.
        filas = (
            query.order_by(MensajeChat.fecha_envio.desc(), MensajeChat.id_mensaje.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        # Una sola consulta agrupada por id_cliente, filtrada solo a los
        # clientes de ESTA página -- reemplaza el conteo por fila de antes.
        ids_pagina = [cliente.id_cliente for _, cliente in filas]
        no_leidos_por_cliente: dict[int, int] = {}
        if ids_pagina:
            conteos = (
                db.query(MensajeChat.id_cliente, func.count(MensajeChat.id_mensaje))
                .filter(
                    MensajeChat.id_cliente.in_(ids_pagina),
                    MensajeChat.remitente_tipo == "cliente",
                    MensajeChat.leido.is_(False),
                )
                .group_by(MensajeChat.id_cliente)
                .all()
            )
            no_leidos_por_cliente = dict(conteos)

        items = [
            {
                "id_cliente": cliente.id_cliente,
                "cliente_nombre": f"{cliente.nombre} {cliente.apellido}",
                "cliente_foto": cliente.foto_perfil,
                "ultimo_mensaje": ultimo_mensaje.contenido or ("📷 Imagen" if ultimo_mensaje.imagen_url else None),
                "ultimo_mensaje_fecha": ultimo_mensaje.fecha_envio,
                "ultimo_mensaje_remitente_tipo": ultimo_mensaje.remitente_tipo,
                "no_leidos": no_leidos_por_cliente.get(cliente.id_cliente, 0),
            }
            for ultimo_mensaje, cliente in filas
        ]
        return items, total

    @staticmethod
    def get_mensajes(
        db: Session,
        id_cliente: int,
        after_id: int | None = None,
        before_id: int | None = None,
        limit: int = 50,
    ) -> list[dict]:
        """Sin after_id ni before_id: los últimos `limit` mensajes del hilo,
        en orden cronológico ascendente (listos para renderizar de arriba a
        abajo). Con after_id: solo mensajes con id_mensaje > after_id -- es
        el contrato que usa el polling incremental del frontend, para no
        volver a traer todo el hilo cada 5 segundos. Con before_id: los
        `limit` mensajes más recientes ANTES de ese id -- es el contrato de
        "cargar mensajes anteriores" cuando el hilo tiene más de los que ya
        se cargaron inicialmente (misma idea que after_id, pero hacia atrás
        en el historial)."""
        query = db.query(MensajeChat).filter(MensajeChat.id_cliente == id_cliente)

        if after_id is not None:
            mensajes = query.filter(MensajeChat.id_mensaje > after_id).order_by(MensajeChat.id_mensaje.asc()).all()
        elif before_id is not None:
            mensajes = (
                query.filter(MensajeChat.id_mensaje < before_id)
                .order_by(MensajeChat.id_mensaje.desc())
                .limit(limit)
                .all()
            )
            mensajes.reverse()
        else:
            mensajes = query.order_by(MensajeChat.id_mensaje.desc()).limit(limit).all()
            mensajes.reverse()

        return [_a_response_dict(db, m) for m in mensajes]

    @staticmethod
    def crear_mensaje(
        db: Session,
        *,
        id_cliente: int,
        id_usuario_remitente: int,
        remitente_tipo: str,
        contenido: str | None,
        imagen_url: str | None,
        archivo_url: str | None = None,
        archivo_nombre: str | None = None,
        id_reserva: int | None = None,
    ) -> dict:
        mensaje = MensajeChat(
            id_cliente=id_cliente,
            id_usuario_remitente=id_usuario_remitente,
            remitente_tipo=remitente_tipo,
            contenido=contenido,
            imagen_url=imagen_url,
            archivo_url=archivo_url,
            archivo_nombre=archivo_nombre,
            id_reserva=id_reserva,
        )
        db.add(mensaje)
        db.commit()
        db.refresh(mensaje)
        return _a_response_dict(db, mensaje)

    @staticmethod
    def marcar_leido(db: Session, id_cliente: int, remitente_tipo_a_marcar: str) -> int:
        """Marca leido=True los mensajes de `remitente_tipo_a_marcar` (la
        OTRA parte de quien llama) para ese cliente -- nunca los propios.
        Devuelve cuántos se actualizaron."""
        actualizados = (
            db.query(MensajeChat)
            .filter(
                and_(
                    MensajeChat.id_cliente == id_cliente,
                    MensajeChat.remitente_tipo == remitente_tipo_a_marcar,
                    MensajeChat.leido.is_(False),
                )
            )
            .update({"leido": True})
        )
        db.commit()
        return actualizados

    @staticmethod
    def contar_no_leidos_admin(db: Session) -> int:
        """Suma de mensajes de tipo 'cliente' no leídos, en TODOS los
        hilos -- badge global del admin (bandeja compartida)."""
        total = (
            db.query(func.count(MensajeChat.id_mensaje))
            .filter(MensajeChat.remitente_tipo == "cliente", MensajeChat.leido.is_(False))
            .scalar()
        )
        return total or 0

    @staticmethod
    def contar_no_leidos_cliente(db: Session, id_cliente: int) -> int:
        """Mensajes de tipo 'admin' no leídos en el hilo propio de este
        cliente -- badge del tab "Mensajes" en su perfil."""
        total = (
            db.query(func.count(MensajeChat.id_mensaje))
            .filter(
                MensajeChat.id_cliente == id_cliente,
                MensajeChat.remitente_tipo == "admin",
                MensajeChat.leido.is_(False),
            )
            .scalar()
        )
        return total or 0
