"""
Ejemplos de uso de los módulos security.py y mail.py en FastAPI routes.

Este archivo sirve como referencia para implementar autenticación y
envío de emails en las rutas de la aplicación.
"""


# Este es un archivo de referencia, no es una ruta activa

# ============================================================================
# EJEMPLO 1: Registro de usuario con email de bienvenida
# ============================================================================
"""
@router.post("/auth/register")
async def register(username: str, email: str, password: str, db: Session = Depends(get_db)):
    '''
    Registro de nuevo usuario
    '''
    # Verificar si el usuario ya existe
    user = db.query(User).filter(User.email == email).first()
    if user:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    # Hashear contraseña
    hashed_password = hash_password(password)
    
    # Crear usuario en BD
    new_user = User(
        username=username,
        email=email,
        password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Enviar email de bienvenida
    await send_welcome_email(email, username)
    
    # Generar tokens
    tokens = generate_token_pair(new_user.id)
    
    return {
        "message": "Usuario registrado exitosamente",
        "user_id": new_user.id,
        **tokens
    }
"""

# ============================================================================
# EJEMPLO 2: Login con generación de tokens
# ============================================================================
"""
@router.post("/auth/login")
async def login(email: str, password: str, db: Session = Depends(get_db)):
    '''
    Login de usuario
    '''
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Verificar contraseña
    if not verify_password(password, user.password):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Generar tokens
    tokens = generate_token_pair(user.id)
    
    return tokens
"""

# ============================================================================
# EJEMPLO 3: Endpoint protegido que requiere token
# ============================================================================
"""
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    '''
    Dependencia para obtener el usuario actual desde el token
    '''
    user_id = get_user_from_token(token)
    
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return user


@router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    '''
    Obtener información del usuario autenticado
    '''
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email
    }
"""

# ============================================================================
# EJEMPLO 4: Enviar email de verificación
# ============================================================================
"""
@router.post("/auth/send-verification")
async def send_verification(email: str, db: Session = Depends(get_db)):
    '''
    Enviar email de verificación
    '''
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Crear token de verificación válido por 24 horas
    verification_token = create_access_token(
        data={"sub": str(user.id), "type": "verification"},
        expires_delta=timedelta(hours=24)
    )
    
    # Enviar email
    success = await send_verification_email(email, verification_token)
    
    if not success:
        raise HTTPException(status_code=500, detail="Error al enviar email")
    
    return {"message": "Email de verificación enviado"}
"""

# ============================================================================
# EJEMPLO 5: Restablecer contraseña
# ============================================================================
"""
@router.post("/auth/forgot-password")
async def forgot_password(email: str, db: Session = Depends(get_db)):
    '''
    Solicitar reset de contraseña
    '''
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # No revelar si el usuario existe por seguridad
        return {"message": "Si el email existe, recibirá instrucciones"}
    
    # Crear token de reset válido por 1 hora
    reset_token = create_access_token(
        data={"sub": str(user.id), "type": "password_reset"},
        expires_delta=timedelta(hours=1)
    )
    
    # Enviar email
    await send_password_reset_email(email, reset_token)
    
    return {"message": "Si el email existe, recibirá instrucciones"}


@router.post("/auth/reset-password")
async def reset_password(token: str, new_password: str, db: Session = Depends(get_db)):
    '''
    Restablecer contraseña con token
    '''
    payload = decode_token(token)
    
    if not payload or payload.get("type") != "password_reset":
        raise HTTPException(status_code=401, detail="Token inválido")
    
    user_id = get_user_from_token(token)
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Actualizar contraseña
    user.password = hash_password(new_password)
    db.commit()
    
    return {"message": "Contraseña actualizada exitosamente"}
"""

# ============================================================================
# EJEMPLO 6: Crear reserva y enviar confirmación
# ============================================================================
"""
@router.post("/reservas/crear")
async def create_reservation(
    hotel_id: int,
    check_in: str,
    check_out: str,
    total_price: float,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    '''
    Crear nueva reserva y enviar confirmación por email
    '''
    hotel = db.query(Hotel).filter(Hotel.id == hotel_id).first()
    
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel no encontrado")
    
    # Crear reserva
    new_reservation = Reservation(
        user_id=current_user.id,
        hotel_id=hotel_id,
        check_in=check_in,
        check_out=check_out,
        total_price=total_price,
        status="confirmada"
    )
    db.add(new_reservation)
    db.commit()
    db.refresh(new_reservation)
    
    # Enviar email de confirmación
    await send_reservation_confirmation(
        email=current_user.email,
        reservation_id=new_reservation.id,
        hotel_name=hotel.nombre,
        check_in=check_in,
        check_out=check_out,
        total_price=total_price,
        guest_name=current_user.username
    )
    
    return {
        "message": "Reserva creada exitosamente",
        "reservation_id": new_reservation.id
    }
"""

# ============================================================================
# EJEMPLO 7: Cancelar reserva y enviar email
# ============================================================================
"""
@router.delete("/reservas/{reservation_id}")
async def cancel_reservation(
    reservation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    '''
    Cancelar reserva y enviar confirmación
    '''
    reservation = db.query(Reservation).filter(
        Reservation.id == reservation_id,
        Reservation.user_id == current_user.id
    ).first()
    
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    
    # Calcular reembolso (ej: 80% del total)
    refund_amount = reservation.total_price * 0.8
    
    # Cancelar reserva
    reservation.status = "cancelada"
    db.commit()
    
    # Enviar email de cancelación
    await send_cancellation_email(
        email=current_user.email,
        reservation_id=reservation.id,
        guest_name=current_user.username,
        refund_amount=refund_amount
    )
    
    return {
        "message": "Reserva cancelada",
        "refund": refund_amount
    }
"""

# ============================================================================
# FUNCIONES AUXILIARES NECESARIAS
# ============================================================================
"""
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from fastapi import Header

security = HTTPBearer()

async def oauth2_scheme(credentials: HTTPAuthCredentials = Depends(security)):
    return credentials.credentials
"""

print("""
RESUMEN DE USO:
==============

1. SEGURIDAD:
   - hash_password(pwd) -> str          # Hashear contraseña
   - verify_password(pwd, hash) -> bool # Verificar contraseña
   - create_access_token(data) -> str   # Crear token JWT
   - generate_token_pair(user_id)       # Crear par de tokens
   - get_user_from_token(token) -> int  # Extraer user_id del token

2. EMAIL:
   - send_welcome_email(email, name)
   - send_verification_email(email, token)
   - send_password_reset_email(email, token)
   - send_reservation_confirmation(email, id, hotel, dates, price, name)
   - send_cancellation_email(email, id, name, refund)

IMPORTAR EN RUTAS:
==================
from app.core.security import hash_password, verify_password, get_user_from_token, ...
from app.core.mail import send_welcome_email, send_verification_email, ...
from app.core.database import get_db
from fastapi import Depends

CONFIGURAR EN MAIN.PY:
=====================
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
# app.include_router(auth_router)
# app.include_router(reservas_router)
""")
