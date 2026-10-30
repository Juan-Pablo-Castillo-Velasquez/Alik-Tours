"""
Módulo de correo electrónico - Envío de emails con SMTP directo, o vía la
API HTTP de Brevo cuando BREVO_API_KEY está definida (ver send_email()).
Desarrollo: Mailpit (sin TLS, sin autenticación) -- siempre por SMTP,
BREVO_API_KEY no se define en dev.
Producción: cualquier proveedor SMTP real (Brevo, Gmail, etc.) vía
variables de entorno -- ver settings.MAIL_*.

Hallazgo real de esta sesión, con Render como hosting del backend: los
servicios web gratis de Render bloquean el tráfico saliente a los puertos
SMTP (25, 465, 587) desde el 26 de septiembre de 2025 -- confirmado en su
propio changelog (render.com/changelog/free-web-services-will-no-longer-
allow-outbound-traffic-to-smtp-ports). No es un bug de este proyecto ni
de Brevo: cualquier SMTP (Brevo, Gmail, SendGrid...) queda inalcanzable
desde un Render free, sin importar las credenciales. La salida sin pagar
nada ni depender de un dominio propio es la API HTTP de Brevo (HTTPS
puerto 443, nunca bloqueado) en vez de su relay SMTP -- mismo remitente ya
verificado, mismo proveedor, sin dar de alta ningún servicio nuevo. Se
activa sola si BREVO_API_KEY está definida; si no, send_email() sigue
usando SMTP exactamente como siempre (Mailpit en dev, o cualquier SMTP
real en un host que sí deje salir por esos puertos -- Railway, un VPS, o
un Render de pago).
"""

import asyncio
import contextlib
import html
import json
import os
import smtplib
import socket
import urllib.error
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

# Paleta de marca Alik Tours (la misma que --primary/--gold en theme.css,
# ver comentario "BRAND (GRANATE AGENCIA)") -- se repite como literales
# hex en vez de variables CSS porque los clientes de correo (Gmail,
# Outlook, Apple Mail...) no soportan `var(--x)` de forma confiable.
_GARNET = "#6e1832"
_GOLD = "#b8912e"
_BG = "#fbf8f6"
_CARD_ALT_BG = "#f5f1ee"
_HEADING = "#241a1f"
_BODY_TEXT = "#4a3f41"
_MUTED = "#73686a"
_MUTED_LIGHT = "#a89a9d"
_FOOTER_TEXT = "#8a7d7f"
_SUCCESS = "#2f7d52"
_SUCCESS_BG = "#eef7f1"
_DANGER = "#a63a33"
_DANGER_BG = "#fbeceb"
_WARNING_BG = "#fbf3e2"
_WARNING_TEXT = "#7a5f1e"


@contextlib.contextmanager
def _forzar_dns_ipv4():
    """Fuerza que socket.getaddrinfo() solo devuelva direcciones IPv4
    mientras el bloque `with` está activo.

    Hallazgo real en producción (Render): enviar por smtp.gmail.com
    fallaba al instante con "[Errno 101] Network is unreachable" -- eso
    NO es Gmail rechazando la conexión ni Render bloqueando el puerto
    587 (eso daría timeout, no "unreachable"), es que smtp.gmail.com
    resuelve a IPv4 y a IPv6, y el contenedor de Render no tiene salida
    IPv6 funcional -- si getaddrinfo() devuelve la dirección IPv6
    primero, la conexión muere de inmediato antes de intentar la IPv4
    que sí funcionaría. Forzar solo A records (IPv4) evita el problema
    sin tocar el hostname (sigue siendo el hostname real, ej.
    "smtp-relay.brevo.com", para efectos de la verificación TLS del
    certificado en starttls()) -- se deja activo sin importar el
    proveedor SMTP configurado, porque el problema es de la red de
    Render, no de un proveedor en particular."""
    original = socket.getaddrinfo

    def _solo_ipv4(host, port, family=0, type=0, proto=0, flags=0):
        return original(host, port, socket.AF_INET, type, proto, flags)

    socket.getaddrinfo = _solo_ipv4
    try:
        yield
    finally:
        socket.getaddrinfo = original


def _enviar_via_brevo_api(email: str, subject: str, body: str, html_body: str | None) -> bool:
    """
    Envía un correo con la API HTTP de Brevo (https://api.brevo.com/v3/smtp/email)
    en vez de su relay SMTP -- ver el comentario del encabezado de este
    archivo sobre por qué hace falta en Render.

    Usa urllib.request (stdlib) a propósito, para no agregar una
    dependencia nueva a requirements.txt solo por un POST con JSON y un
    header de auth -- no hace falta nada más elaborado (sesiones,
    reintentos, pool de conexiones) para el volumen de correo de este
    proyecto.

    La API de Brevo solo acepta UN tipo de cuerpo por envío --
    `htmlContent`, `textContent` o `templateId`, nunca dos a la vez (a
    diferencia de MIMEMultipart("alternative") en el envío por SMTP, que sí
    manda ambos). Como todos los correos de este archivo ya traen un
    `html_body` bien maquetado, se manda ese; si por algún motivo no
    hubiera HTML, se manda el texto plano como `textContent` en su lugar
    -- ningún llamador de send_email() deja de recibir su correo por esto,
    solo cambia si el cliente de correo del destinatario ve la versión
    HTML o la de texto plano (igual que cualquier otro proveedor que solo
    soporte un tipo de cuerpo).
    """
    payload = {
        "sender": {"name": settings.MAIL_FROM_NAME, "email": settings.MAIL_FROM},
        "to": [{"email": email}],
        "subject": subject,
    }
    if html_body:
        payload["htmlContent"] = html_body
    else:
        payload["textContent"] = body

    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json",
            "accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            # Brevo responde 201 Created en éxito (con un messageId en el
            # cuerpo) -- cualquier 2xx que llegue hasta acá sin lanzar
            # HTTPError se toma como éxito, sin atarse al código exacto.
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as e:
        # El cuerpo del error (ej. remitente no verificado, api-key
        # inválida) es justo lo que hace falta para diagnosticar sin
        # adivinar -- se imprime completo en vez de solo el código.
        detalle = e.read().decode("utf-8", errors="replace")
        print(f"Error al enviar email a {email} vía API de Brevo ({e.code}): {detalle}")
        return False
    except urllib.error.URLError as e:
        print(f"Error de red al enviar email a {email} vía API de Brevo: {e.reason}")
        return False


async def send_email(email: str, subject: str, body: str, html_body: str | None = None) -> bool:
    """
    Envía un email simple o con cuerpo HTML.

    Si BREVO_API_KEY está definida, usa la API HTTP de Brevo (evita el
    bloqueo de puertos SMTP de Render free -- ver encabezado del archivo).
    Si no, usa SMTP directo como siempre (Mailpit en dev, o cualquier
    proveedor SMTP real en un host que sí permita esos puertos).

    Args:
        email: Dirección de correo destino
        subject: Asunto del email
        body: Cuerpo en texto plano
        html_body: Cuerpo en HTML (opcional)

    Returns:
        True si se envió correctamente, False en caso contrario
    """
    if settings.BREVO_API_KEY:
        # urllib.request.urlopen es bloqueante -- se corre en un hilo aparte
        # para no congelar el event loop de FastAPI mientras espera la
        # respuesta HTTP (mismo motivo por el que smtplib más abajo ya
        # corre casi siempre dentro de un threading.Thread propio en los
        # callers, pero acá se cubre también el caso de quien haga
        # `await send_email(...)` directo en una ruta async).
        return await asyncio.to_thread(_enviar_via_brevo_api, email, subject, body, html_body)

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
        msg["To"] = email

        # Siempre adjuntar texto plano primero (fallback)
        msg.attach(MIMEText(body, "plain", "utf-8"))

        # Adjuntar HTML si se provee (tiene prioridad sobre texto plano)
        if html_body:
            msg.attach(MIMEText(html_body, "html", "utf-8"))

        use_ssl = getattr(settings, "MAIL_SSL_TLS", False)
        use_tls = getattr(settings, "MAIL_STARTTLS", False)

        with _forzar_dns_ipv4():
            if use_ssl:
                # Puerto 465 — SSL desde el inicio
                with smtplib.SMTP_SSL(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as server:
                    if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
                        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                    server.sendmail(settings.MAIL_FROM, [email], msg.as_string())
            else:
                # Puerto 587 (STARTTLS) o 1025 (Mailpit sin cifrado)
                with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as server:
                    if use_tls:
                        server.starttls()
                    if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
                        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                    server.sendmail(settings.MAIL_FROM, [email], msg.as_string())

        return True

    except Exception as e:
        print(f"Error al enviar email a {email}: {str(e)}")
        return False


def _email_shell(subject: str, preheader: str, content_html: str) -> str:
    """
    Envuelve el `content_html` de cualquier correo con el mismo header
    (logo + nombre + tagline, fondo granate) y footer de marca -- antes
    cada función de este archivo traía su propia plantilla suelta
    (Arial genérico, colores random como azul #007bff o verde #28a745
    sin relación con la marca), y solo send_verification_email tenía la
    identidad visual real de Alik Tours. Ahora todas comparten esta
    misma "cáscara", así que un cambio de marca futuro se hace en un
    solo lugar.

    `preheader` es el texto oculto que Gmail/Outlook muestran como
    resumen junto al asunto en la bandeja de entrada, antes de abrir el
    correo -- no reemplaza el asunto, lo complementa.
    """
    return f"""
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{subject}</title>
</head>
<body style="margin:0; padding:0; background-color:{_BG}; -webkit-text-size-adjust:100%; text-size-adjust:100%;">
  <div style="display:none; max-height:0; max-width:0; overflow:hidden; opacity:0; font-size:1px; line-height:1px; color:{_BG}; mso-hide:all;">
    {preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{_BG}; border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; border-collapse:collapse; box-shadow:0 4px 24px rgba(110,24,50,0.08);">

          <tr>
            <td style="background-color:{_GARNET}; padding:32px 40px 28px 40px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:14px;" valign="middle">
                    <table role="presentation" width="44" height="44" cellpadding="0" cellspacing="0" border="0" style="width:44px; height:44px; background-color:{_GOLD}; border-radius:12px;">
                      <tr>
                        <td align="center" valign="middle" style="font-family:Georgia,'Times New Roman',serif; font-size:20px; font-weight:700; color:#2e2611; line-height:44px;">A</td>
                      </tr>
                    </table>
                  </td>
                  <td valign="middle" align="left">
                    <div style="font-family:Georgia,'Times New Roman',serif; font-size:24px; font-weight:700; color:#ffffff; letter-spacing:-0.3px; line-height:1.1;">Alik Tours</div>
                    <div style="font-family:Helvetica,Arial,sans-serif; font-size:10px; font-weight:600; color:#e7b9c5; letter-spacing:1.5px; text-transform:uppercase; margin-top:4px;">Agencia de viajes y turismo</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:{_GOLD}; height:4px; line-height:4px; font-size:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="padding:40px 40px 32px 40px; font-family:Helvetica,Arial,sans-serif;">
{content_html}
            </td>
          </tr>

          <tr>
            <td style="background-color:{_CARD_ALT_BG}; padding:24px 40px; text-align:center;">
              <p style="margin:0; font-family:Helvetica,Arial,sans-serif; font-size:12px; color:{_FOOTER_TEXT};">
                Con cariño, el equipo de <strong style="color:{_GARNET};">Alik Tours</strong> ✈️
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    """.strip()


def _boton(texto: str, link: str) -> str:
    """Botón CTA reutilizable (granate, mismo estilo en todos los correos)."""
    return f"""
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color:{_GARNET}; border-radius:10px;">
                    <a href="{link}" target="_blank"
                       style="display:inline-block; padding:14px 36px; font-family:Helvetica,Arial,sans-serif; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;">
                      {texto}
                    </a>
                  </td>
                </tr>
              </table>"""


async def send_welcome_email(
    email: str,
    name: str,
    base_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173"),
) -> bool:
    """
    Envía un email de bienvenida a un nuevo usuario.
    """
    subject = "¡Bienvenido a Alik Tours!"
    nombre_seguro = html.escape(name) if name else ""

    body = f"""
Hola {name},

¡Bienvenido a Alik Tours! Tu cuenta ha sido creada exitosamente.

Ya puedes explorar destinos, armar tu itinerario y reservar hoteles y paquetes desde tu cuenta.

Ingresa aquí: {base_url}/login

Saludos,
El equipo de Alik Tours
    """.strip()

    content_html = f"""
              <h1 style="margin:0 0 16px 0; font-family:Georgia,'Times New Roman',serif; font-size:26px; font-weight:700; color:{_HEADING}; line-height:1.3;">
                ¡Bienvenido a bordo, {nombre_seguro}! 🎉
              </h1>
              <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; color:{_BODY_TEXT};">
                Tu cuenta en <strong style="color:{_GARNET};">Alik Tours</strong> ya está lista. Desde ahora puedes explorar destinos, armar tu itinerario y reservar hoteles y paquetes en minutos.
              </p>
{_boton("Iniciar sesión", f"{base_url}/login")}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #f0e5e8; padding-top:20px;">
                  <p style="margin:0; font-size:13px; line-height:1.6; color:{_MUTED};">
                    🏨 Hoteles y paquetes seleccionados &nbsp;·&nbsp; 🗺️ Itinerarios a tu medida &nbsp;·&nbsp; 💳 Pago seguro en línea
                  </p>
                </td></tr>
              </table>
    """.strip()

    html_body = _email_shell(
        subject, "Tu cuenta en Alik Tours ya está lista. Empieza a explorar destinos.", content_html
    )

    return await send_email(email, subject, body, html_body)


async def send_verification_email(
    email: str,
    verification_token: str,
    base_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173"),
    username: str | None = None,
    codigo: str | None = None,
) -> bool:
    """
    Envía el correo de verificación de registro con la identidad visual de
    Alik Tours (granate + dorado, la misma paleta que --primary/--gold en
    theme.css) en vez de la plantilla generica de Arial + boton azul que
    traia antes. `username` es opcional (compatibilidad hacia atras con
    quien ya llamaba esta funcion sin ese dato) -- sin el, el saludo
    simplemente queda generico ("Hola,") en vez de "Hola, <nombre>,".

    `codigo` (nuevo): el código de 6 dígitos que RegisterModal.tsx le pide
    a la persona apenas crea la cuenta, sin que tenga que salir del modal a
    buscar el enlace en su bandeja. Sigue siendo opcional (None) para no
    romper ninguna otra llamada existente a esta función (ej. un futuro
    reenvío que por algún motivo no genere código) -- sin él, el correo
    queda igual que antes, solo con el botón/enlace.
    """
    verification_link = f"{base_url}/verify?token={verification_token}"
    # Texto plano: el username tal cual (no es HTML, no hace falta escapar
    # nada ahí, y escaparlo solo ensuciaría el correo con "&lt;...&gt;"
    # literal si alguien puso caracteres raros en su nombre de usuario).
    saludo_nombre_texto = f", {username}" if username else ""
    # HTML: sí se escapa -- username es texto libre que el usuario eligió
    # al registrarse, y va insertado directo en el <body> del correo.
    nombre_seguro = html.escape(username) if username else None
    saludo_nombre_html = f", {nombre_seguro}" if nombre_seguro else ""

    subject = "Confirma tu correo para activar tu cuenta - Alik Tours"

    codigo_texto_plano = (
        f"""
También puedes volver a la pestaña donde te registraste e ingresar este código:

    {codigo}

Ese código vence en 15 minutos.
"""
        if codigo
        else ""
    )

    body = f"""
Hola{saludo_nombre_texto},

¡Gracias por crear tu cuenta en Alik Tours! Solo falta un paso: confirma
tu correo electrónico para activarla del todo.

Verifica tu correo aquí:
{verification_link}
{codigo_texto_plano}
Este enlace expira en 24 horas. Si tú no creaste esta cuenta, puedes
ignorar este mensaje con tranquilidad.

Saludos,
El equipo de Alik Tours
    """.strip()

    codigo_html = (
        f"""
              <p style="margin:0 0 10px 0; font-size:13px; line-height:1.6; color:{_MUTED};">
                O vuelve a la pestaña donde te registraste e ingresa este código:
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:{_CARD_ALT_BG}; border:1.5px dashed rgba(110,24,50,0.35); border-radius:10px; padding:14px 28px;">
                    <span style="font-family:Georgia,'Times New Roman',serif; font-size:30px; font-weight:700; letter-spacing:8px; color:{_GARNET};">{codigo}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px 0; font-size:12px; color:{_MUTED_LIGHT};">Ese código vence en 15 minutos.</p>
"""
        if codigo
        else ""
    )

    content_html = f"""
              <h1 style="margin:0 0 16px 0; font-family:Georgia,'Times New Roman',serif; font-size:26px; font-weight:700; color:{_HEADING}; line-height:1.3;">
                Ya casi estás dentro
              </h1>
              <p style="margin:0 0 20px 0; font-size:15px; line-height:1.6; color:{_BODY_TEXT};">
                Hola{saludo_nombre_html}, gracias por crear tu cuenta en <strong style="color:{_GARNET};">Alik Tours</strong>. Solo falta un paso: confirma tu correo para activarla y empezar a reservar tus próximos viajes.
              </p>
{_boton("Verificar mi correo", verification_link)}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:{_WARNING_BG}; border-radius:8px; padding:10px 14px;">
                    <span style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:{_WARNING_TEXT};">⏳ Este enlace expira en 24 horas.</span>
                  </td>
                </tr>
              </table>
{codigo_html}
              <p style="margin:0 0 8px 0; font-size:13px; line-height:1.6; color:{_MUTED};">
                ¿El botón no funciona? Copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0 0 28px 0; font-size:12px; line-height:1.5; color:{_GARNET}; word-break:break-all; background-color:{_CARD_ALT_BG}; padding:10px 12px; border-radius:8px;">
                {verification_link}
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #f0e5e8; padding-top:20px;">
                  <p style="margin:0; font-size:12px; line-height:1.6; color:{_MUTED_LIGHT};">
                    Si tú no creaste esta cuenta, puedes ignorar este correo con tranquilidad -- no se activará nada sin confirmar.
                  </p>
                </td></tr>
              </table>
    """.strip()

    html_body = _email_shell(
        subject,
        "Confirma tu correo para activar tu cuenta en Alik Tours. El enlace expira en 24 horas.",
        content_html,
    )

    return await send_email(email, subject, body, html_body)


async def send_password_reset_email(
    email: str,
    reset_token: str,
    base_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173"),
) -> bool:
    reset_link = f"{base_url}/reset-password?token={reset_token}"
    subject = "Restablecer contraseña - Alik Tours"
    body = f"""
Haz clic en el siguiente enlace para crear una nueva contraseña:
{reset_link}

Este enlace expira en 24 horas. Si tú no solicitaste este cambio, ignora
este correo -- tu contraseña actual sigue funcionando sin cambios.

Saludos,
El equipo de Alik Tours
    """.strip()

    content_html = f"""
              <h1 style="margin:0 0 16px 0; font-family:Georgia,'Times New Roman',serif; font-size:26px; font-weight:700; color:{_HEADING}; line-height:1.3;">
                Restablece tu contraseña
              </h1>
              <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; color:{_BODY_TEXT};">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong style="color:{_GARNET};">Alik Tours</strong>. Haz clic en el botón para crear una nueva.
              </p>
{_boton("Crear nueva contraseña", reset_link)}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:{_WARNING_BG}; border-radius:8px; padding:10px 14px;">
                    <span style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:{_WARNING_TEXT};">⏳ Este enlace expira en 24 horas.</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0; font-size:13px; line-height:1.6; color:{_MUTED};">
                ¿El botón no funciona? Copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0 0 28px 0; font-size:12px; line-height:1.5; color:{_GARNET}; word-break:break-all; background-color:{_CARD_ALT_BG}; padding:10px 12px; border-radius:8px;">
                {reset_link}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #f0e5e8; padding-top:20px;">
                  <p style="margin:0; font-size:12px; line-height:1.6; color:{_MUTED_LIGHT};">
                    Si tú no solicitaste este cambio, ignora este correo con tranquilidad -- tu contraseña actual sigue funcionando sin cambios.
                  </p>
                </td></tr>
              </table>
    """.strip()

    html_body = _email_shell(
        subject,
        "Restablece tu contraseña de Alik Tours. Este enlace expira en 24 horas.",
        content_html,
    )

    return await send_email(email, subject, body, html_body)


async def send_reservation_confirmation(
    email: str,
    reservation_id: int,
    hotel_name: str,
    check_in: str,
    check_out: str,
    total_price: float,
    guest_name: str,
    base_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173"),
) -> bool:
    """
    Envía confirmación de reserva.
    """
    subject = f"Confirmación de Reserva #{reservation_id} - Alik Tours"
    nombre_seguro = html.escape(guest_name) if guest_name else ""
    hotel_seguro = html.escape(hotel_name) if hotel_name else ""

    body = f"""
Hola {guest_name},

Tu reserva ha sido confirmada.

Detalles:
- Reserva: #{reservation_id}
- Hotel: {hotel_name}
- Check-in: {check_in}
- Check-out: {check_out}
- Total: ${total_price:,.2f}

Gracias por elegir Alik Tours.

Saludos,
El equipo de Alik Tours
    """.strip()

    content_html = f"""
              <h1 style="margin:0 0 16px 0; font-family:Georgia,'Times New Roman',serif; font-size:26px; font-weight:700; color:{_HEADING}; line-height:1.3;">
                ¡Tu reserva está confirmada! 🎉
              </h1>
              <p style="margin:0 0 20px 0; font-size:15px; line-height:1.6; color:{_BODY_TEXT};">
                Hola <strong>{nombre_seguro}</strong>, gracias por reservar con <strong style="color:{_GARNET};">Alik Tours</strong>. Aquí está el resumen de tu viaje:
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0; border:1px solid #f0e5e8; border-radius:10px; overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px; font-size:13px; color:{_MUTED}; border-bottom:1px solid #f0e5e8;">Número de reserva</td>
                  <td style="padding:12px 16px; font-size:13px; font-weight:700; color:{_HEADING}; text-align:right; border-bottom:1px solid #f0e5e8;">#{reservation_id}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; font-size:13px; color:{_MUTED}; border-bottom:1px solid #f0e5e8; background-color:{_CARD_ALT_BG};">🏨 Hotel</td>
                  <td style="padding:12px 16px; font-size:13px; font-weight:700; color:{_HEADING}; text-align:right; border-bottom:1px solid #f0e5e8; background-color:{_CARD_ALT_BG};">{hotel_seguro}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; font-size:13px; color:{_MUTED}; border-bottom:1px solid #f0e5e8;">📅 Check-in</td>
                  <td style="padding:12px 16px; font-size:13px; font-weight:700; color:{_HEADING}; text-align:right; border-bottom:1px solid #f0e5e8;">{check_in}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; font-size:13px; color:{_MUTED}; background-color:{_CARD_ALT_BG};">📅 Check-out</td>
                  <td style="padding:12px 16px; font-size:13px; font-weight:700; color:{_HEADING}; text-align:right; background-color:{_CARD_ALT_BG};">{check_out}</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="background-color:{_SUCCESS_BG}; border-radius:10px; padding:14px 18px;">
                    <span style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:{_SUCCESS};">Total pagado</span><br>
                    <span style="font-family:Georgia,'Times New Roman',serif; font-size:24px; font-weight:700; color:{_SUCCESS};">${total_price:,.2f}</span>
                  </td>
                </tr>
              </table>
{_boton("Ver mi reserva", f"{base_url}/profile")}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #f0e5e8; padding-top:20px;">
                  <p style="margin:0; font-size:12px; line-height:1.6; color:{_MUTED_LIGHT};">
                    Gracias por elegir Alik Tours para tu próxima aventura. ¡Buen viaje! ✈️
                  </p>
                </td></tr>
              </table>
    """.strip()

    html_body = _email_shell(
        subject,
        f"Tu reserva #{reservation_id} en {hotel_name or 'Alik Tours'} está confirmada.",
        content_html,
    )

    return await send_email(email, subject, body, html_body)


async def send_cancellation_email(
    email: str, reservation_id: int, guest_name: str, refund_amount: float | None = None
) -> bool:
    """
    Envía confirmación de cancelación de reserva.
    """
    subject = f"Cancelación de Reserva #{reservation_id} - Alik Tours"
    nombre_seguro = html.escape(guest_name) if guest_name else ""

    refund_text = f"\nReembolso: ${refund_amount:,.2f}" if refund_amount else ""

    body = f"""
Hola {guest_name},

Tu reserva #{reservation_id} ha sido cancelada.
{refund_text}

Si tienes dudas, contacta a nuestro equipo.

Saludos,
El equipo de Alik Tours
    """.strip()

    refund_html = (
        f"""
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:{_SUCCESS_BG}; border-radius:10px; padding:14px 18px;">
                    <span style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:{_SUCCESS};">Reembolso</span><br>
                    <span style="font-family:Georgia,'Times New Roman',serif; font-size:22px; font-weight:700; color:{_SUCCESS};">${refund_amount:,.2f}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px 0; font-size:12px; color:{_MUTED_LIGHT};">
                Se verá reflejado en tu método de pago original según los tiempos de tu entidad financiera.
              </p>"""
        if refund_amount
        else ""
    )

    content_html = f"""
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="background-color:{_DANGER_BG}; border-radius:20px; padding:5px 14px;">
                    <span style="font-family:Helvetica,Arial,sans-serif; font-size:12px; font-weight:700; color:{_DANGER}; text-transform:uppercase; letter-spacing:0.5px;">Reserva cancelada</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0 0 16px 0; font-family:Georgia,'Times New Roman',serif; font-size:26px; font-weight:700; color:{_HEADING}; line-height:1.3;">
                Tu reserva #{reservation_id} fue cancelada
              </h1>
              <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; color:{_BODY_TEXT};">
                Hola <strong>{nombre_seguro}</strong>, confirmamos que tu reserva <strong>#{reservation_id}</strong> ha sido cancelada.
              </p>
{refund_html}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #f0e5e8; padding-top:20px;">
                  <p style="margin:0; font-size:13px; line-height:1.6; color:{_MUTED};">
                    Si tienes dudas sobre esta cancelación, escríbenos desde nuestra página de contacto y con gusto te ayudamos.
                  </p>
                </td></tr>
              </table>
    """.strip()

    html_body = _email_shell(subject, f"Tu reserva #{reservation_id} en Alik Tours fue cancelada.", content_html)

    return await send_email(email, subject, body, html_body)


async def send_contact_email(nombre: str, correo: str, asunto: str, mensaje: str) -> bool:
    """
    Reenvía un mensaje del formulario de contacto a la bandeja de soporte
    y envía una confirmación de recibido al remitente.
    """
    nombre_seguro = html.escape(nombre) if nombre else ""
    correo_seguro = html.escape(correo) if correo else ""
    asunto_seguro = html.escape(asunto) if asunto else ""
    mensaje_seguro = html.escape(mensaje) if mensaje else ""

    # 1) Correo interno a soporte con los datos del formulario
    subject_interno = f"[Contacto Web] {asunto}"
    body_interno = f"""
Nuevo mensaje desde el formulario de contacto:

Nombre: {nombre}
Correo: {correo}
Asunto: {asunto}

Mensaje:
{mensaje}
    """.strip()

    content_interno = f"""
              <h1 style="margin:0 0 20px 0; font-family:Georgia,'Times New Roman',serif; font-size:22px; font-weight:700; color:{_HEADING};">
                📬 Nuevo mensaje de contacto
              </h1>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0; border:1px solid #f0e5e8; border-radius:10px; overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px; font-size:13px; color:{_MUTED}; border-bottom:1px solid #f0e5e8;">Nombre</td>
                  <td style="padding:12px 16px; font-size:13px; font-weight:700; color:{_HEADING}; text-align:right; border-bottom:1px solid #f0e5e8;">{nombre_seguro}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; font-size:13px; color:{_MUTED}; border-bottom:1px solid #f0e5e8; background-color:{_CARD_ALT_BG};">Correo</td>
                  <td style="padding:12px 16px; font-size:13px; font-weight:700; color:{_HEADING}; text-align:right; border-bottom:1px solid #f0e5e8; background-color:{_CARD_ALT_BG};">{correo_seguro}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; font-size:13px; color:{_MUTED};">Asunto</td>
                  <td style="padding:12px 16px; font-size:13px; font-weight:700; color:{_HEADING}; text-align:right;">{asunto_seguro}</td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0; font-size:13px; color:{_MUTED};">Mensaje:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:{_CARD_ALT_BG}; border-radius:10px; padding:16px;">
                    <p style="margin:0; font-size:14px; line-height:1.6; color:{_BODY_TEXT}; white-space:pre-wrap;">{mensaje_seguro}</p>
                  </td>
                </tr>
              </table>
    """.strip()

    html_interno = _email_shell(subject_interno, f'Nuevo mensaje de {nombre} sobre "{asunto}".', content_interno)

    # Best-effort: esta copia interna es redundante con la notificación real
    # que enviar_contacto() ya crea dentro de la plataforma (ver
    # crear_notificacion en contacto_route.py), así que su resultado se
    # descarta a propósito -- antes determinaba, junto con la confirmación
    # de abajo, si el formulario completo "funcionaba" (`ok_interno and
    # ok_confirmacion`), y un solo correo que Gmail no entregara (algo
    # transitorio y normal en SMTP) tumbaba TODO el formulario con un error,
    # aunque el mensaje del cliente sí hubiera llegado bien a la plataforma.
    await send_email(settings.MAIL_FROM, subject_interno, body_interno, html_interno)

    # 2) Confirmación automática al usuario
    subject_confirmacion = "Recibimos tu mensaje - Alik Tours"
    body_confirmacion = f"""
Hola {nombre},

Gracias por escribirnos. Hemos recibido tu mensaje sobre "{asunto}" y un asesor te responderá a este correo en menos de 2 horas hábiles.

Saludos,
El equipo de Alik Tours
    """.strip()

    content_confirmacion = f"""
              <h1 style="margin:0 0 16px 0; font-family:Georgia,'Times New Roman',serif; font-size:26px; font-weight:700; color:{_HEADING}; line-height:1.3;">
                ¡Gracias por escribirnos, {nombre_seguro}! 🎉
              </h1>
              <p style="margin:0 0 20px 0; font-size:15px; line-height:1.6; color:{_BODY_TEXT};">
                Hemos recibido tu mensaje sobre <strong style="color:{_GARNET};">"{asunto_seguro}"</strong>.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:{_WARNING_BG}; border-radius:8px; padding:10px 14px;">
                    <span style="font-family:Helvetica,Arial,sans-serif; font-size:13px; color:{_WARNING_TEXT};">🕑 Un asesor de Alik Tours te responderá a este correo en menos de 2 horas hábiles.</span>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #f0e5e8; padding-top:20px;">
                  <p style="margin:0; font-size:12px; line-height:1.6; color:{_MUTED_LIGHT};">
                    Este es un resumen de tu mensaje, para que quede constancia:
                  </p>
                  <p style="margin:8px 0 0 0; font-size:13px; line-height:1.6; color:{_MUTED}; background-color:{_CARD_ALT_BG}; padding:12px; border-radius:8px; white-space:pre-wrap;">{mensaje_seguro}</p>
                </td></tr>
              </table>
    """.strip()

    html_confirmacion = _email_shell(
        subject_confirmacion,
        f'Recibimos tu mensaje sobre "{asunto}". Un asesor te responde en menos de 2 horas hábiles.',
        content_confirmacion,
    )

    # Esta sí es la que de verdad le importa a la respuesta que ve el
    # cliente en el formulario -- su resultado se sigue devolviendo, pero
    # ya no puede tumbar la solicitud completa (ver enviar_contacto).
    return await send_email(correo, subject_confirmacion, body_confirmacion, html_confirmacion)
