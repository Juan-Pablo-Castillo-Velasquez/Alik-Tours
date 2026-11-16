import asyncio
import threading

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.mail import send_contact_email
from app.services.notificacion_service import crear_notificacion

router = APIRouter(prefix="/api/contacto", tags=["Contacto"])


class ContactoRequest(BaseModel):
    # Quita espacios al inicio y al final: "   " ya no pasa como dato válido.
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(..., min_length=2, max_length=100)
    correo: EmailStr
    asunto: str = Field(..., min_length=3, max_length=150)
    mensaje: str = Field(..., min_length=10, max_length=2000)


def _enviar_contacto_en_hilo(nombre: str, correo: str, asunto: str, mensaje: str) -> None:
    """Corre en un hilo aparte, igual que send_email_in_thread() en
    auth_route.py -- y por el mismo motivo. send_contact_email() hace DOS
    envíos SMTP reales y seguidos (copia a soporte + confirmación al
    remitente), cada uno con hasta 10s de timeout de socket (ver
    send_email() en mail.py). Si Gmail va lento, o hay algún tropiezo de
    red entre Render y smtp.gmail.com, esos dos envíos sumados pueden
    superar el límite de tiempo que el proxy de Render le da a una
    petición HTTP -- y cuando eso pasa, Render corta la conexión y
    responde con una página de error DE PLATAFORMA, sin ninguna cabecera
    CORS (porque esa respuesta nunca la generó nuestra app/CORSMiddleware,
    la generó el proxy). El navegador reporta eso como "bloqueado por
    CORS policy", aunque el origen sí esté bien permitido en cors.py --
    se confirmó comparando con /api/reservas (que no manda correo y
    siempre responde con sus cabeceras intactas, incluso en un 409).

    Antes esto se esperaba (`await send_contact_email(...)`) dentro de la
    misma petición HTTP del formulario de contacto, así que quien
    escribía quedaba esperando esos dos correos completos antes de
    recibir cualquier respuesta -- y en el peor caso, ni eso: la petición
    se caía por timeout antes de que nuestra app alcanzara a responder
    nada."""
    try:
        enviado = asyncio.run(send_contact_email(nombre, correo, asunto, mensaje))
        if enviado:
            print(f"[BACKGROUND] Confirmación de contacto enviada a {correo}")
        else:
            print(
                f"[BACKGROUND] No se pudo enviar la confirmación de contacto a {correo} (ver 'Error al enviar email' arriba)"
            )
    except Exception as e:
        print(f"[BACKGROUND] Error enviando contacto: {str(e)}")


@router.post("")
async def enviar_contacto(data: ContactoRequest, db: Session = Depends(get_db)):
    # El mensaje queda registrado como notificación real dentro de la
    # plataforma primero (ver ModuleNotificaciones) -- esto es lo único que
    # de verdad garantiza que soporte se entere, sin depender de que un
    # correo llegue (y ahora, ver más abajo, sin depender de que ese correo
    # sea RÁPIDO). Antes esto solo pasaba SI el correo se enviaba bien
    # (`if not enviado: raise ...` cortaba antes de llegar aquí), así que
    # un correo perdido o lento por Gmail (transitorio, no significa que
    # el formulario esté roto) también se llevaba consigo el registro del
    # mensaje.
    crear_notificacion(
        db,
        tipo="contacto",
        titulo=f"Nuevo mensaje de contacto: {data.asunto}",
        mensaje=f"{data.nombre} ({data.correo}): {data.mensaje}",
    )

    # El correo (copia a soporte + confirmación al remitente) ya no se
    # espera dentro de esta petición -- mismo patrón que ya usa
    # /auth/register (ver send_email_in_thread en auth_route.py). Antes
    # se hacía `await send_contact_email(...)` justo aquí: son dos envíos
    # SMTP reales y seguidos, y si Gmail o la red de Render tardan, la
    # petición completa queda colgada hasta que el proxy de Render la
    # corta -- esa respuesta cortada llega sin cabeceras CORS y el
    # navegador la muestra como error de CORS, aunque el origen esté bien
    # permitido (ver _enviar_contacto_en_hilo arriba). Con el hilo aparte,
    # la respuesta HTTP sale de inmediato apenas la notificación queda
    # guardada, y los correos se mandan después, sin que nadie los espere.
    try:
        thread = threading.Thread(
            target=_enviar_contacto_en_hilo,
            args=(data.nombre, data.correo, data.asunto, data.mensaje),
            daemon=True,
        )
        thread.start()
    except Exception as e:
        print(f"[ERROR] {str(e)}")

    return {"ok": True, "message": "Mensaje enviado correctamente"}
