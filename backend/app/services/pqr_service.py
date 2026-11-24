"""Reglas de negocio de las PQRSF.

Plazos (días hábiles, contados desde el día hábil siguiente al recibo):

- Petición general: 15 días (Ley 1755 de 2015, art. 14).
- Petición de documentos o de información: 10 días (art. 14, num. 1).
- Consulta: 30 días (art. 14, num. 2).
- Queja, reclamo, sugerencia y felicitación: 15 días. Para los reclamos de
  servicios turísticos, la reclamación directa ante el prestador también
  se responde en máximo 15 días hábiles (Decreto 1074 de 2015, que compila
  el Decreto 1097 de 2014), diciendo de forma expresa si se accede o no a
  lo pedido y, si no, por qué.

Prórroga: si no se alcanza a responder, se avisa ANTES de que venza el
plazo, con los motivos y la nueva fecha, que no puede pasar del doble del
plazo inicial (Ley 1755, art. 14, parágrafo).

Petición incompleta: se le puede pedir al cliente que complete la
información dentro de los 10 días siguientes a la radicación; el plazo se
suspende y vuelve a empezar cuando el cliente responde (art. 17). Si en un
mes no responde, se puede archivar por desistimiento tácito.
"""

from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.dias_habiles import dias_habiles_entre, hoy_colombia, sumar_dias_habiles
from app.models.pqr_model import Pqr, PqrActuacion
from app.models.user_model import Usuario

TIPOS: dict[str, dict] = {
    "peticion": {
        "nombre": "Petición",
        "descripcion": "Pides algo a la agencia: un cambio, un trámite, una gestión sobre tu viaje.",
        "dias": 15,
        "norma": "Ley 1755 de 2015, art. 14",
    },
    "informacion": {
        "nombre": "Solicitud de información o documentos",
        "descripcion": "Pides copia de un documento, un certificado o información puntual de tu reserva.",
        "dias": 10,
        "norma": "Ley 1755 de 2015, art. 14 num. 1",
    },
    "consulta": {
        "nombre": "Consulta",
        "descripcion": "Nos pides un concepto u orientación sobre un tema de nuestros servicios.",
        "dias": 30,
        "norma": "Ley 1755 de 2015, art. 14 num. 2",
    },
    "queja": {
        "nombre": "Queja",
        "descripcion": "Nos cuentas tu inconformidad con la atención o el trato que recibiste.",
        "dias": 15,
        "norma": "Ley 1755 de 2015, art. 14",
    },
    "reclamo": {
        "nombre": "Reclamo",
        "descripcion": "Un servicio no se prestó como se ofreció y pides que se corrija, se repare o se reembolse.",
        "dias": 15,
        "norma": "Decreto 1074 de 2015 (reclamación directa) y Ley 1480 de 2011",
    },
    "sugerencia": {
        "nombre": "Sugerencia",
        "descripcion": "Una idea para mejorar nuestros servicios.",
        "dias": 15,
        "norma": "Ley 1755 de 2015, art. 14",
    },
    "felicitacion": {
        "nombre": "Felicitación",
        "descripcion": "Quieres reconocer una buena experiencia o a alguien del equipo.",
        "dias": 15,
        "norma": "Ley 1755 de 2015, art. 14",
    },
}

ABIERTAS = ("radicada", "en_tramite", "esperando_cliente")
FINALES = ("respondida", "cerrada", "desistida")
DIAS_POR_VENCER = 3
DIAS_PARA_PEDIR_INFORMACION = 10
MAX_ABIERTAS_POR_CLIENTE = 10

_TIPOS_DEL_CLIENTE = {"mensaje_cliente", "desistimiento", "calificacion"}


def utc(dt: datetime | None) -> datetime | None:
    """Las fechas se guardan en UTC sin zona; al API salen con su zona para
    que el navegador las muestre en la hora local del cliente."""
    if dt is None or dt.tzinfo is not None:
        return dt
    return dt.replace(tzinfo=UTC)


def ahora() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def nombre_usuario(usuario: Usuario | None) -> str:
    if usuario is None:
        return "Equipo Alik Tours"
    empleado = getattr(usuario, "empleado", None)
    if empleado is not None and getattr(empleado, "nombre", None):
        return f"{empleado.nombre} {empleado.apellido}".strip()
    return usuario.username


def nombre_cliente(pqr: Pqr) -> str | None:
    c = pqr.cliente
    return f"{c.nombre} {c.apellido}".strip() if c else None


def calcular_vencimiento(inicio: date, dias: int) -> date:
    return sumar_dias_habiles(inicio, dias)


def generar_radicado(pqr: Pqr) -> str:
    anio = (pqr.fecha_radicacion or ahora()).year
    return f"PQR-{anio}-{pqr.id_pqr:06d}"


def registrar(
    db: Session,
    pqr: Pqr,
    tipo: str,
    texto: str | None,
    usuario: Usuario | None,
    *,
    visible: bool = True,
    autor: str | None = None,
) -> PqrActuacion:
    act = PqrActuacion(
        id_pqr=pqr.id_pqr,
        tipo=tipo,
        texto=texto,
        id_usuario=usuario.id_usuario if usuario else None,
        autor_nombre=autor or (nombre_usuario(usuario) if usuario else "Sistema"),
        visible_cliente=visible,
        fecha=ahora(),
    )
    db.add(act)
    pqr.actuaciones.append(act)
    pqr.fecha_actualizacion = ahora()
    return act


def dias_restantes(pqr: Pqr, hoy: date | None = None) -> int:
    return dias_habiles_entre(hoy or hoy_colombia(), pqr.fecha_vencimiento)


def estado_plazo(pqr: Pqr, hoy: date | None = None) -> str:
    if pqr.respondida_a_tiempo is not None:
        return "respondida_a_tiempo" if pqr.respondida_a_tiempo else "respondida_tarde"
    if pqr.estado in ("esperando_cliente", "desistida", "cerrada"):
        return "pausada"
    restantes = dias_restantes(pqr, hoy)
    if restantes < 0:
        return "vencida"
    if restantes <= DIAS_POR_VENCER:
        return "por_vencer"
    return "a_tiempo"


def puede_prorrogar(pqr: Pqr, hoy: date | None = None) -> bool:
    return (
        pqr.estado in ("radicada", "en_tramite")
        and not pqr.prorrogada
        and (hoy or hoy_colombia()) <= (pqr.fecha_vencimiento)
    )


def puede_solicitar_informacion(pqr: Pqr, hoy: date | None = None) -> bool:
    if pqr.estado not in ("radicada", "en_tramite") or pqr.fecha_solicitud_informacion is not None:
        return False
    radicada = hoy_colombia(pqr.fecha_radicacion)
    limite = sumar_dias_habiles(radicada, DIAS_PARA_PEDIR_INFORMACION)
    return (hoy or hoy_colombia()) <= limite


def puede_archivar_por_desistimiento(pqr: Pqr, momento: datetime | None = None) -> bool:
    if pqr.estado != "esperando_cliente" or pqr.fecha_solicitud_informacion is None:
        return False
    return (momento or ahora()) - pqr.fecha_solicitud_informacion >= timedelta(days=30)


def _autor_equipo(pqr: Pqr, act: PqrActuacion) -> bool:
    if act.tipo in _TIPOS_DEL_CLIENTE:
        return False
    if act.tipo == "radicacion":
        return pqr.canal != "web"
    return True


def serializar_resumen(pqr: Pqr, hoy: date | None = None) -> dict:
    tipo = TIPOS.get(pqr.tipo, {"nombre": pqr.tipo})
    ultima = pqr.actuaciones[-1].fecha if pqr.actuaciones else pqr.fecha_radicacion
    return {
        "id_pqr": pqr.id_pqr,
        "radicado": pqr.radicado or generar_radicado(pqr),
        "tipo": pqr.tipo,
        "tipo_nombre": tipo["nombre"],
        "canal": pqr.canal,
        "asunto": pqr.asunto,
        "estado": pqr.estado,
        "prioridad": pqr.prioridad,
        "id_cliente": pqr.id_cliente,
        "cliente_nombre": nombre_cliente(pqr),
        "id_reserva": pqr.id_reserva,
        "id_responsable": pqr.id_responsable,
        "responsable_nombre": nombre_usuario(pqr.responsable) if pqr.responsable else None,
        "dias_termino": pqr.dias_termino,
        "fecha_radicacion": utc(pqr.fecha_radicacion),
        "fecha_vencimiento": pqr.fecha_vencimiento,
        "prorrogada": bool(pqr.prorrogada),
        "dias_habiles_restantes": dias_restantes(pqr, hoy),
        "estado_plazo": estado_plazo(pqr, hoy),
        "decision": pqr.decision,
        "fecha_respuesta": utc(pqr.fecha_respuesta),
        "satisfaccion": pqr.satisfaccion,
        "ultima_actividad": utc(ultima),
    }


def serializar_detalle(pqr: Pqr, *, para_equipo: bool) -> dict:
    datos = serializar_resumen(pqr)
    reserva_titulo = None
    if pqr.reserva is not None:
        paquete = getattr(pqr.reserva, "paquete", None)
        nombre = getattr(paquete, "nombre_paquete", None) if paquete else None
        reserva_titulo = f"Reserva #{pqr.id_reserva}" + (f" · {nombre}" if nombre else "")
    actuaciones = [
        {
            "id_actuacion": a.id_actuacion,
            "tipo": a.tipo,
            "texto": a.texto,
            "autor_nombre": a.autor_nombre,
            "autor_equipo": _autor_equipo(pqr, a),
            "visible_cliente": a.visible_cliente,
            "fecha": utc(a.fecha),
        }
        for a in pqr.actuaciones
        if para_equipo or a.visible_cliente
    ]
    datos.update(
        {
            "descripcion": pqr.descripcion,
            "pretension": pqr.pretension,
            "reserva_titulo": reserva_titulo,
            "fecha_vencimiento_original": pqr.fecha_vencimiento_original,
            "motivo_prorroga": pqr.motivo_prorroga,
            "respuesta": pqr.respuesta,
            "comentario_satisfaccion": pqr.comentario_satisfaccion,
            "fecha_cierre": utc(pqr.fecha_cierre),
            "puede_prorrogar": para_equipo and puede_prorrogar(pqr),
            "puede_solicitar_informacion": para_equipo and puede_solicitar_informacion(pqr),
            "actuaciones": actuaciones,
        }
    )
    return datos


def fecha_legible(d: date) -> str:
    meses = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre",
    ]
    return f"{d.day} de {meses[d.month - 1]} de {d.year}"
