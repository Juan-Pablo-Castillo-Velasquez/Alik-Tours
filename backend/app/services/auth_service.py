# services/auth_service.py

from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.core.security import (
    create_access_token,
    create_verification_token,
    generate_token_pair,
    generate_verification_code,
    hash_password,
    hash_verification_code,
    verify_password,
    verify_verification_code,
    verify_verification_token,
)
from app.repositories.user_repository import create_user, get_user_by_email, get_user_by_username

# Vida del código de 6 dígitos -- más corta que las 24h del enlace de correo
# (create_verification_token) porque este flujo asume que la persona sigue
# ahí mismo, en el modal de registro, esperando el código.
CODIGO_VERIFICACION_VIGENCIA_MINUTOS = 15
# Con solo 10^6 combinaciones posibles, hay que limitar intentos fallidos
# antes de exigir un código nuevo (ver verify_email_code).
CODIGO_VERIFICACION_MAX_INTENTOS = 5


def _generar_y_guardar_codigo(db: Session, user) -> str:
    """Genera un código de 6 dígitos nuevo, lo guarda hasheado en el
    usuario (con su expiración e intentos en cero) y devuelve el código
    EN CRUDO -- ese valor crudo es el único momento en que existe sin
    hashear, y es responsabilidad de quien llama mandarlo por correo y
    nunca guardarlo en ningún otro lado."""
    codigo = generate_verification_code()
    user.codigo_verificacion_hash = hash_verification_code(codigo)
    user.codigo_verificacion_expira = datetime.now(UTC) + timedelta(minutes=CODIGO_VERIFICACION_VIGENCIA_MINUTOS)
    user.intentos_verificacion = 0
    db.commit()
    return codigo


def register_user(db: Session, username: str, email: str, password: str, terminos_version: str | None = None):
    existing_user = get_user_by_username(db, username)
    if existing_user:
        return {"error": "El nombre de usuario ya existe"}

    from app.models.user_model import Usuario

    existing_email = db.query(Usuario).filter(Usuario.correo_electronico == email).first()
    if existing_email:
        return {"error": "El correo electrónico ya está registrado"}

    hashed_password = hash_password(password)
    user_data = {
        "username": username,
        "correo_electronico": email,
        "password_hash": hashed_password,
        "activo": True,
        "verificado": False,
    }
    if terminos_version:
        user_data["terminos_version"] = terminos_version
        user_data["terminos_aceptados_en"] = datetime.now(UTC).replace(tzinfo=None)
    user = create_user(db, user_data)
    # El enlace del correo se conserva (algunas personas prefieren darle
    # clic en vez de teclear un código), y ADEMÁS se genera el código de 6
    # dígitos que el frontend pide justo después de crear la cuenta (ver
    # RegisterModal.tsx) -- los dos viajan en el mismo correo de
    # verificación (ver send_verification_email en mail.py).
    verification_token = create_verification_token(email)
    verification_code = _generar_y_guardar_codigo(db, user)

    db.execute(text("INSERT INTO usuarios_roles (id_usuario, id_rol) VALUES (:uid, 2)"), {"uid": user.id_usuario})
    db.commit()

    # El frontend (Register.tsx / RegisterModal.tsx) crea y vincula el perfil
    # de cliente en la MISMA operación, justo después del registro. Esos
    # endpoints exigen sesión (Authorization: Bearer), así que este registro
    # debe devolver un access_token — auto-login del usuario recién creado —
    # para que el flujo no falle con 401. El rol por defecto es "cliente"
    # (id_rol 2). Un access token expira en minutos, de modo que no deja la
    # cuenta abierta indefinidamente; la verificación de email sigue aparte.
    access_token = create_access_token(data={"sub": str(user.id_usuario), "roles": ["cliente"]})

    return {
        "user_id": user.id_usuario,
        "access_token": access_token,
        "token_type": "bearer",
        "verification_token": verification_token,
        "verification_code": verification_code,
        "email": email,
    }


def regenerar_codigo_verificacion(db: Session, user) -> str:
    """Usado por /auth/resend-verification -- mismo helper que register_user,
    expuesto aparte para no duplicar la lógica de hasheo/expiración/reseteo
    de intentos."""
    return _generar_y_guardar_codigo(db, user)


def _emitir_tokens_sesion(db: Session, user) -> dict:
    """Genera el mismo payload de sesión que login_user (tokens + datos del
    usuario) -- se reutiliza tanto cuando el código recién se confirma como
    cuando la cuenta ya estaba verificada de antes (ver verify_email_code),
    para que el frontend maneje un solo formato de respuesta exitosa."""
    rows = db.execute(
        text("""
            SELECT r.nombre_rol
            FROM roles r
            JOIN usuarios_roles ur ON r.id_rol = ur.id_rol
            WHERE ur.id_usuario = :uid
        """),
        {"uid": user.id_usuario},
    ).fetchall()
    roles = [r.nombre_rol for r in rows]

    tokens = generate_token_pair(user.id_usuario, roles=roles)
    tokens.update(
        {
            "user_id": user.id_usuario,
            "username": user.username,
            "id_cliente": user.id_cliente,
            # Igual que id_cliente: se manda explicito para que
            # AuthContext.usuario lo tenga desde el login (lo necesita el
            # panel recortado del empleado para pedir sus propios KPIs,
            # ver GET /api/dashboard/resumen-empleado). None para
            # cualquier cuenta sin perfil de empleado vinculado.
            "id_empleado": user.id_empleado,
            "roles": roles,
            "foto_perfil": user.foto_perfil,
            "verificado": True,
            "activo": user.activo,
        }
    )
    return tokens


def verify_email_code(db: Session, correo_electronico: str, codigo: str):
    """Verifica la cuenta a partir del código de 6 dígitos (en vez del
    token del enlace, ver verify_user_email). Devuelve tokens completos de
    sesión en éxito -- igual que login_user -- para que el frontend pueda
    loguear a la persona de inmediato apenas confirma el código, sin
    pedirle que además inicie sesión a mano."""
    from app.models.user_model import Usuario

    user = db.query(Usuario).filter(Usuario.correo_electronico == correo_electronico).first()
    # Mismo criterio de privacidad que /forgot-password y
    # /resend-verification: no se distingue "correo no existe" de "código
    # incorrecto" en el mensaje, para no dejar enumerar correos registrados.
    error_generico = {"error": "Código incorrecto o expirado"}

    if not user:
        return error_generico

    # Se revisa ANTES que el hash del código: una vez verificada, la cuenta
    # limpia su codigo_verificacion_hash (ver más abajo), así que si este
    # chequeo fuera después, un segundo clic en "Verificar" (o verificar
    # por el enlace del correo y luego volver al modal) siempre caería en
    # el error genérico de abajo en vez de loguear a la persona igual.
    if user.verificado:
        return _emitir_tokens_sesion(db, user)

    if not user.codigo_verificacion_hash:
        return error_generico

    if user.intentos_verificacion >= CODIGO_VERIFICACION_MAX_INTENTOS:
        return {"error": "Demasiados intentos. Pide un código nuevo."}

    expira = user.codigo_verificacion_expira
    if expira and expira.tzinfo is None:
        # SQLite/algunos drivers devuelven el TIMESTAMP sin tzinfo aunque se
        # guardó en UTC -- se le pone UTC explícito para poder comparar
        # contra datetime.now(UTC) sin un TypeError de "naive vs aware".
        expira = expira.replace(tzinfo=UTC)

    if not expira or expira < datetime.now(UTC):
        return {"error": "El código expiró. Pide uno nuevo."}

    if not verify_verification_code(codigo, user.codigo_verificacion_hash):
        user.intentos_verificacion += 1
        db.commit()
        intentos_restantes = CODIGO_VERIFICACION_MAX_INTENTOS - user.intentos_verificacion
        if intentos_restantes <= 0:
            return {"error": "Demasiados intentos. Pide un código nuevo."}
        return {"error": f"Código incorrecto. Te quedan {intentos_restantes} intento(s)."}

    user.verificado = True
    user.codigo_verificacion_hash = None
    user.codigo_verificacion_expira = None
    user.intentos_verificacion = 0
    db.commit()

    return _emitir_tokens_sesion(db, user)


def login_user(db: Session, correo_electronico: str, password: str):
    """
    Autentica un usuario por su correo electrónico (único método de login
    soportado: nunca por username) y retorna tokens JWT + datos del usuario.
    """
    user = get_user_by_email(db, correo_electronico)
    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    if not user.verificado:
        return {"error": "Por favor verifica tu email antes de continuar"}

    # Antes no se revisaba: un admin podía "desactivar" un usuario
    # (activo=False, ver PUT /api/usuarios/{id}) y ese usuario podía seguir
    # iniciando sesión con normalidad, porque login_user solo validaba
    # contraseña y verificado. La desactivación quedaba sin efecto real.
    if not user.activo:
        return {"error": "Esta cuenta está desactivada. Contacta al administrador."}

    # Última vez que esta cuenta inició sesión con éxito -- antes esta
    # columna (Usuario.ultimo_login, ver user_model.py) nunca se actualizaba,
    # así que quedaba NULL para siempre y no servía de nada en el panel de
    # admin (ver "más información" pedido para ModuleUsuarios.tsx). Se marca
    # aquí, después de pasar todas las validaciones (contraseña, verificado,
    # activo), para que solo cuente como "acceso" un login que de verdad tuvo
    # éxito.
    user.ultimo_login = func.now()
    db.commit()

    # Obtener roles con SQL directo (sin modelos ORM para roles/usuarios_roles)
    rows = db.execute(
        text("""
            SELECT r.nombre_rol
            FROM roles r
            JOIN usuarios_roles ur ON r.id_rol = ur.id_rol
            WHERE ur.id_usuario = :uid
        """),
        {"uid": user.id_usuario},
    ).fetchall()
    roles = [r.nombre_rol for r in rows]

    tokens = generate_token_pair(user.id_usuario, roles=roles)
    tokens.update(
        {
            "user_id": user.id_usuario,
            "username": user.username,
            "id_cliente": user.id_cliente,
            # Igual que id_cliente: se manda explicito para que
            # AuthContext.usuario lo tenga desde el login (lo necesita el
            # panel recortado del empleado para pedir sus propios KPIs,
            # ver GET /api/dashboard/resumen-empleado). None para
            # cualquier cuenta sin perfil de empleado vinculado.
            "id_empleado": user.id_empleado,
            "roles": roles,
            "foto_perfil": user.foto_perfil,
            # Ya se validaron arriba (if not user.verificado / if not
            # user.activo) antes de llegar aquí -- se devuelven explícitos
            # en vez de dejar que el frontend los infiera, para que
            # AuthContext.usuario los tenga siempre definidos tras un
            # login real (nunca en undefined "se desconoce").
            "verificado": True,
            "activo": True,
        }
    )
    return tokens


def verify_user_email(db: Session, token: str):
    from app.models.user_model import Usuario

    email = verify_verification_token(token)
    if not email:
        return {"error": "Token inválido o expirado"}

    user = db.query(Usuario).filter(Usuario.correo_electronico == email).first()
    if not user:
        return {"error": "Usuario no encontrado"}

    if user.verificado:
        return {"message": "El email ya estaba verificado"}

    user.verificado = True
    db.commit()

    return {
        "message": "Email verificado exitosamente",
        "email": email,
        "user_id": user.id_usuario,
    }
