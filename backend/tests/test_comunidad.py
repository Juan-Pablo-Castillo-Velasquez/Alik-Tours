"""Comunidad viajera: publicaciones con moderación previa, comentarios entre
clientes y notificaciones (ver app/routes/comunidad_route.py)."""

import asyncio

import pytest
from fastapi import HTTPException

from app.models.cliente_model import Cliente
from app.models.notificacion_model import Notificacion
from app.models.user_model import Usuario
from app.routes import comunidad_route
from app.schemas.comunidad_schema import ComentarioCreate, ModerarPublicacion


def _cliente_con_usuario(db, cedula, nombre="Ana", apellido="Gómez"):
    cliente = Cliente(nombre=nombre, apellido=apellido, cedula=cedula, correo=f"{cedula}@test.com")
    db.add(cliente)
    db.commit()
    usuario = Usuario(
        username=f"u{cedula}",
        correo_electronico=f"{cedula}@test.com",
        password_hash="x",
        id_cliente=cliente.id_cliente,
        activo=True,
        verificado=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return cliente, usuario


def _publicar(db, usuario, titulo="Mi viaje a Cartagena"):
    return asyncio.run(
        comunidad_route.crear_publicacion(
            titulo=titulo,
            contenido="Todo salió perfecto, el hotel y los traslados a tiempo.",
            calificacion=5,
            destino="Cartagena",
            video=None,
            imagenes=None,
            db=db,
            current_user=usuario,
        )
    )


def _listar(db):
    return comunidad_route.listar_publicaciones(skip=0, limit=10, db=db)


def test_publicacion_nace_pendiente_y_no_se_ve_hasta_aprobarla(db):
    _, usuario = _cliente_con_usuario(db, "2000000001")
    pub = _publicar(db, usuario)

    assert pub.estado == "pendiente"
    assert pub.autor.nombre == "Ana G."  # nunca el apellido completo
    assert _listar(db).total == 0
    assert db.query(Notificacion).filter(Notificacion.id_cliente.is_(None)).count() == 1

    comunidad_route.admin_moderar(pub.id_publicacion, ModerarPublicacion(estado="aprobada"), db=db, moderador_id=1)

    listado = _listar(db)
    assert listado.total == 1
    assert listado.items[0].titulo == "Mi viaje a Cartagena"
    aviso = db.query(Notificacion).filter(Notificacion.id_cliente == usuario.id_cliente).one()
    assert aviso.titulo == "Tu publicación ya está en la comunidad"


def test_comentar_solo_en_publicaciones_aprobadas_y_avisa_al_autor(db):
    autor_cliente, autor = _cliente_con_usuario(db, "2000000002")
    _, otro = _cliente_con_usuario(db, "2000000003", nombre="Luis", apellido="Pérez")
    pub = _publicar(db, autor)

    with pytest.raises(HTTPException) as exc:
        comunidad_route.comentar(pub.id_publicacion, ComentarioCreate(contenido="¡Qué bien!"), db=db, current_user=otro)
    assert exc.value.status_code == 404

    comunidad_route.admin_moderar(pub.id_publicacion, ModerarPublicacion(estado="aprobada"), db=db, moderador_id=1)
    comentario = comunidad_route.comentar(
        pub.id_publicacion, ComentarioCreate(contenido="¡Qué bien!"), db=db, current_user=otro
    )
    assert comentario.autor.nombre == "Luis P."
    assert _listar(db).items[0].total_comentarios == 1
    titulos = [
        n.titulo for n in db.query(Notificacion).filter(Notificacion.id_cliente == autor_cliente.id_cliente).all()
    ]
    assert "Comentaron tu publicación" in titulos


def test_comentario_oculto_no_se_muestra(db):
    _, autor = _cliente_con_usuario(db, "2000000004")
    _, otro = _cliente_con_usuario(db, "2000000005")
    pub = _publicar(db, autor)
    comunidad_route.admin_moderar(pub.id_publicacion, ModerarPublicacion(estado="aprobada"), db=db, moderador_id=1)
    c = comunidad_route.comentar(pub.id_publicacion, ComentarioCreate(contenido="spam"), db=db, current_user=otro)

    from app.schemas.comunidad_schema import OcultarComentario

    comunidad_route.admin_ocultar_comentario(c.id_comentario, OcultarComentario(oculto=True), db=db, moderador_id=1)
    assert _listar(db).items[0].total_comentarios == 0


def test_solo_el_autor_borra_su_publicacion(db):
    _, autor = _cliente_con_usuario(db, "2000000006")
    _, otro = _cliente_con_usuario(db, "2000000007")
    pub = _publicar(db, autor)

    with pytest.raises(HTTPException) as exc:
        comunidad_route.borrar_publicacion(pub.id_publicacion, db=db, current_user=otro)
    assert exc.value.status_code == 404

    comunidad_route.borrar_publicacion(pub.id_publicacion, db=db, current_user=autor)
    assert comunidad_route.mis_publicaciones(db=db, current_user=autor) == []


def test_usuario_sin_cliente_no_puede_publicar(db):
    admin = Usuario(username="staff", correo_electronico="staff@test.com", password_hash="x", activo=True)
    db.add(admin)
    db.commit()
    with pytest.raises(HTTPException) as exc:
        _publicar(db, admin)
    assert exc.value.status_code == 403


# ---------------------------------------------------------------------------
# Comentarios del equipo, respuestas, "lo mío" en el listado público y
# videos de la agencia (comentarios, paquete promocional, página de inicio).
# ---------------------------------------------------------------------------

from app.core.security import create_access_token  # noqa: E402
from app.models.comunidad_model import ComentarioComunidad, VideoAgencia  # noqa: E402
from app.models.reserva_model import Paquete  # noqa: E402
from app.schemas.comunidad_schema import VideoAgenciaUpdate  # noqa: E402


def _staff(db, username="asesor1"):
    u = Usuario(username=username, correo_electronico=f"{username}@test.com", password_hash="x", activo=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    token = "Bearer " + create_access_token(data={"sub": str(u.id_usuario), "roles": ["empleado"]})
    return u, token


def _publicacion_aprobada(db, autor):
    pub = _publicar(db, autor)
    comunidad_route.admin_moderar(pub.id_publicacion, ModerarPublicacion(estado="aprobada"), db=db, moderador_id=1)
    return pub


def _video(db, **extra):
    datos = {"titulo": "Así fue Cartagena", "video_url": "/uploads/videos-agencia/v.mp4", "activo": True, **extra}
    v = VideoAgencia(**datos)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def test_el_equipo_comenta_como_la_agencia(db):
    _, autor = _cliente_con_usuario(db, "2000000010")
    asesor, token = _staff(db)
    pub = _publicacion_aprobada(db, autor)

    c = comunidad_route.comentar(
        pub.id_publicacion,
        ComentarioCreate(contenido="¡Gracias por viajar con nosotros!"),
        db=db,
        current_user=asesor,
        authorization=token,
    )

    assert c.autor.es_equipo is True
    assert c.autor.nombre == comunidad_route.NOMBRE_EQUIPO
    assert c.es_mio is True


def test_usuario_sin_cliente_ni_rol_no_puede_comentar(db):
    _, autor = _cliente_con_usuario(db, "2000000011")
    sin_rol = Usuario(username="nadie", correo_electronico="nadie@test.com", password_hash="x", activo=True)
    db.add(sin_rol)
    db.commit()
    pub = _publicacion_aprobada(db, autor)
    with pytest.raises(HTTPException) as exc:
        comunidad_route.comentar(pub.id_publicacion, ComentarioCreate(contenido="hola"), db=db, current_user=sin_rol)
    assert exc.value.status_code == 403


def test_responder_un_comentario_avisa_a_quien_comento(db):
    _, autor = _cliente_con_usuario(db, "2000000012")
    otro_cliente, otro = _cliente_con_usuario(db, "2000000013", nombre="Luis")
    pub = _publicacion_aprobada(db, autor)
    principal = comunidad_route.comentar(
        pub.id_publicacion, ComentarioCreate(contenido="¿Qué hotel era?"), db=db, current_user=otro
    )

    respuesta = comunidad_route.comentar(
        pub.id_publicacion,
        ComentarioCreate(contenido="El de la playa", id_padre=principal.id_comentario),
        db=db,
        current_user=autor,
    )
    # Responder a una respuesta cuelga del mismo comentario principal (un nivel).
    otra = comunidad_route.comentar(
        pub.id_publicacion,
        ComentarioCreate(contenido="¡Gracias!", id_padre=respuesta.id_comentario),
        db=db,
        current_user=otro,
    )

    assert respuesta.id_padre == principal.id_comentario
    assert otra.id_padre == principal.id_comentario
    avisos = [n.titulo for n in db.query(Notificacion).filter(Notificacion.id_cliente == otro_cliente.id_cliente)]
    assert "Respondieron tu comentario" in avisos


def test_no_se_responde_un_comentario_de_otra_publicacion(db):
    _, autor = _cliente_con_usuario(db, "2000000014")
    pub1 = _publicacion_aprobada(db, autor)
    pub2 = _publicacion_aprobada(db, autor)
    c = comunidad_route.comentar(pub1.id_publicacion, ComentarioCreate(contenido="uno"), db=db, current_user=autor)
    with pytest.raises(HTTPException) as exc:
        comunidad_route.comentar(
            pub2.id_publicacion, ComentarioCreate(contenido="dos", id_padre=c.id_comentario), db=db, current_user=autor
        )
    assert exc.value.status_code == 404


def test_el_listado_publico_marca_lo_propio_si_hay_sesion(db):
    _, autor = _cliente_con_usuario(db, "2000000015")
    _, otro = _cliente_con_usuario(db, "2000000016")
    pub = _publicacion_aprobada(db, autor)
    comunidad_route.comentar(pub.id_publicacion, ComentarioCreate(contenido="mío"), db=db, current_user=otro)

    anonimo = comunidad_route.listar_publicaciones(skip=0, limit=10, db=db)
    con_sesion = comunidad_route.listar_publicaciones(skip=0, limit=10, db=db, usuario=otro)
    del_autor = comunidad_route.listar_publicaciones(skip=0, limit=10, db=db, usuario=autor)

    assert anonimo.items[0].comentarios[0].es_mio is False
    assert con_sesion.items[0].comentarios[0].es_mio is True
    assert del_autor.items[0].es_mia is True


def test_el_autor_borra_su_comentario_y_sus_respuestas(db):
    _, autor = _cliente_con_usuario(db, "2000000017")
    _, otro = _cliente_con_usuario(db, "2000000018")
    pub = _publicacion_aprobada(db, autor)
    c = comunidad_route.comentar(pub.id_publicacion, ComentarioCreate(contenido="hola"), db=db, current_user=otro)
    comunidad_route.comentar(
        pub.id_publicacion, ComentarioCreate(contenido="resp", id_padre=c.id_comentario), db=db, current_user=autor
    )

    with pytest.raises(HTTPException):
        comunidad_route.borrar_comentario(c.id_comentario, db=db, current_user=autor)
    comunidad_route.borrar_comentario(c.id_comentario, db=db, current_user=otro)

    assert db.query(ComentarioComunidad).count() == 0


def test_respuesta_de_un_comentario_oculto_tampoco_se_ve(db):
    from app.schemas.comunidad_schema import OcultarComentario

    _, autor = _cliente_con_usuario(db, "2000000019")
    pub = _publicacion_aprobada(db, autor)
    c = comunidad_route.comentar(pub.id_publicacion, ComentarioCreate(contenido="spam"), db=db, current_user=autor)
    comunidad_route.comentar(
        pub.id_publicacion, ComentarioCreate(contenido="resp", id_padre=c.id_comentario), db=db, current_user=autor
    )
    comunidad_route.admin_ocultar_comentario(c.id_comentario, OcultarComentario(oculto=True), db=db, moderador_id=1)

    assert _listar(db).items[0].total_comentarios == 0


def test_comentar_un_video_de_la_agencia_avisa_al_equipo(db):
    _, cliente = _cliente_con_usuario(db, "2000000020")
    asesor, token = _staff(db, "asesor2")
    v = _video(db)

    c = comunidad_route.comentar_video(
        v.id_video, ComentarioCreate(contenido="¡Quiero ir!"), db=db, current_user=cliente
    )
    comunidad_route.comentar_video(
        v.id_video,
        ComentarioCreate(contenido="¡Te esperamos!", id_padre=c.id_comentario),
        db=db,
        current_user=asesor,
        authorization=token,
    )

    videos = comunidad_route.listar_videos_agencia(id_paquete=None, inicio=False, db=db, usuario=cliente)
    assert videos[0].total_comentarios == 2
    assert videos[0].comentarios[0].es_mio is True
    assert videos[0].comentarios[1].autor.es_equipo is True
    interno = db.query(Notificacion).filter(Notificacion.id_cliente.is_(None)).all()
    assert any(n.titulo == "Nuevo comentario en un video de la agencia" for n in interno)


def test_no_se_comenta_un_video_oculto(db):
    _, cliente = _cliente_con_usuario(db, "2000000021")
    v = _video(db, activo=False)
    with pytest.raises(HTTPException) as exc:
        comunidad_route.comentar_video(v.id_video, ComentarioCreate(contenido="hola"), db=db, current_user=cliente)
    assert exc.value.status_code == 404


def test_videos_por_paquete_y_destacados_del_inicio(db):
    paquete = Paquete(nombre_paquete="Cartagena 4 días", precio_base=1000)
    db.add(paquete)
    db.commit()
    promo = _video(db, id_paquete=paquete.id_paquete)
    inicio = _video(db, mostrar_inicio=True)

    del_paquete = comunidad_route.listar_videos_agencia(id_paquete=paquete.id_paquete, inicio=False, db=db)
    del_inicio = comunidad_route.listar_videos_agencia(id_paquete=None, inicio=True, db=db)

    assert [v.id_video for v in del_paquete] == [promo.id_video]
    assert del_paquete[0].nombre_paquete == "Cartagena 4 días"
    assert [v.id_video for v in del_inicio] == [inicio.id_video]


def test_admin_asocia_y_quita_el_paquete_de_un_video(db):
    paquete = Paquete(nombre_paquete="Santa Marta", precio_base=900)
    db.add(paquete)
    db.commit()
    v = _video(db)

    r = comunidad_route.admin_editar_video(
        v.id_video, VideoAgenciaUpdate(id_paquete=paquete.id_paquete, mostrar_inicio=True), db=db, admin_id=1
    )
    assert (r.id_paquete, r.mostrar_inicio) == (paquete.id_paquete, True)

    r = comunidad_route.admin_editar_video(v.id_video, VideoAgenciaUpdate(id_paquete=0), db=db, admin_id=1)
    assert r.id_paquete is None

    with pytest.raises(HTTPException) as exc:
        comunidad_route.admin_editar_video(v.id_video, VideoAgenciaUpdate(id_paquete=9999), db=db, admin_id=1)
    assert exc.value.status_code == 422
