"""
Módulo de seguridad: autenticación JWT, hashing de contraseñas y autorización.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import Header, HTTPException
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(days=7)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def get_user_from_token(token: str) -> int | None:
    payload = decode_token(token)
    if payload is None:
        return None
    # El refresh token tiene la misma clave de firma pero NUNCA debe servir
    # como token de acceso: dura 7 días (contra 30 min del de acceso). Si
    # no se distingue el tipo, un refresh token robado da acceso a la cuenta
    # durante toda una semana. Solo los tokens marcados como "access" valen
    # aquí (Fase H-02 del plan de mejora).
    if payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    try:
        return int(user_id)
    except (ValueError, TypeError):
        return None


def generate_token_pair(user_id: int, roles: list[str] | None = None) -> dict:
    """
    Genera access + refresh token.
    Ahora incluye los roles en el payload del JWT.

    Args:
        user_id: ID del usuario
        roles: Lista de nombres de rol (ej. ['admin', 'cliente'])

    Returns:
        Dict con access_token, refresh_token y token_type
    """
    # Nunca uses una lista como valor por defecto (bug clásico de Python: el
    # mismo objeto se reutilizaría en todas las llamadas que no pasen roles).
    if roles is None:
        roles = []
    payload = {
        "sub": str(user_id),
        "roles": roles,  # ← nuevo campo
    }
    access_token = create_access_token(data=payload)
    # El refresh token también lleva los roles, para que al renovar una
    # sesión de admin (que decodifica el claim `roles` del JWT) no se
    # pierda el privilegio (Fase H-02 del plan de mejora).
    refresh_token = create_refresh_token(data={"sub": str(user_id), "roles": roles})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def create_verification_token(email: str) -> str:
    to_encode = {"email": email, "type": "verification"}
    expire = datetime.now(UTC) + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_verification_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "verification":
            return None
        return payload.get("email")
    except JWTError:
        return None


def _huella_password(password_hash: str) -> str:
    return hashlib.sha256((password_hash or "").encode()).hexdigest()[:16]


def create_password_reset_token(email: str, password_hash: str) -> str:
    """Token del enlace "olvidé mi contraseña" (hallazgo de la semana 7 del
    bootcamp). Antes se reutilizaba create_verification_token, así que:
    1) el enlace de "verifica tu correo" también servía para cambiar la
       contraseña (mismo tipo de token), y
    2) el enlace servía varias veces durante 24 h.
    Ahora tiene su propio tipo, vence en 1 hora y lleva una huella del hash
    actual de la contraseña: en cuanto la contraseña cambia, la huella deja
    de coincidir y el enlace ya no sirve (un solo uso)."""
    to_encode = {
        "email": email,
        "type": "password_reset",
        "pwd": _huella_password(password_hash),
        "exp": datetime.now(UTC) + timedelta(hours=1),
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_password_reset_token(token: str, password_hash_actual_de) -> str | None:
    """Devuelve el correo si el token es de recuperación, no venció y la
    contraseña no ha cambiado desde que se emitió. `password_hash_actual_de`
    recibe el correo y devuelve el hash guardado hoy (o None)."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    if payload.get("type") != "password_reset":
        return None
    email = payload.get("email")
    hash_actual = password_hash_actual_de(email)
    if hash_actual is None or payload.get("pwd") != _huella_password(hash_actual):
        return None
    return email


def generate_verification_code() -> str:
    """Código de 6 dígitos para verificar la cuenta escribiéndolo de vuelta
    en el formulario, sin depender de abrir el enlace del correo en el
    mismo dispositivo (ver a54ac89a1f9b_agregar_codigo_verificacion.py).
    `secrets.randbelow` (no `random`) porque es criptográficamente seguro
    -- el mismo criterio que ya se sigue para tokens de sesión."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_verification_code(codigo: str) -> str:
    """Reutiliza el mismo CryptContext (bcrypt) que las contraseñas -- el
    código nunca se guarda en texto plano en la base de datos, igual que
    password_hash."""
    return pwd_context.hash(codigo)


def verify_verification_code(codigo: str, codigo_hash: str) -> bool:
    return pwd_context.verify(codigo, codigo_hash)


def get_current_user(authorization: str | None = None) -> int | None:
    from fastapi import HTTPException

    if not authorization:
        raise HTTPException(status_code=401, detail="No autenticado")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Token inválido")
    user_id = get_user_from_token(parts[1])
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token expirado o inválido")
    return user_id


def require_admin(authorization: str | None = Header(None)) -> int:
    """
    Dependency reutilizable para endpoints exclusivos de administrador:
    exige un JWT válido cuyo claim `roles` incluya "admin". Se usa como
    `Depends(require_admin)` en las rutas de administración (usuarios/roles,
    solicitudes de cancelación, etc).
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="No autenticado")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Token inválido")

    payload = decode_token(parts[1])
    if payload is None:
        raise HTTPException(status_code=401, detail="Token expirado o inválido")

    roles = payload.get("roles") or []
    if "admin" not in roles:
        raise HTTPException(status_code=403, detail="Requiere rol de administrador")

    return int(payload["sub"])


def require_empleado(authorization: str | None = Header(None)) -> int:
    """
    Dependency reutilizable para endpoints que debe poder usar tanto un
    administrador como un empleado ("asesor") -- exige un JWT válido cuyo
    claim `roles` incluya "admin" O "empleado". Se usa en las rutas que
    alimentan el panel recortado del empleado (dashboard, reservas, pagos,
    mensajes, solicitudes de cancelación) para que ese panel pueda
    reutilizar exactamente los mismos endpoints que ya usa el admin, sin
    duplicar rutas por rol.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="No autenticado")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Token inválido")

    payload = decode_token(parts[1])
    if payload is None:
        raise HTTPException(status_code=401, detail="Token expirado o inválido")

    roles = payload.get("roles") or []
    if "admin" not in roles and "empleado" not in roles:
        raise HTTPException(status_code=403, detail="Requiere rol de administrador o empleado")

    return int(payload["sub"])
