from sqlalchemy import TIMESTAMP, Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    correo_electronico = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    id_cliente = Column(Integer, ForeignKey("clientes.id_cliente", ondelete="CASCADE"), unique=True)
    id_empleado = Column(Integer, ForeignKey("empleados.id_empleado", ondelete="CASCADE"), unique=True)
    activo = Column(Boolean, default=True)
    verificado = Column(Boolean, default=False)
    foto_perfil = Column(String(255), nullable=True)
    ultimo_login = Column(TIMESTAMP)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    # Evidencia de aceptación de los términos y condiciones al registrarse
    # (versión del documento y momento). NULL en cuentas anteriores.
    terminos_version = Column(String(40), nullable=True)
    terminos_aceptados_en = Column(TIMESTAMP, nullable=True)

    # Código corto (6 dígitos) para verificar la cuenta sin depender del
    # enlace del correo -- ver a54ac89a1f9b_agregar_codigo_verificacion.py.
    # Solo se guarda el hash (igual que password_hash), nunca el código en
    # texto plano.
    codigo_verificacion_hash = Column(String(255), nullable=True)
    codigo_verificacion_expira = Column(TIMESTAMP, nullable=True)
    intentos_verificacion = Column(Integer, default=0, nullable=False)

    cliente = relationship("Cliente", back_populates="usuario", uselist=False)
    empleado = relationship("Empleado", back_populates="usuario", uselist=False)
