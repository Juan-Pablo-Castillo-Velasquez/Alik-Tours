import asyncio
import os
import threading

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.mail import send_password_reset_email, send_verification_email
from app.core.security import create_verification_token, hash_password, verify_verification_token  # ← agrega
from app.schemas.user_schema import (
    PasswordResetConfirm,
    PasswordResetRequest,
    UsuarioCreate,
    UsuarioLogin,
)
from app.services.auth_service import (
    login_user,
    regenerar_codigo_verificacion,
    register_user,
    verify_email_code,
    verify_user_email,
)

# URL del frontend real, para los links de verificación/reset que se
# mandan por correo — antes estaba fija en "http://localhost:5173", así
# que cualquier correo real (fuera de dev) llevaba un link roto. Con
# FRONTEND_URL sin definir en el entorno, sigue apuntando a localhost
# (mismo comportamiento de siempre en dev).
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

router = APIRouter(prefix="/auth", tags=["Auth"])


def send_email_in_thread(email: str, token: str, username: str | None = None, codigo: str | None = None):
    """Corre en un hilo aparte para no bloquear la respuesta de /register
    mientras se envía el correo de verificación.

    Antes reimplementaba su propio envío SMTP crudo (sin STARTTLS ni
    login) -- funcionaba "por casualidad" contra Mailpit (que no exige
    autenticación) pero se quedaba callado, sin enviar nada, contra
    cualquier proveedor real (Gmail, Brevo, etc.) que sí exige TLS +
    credenciales. Ahora reutiliza send_verification_email() de
    app/core/mail.py, que ya maneja STARTTLS/SSL y login según
    MAIL_STARTTLS/MAIL_SSL_TLS/MAIL_USERNAME/MAIL_PASSWORD -- cambiar de
    Mailpit a un servidor real es solo cuestión de env vars, sin tocar
    este código de nuevo. `username` es opcional, solo para personalizar
    el saludo del correo (ver send_verification_email). `codigo` (nuevo)
    es el código de 6 dígitos que se muestra en el mismo correo, para el
    paso de verificación dentro del propio modal (ver RegisterModal.tsx)."""
    try:
        # send_verification_email() ya atrapa sus propios errores de SMTP
        # y devuelve False en vez de lanzar excepción (ver send_email() en
        # app/core/mail.py) -- antes este código imprimía "Email enviado"
        # sin revisar ese resultado, así que un envío fallido (ej. Gmail
        # rechazando la conexión) quedaba registrado en los logs como si
        # hubiera funcionado, ocultando el problema real.
        enviado = asyncio.run(send_verification_email(email, token, FRONTEND_URL, username, codigo))
        if enviado:
            print(f"[BACKGROUND] Email enviado a {email}")
        else:
            print(f"[BACKGROUND] No se pudo enviar el email a {email} (ver 'Error al enviar email' arriba)")
    except Exception as e:
        print(f"[BACKGROUND] Error: {str(e)}")


@router.post("/register", response_model=dict, status_code=201)
def register(data: UsuarioCreate, db: Session = Depends(get_db)):
    result = register_user(
        db, data.username, data.correo_electronico, data.password, terminos_version=data.terminos_version
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    verification_token = result.get("verification_token")
    verification_code = result.get("verification_code")
    email = result.get("email")

    try:
        thread = threading.Thread(
            target=send_email_in_thread,
            args=(email, verification_token, data.username, verification_code),
            daemon=True,
        )
        thread.start()
    except Exception as e:
        print(f"[ERROR] {str(e)}")

    return {
        "message": "Usuario registrado exitosamente. Revisa tu correo para verificar tu cuenta.",
        "user_id": result.get("user_id"),
        "email": email,
        "access_token": result.get("access_token"),
        "token_type": "bearer",
    }


@router.post("/login", response_model=dict)
def login(data: UsuarioLogin, db: Session = Depends(get_db)):
    tokens = login_user(db, data.username, data.password)
    if not tokens:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if isinstance(tokens, dict) and "error" in tokens:
        raise HTTPException(status_code=403, detail=tokens["error"])
    return tokens


@router.post("/verify-email", response_model=dict)
def verify_email(token: str, db: Session = Depends(get_db)):
    result = verify_user_email(db, token)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


class ResendVerificationRequest(BaseModel):
    correo_electronico: str


@router.post("/resend-verification", response_model=dict)
def resend_verification(data: ResendVerificationRequest, db: Session = Depends(get_db)):
    """
    Reenvía el correo de verificación. Antes, si el primer correo no
    llegaba (spam, o el bug de credenciales de Gmail encontrado en esta
    sesión), la única salida para el usuario era registrarse de nuevo --
    lo cual falla con "correo ya registrado". `/register` nunca expone el
    verification_token al frontend (a propósito: si lo hiciera, cualquiera
    podría "verificarse" sin abrir su correo, que es justo lo que este
    flujo existe para exigir) -- por eso el único botón útil en la pantalla
    de éxito del registro es este, para pedir un envío nuevo.

    Mismo criterio de privacidad que /forgot-password: la respuesta nunca
    revela si el correo existe ni si ya estaba verificado, para no dejar
    enumerar correos registrados desde este endpoint público.
    """
    from app.models.user_model import Usuario

    user = db.query(Usuario).filter(Usuario.correo_electronico == data.correo_electronico).first()
    if user and not user.verificado:
        token = create_verification_token(user.correo_electronico)
        # Código nuevo en cada reenvío (mismo helper que usa el registro
        # inicial) -- también reinicia el contador de intentos fallidos, así
        # que pedir un código nuevo es la salida real cuando alguien se
        # equivoca varias veces tecleándolo (ver verify_email_code).
        codigo = regenerar_codigo_verificacion(db, user)
        try:
            thread = threading.Thread(
                target=send_email_in_thread,
                args=(user.correo_electronico, token, user.username, codigo),
                daemon=True,
            )
            thread.start()
        except Exception as e:
            print(f"[ERROR] {str(e)}")

    return {"message": "Si el correo existe y aún no ha sido verificado, te reenviamos el código de verificación."}


class VerifyEmailCodeRequest(BaseModel):
    correo_electronico: str
    codigo: str


@router.post("/verify-email-code", response_model=dict)
def verify_email_code_endpoint(data: VerifyEmailCodeRequest, db: Session = Depends(get_db)):
    """
    Verifica la cuenta con el código de 6 dígitos que llegó en el mismo
    correo que el enlace (ver send_verification_email) -- pensado para
    completarse sin salir del modal de registro (RegisterModal.tsx). A
    diferencia de /verify-email (por token, en la página aparte /verify),
    esta sí devuelve tokens de sesión completos en éxito, para dejar a la
    persona logueada de inmediato apenas confirma el código.
    """
    result = verify_email_code(db, data.correo_electronico, data.codigo)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/forgot-password", response_model=dict)
async def forgot_password(data: PasswordResetRequest, db: Session = Depends(get_db)):
    from app.models.user_model import Usuario

    user = db.query(Usuario).filter(Usuario.correo_electronico == data.correo_electronico).first()

    if user:
        token = create_verification_token(user.correo_electronico)
        await send_password_reset_email(
            email=user.correo_electronico,
            reset_token=token,
            base_url=FRONTEND_URL,
        )

    return {"message": "Si el correo existe, recibirás un enlace para restablecer tu contraseña"}


@router.post("/reset-password", response_model=dict)
def reset_password_endpoint(data: PasswordResetConfirm, db: Session = Depends(get_db)):
    from app.models.user_model import Usuario

    email = verify_verification_token(data.token)
    if not email:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")

    user = db.query(Usuario).filter(Usuario.correo_electronico == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.password_hash = hash_password(data.new_password)
    db.commit()

    return {"message": "Contraseña actualizada exitosamente"}
