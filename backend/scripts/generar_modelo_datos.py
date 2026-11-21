"""Genera docs/entrega-final/01b-modelo-de-datos.md desde los modelos reales.

El MER (Mermaid erDiagram), el modelo relacional (tablas con PK, FK y
restricciones) y el diagrama de clases UML de las entidades salen de
`Base.metadata` y de los mappers de SQLAlchemy, así que nunca quedan
desactualizados frente al código. Volver a generarlo tras cambiar un modelo:

    cd backend && python scripts/generar_modelo_datos.py
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))


import app.models  # noqa: E402,F401  (registra todas las tablas)
from app.core.database import Base  # noqa: E402

SALIDA = RAIZ.parent / "docs" / "entrega-final" / "01b-modelo-de-datos.md"

# Agrupación por módulo del negocio (para leer el modelo por partes).
MODULOS = {
    "Usuarios y seguridad": [
        "usuarios",
        "roles",
        "permisos",
        "usuarios_roles",
        "roles_permisos",
        "sesiones_usuario",
        "recuperacion_password",
    ],
    "Clientes y empleados": [
        "clientes",
        "empleados",
        "preferencias_cliente",
        "favoritos",
        "metodos_pago_guardados",
        "solicitudes_corporativas",
    ],
    "Hoteles": [
        "hoteles",
        "habitaciones",
        "tipo_habitacion",
        "caracteristicas_hotel",
        "hotel_caracteristicas",
        "imagenes_hotel",
        "imagenes_habitacion",
        "resenas",
    ],
    "Paquetes, vuelos y servicios": [
        "paquetes",
        "paquete_hotel",
        "paquete_servicios",
        "paquete_inclusiones",
        "paquete_vuelos",
        "salidas_paquete",
        "itinerario_paquete",
        "imagenes_paquete",
        "ofertas_vuelo",
        "servicios",
        "categoria_servicio",
        "destinos",
        "proveedores",
        "servicio_proveedor",
    ],
    "Reservas y pagos": [
        "reservas",
        "reserva_habitaciones",
        "reserva_servicios",
        "reserva_conceptos",
        "viajeros_reserva",
        "historial_reservas",
        "pagos",
        "metodos_pago",
        "solicitudes_cancelacion",
    ],
    "Comunicación y contenido": [
        "notificaciones",
        "mensajes_chat",
        "publicaciones_comunidad",
        "comentarios_comunidad",
        "imagenes_publicacion",
        "videos_agencia",
        "banners_publicitarios",
        "temas_color",
        "configuracion_sistema",
    ],
    "IoT (prototipo)": ["dispositivos_iot", "lecturas_iot"],
}

# Entidades centrales para el diagrama de clases (el resto está en el MER).
CLASES = [
    "Usuario",
    "Cliente",
    "Empleado",
    "Hotel",
    "Habitacion",
    "Paquete",
    "OfertaVuelo",
    "Reserva",
    "ReservaConcepto",
    "ViajeroReserva",
    "Pago",
    "Resena",
    "DispositivoIoT",
    "LecturaIoT",
]


def tipo_corto(col) -> str:
    try:
        nombre = col.type.__class__.__name__.lower()
    except Exception:  # pragma: no cover
        return "dato"
    return {"varchar": "string", "timestamp": "datetime", "numeric": "decimal"}.get(nombre, nombre)


def mer() -> str:
    lineas = ["```mermaid", "erDiagram"]
    for tabla in sorted(Base.metadata.tables.values(), key=lambda t: t.name):
        for fk in sorted(tabla.foreign_keys, key=lambda f: f.parent.name):
            destino = fk.column.table.name
            opcional = "o" if fk.parent.nullable else "|"
            lineas.append(f'    {destino} ||--{opcional}{{ {tabla.name} : "{fk.parent.name}"')
    for tabla in sorted(Base.metadata.tables.values(), key=lambda t: t.name):
        lineas.append(f"    {tabla.name} {{")
        for col in tabla.columns:
            marcas = []
            if col.primary_key:
                marcas.append("PK")
            if col.foreign_keys:
                marcas.append("FK")
            if col.unique and not col.primary_key:
                marcas.append("UK")
            marca = f" {','.join(marcas)}" if marcas else ""
            lineas.append(f"        {tipo_corto(col)} {col.name}{marca}")
        lineas.append("    }")
    lineas.append("```")
    return "\n".join(lineas)


def mr() -> str:
    partes = []
    vistas = set()
    for modulo, tablas in MODULOS.items():
        partes.append(f"\n### {modulo}\n")
        for nombre in tablas:
            tabla = Base.metadata.tables.get(nombre)
            if tabla is None:
                continue
            vistas.add(nombre)
            columnas = []
            for col in tabla.columns:
                texto = col.name
                if col.primary_key:
                    texto = f"<u>{texto}</u>"
                if col.foreign_keys:
                    fk = next(iter(col.foreign_keys))
                    texto += f" → {fk.column.table.name}.{fk.column.name}"
                if not col.nullable and not col.primary_key:
                    texto += " (NN)"
                columnas.append(texto)
            partes.append(f"- **{nombre}**({', '.join(columnas)})")
    resto = sorted(set(Base.metadata.tables) - vistas)
    if resto:
        partes.append("\n### Otras\n")
        partes.extend(f"- **{n}**({', '.join(c.name for c in Base.metadata.tables[n].columns)})" for n in resto)
    return "\n".join(partes)


def clases() -> str:
    mappers = {m.class_.__name__: m for m in Base.registry.mappers}
    lineas = ["```mermaid", "classDiagram"]
    relaciones = set()
    for nombre in CLASES:
        m = mappers.get(nombre)
        if m is None:
            continue
        lineas.append(f"    class {nombre} {{")
        for col in m.columns:
            if col.foreign_keys:
                continue
            lineas.append(f"        +{tipo_corto(col)} {col.key}")
        lineas.append("    }")
        for rel in m.relationships:
            destino = rel.mapper.class_.__name__
            if destino not in CLASES:
                continue
            par = tuple(sorted((nombre, destino)))
            if par in relaciones:
                continue
            relaciones.add(par)
            multiplicidad = '"1" --> "*"' if rel.uselist else '"*" --> "1"'
            lineas.append(f"    {nombre} {multiplicidad} {destino} : {rel.key}")
    lineas.append("```")
    return "\n".join(lineas)


def main() -> None:
    tablas = len(Base.metadata.tables)
    fks = sum(len(t.foreign_keys) for t in Base.metadata.tables.values())
    texto = f"""# Modelo de datos (MER, MR y clases)

> Generado por `backend/scripts/generar_modelo_datos.py` desde los modelos
> SQLAlchemy de `backend/app/models/`. No editar a mano: volver a correr el
> script tras cambiar un modelo. Esquema en la base: migraciones de Alembic
> (`backend/alembic/versions/`).

**{tablas} tablas · {fks} llaves foráneas** · motor PostgreSQL 16 (Neon en producción).

## 1. Modelo relacional (MR)

Notación: <u>subrayado</u> = llave primaria · `→ tabla.columna` = llave
foránea · (NN) = NOT NULL.
{mr()}

## 2. Diagrama de clases UML (entidades centrales)

Atributos propios de cada clase (las llaves foráneas se muestran como
asociaciones). Multiplicidad tomada de las relaciones del ORM.

{clases()}

## 3. Modelo entidad-relación (MER completo)

Cada relación sale de una llave foránea real: `||--o{{` = cero o muchos
(FK opcional), `||--|{{` = uno o muchos (FK obligatoria).

{mer()}
"""
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(texto, encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ.parent)} ({tablas} tablas, {fks} FK)")


if __name__ == "__main__":
    main()
