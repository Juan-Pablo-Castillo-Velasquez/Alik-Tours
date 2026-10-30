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
