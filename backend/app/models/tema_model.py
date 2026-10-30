from sqlalchemy import TIMESTAMP, Boolean, Column, Integer, String
from sqlalchemy.sql import func

from app.core.database import Base


class Tema(Base):
    """Temas de color de temporada (Navidad, Halloween, etc.) que el
    administrador puede crear y activar para recolorear el acento de marca
    en TODO el sitio -- botones, enlaces, sidebar admin, navbar, degradados
    de theme.css -- sin tocar layout ni los fondos/textos base (background,
    foreground, card siguen siendo los mismos claro/oscuro de siempre, para
    no perder legibilidad ni el look serio de una agencia real).

    Solo un tema puede estar `activo` a la vez (lo garantiza
    TemaRepository.activar, no una constraint de base de datos). El tema
    con `es_predeterminado=True` representa los colores actuales de marca
    de Alik Tours (granate + dorado) y no se puede eliminar -- siempre debe
    quedar al menos un tema de respaldo si el admin borra los demás.

    Cada color se guarda en versión clara/oscura (mismo criterio que
    --primary en theme.css, que ya vale distinto en :root y en .dark) y
    fue verificado con la fórmula de luminancia relativa de WCAG: el
    primario siempre se usa como fondo de botón con texto blanco encima
    (--primary-foreground, fijo) y el secundario con texto oscuro fijo
    (--gold-foreground) -- ambos casos deben dar >=4.5:1 (WCAG 2.1 AA,
    el nivel que exige la Resolución MinTIC 1519 de 2020 para sitios del
    Estado colombiano; aquí se aplica igual aunque no sea obligatorio,
    porque es la misma regla objetiva de "se lee bien")."""

    __tablename__ = "temas_color"

    id_tema = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(60), nullable=False)
    # Identificador corto y estable (ej. "navidad") -- lo usa el frontend
    # como atributo data-tema-temporada para aplicar el CSS del tema activo,
    # así que nunca cambia aunque el admin edite el nombre visible.
    clave = Column(String(40), nullable=False, unique=True, index=True)
    color_primario_claro = Column(String(7), nullable=False)
    color_primario_oscuro = Column(String(7), nullable=False)
    color_secundario_claro = Column(String(7), nullable=False)
    color_secundario_oscuro = Column(String(7), nullable=False)
    activo = Column(Boolean, nullable=False, default=False)
    es_predeterminado = Column(Boolean, nullable=False, default=False)
    # Nombre de ícono decorativo (lucide-react, ej. "snowflake", "ghost") --
    # nullable porque temas creados antes de este campo (o sin ícono
    # elegido) simplemente no muestran nada decorativo, nunca rompen el
    # render. Restringido a un catálogo cerrado (ver tema_schema.py) para
    # que nunca llegue un string arbitrario al frontend.
    icono = Column(String(30), nullable=True)
    # URL de una imagen decorativa real subida por el admin (Cloudinary si
    # está configurado, disco local si no -- ver app/core/image_storage.py,
    # mismo mecanismo que ya usan banners/fotos de perfil). Nullable: un
    # tema puede quedarse solo con su ícono lucide si el admin no sube
    # ninguna imagen, nunca es obligatoria.
    imagen_url = Column(String(500), nullable=True)
    # URL de un video decorativo real (Cloudinary si está configurado,
    # disco local si no -- mismo mecanismo que imagen_url, ver
    # app/core/image_storage.py) para el fondo del Hero cuando este tema
    # está activo. Nullable: si el admin no sube ninguno, Hero.tsx cae al
    # video genérico de por defecto (ver Hero.tsx), nunca queda sin video.
    video_url = Column(String(500), nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
