"""PQR de ejemplo para demostraciones.

Crea un conjunto de solicitudes en todos los estados (radicada, en trámite,
esperando al cliente, prorrogada, vencida, respondida y cerrada) para un
cliente, con fechas hacia atrás en días hábiles para que los plazos se vean
como en la vida real. Todas quedan con es_ejemplo=True: en pantalla llevan
la etiqueta «Ejemplo» y se borran juntas desde el panel.
"""

from datetime import UTC, date, datetime, time

from sqlalchemy.orm import Session

from app.core.dias_habiles import ZONA_COLOMBIA, hoy_colombia, restar_dias_habiles, sumar_dias_habiles
from app.models.cliente_model import Cliente
from app.models.pqr_model import Pqr, PqrActuacion
from app.models.user_model import Usuario
from app.services import pqr_service as svc


def _instante(dia: date, hora: int, minuto: int = 0) -> datetime:
    """Hora local de Colombia → UTC sin zona (como se guarda)."""
    local = datetime.combine(dia, time(hora, minuto), tzinfo=ZONA_COLOMBIA)
    return local.astimezone(UTC).replace(tzinfo=None)


ESCENARIOS = [
    {
        "tipo": "reclamo",
        "hace": 3,
        "asunto": "Me cobraron dos veces el anticipo de la reserva",
        "descripcion": (
            "Pagué el anticipo de la reserva en Cartagena con mi tarjeta y en el extracto aparecen dos cobros "
            "iguales el mismo día, con pocos minutos de diferencia."
        ),
        "pretension": "Que me devuelvan el cobro repetido.",
        "estado": "en_tramite",
        "tipificacion": ("pagos", "Cobro doble"),
        "hilo": [
            (
                "mensaje_equipo",
                1,
                "Hola, ya validamos con el área de pagos los dos cobros. Estamos pidiendo el soporte al banco para tramitar la devolución.",
            ),
            ("nota_interna", 1, "Transacciones 88123 y 88124 en la pasarela. Pedir reverso de la segunda."),
            ("mensaje_cliente", 2, "Gracias. ¿Cuánto tarda en verse el dinero en mi tarjeta?"),
        ],
    },
    {
        "tipo": "queja",
        "hace": 13,
        "asunto": "El guía del tour llegó una hora tarde",
        "descripcion": (
            "En el tour por la ciudad amurallada el guía llegó una hora tarde y nadie nos avisó. Perdimos parte "
            "del recorrido."
        ),
        "estado": "en_tramite",
        "tipificacion": ("paquetes", "Guía o transporte"),
        "prorroga": (5, "Estamos esperando el informe del operador del tour para revisar lo que pasó con el guía."),
        "hilo": [("mensaje_equipo", 2, "Lamentamos lo ocurrido. Ya le pedimos el informe al operador del tour.")],
    },
    {
        "tipo": "informacion",
        "hace": 2,
        "asunto": "Certificado de la reserva para mi empresa",
        "descripcion": "Necesito un certificado de la reserva con el valor pagado para legalizar los viáticos.",
        "estado": "esperando_cliente",
        "tipificacion": ("documentos", "Certificado de reserva"),
        "pide": "¿A nombre de qué empresa y NIT debe salir el certificado? Envíanos también el número de la reserva.",
    },
    {
        "tipo": "reclamo",
        "hace": 9,
        "asunto": "Nos asignaron una habitación distinta a la reservada",
        "descripcion": (
            "Reservamos habitación con vista al mar y al llegar nos dieron una interna, sin vista, porque el hotel "
            "dijo que no había disponibilidad."
        ),
        "pretension": "Que nos devuelvan la diferencia de precio entre las dos habitaciones.",
        "estado": "respondida",
        "tipificacion": ("hotel", "Habitación distinta a la reservada"),
        "respuesta": (
            "parcial",
            "Confirmamos con el hotel que no les entregó la habitación reservada. Accedemos a devolver la diferencia "
            "de tarifa de las tres noches. No accedemos al reembolso del transporte al aeropuerto, porque ese "
            "servicio sí se prestó según el voucher firmado, y la política del paquete no contempla su devolución.",
        ),
    },
    {
        "tipo": "felicitacion",
        "hace": 6,
        "asunto": "Excelente atención de la asesora",
        "descripcion": "Quiero felicitar a la asesora que me ayudó a cambiar la fecha del vuelo: fue muy amable y rápida.",
        "estado": "cerrada",
        "tipificacion": ("atencion", "Felicitación al asesor"),
        "respuesta": (
            "informativa",
            "¡Gracias por tu mensaje! Se lo compartimos a tu asesora y quedó en su evaluación de servicio.",
        ),
        "calificacion": (5, "Muy rápido, gracias."),
    },
    {
        "tipo": "peticion",
        "hace": 12,
        "asunto": "Cambiar la fecha del paquete a San Andrés",
        "descripcion": "Por un tema de trabajo necesito mover el viaje una semana, del 12 al 19 de diciembre.",
        "pretension": "Que me cambien la fecha sin costo adicional, si es posible.",
        "estado": "radicada",
    },
    {
        "tipo": "sugerencia",
        "hace": 0,
        "asunto": "Agreguen más tours en Santa Marta",
        "descripcion": "Me encantaría ver tours a la Sierra Nevada y a Minca en el catálogo de paquetes.",
        "estado": "radicada",
    },
    {
        "tipo": "queja",
        "hace": 17,
        "canal": "whatsapp",
        "asunto": "Nadie me contestó por WhatsApp",
        "descripcion": "Escribí tres días seguidos por WhatsApp para preguntar por mi reserva y nadie me respondió.",
        "estado": "en_tramite",
        "tipificacion": ("atencion", "Demora en la respuesta"),
        "hilo": [("nota_interna", 3, "Revisar la cola de WhatsApp de esa semana con el supervisor.")],
    },
]


def crear_ejemplos(db: Session, cliente: Cliente, admin: Usuario | None) -> list[Pqr]:
    hoy = hoy_colombia()
    nombre_cliente = f"{cliente.nombre} {cliente.apellido}".strip()
    nombre_equipo = svc.nombre_usuario(admin) if admin else "Equipo Alik Tours"
    creadas: list[Pqr] = []

    for e in ESCENARIOS:
        radicada = restar_dias_habiles(hoy, e["hace"]) if e["hace"] else hoy
        dias = svc.TIPOS[e["tipo"]]["dias"]
        canal = e.get("canal", "web")
        pqr = Pqr(
            tipo=e["tipo"],
            canal=canal,
            id_cliente=cliente.id_cliente,
            id_usuario_radica=admin.id_usuario if (admin and canal != "web") else None,
            asunto=e["asunto"],
            descripcion=e["descripcion"],
            pretension=e.get("pretension"),
            autoriza_datos=True,
            estado=e["estado"],
            prioridad="alta" if e["tipo"] == "reclamo" else "normal",
            dias_termino=dias,
            fecha_radicacion=_instante(radicada, 9, 30),
            fecha_inicio_termino=radicada,
            fecha_vencimiento=sumar_dias_habiles(radicada, dias),
            es_ejemplo=True,
        )
        db.add(pqr)
        db.flush()
        pqr.radicado = svc.generar_radicado(pqr)

        def act(tipo, dia, texto, *, visible=True, autor=None, hora=10, _pqr=pqr):
            a = PqrActuacion(
                id_pqr=_pqr.id_pqr,
                tipo=tipo,
                texto=texto,
                id_usuario=admin.id_usuario if (admin and autor != nombre_cliente) else None,
                autor_nombre=autor or nombre_equipo,
                visible_cliente=visible,
                fecha=_instante(dia, hora),
            )
            db.add(a)
            _pqr.actuaciones.append(a)

        act(
            "radicacion",
            radicada,
            "Radicada por el cliente." if canal == "web" else f"Radicada por el equipo (canal: {canal}).",
            autor=nombre_cliente if canal == "web" else None,
            hora=9,
        )
        if e["estado"] != "radicada" and admin:
            pqr.id_responsable = admin.id_usuario
        if "tipificacion" in e:
            cat, motivo = e["tipificacion"]
            pqr.categoria, pqr.motivo = cat, motivo
            pqr.id_usuario_tipifica = admin.id_usuario if admin else None
            pqr.fecha_tipificacion = _instante(radicada, 11)
            act(
                "tipificacion",
                radicada,
                f"Tipificada: {svc.TIPIFICACION[cat]['nombre']} → {motivo}.",
                visible=False,
                hora=11,
            )
        for tipo, despues, texto in e.get("hilo", []):
            dia = sumar_dias_habiles(radicada, despues)
            es_cliente = tipo == "mensaje_cliente"
            act(
                tipo,
                min(dia, hoy),
                texto,
                visible=tipo != "nota_interna",
                autor=nombre_cliente if es_cliente else None,
                hora=14,
            )
        if "pide" in e:
            pqr.fecha_solicitud_informacion = _instante(min(sumar_dias_habiles(radicada, 1), hoy), 15)
            act("solicitud_informacion", min(sumar_dias_habiles(radicada, 1), hoy), e["pide"], hora=15)
        if "prorroga" in e:
            extra, motivo = e["prorroga"]
            pqr.fecha_vencimiento_original = pqr.fecha_vencimiento
            pqr.fecha_vencimiento = sumar_dias_habiles(pqr.fecha_vencimiento, extra)
            pqr.prorrogada = True
            pqr.motivo_prorroga = motivo
            act(
                "prorroga",
                min(sumar_dias_habiles(radicada, 10), hoy),
                f"Ampliamos el plazo de respuesta hasta el {svc.fecha_legible(pqr.fecha_vencimiento)}. Motivo: {motivo}",
                hora=16,
            )
        if "respuesta" in e:
            decision, texto = e["respuesta"]
            dia = min(sumar_dias_habiles(radicada, max(1, e["hace"] - 1)), hoy)
            pqr.decision = decision
            pqr.respuesta = texto
            pqr.fecha_respuesta = _instante(dia, 16)
            pqr.id_usuario_responde = admin.id_usuario if admin else None
            pqr.respondida_a_tiempo = dia <= pqr.fecha_vencimiento
            act("respuesta", dia, texto, hora=16)
        if "calificacion" in e:
            estrellas, comentario = e["calificacion"]
            pqr.satisfaccion = estrellas
            pqr.comentario_satisfaccion = comentario
            pqr.fecha_cierre = _instante(hoy, 8)
            act(
                "calificacion",
                hoy,
                f"Calificó la atención con {estrellas} de 5. {comentario}",
                autor=nombre_cliente,
                hora=8,
            )
        creadas.append(pqr)
    return creadas
