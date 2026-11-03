from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ClienteDependencyError, EmpleadoDependencyError, NotFoundError
from app.models.cliente_model import Cliente, Empleado
from app.models.reserva_model import HistorialReserva, Reserva


class ClienteRepository:
    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 10):
        # joinedload(Cliente.usuario) evita N+1 al resolver Cliente.foto_perfil
        # (propiedad usada por ClienteResponse) para cada cliente de la lista.
        # order_by agregado: sin él, una vez la tabla supera `limit`, qué
        # subconjunto de clientes devuelve la consulta queda a criterio del
        # motor de base de datos (sin garantía de orden) — con id_cliente
        # como criterio estable, al menos siempre son los mismos primero.
        return (
            db.query(Cliente)
            .options(joinedload(Cliente.usuario))
            .order_by(Cliente.id_cliente)
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, cliente_id: int):
        return db.query(Cliente).options(joinedload(Cliente.usuario)).filter(Cliente.id_cliente == cliente_id).first()

    @staticmethod
    def get_by_cedula(db: Session, cedula: str):
        return db.query(Cliente).filter(Cliente.cedula == cedula).first()

    @staticmethod
    def get_by_email(db: Session, correo: str):
        return db.query(Cliente).filter(Cliente.correo == correo).first()

    @staticmethod
    def create(db: Session, cliente_data: dict):
        cliente = Cliente(**cliente_data)
        db.add(cliente)
        db.commit()
        db.refresh(cliente)
        return cliente

    @staticmethod
    def update(db: Session, cliente_id: int, cliente_data: dict):
        cliente = db.query(Cliente).filter(Cliente.id_cliente == cliente_id).first()
        if cliente:
            for key, value in cliente_data.items():
                if value is not None:
                    setattr(cliente, key, value)
            db.commit()
            db.refresh(cliente)
        return cliente

    @staticmethod
    def existe_otro_con_correo(db: Session, cliente_id: int, correo: str) -> bool:
        """Antes update_cliente no validaba esto y una edición a un correo ya
        usado por OTRO cliente reventaba con un IntegrityError sin capturar
        (500 crudo) en vez del mensaje claro que create_cliente ya da."""
        return db.query(Cliente).filter(Cliente.correo == correo, Cliente.id_cliente != cliente_id).first() is not None

    @staticmethod
    def delete(db: Session, cliente_id: int):
        cliente = db.query(Cliente).filter(Cliente.id_cliente == cliente_id).first()
        if not cliente:
            raise NotFoundError(f"Cliente con ID {cliente_id} no encontrado")

        # Verificar si tiene reservas
        reservas_count = db.query(func.count(Reserva.id_reserva)).filter(Reserva.id_cliente == cliente_id).scalar() or 0

        if reservas_count > 0:
            raise ClienteDependencyError(cliente_id, reservas_count)

        db.delete(cliente)
        db.commit()
        return cliente


class EmpleadoRepository:
    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 10):
        # Mismo criterio que ClienteRepository.get_all — evita N+1 en Empleado.foto_perfil.
        return db.query(Empleado).options(joinedload(Empleado.usuario)).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, empleado_id: int):
        return (
            db.query(Empleado).options(joinedload(Empleado.usuario)).filter(Empleado.id_empleado == empleado_id).first()
        )

    @staticmethod
    def get_by_cedula(db: Session, cedula: str):
        return db.query(Empleado).filter(Empleado.cedula == cedula).first()

    @staticmethod
    def get_by_email(db: Session, correo: str):
        return db.query(Empleado).filter(Empleado.correo_electronico == correo).first()

    @staticmethod
    def get_activos(db: Session, skip: int = 0, limit: int = 10):
        return (
            db.query(Empleado)
            .options(joinedload(Empleado.usuario))
            .filter(Empleado.activo)
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def create(db: Session, empleado_data: dict):
        empleado = Empleado(**empleado_data)
        db.add(empleado)
        db.commit()
        db.refresh(empleado)
        return empleado

    @staticmethod
    def update(db: Session, empleado_id: int, empleado_data: dict):
        empleado = db.query(Empleado).filter(Empleado.id_empleado == empleado_id).first()
        if empleado:
            for key, value in empleado_data.items():
                if value is not None:
                    setattr(empleado, key, value)
            db.commit()
            db.refresh(empleado)
        return empleado

    @staticmethod
    def delete(db: Session, empleado_id: int):
        empleado = db.query(Empleado).filter(Empleado.id_empleado == empleado_id).first()
        if not empleado:
            raise NotFoundError(f"Empleado con ID {empleado_id} no encontrado")

        # Verificar si tiene reservas asignadas
        reservas_count = (
            db.query(func.count(Reserva.id_empleado)).filter(Reserva.id_empleado == empleado_id).scalar() or 0
        )

        # Verificar si tiene historial de reservas
        historial_count = (
            # Hallazgo (bootcamp, semana 8): la columna se llama
            # id_empleado_responsable; con id_empleado, borrar CUALQUIER
            # empleado respondía 500 (AttributeError).
            db.query(func.count(HistorialReserva.id_empleado_responsable))
            .filter(HistorialReserva.id_empleado_responsable == empleado_id)
            .scalar()
            or 0
        )

        if reservas_count > 0 or historial_count > 0:
            raise EmpleadoDependencyError(empleado_id, reservas_count, historial_count)

        db.delete(empleado)
        db.commit()
        return empleado
