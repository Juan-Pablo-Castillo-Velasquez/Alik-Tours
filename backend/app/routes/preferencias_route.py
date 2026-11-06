from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import exigir_propietario_o_admin, get_current_usuario
from app.models.cliente_model import PreferenciaCliente
from app.models.hotel_model import Habitacion, Hotel, HotelCaracteristica
from app.models.reserva_model import Paquete, PaqueteHotel, PaqueteServicio
from app.models.servicio_model import Servicio
from app.models.user_model import Usuario
from app.schemas.hotel_schema import HotelDetailResponse
from app.schemas.reserva_schema import PaqueteResponse

router = APIRouter(prefix="/api/preferencias-cliente", tags=["Preferencias"])


class PreferenciaCreate(BaseModel):
    id_cliente: int
    intereses: list[str] | None = []
    compania: str | None = None
    presupuesto: str | None = None
    clima: str | None = None
    ritmo: str | None = None
    transporte: str | None = None


class PreferenciaResponse(BaseModel):
    id_preferencia: int
    id_cliente: int
    intereses: list[str] | None = []
    compania: str | None = None
    presupuesto: str | None = None
    clima: str | None = None
    ritmo: str | None = None
    transporte: str | None = None

    model_config = ConfigDict(from_attributes=True)


@router.post("/", response_model=PreferenciaResponse, status_code=201)
def create_preferencia(
    data: PreferenciaCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_usuario)
):
    # Validar que el usuario está autenticado
    if not current_user:
        raise HTTPException(status_code=401, detail="No autenticado")

    # Si el usuario no tiene id_cliente, rechazar
    if not current_user.id_cliente:
        raise HTTPException(status_code=400, detail="Debes completar tu perfil de cliente primero")

    # Validar que el id_cliente pertenece al usuario autenticado
    if current_user.id_cliente != data.id_cliente:
        raise HTTPException(status_code=403, detail="No tienes permiso para guardar preferencias de otro cliente")

    existente = db.query(PreferenciaCliente).filter(PreferenciaCliente.id_cliente == data.id_cliente).first()
    if existente:
        # Actualiza si ya existe
        for key, value in data.model_dump(exclude={"id_cliente"}).items():
            setattr(existente, key, value)
        db.commit()
        db.refresh(existente)
        return existente

    preferencia = PreferenciaCliente(**data.model_dump())
    db.add(preferencia)
    db.commit()
    db.refresh(preferencia)
    return preferencia


@router.get("/{cliente_id}", response_model=PreferenciaResponse)
def get_preferencia(
    cliente_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
    authorization: str | None = Header(None),
):
    # IDOR corregido (Fase 0 del plan de mejora): este endpoint exigía sesión
    # pero nunca comparaba el cliente_id de la URL contra el del usuario
    # autenticado, a diferencia de create_preferencia (arriba) y
    # get_sugerencias (abajo) — cualquier cliente logueado podía leer las
    # preferencias de cualquier otro cambiando el número en la URL.
    exigir_propietario_o_admin(current_user, cliente_id, authorization)

    preferencia = db.query(PreferenciaCliente).filter(PreferenciaCliente.id_cliente == cliente_id).first()
    if not preferencia:
        raise HTTPException(status_code=404, detail="Preferencias no encontradas")
    return preferencia


# ─── Motor de sugerencias de paquetes ──────────────────────────────────────

# Palabras clave asociadas a cada interés, usadas para puntuar coincidencias
# contra la categoría del servicio, su descripción y la descripción del
# destino asociado (los datos semilla no tienen una relación directa
# interés -> categoría, así que se aproxima por texto).
_KEYWORDS_INTERES = {
    "beach": ["playa", "mar", "isla", "buceo", "caribe"],
    "nature": ["ecoturismo", "natural", "senderismo", "caminata", "valle", "desierto", "río", "reserva"],
    "culture": ["cultura", "museo", "histór", "religios", "patrimonio"],
    "food": ["gastronom"],
    "adventure": ["aventura", "deporte", "escalada", "extremo", "buceo"],
    "wellness": ["spa", "relaj", "bienestar", "descanso"],
}

_RANGOS_PRESUPUESTO = {
    "low": (0, 800000),
    "mid": (800000, 1300000),
    "high": (1300000, float("inf")),
}


class PaqueteSugeridoResponse(PaqueteResponse):
    destinos: list[str] = []
    hoteles: list[str] = []


def _score_paquete(paquete: Paquete, preferencia: PreferenciaCliente) -> int:
    score = 0
    precio = float(paquete.precio_base)

    # Presupuesto: puntos si cae en el rango del cliente, mitad si es adyacente
    if preferencia.presupuesto in _RANGOS_PRESUPUESTO:
        lo, hi = _RANGOS_PRESUPUESTO[preferencia.presupuesto]
        if lo <= precio < hi:
            score += 3
        else:
            score += 1

    # Ritmo: viajes largos (más días) para "relax", cortos para "active"
    if paquete.duracion_dias and (
        preferencia.ritmo == "relax"
        and paquete.duracion_dias >= 4
        or preferencia.ritmo == "active"
        and paquete.duracion_dias <= 4
    ):
        score += 1

    # Intereses: busca coincidencias de texto en categoría/servicio/destino
    intereses = preferencia.intereses or []
    textos = []
    for ps in paquete.paquete_servicios:
        servicio = ps.servicio
        if not servicio:
            continue
        if servicio.categoria:
            textos.append(servicio.categoria.nombre_categoria)
        if servicio.descripcion:
            textos.append(servicio.descripcion)
        if servicio.destino and servicio.destino.descripcion:
            textos.append(servicio.destino.descripcion)
    texto_completo = " ".join(textos).lower()

    for interes in intereses:
        for keyword in _KEYWORDS_INTERES.get(interes, []):
            if keyword in texto_completo:
                score += 2
                break

    return score


@router.get("/{cliente_id}/sugerencias", response_model=list[PaqueteSugeridoResponse])
def get_sugerencias(
    cliente_id: int,
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
):
    """
    Recomienda paquetes activos según las preferencias guardadas del cliente
    (presupuesto, ritmo de viaje e intereses), con una puntuación simple y
    explicable: coincidencia de rango de precio, duración del viaje vs. ritmo,
    y coincidencia de intereses contra categorías/descripciones de servicios.
    """
    if current_user.id_cliente != cliente_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver sugerencias de otro cliente")

    preferencia = db.query(PreferenciaCliente).filter(PreferenciaCliente.id_cliente == cliente_id).first()
    if not preferencia:
        raise HTTPException(
            status_code=404,
            detail="Aún no has completado tus preferencias de viaje. Complétalas para recibir sugerencias.",
        )

    paquetes = (
        db.query(Paquete)
        .filter(Paquete.activo.is_(True))
        .options(
            joinedload(Paquete.paquete_servicios).joinedload(PaqueteServicio.servicio).joinedload(Servicio.categoria),
            joinedload(Paquete.paquete_servicios).joinedload(PaqueteServicio.servicio).joinedload(Servicio.destino),
            joinedload(Paquete.paquete_hotel).joinedload(PaqueteHotel.hotel),
        )
        .all()
    )

    puntuados = [(paquete, _score_paquete(paquete, preferencia)) for paquete in paquetes]
    puntuados.sort(key=lambda par: (-par[1], float(par[0].precio_base)))

    resultado = []
    for paquete, _score in puntuados[:limit]:
        destinos = sorted(
            {
                ps.servicio.destino.nombre_destino
                for ps in paquete.paquete_servicios
                if ps.servicio and ps.servicio.destino
            }
        )
        hoteles = sorted({ph.hotel.nombre_hotel for ph in paquete.paquete_hotel if ph.hotel})
        resultado.append(
            PaqueteSugeridoResponse(
                id_paquete=paquete.id_paquete,
                nombre_paquete=paquete.nombre_paquete,
                descripcion=paquete.descripcion,
                duracion_dias=paquete.duracion_dias,
                precio_base=float(paquete.precio_base),
                activo=paquete.activo,
                destinos=destinos,
                hoteles=hoteles,
            )
        )
    return resultado


# ─── Sugerencias de HOTELES por preferencias ───────────────────────────────
# El bloque "Paquetes sugeridos" del perfil apuntaba a /package/{id}; el
# cliente prefiere que las sugerencias por preferencias lleven a HOTELES
# (Hoteles → /hotel/{id}) en lugar de paquetes. Este endpoint puntúa los
# hoteles con la misma idea simple y explicable que el de paquetes:
# coincidencia de rango de precio por noche y de intereses contra la ciudad
# y las características del hotel.

# Mapa de interés -> palabras a buscar en la ciudad/características del hotel.
_KEYWORDS_HOTEL_INTERES = {
    "beach": ["playa", "mar", "isla", "caribe", "piscina", "buceo", "cartagena", "san andr"],
    "nature": ["naturaleza", "ecoturismo", "senderismo", "valle", "desierto", "campo", "monta"],
    "culture": ["cultura", "histór", "museo", "religios", "patrimonio", "bogotá", "cartagena"],
    "food": ["gastronom", "restaurante", "buffet", "desayuno"],
    "adventure": ["aventura", "deporte", "gimnasio", "extremo", "buceo"],
    "wellness": ["spa", "relaj", "bienestar", "descanso", "masajes"],
}


def _min_precio_hotel(hotel: Hotel) -> float | None:
    """Menor precio por noche de una habitación disponible del hotel."""
    disponibles = [h for h in hotel.habitaciones if h.estado and h.estado.lower() == "disponible"]
    if not disponibles:
        return None
    return min(float(h.precio_noche) for h in disponibles)


def _score_hotel(hotel: Hotel, preferencia: PreferenciaCliente) -> int:
    score = 0
    precio = _min_precio_hotel(hotel)

    # Presupuesto: se cruza contra el precio por noche mínimo del hotel.
    if precio is not None and preferencia.presupuesto in _RANGOS_PRESUPUESTO:
        lo, hi = _RANGOS_PRESUPUESTO[preferencia.presupuesto]
        if lo <= precio < hi:
            score += 3
        else:
            score += 1

    # Intereses: coincidencia de texto en ciudad y en características reales.
    intereses = preferencia.intereses or []
    textos = [hotel.ciudad or "", hotel.pais or "", hotel.nombre_hotel or ""]
    for hc in hotel.hotel_caracteristicas:
        if hc.disponible and hc.caracteristica:
            textos.append(hc.caracteristica.nombre_caracteristica)
    texto_completo = " ".join(textos).lower()

    for interes in intereses:
        for keyword in _KEYWORDS_HOTEL_INTERES.get(interes, []):
            if keyword in texto_completo:
                score += 2
                break

    return score


@router.get("/{cliente_id}/sugerencias-hoteles", response_model=list[HotelDetailResponse])
def get_sugerencias_hoteles(
    cliente_id: int,
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_usuario),
):
    """Recomienda hoteles según las preferencias guardadas del cliente
    (presupuesto e intereses), con la misma puntuación simple y explicable
    que las sugerencias de paquetes. El perfil las muestra como tarjetas de
    hotel (HotelCard → /hotel/{id}), no como paquetes."""
    if current_user.id_cliente != cliente_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver sugerencias de otro cliente")

    preferencia = db.query(PreferenciaCliente).filter(PreferenciaCliente.id_cliente == cliente_id).first()
    if not preferencia:
        raise HTTPException(
            status_code=404,
            detail="Aún no has completado tus preferencias de viaje. Complétalas para recibir sugerencias.",
        )

    hoteles = (
        db.query(Hotel)
        .options(
            joinedload(Hotel.habitaciones).joinedload(Habitacion.tipo_habitacion),
            joinedload(Hotel.hotel_caracteristicas).joinedload(HotelCaracteristica.caracteristica),
        )
        .all()
    )

    puntuados = [(hotel, _score_hotel(hotel, preferencia)) for hotel in hoteles]
    puntuados.sort(key=lambda par: (-par[1], (_min_precio_hotel(par[0]) or float("inf"))))

    # Solo sugerimos hoteles con algo de coincidencia (score > 0) para no
    # recomendar catálogo completo al azar; si ninguno puntúa, vacío.
    resultado = []
    for hotel, score in puntuados:
        if score <= 0:
            continue
        resultado.append(HotelDetailResponse.model_validate(hotel))
        if len(resultado) >= limit:
            break
    return resultado
