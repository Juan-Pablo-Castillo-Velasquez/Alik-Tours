"""PQRSF compartidas entre cliente, asesor (empleado) y admin.

Cliente:  radica, ve las suyas, escribe, completa información, desiste y
          califica la respuesta.
Equipo:   ve todas con filtros y plazos, asigna responsable, cambia
          prioridad, escribe al cliente o deja notas internas, pide
          información, prorroga una vez y da la respuesta de fondo.

Las reglas de plazos están en app/services/pqr_service.py.
"""

import contextlib

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_usuario_verificado
from app.core.dias_habiles import hoy_colombia, sumar_dias_habiles
from app.core.mail import send_pqr_email
from app.core.security import _roles_vigentes, require_admin, require_empleado
from app.models.auth_model import Rol, UsuarioRol
from app.models.cliente_model import Cliente
from app.models.pqr_model import Pqr
from app.models.reserva_model import Reserva
from app.models.user_model import Usuario
from app.schemas.pqr_schema import (
    PqrCalificacion,
    PqrCategoriaOut,
    PqrCierre,
    PqrCreate,
    PqrDesistimiento,
    PqrDetalleOut,
    PqrEjemplosIn,
    PqrEjemplosOut,
    PqrGestionUpdate,
    PqrMensajeCreate,
    PqrPagina,
    PqrProrroga,
    PqrResponsableOut,
    PqrRespuesta,
    PqrResumenOut,
    PqrSolicitarInformacion,
    PqrTipoOut,
)
from app.services import pqr_service as svc
from app.services.notificacion_service import crear_notificacion
from app.services.pqr_ejemplos import crear_ejemplos

router = APIRouter(prefix="/api/pqr", tags=["PQR"])


# ─── utilidades ───────────────────────────────────────────────────────────


def _es_equipo(db: Session, usuario: Usuario) -> bool:
    estado = _roles_vigentes(db, usuario.id_usuario)
    return bool(estado and estado[0] and {"admin", "empleado"} & set(estado[1]))


def _cargar(db: Session, id_pqr: int) -> Pqr:
    pqr = (
        db.query(Pqr)
        .options(joinedload(Pqr.cliente), joinedload(Pqr.responsable), joinedload(Pqr.actuaciones))
        .filter(Pqr.id_pqr == id_pqr)
        .first()
    )
    if pqr is None:
        raise HTTPException(status_code=404, detail="No encontramos esa solicitud")
    return pqr


def _cargar_con_acceso(db: Session, id_pqr: int, usuario: Usuario) -> tuple[Pqr, bool]:
    pqr = _cargar(db, id_pqr)
    equipo = _es_equipo(db, usuario)
    if not equipo and usuario.id_cliente != pqr.id_cliente:
        # 404 y no 403: no confirmamos que exista una PQR ajena.
        raise HTTPException(status_code=404, detail="No encontramos esa solicitud")
    return pqr, equipo


def _correo_cliente(pqr: Pqr) -> str | None:
    if pqr.cliente is None:
        return None
    usuario = getattr(pqr.cliente, "usuario", None)
    return (usuario.correo_electronico if usuario else None) or pqr.cliente.correo


def _avisar(
    bg: BackgroundTasks,
    pqr: Pqr,
    titulo: str,
    parrafos: list[str],
    *,
    destacado: tuple[str, str] | None = None,
    tono: str = "info",
    nota: str | None = None,
) -> None:
    """Correo al cliente con la plantilla de marca (core/mail.send_pqr_email)."""
    correo = _correo_cliente(pqr)
    if not correo:
        return
    prefijo = "[Ejemplo] " if pqr.es_ejemplo else ""
    datos = [
        ("Tipo", svc.TIPOS[pqr.tipo]["nombre"]),
        ("Fecha límite", svc.fecha_legible(pqr.fecha_vencimiento)),
    ]
    kwargs = {
        "nombre": pqr.cliente.nombre if pqr.cliente else None,
        "asunto_correo": f"{prefijo}{titulo} · {pqr.radicado}",
        "titulo": titulo,
        "radicado": pqr.radicado,
        "asunto_pqr": pqr.asunto,
        "parrafos": parrafos,
        "destacado": destacado,
        "tono": tono,
        "datos": datos,
        "nota": nota,
    }

    async def _enviar():
        with contextlib.suppress(Exception):
            await send_pqr_email(correo, **kwargs)

    bg.add_task(_enviar)


def _detalle(pqr: Pqr, equipo: bool) -> dict:
    return svc.serializar_detalle(pqr, para_equipo=equipo)


def _exigir_abierta(pqr: Pqr) -> None:
    if pqr.estado in svc.FINALES:
        raise HTTPException(status_code=409, detail="Esta solicitud ya está cerrada")


# ─── públicos ─────────────────────────────────────────────────────────────


@router.get("/tipos", response_model=list[PqrTipoOut])
def listar_tipos():
    """Tipos de solicitud con su plazo de respuesta en días hábiles."""
    return [{"tipo": k, **v} for k, v in svc.TIPOS.items()]


# ─── cliente ──────────────────────────────────────────────────────────────


@router.post("", response_model=PqrDetalleOut, status_code=201)
def radicar(
    data: PqrCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_verificado),
):
    equipo = _es_equipo(db, usuario)
    if data.id_cliente is not None and data.id_cliente != usuario.id_cliente:
        if not equipo:
            raise HTTPException(status_code=403, detail="Solo el equipo puede radicar a nombre de otro cliente")
        id_cliente = data.id_cliente
    else:
        id_cliente = usuario.id_cliente
    if id_cliente is None:
        raise HTTPException(status_code=422, detail="Indica el cliente al que pertenece la solicitud")
    cliente = db.query(Cliente).filter(Cliente.id_cliente == id_cliente).first()
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if not data.autoriza_datos:
        raise HTTPException(
            status_code=422, detail="Debes autorizar el tratamiento de tus datos para poder atender la solicitud"
        )
    if data.tipo == "reclamo" and len(data.pretension or "") < 10:
        raise HTTPException(
            status_code=422, detail="En un reclamo cuéntanos qué esperas que hagamos (mínimo 10 caracteres)"
        )
    if data.id_reserva is not None:
        reserva = db.query(Reserva).filter(Reserva.id_reserva == data.id_reserva).first()
        if reserva is None or reserva.id_cliente != id_cliente:
            raise HTTPException(status_code=422, detail="La reserva indicada no pertenece a este cliente")

    abiertas = db.query(func.count(Pqr.id_pqr)).filter(Pqr.id_cliente == id_cliente, Pqr.estado.in_(svc.ABIERTAS))
    if abiertas.scalar() >= svc.MAX_ABIERTAS_POR_CLIENTE:
        raise HTTPException(
            status_code=429,
            detail="Tienes muchas solicitudes abiertas. Escríbenos en alguna de ellas mientras las respondemos.",
        )

    canal = data.canal if (equipo and data.id_cliente is not None) else "web"
    hoy = hoy_colombia()
    dias = svc.TIPOS[data.tipo]["dias"]
    momento = svc.ahora()
    pqr = Pqr(
        tipo=data.tipo,
        canal=canal,
        id_cliente=id_cliente,
        id_usuario_radica=usuario.id_usuario,
        id_reserva=data.id_reserva,
        asunto=data.asunto,
        descripcion=data.descripcion,
        pretension=data.pretension,
        autoriza_datos=True,
        estado="radicada",
        prioridad="alta" if data.tipo == "reclamo" else "normal",
        dias_termino=dias,
        fecha_radicacion=momento,
        fecha_inicio_termino=hoy,
        fecha_vencimiento=svc.calcular_vencimiento(hoy, dias),
    )
    db.add(pqr)
    db.flush()
    pqr.radicado = svc.generar_radicado(pqr)
    autor = f"{cliente.nombre} {cliente.apellido}".strip() if canal == "web" else None
    svc.registrar(
        db,
        pqr,
        "radicacion",
        f"Radicada por {'el cliente' if canal == 'web' else 'el equipo (canal: ' + canal + ')'}.",
        usuario,
        autor=autor,
    )
    crear_notificacion(
        db,
        tipo="pqr",
        titulo=f"Nueva {svc.TIPOS[data.tipo]['nombre'].lower()} {pqr.radicado}",
        mensaje=data.asunto,
        id_referencia=pqr.id_pqr,
        commit=False,
    )
    db.commit()
    db.refresh(pqr)
    _avisar(
        bg,
        pqr,
        "Recibimos tu solicitud",
        [
            f"Radicamos tu {svc.TIPOS[pqr.tipo]['nombre'].lower()} el {svc.fecha_legible(hoy)}. "
            "Guarda el número de radicado: con él puedes hacerle seguimiento.",
            "Si necesitamos un dato más te lo pediremos por este medio y en tu perfil.",
        ],
        destacado=(
            "Te respondemos a más tardar el",
            f"{svc.fecha_legible(pqr.fecha_vencimiento)} ({dias} días hábiles)",
        ),
    )
    return _detalle(pqr, equipo)


@router.get("/mias", response_model=list[PqrResumenOut])
def mis_pqr(db: Session = Depends(get_db), usuario: Usuario = Depends(get_usuario_verificado)):
    if usuario.id_cliente is None:
        return []
    filas = (
        db.query(Pqr)
        .options(joinedload(Pqr.cliente), joinedload(Pqr.responsable), joinedload(Pqr.actuaciones))
        .filter(Pqr.id_cliente == usuario.id_cliente)
        .order_by(Pqr.fecha_radicacion.desc(), Pqr.id_pqr.desc())
        .all()
    )
    hoy = hoy_colombia()
    return [svc.serializar_resumen(p, hoy) for p in filas]


@router.get("/gestion", response_model=PqrPagina)
def gestion(
    estado: str | None = Query(None, description="abiertas, finalizadas o un estado puntual"),
    tipo: str | None = None,
    categoria: str | None = Query(None, description="código de categoría o 'sin' para las no tipificadas"),
    responsable: str | None = Query(None, description="yo, sin o el id de un usuario"),
    plazo: str | None = Query(None, description="vencidas o por_vencer"),
    q: str | None = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    id_usuario: int = Depends(require_empleado),
):
    consulta = db.query(Pqr)
    if estado == "abiertas":
        consulta = consulta.filter(Pqr.estado.in_(svc.ABIERTAS))
    elif estado == "finalizadas":
        consulta = consulta.filter(Pqr.estado.in_(svc.FINALES))
    elif estado:
        consulta = consulta.filter(Pqr.estado == estado)
    if tipo:
        consulta = consulta.filter(Pqr.tipo == tipo)
    if categoria == "sin":
        consulta = consulta.filter(Pqr.categoria.is_(None))
    elif categoria:
        consulta = consulta.filter(Pqr.categoria == categoria)
    if responsable == "yo":
        consulta = consulta.filter(Pqr.id_responsable == id_usuario)
    elif responsable == "sin":
        consulta = consulta.filter(Pqr.id_responsable.is_(None))
    elif responsable and responsable.isdigit():
        consulta = consulta.filter(Pqr.id_responsable == int(responsable))
    if q:
        patron = f"%{q.strip()}%"
        consulta = consulta.join(Cliente, Cliente.id_cliente == Pqr.id_cliente).filter(
            or_(
                Pqr.radicado.ilike(patron),
                Pqr.asunto.ilike(patron),
                Cliente.nombre.ilike(patron),
                Cliente.apellido.ilike(patron),
                Cliente.cedula.ilike(patron),
            )
        )
    hoy = hoy_colombia()
    if plazo == "vencidas":
        consulta = consulta.filter(Pqr.estado.in_(("radicada", "en_tramite")), Pqr.fecha_vencimiento < hoy)
    elif plazo == "por_vencer":
        limite = sumar_dias_habiles(hoy, svc.DIAS_POR_VENCER)
        consulta = consulta.filter(
            Pqr.estado.in_(("radicada", "en_tramite")),
            Pqr.fecha_vencimiento >= hoy,
            Pqr.fecha_vencimiento <= limite,
        )

    total = consulta.with_entities(func.count(Pqr.id_pqr)).scalar() or 0
    # Primero lo abierto y lo que vence antes; luego lo finalizado más reciente.
    filas = (
        consulta.options(joinedload(Pqr.cliente), joinedload(Pqr.responsable), joinedload(Pqr.actuaciones))
        .order_by(
            Pqr.estado.in_(svc.FINALES),
            Pqr.fecha_vencimiento.asc(),
            Pqr.id_pqr.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [svc.serializar_resumen(p, hoy) for p in filas],
        "total": total,
        "page": page,
        "page_size": page_size,
        "resumen": _resumen(db, hoy),
    }


def _resumen(db: Session, hoy) -> dict:
    en_curso = ("radicada", "en_tramite")
    abiertas = db.query(func.count(Pqr.id_pqr)).filter(Pqr.estado.in_(svc.ABIERTAS)).scalar() or 0
    sin_asignar = (
        db.query(func.count(Pqr.id_pqr)).filter(Pqr.estado.in_(svc.ABIERTAS), Pqr.id_responsable.is_(None)).scalar()
        or 0
    )
    vencidas = (
        db.query(func.count(Pqr.id_pqr)).filter(Pqr.estado.in_(en_curso), Pqr.fecha_vencimiento < hoy).scalar() or 0
    )
    limite = sumar_dias_habiles(hoy, svc.DIAS_POR_VENCER)
    por_vencer = (
        db.query(func.count(Pqr.id_pqr))
        .filter(Pqr.estado.in_(en_curso), Pqr.fecha_vencimiento >= hoy, Pqr.fecha_vencimiento <= limite)
        .scalar()
        or 0
    )
    respondidas = db.query(func.count(Pqr.id_pqr)).filter(Pqr.respondida_a_tiempo.isnot(None)).scalar() or 0
    a_tiempo = db.query(func.count(Pqr.id_pqr)).filter(Pqr.respondida_a_tiempo.is_(True)).scalar() or 0
    promedio = db.query(func.avg(Pqr.satisfaccion)).filter(Pqr.satisfaccion.isnot(None)).scalar()
    sin_tipificar = (
        db.query(func.count(Pqr.id_pqr)).filter(Pqr.estado.in_(svc.ABIERTAS), Pqr.categoria.is_(None)).scalar() or 0
    )
    conteos = (
        db.query(Pqr.categoria, func.count(Pqr.id_pqr))
        .filter(Pqr.categoria.isnot(None))
        .group_by(Pqr.categoria)
        .order_by(func.count(Pqr.id_pqr).desc())
        .all()
    )
    ejemplos = db.query(func.count(Pqr.id_pqr)).filter(Pqr.es_ejemplo.is_(True)).scalar() or 0
    return {
        "sin_tipificar": sin_tipificar,
        "ejemplos": ejemplos,
        "por_categoria": [
            {"categoria": c, "nombre": svc.TIPIFICACION.get(c, {"nombre": c})["nombre"], "total": n} for c, n in conteos
        ],
        "abiertas": abiertas,
        "sin_asignar": sin_asignar,
        "por_vencer": por_vencer,
        "vencidas": vencidas,
        "respondidas": respondidas,
        "a_tiempo_pct": round(a_tiempo * 100 / respondidas) if respondidas else None,
        "satisfaccion_promedio": round(float(promedio), 1) if promedio is not None else None,
    }


@router.get("/gestion/tipificaciones", response_model=list[PqrCategoriaOut])
def tipificaciones(_id: int = Depends(require_empleado)):
    """Catálogo de categorías y motivos para tipificar."""
    return [{"categoria": k, "nombre": v["nombre"], "motivos": v["motivos"]} for k, v in svc.TIPIFICACION.items()]


@router.post("/gestion/ejemplos", response_model=PqrEjemplosOut, status_code=201)
def cargar_ejemplos(
    data: PqrEjemplosIn,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    id_usuario: int = Depends(require_admin),
):
    """Crea PQR de ejemplo, en distintos estados, para el cliente indicado.
    Quedan marcadas «Ejemplo» y se borran todas con DELETE /gestion/ejemplos."""
    cliente = db.query(Cliente).filter(Cliente.id_cliente == data.id_cliente).first()
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    admin = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    creadas = crear_ejemplos(db, cliente, admin)
    db.commit()
    # Los correos de las que ya tienen respuesta, para ver cómo le llegan al cliente.
    for pqr in creadas:
        db.refresh(pqr)
        if pqr.respuesta and pqr.decision:
            _avisar(
                bg,
                pqr,
                "Respondimos tu solicitud",
                [pqr.respuesta],
                destacado=("Nuestra decisión", TEXTO_DECISION[pqr.decision]),
                tono={"favorable": "exito", "parcial": "alerta", "desfavorable": "error"}.get(pqr.decision, "info"),
            )
    return {"creadas": len(creadas)}


@router.delete("/gestion/ejemplos", response_model=PqrEjemplosOut)
def borrar_ejemplos(db: Session = Depends(get_db), _id: int = Depends(require_admin)):
    borradas = 0
    for pqr in db.query(Pqr).filter(Pqr.es_ejemplo.is_(True)).all():
        db.delete(pqr)
        borradas += 1
    db.commit()
    return {"creadas": 0, "borradas": borradas}


@router.get("/gestion/responsables", response_model=list[PqrResponsableOut])
def responsables(db: Session = Depends(get_db), _id: int = Depends(require_empleado)):
    usuarios = (
        db.query(Usuario)
        .join(UsuarioRol, UsuarioRol.id_usuario == Usuario.id_usuario)
        .join(Rol, Rol.id_rol == UsuarioRol.id_rol)
        .filter(Rol.nombre_rol.in_(("admin", "empleado")), or_(Usuario.activo.is_(True), Usuario.activo.is_(None)))
        .distinct()
        .all()
    )
    return sorted(
        ({"id_usuario": u.id_usuario, "nombre": svc.nombre_usuario(u)} for u in usuarios),
        key=lambda r: r["nombre"].lower(),
    )


@router.get("/{id_pqr}", response_model=PqrDetalleOut)
def ver(id_pqr: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_usuario_verificado)):
    pqr, equipo = _cargar_con_acceso(db, id_pqr, usuario)
    return _detalle(pqr, equipo)


@router.post("/{id_pqr}/mensajes", response_model=PqrDetalleOut, status_code=201)
def escribir(
    id_pqr: int,
    data: PqrMensajeCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_verificado),
):
    pqr, equipo = _cargar_con_acceso(db, id_pqr, usuario)
    _exigir_abierta(pqr)
    if data.interna and not equipo:
        raise HTTPException(status_code=403, detail="Solo el equipo puede dejar notas internas")

    es_del_cliente = usuario.id_cliente == pqr.id_cliente and not data.interna
    if not es_del_cliente:
        tipo = "nota_interna" if data.interna else "mensaje_equipo"
        svc.registrar(db, pqr, tipo, data.texto, usuario, visible=not data.interna)
        if not data.interna:
            if pqr.estado == "radicada":
                pqr.estado = "en_tramite"
            if pqr.id_responsable is None:
                pqr.id_responsable = usuario.id_usuario
            crear_notificacion(
                db,
                tipo="pqr",
                titulo=f"Nuevo mensaje en tu solicitud {pqr.radicado}",
                mensaje=data.texto[:180],
                id_referencia=pqr.id_pqr,
                id_cliente=pqr.id_cliente,
                commit=False,
            )
            _avisar(
                bg,
                pqr,
                "Te escribimos sobre tu solicitud",
                ["Puedes responder desde tu perfil, en la sección Solicitudes PQR."],
                destacado=(f"Mensaje de {svc.nombre_usuario(usuario)}", data.texto),
            )
    else:
        autor = svc.nombre_cliente(pqr)
        svc.registrar(db, pqr, "mensaje_cliente", data.texto, usuario, autor=autor)
        if pqr.estado == "esperando_cliente":
            # Art. 17 Ley 1755: el plazo vuelve a empezar cuando el cliente
            # completa lo que se le pidió.
            hoy = hoy_colombia()
            pqr.estado = "en_tramite"
            pqr.fecha_inicio_termino = hoy
            pqr.fecha_vencimiento = svc.calcular_vencimiento(hoy, pqr.dias_termino)
            pqr.prorrogada = False
            pqr.fecha_vencimiento_original = None
            svc.registrar(
                db,
                pqr,
                "estado",
                f"El cliente completó la información. El plazo vuelve a correr: "
                f"respuesta a más tardar el {svc.fecha_legible(pqr.fecha_vencimiento)}.",
                None,
            )
        crear_notificacion(
            db,
            tipo="pqr",
            titulo=f"El cliente respondió en {pqr.radicado}",
            mensaje=data.texto[:180],
            id_referencia=pqr.id_pqr,
            commit=False,
        )
    db.commit()
    db.refresh(pqr)
    return _detalle(pqr, equipo)


@router.post("/{id_pqr}/desistir", response_model=PqrDetalleOut)
def desistir(
    id_pqr: int,
    data: PqrDesistimiento,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_verificado),
):
    pqr, equipo = _cargar_con_acceso(db, id_pqr, usuario)
    if usuario.id_cliente != pqr.id_cliente:
        raise HTTPException(status_code=403, detail="Solo quien radicó la solicitud puede desistir de ella")
    _exigir_abierta(pqr)
    pqr.estado = "desistida"
    pqr.fecha_cierre = svc.ahora()
    svc.registrar(
        db,
        pqr,
        "desistimiento",
        data.motivo or "El cliente desistió de la solicitud.",
        usuario,
        autor=svc.nombre_cliente(pqr),
    )
    db.commit()
    db.refresh(pqr)
    return _detalle(pqr, equipo)


@router.post("/{id_pqr}/calificar", response_model=PqrDetalleOut)
def calificar(
    id_pqr: int,
    data: PqrCalificacion,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_verificado),
):
    pqr, equipo = _cargar_con_acceso(db, id_pqr, usuario)
    if usuario.id_cliente != pqr.id_cliente:
        raise HTTPException(status_code=403, detail="Solo quien radicó la solicitud puede calificar la respuesta")
    if pqr.estado != "respondida":
        raise HTTPException(status_code=409, detail="Solo puedes calificar una solicitud ya respondida")
    pqr.satisfaccion = data.satisfaccion
    pqr.comentario_satisfaccion = (data.comentario or "").strip() or None
    pqr.estado = "cerrada"
    pqr.fecha_cierre = svc.ahora()
    svc.registrar(
        db,
        pqr,
        "calificacion",
        f"Calificó la atención con {data.satisfaccion} de 5."
        + (f" {pqr.comentario_satisfaccion}" if pqr.comentario_satisfaccion else ""),
        usuario,
        autor=svc.nombre_cliente(pqr),
    )
    db.commit()
    db.refresh(pqr)
    return _detalle(pqr, equipo)


# ─── equipo ───────────────────────────────────────────────────────────────


def _cargar_equipo(db: Session, id_pqr: int, id_usuario: int) -> tuple[Pqr, Usuario]:
    pqr = _cargar(db, id_pqr)
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    return pqr, usuario


@router.patch("/{id_pqr}/gestion", response_model=PqrDetalleOut)
def actualizar_gestion(
    id_pqr: int,
    data: PqrGestionUpdate,
    db: Session = Depends(get_db),
    id_usuario: int = Depends(require_empleado),
):
    pqr, usuario = _cargar_equipo(db, id_pqr, id_usuario)
    _exigir_abierta(pqr)
    if data.id_responsable is not None:
        if data.id_responsable == 0:
            if pqr.id_responsable is not None:
                pqr.id_responsable = None
                svc.registrar(db, pqr, "asignacion", "Quedó sin responsable.", usuario, visible=False)
        else:
            nuevo = db.query(Usuario).filter(Usuario.id_usuario == data.id_responsable).first()
            if nuevo is None or not _es_equipo(db, nuevo):
                raise HTTPException(status_code=422, detail="El responsable debe ser alguien del equipo")
            if pqr.id_responsable != nuevo.id_usuario:
                pqr.id_responsable = nuevo.id_usuario
                svc.registrar(db, pqr, "asignacion", f"Asignada a {svc.nombre_usuario(nuevo)}.", usuario, visible=False)
    if data.categoria is not None or data.motivo is not None:
        if not data.categoria or not data.motivo or not svc.tipificacion_valida(data.categoria, data.motivo):
            raise HTTPException(status_code=422, detail="Elige una categoría y un motivo válidos")
        if (pqr.categoria, pqr.motivo) != (data.categoria, data.motivo):
            antes = (
                f"{svc.TIPIFICACION.get(pqr.categoria, {'nombre': pqr.categoria})['nombre']} → {pqr.motivo}"
                if pqr.categoria
                else None
            )
            pqr.categoria = data.categoria
            pqr.motivo = data.motivo
            pqr.id_usuario_tipifica = id_usuario
            pqr.fecha_tipificacion = svc.ahora()
            nombre = svc.TIPIFICACION[data.categoria]["nombre"]
            svc.registrar(
                db,
                pqr,
                "tipificacion",
                f"Tipificada: {nombre} → {data.motivo}." + (f" (antes {antes})" if antes else ""),
                usuario,
                visible=False,
            )
    if data.prioridad and data.prioridad != pqr.prioridad:
        pqr.prioridad = data.prioridad
        svc.registrar(db, pqr, "estado", f"Prioridad: {data.prioridad}.", usuario, visible=False)
    if data.estado == "en_tramite" and pqr.estado == "radicada":
        pqr.estado = "en_tramite"
        svc.registrar(db, pqr, "estado", "Tu solicitud está en trámite.", usuario)
        if pqr.id_responsable is None:
            pqr.id_responsable = id_usuario
    db.commit()
    db.refresh(pqr)
    return _detalle(pqr, True)


@router.post("/{id_pqr}/solicitar-informacion", response_model=PqrDetalleOut)
def solicitar_informacion(
    id_pqr: int,
    data: PqrSolicitarInformacion,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    id_usuario: int = Depends(require_empleado),
):
    pqr, usuario = _cargar_equipo(db, id_pqr, id_usuario)
    _exigir_abierta(pqr)
    if not svc.puede_solicitar_informacion(pqr):
        raise HTTPException(
            status_code=409,
            detail=(
                "Solo se puede pedir información una vez y dentro de los 10 días hábiles siguientes a la radicación"
            ),
        )
    pqr.estado = "esperando_cliente"
    pqr.fecha_solicitud_informacion = svc.ahora()
    if pqr.id_responsable is None:
        pqr.id_responsable = id_usuario
    svc.registrar(db, pqr, "solicitud_informacion", data.texto, usuario)
    crear_notificacion(
        db,
        tipo="pqr",
        titulo=f"Necesitamos un dato para tu solicitud {pqr.radicado}",
        mensaje=data.texto[:180],
        id_referencia=pqr.id_pqr,
        id_cliente=pqr.id_cliente,
        commit=False,
    )
    db.commit()
    db.refresh(pqr)
    _avisar(
        bg,
        pqr,
        "Necesitamos información para tu solicitud",
        [
            "Mientras nos respondes, el plazo queda en pausa y vuelve a empezar cuando nos envíes lo que falta. "
            "Si en un mes no recibimos respuesta, podremos archivar la solicitud; siempre puedes radicarla de nuevo.",
        ],
        destacado=("Lo que necesitamos", data.texto),
        tono="alerta",
    )
    return _detalle(pqr, True)


@router.post("/{id_pqr}/prorrogar", response_model=PqrDetalleOut)
def prorrogar(
    id_pqr: int,
    data: PqrProrroga,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    id_usuario: int = Depends(require_empleado),
):
    pqr, usuario = _cargar_equipo(db, id_pqr, id_usuario)
    _exigir_abierta(pqr)
    if not svc.puede_prorrogar(pqr):
        raise HTTPException(
            status_code=409,
            detail="La prórroga se puede pedir una sola vez y antes de que venza el plazo",
        )
    if data.dias_adicionales > pqr.dias_termino:
        raise HTTPException(
            status_code=422,
            detail=f"El nuevo plazo no puede superar el doble del inicial: máximo {pqr.dias_termino} días más",
        )
    pqr.fecha_vencimiento_original = pqr.fecha_vencimiento
    pqr.fecha_vencimiento = sumar_dias_habiles(pqr.fecha_vencimiento, data.dias_adicionales)
    pqr.prorrogada = True
    pqr.motivo_prorroga = data.motivo
    if pqr.estado == "radicada":
        pqr.estado = "en_tramite"
    texto = (
        f"Ampliamos el plazo de respuesta hasta el {svc.fecha_legible(pqr.fecha_vencimiento)}. Motivo: {data.motivo}"
    )
    svc.registrar(db, pqr, "prorroga", texto, usuario)
    crear_notificacion(
        db,
        tipo="pqr",
        titulo=f"Ampliamos el plazo de tu solicitud {pqr.radicado}",
        mensaje=texto[:180],
        id_referencia=pqr.id_pqr,
        id_cliente=pqr.id_cliente,
        commit=False,
    )
    db.commit()
    db.refresh(pqr)
    _avisar(
        bg,
        pqr,
        "Ampliamos el plazo de tu solicitud",
        [f"Motivo: {data.motivo}"],
        destacado=("Nueva fecha límite", svc.fecha_legible(pqr.fecha_vencimiento)),
        tono="alerta",
    )
    return _detalle(pqr, True)


TEXTO_DECISION = {
    "favorable": "Accedemos a lo que pediste.",
    "parcial": "Accedemos parcialmente a lo que pediste.",
    "desfavorable": "No accedemos a lo que pediste.",
    "informativa": "Te damos la información que pediste.",
}


@router.post("/{id_pqr}/responder", response_model=PqrDetalleOut)
def responder(
    id_pqr: int,
    data: PqrRespuesta,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    id_usuario: int = Depends(require_empleado),
):
    pqr, usuario = _cargar_equipo(db, id_pqr, id_usuario)
    _exigir_abierta(pqr)
    if pqr.estado == "esperando_cliente":
        raise HTTPException(status_code=409, detail="Estamos esperando información del cliente")
    if not pqr.categoria:
        raise HTTPException(status_code=409, detail="Tipifica la PQR (categoría y motivo) antes de responder")
    if pqr.tipo == "reclamo" and data.decision == "informativa":
        raise HTTPException(
            status_code=422,
            detail="En un reclamo hay que decir expresamente si se accede, se accede en parte o no se accede",
        )
    if data.decision in ("parcial", "desfavorable") and len(data.respuesta) < 80:
        raise HTTPException(
            status_code=422,
            detail="Si no accedes a todo lo pedido, explica los motivos de hecho y de derecho (mínimo 80 caracteres)",
        )
    hoy = hoy_colombia()
    pqr.decision = data.decision
    pqr.respuesta = data.respuesta.strip()
    pqr.fecha_respuesta = svc.ahora()
    pqr.id_usuario_responde = id_usuario
    pqr.respondida_a_tiempo = hoy <= pqr.fecha_vencimiento
    pqr.estado = "respondida"
    if pqr.id_responsable is None:
        pqr.id_responsable = id_usuario
    svc.registrar(db, pqr, "respuesta", pqr.respuesta, usuario)
    crear_notificacion(
        db,
        tipo="pqr",
        titulo=f"Respondimos tu solicitud {pqr.radicado}",
        mensaje=TEXTO_DECISION[data.decision],
        id_referencia=pqr.id_pqr,
        id_cliente=pqr.id_cliente,
        commit=False,
    )
    db.commit()
    db.refresh(pqr)
    nota = None
    if pqr.tipo in ("reclamo", "queja") and data.decision in ("parcial", "desfavorable"):
        nota = (
            "Si no estás de acuerdo con esta respuesta, puedes acudir a la Superintendencia de Industria y "
            "Comercio (www.sic.gov.co), autoridad de protección al consumidor, con tu número de radicado."
        )
    tono = {"favorable": "exito", "parcial": "alerta", "desfavorable": "error"}.get(data.decision, "info")
    _avisar(
        bg,
        pqr,
        "Respondimos tu solicitud",
        [pqr.respuesta, "Cuéntanos en tu perfil cómo te pareció la atención: tu calificación cierra la solicitud."],
        destacado=("Nuestra decisión", TEXTO_DECISION[data.decision]),
        tono=tono,
        nota=nota,
    )
    return _detalle(pqr, True)


@router.post("/{id_pqr}/cerrar", response_model=PqrDetalleOut)
def cerrar(
    id_pqr: int,
    data: PqrCierre,
    db: Session = Depends(get_db),
    id_usuario: int = Depends(require_empleado),
):
    """Cierra una respondida que el cliente no calificó, o archiva por
    desistimiento tácito una que lleva un mes esperando información."""
    pqr, usuario = _cargar_equipo(db, id_pqr, id_usuario)
    if pqr.estado == "respondida":
        pqr.estado = "cerrada"
        texto = f"Cerrada. {data.motivo}"
    elif svc.puede_archivar_por_desistimiento(pqr):
        pqr.estado = "desistida"
        texto = f"Archivada por desistimiento tácito: no recibimos la información pedida en un mes. {data.motivo}"
    else:
        raise HTTPException(
            status_code=409,
            detail="Solo se cierra una solicitud respondida, o una que lleva un mes esperando información del cliente",
        )
    pqr.fecha_cierre = svc.ahora()
    svc.registrar(db, pqr, "cierre", texto, usuario)
    db.commit()
    db.refresh(pqr)
    return _detalle(pqr, True)


@router.get("/gestion/cliente/{id_cliente}", response_model=list[PqrResumenOut])
def pqr_de_cliente(id_cliente: int, db: Session = Depends(get_db), _id: int = Depends(require_empleado)):
    filas = (
        db.query(Pqr)
        .options(joinedload(Pqr.cliente), joinedload(Pqr.responsable), joinedload(Pqr.actuaciones))
        .filter(Pqr.id_cliente == id_cliente)
        .order_by(Pqr.id_pqr.desc())
        .all()
    )
    hoy = hoy_colombia()
    return [svc.serializar_resumen(p, hoy) for p in filas]
