"""Ecosistema de reservas: vuelos, paquetes completos, desglose y viajeros.

Solo AGREGA (tablas nuevas y columnas nullable o con default). No borra ni
modifica datos existentes, salvo un ajuste justificado y reversible:
los paquetes que ya tenían hoteles vinculados quedan con
modalidad_alojamiento='incluido' (así se mostraban hasta hoy: "hoteles
incluidos"); el resto queda 'sin'. Ningún paquete queda con vuelo
(modalidad_vuelo='sin') hasta que el admin lo configure.

Revision ID: f5b9d2e7a1c3
Revises: e4a2c8f1b6d9
Create Date: 2026-11-06
"""

import sqlalchemy as sa

from alembic import op

revision = "f5b9d2e7a1c3"
down_revision = "e4a2c8f1b6d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Ofertas aéreas ---
    op.create_table(
        "ofertas_vuelo",
        sa.Column("id_oferta", sa.Integer(), primary_key=True),
        sa.Column("titulo", sa.String(150), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("estado", sa.String(20), nullable=False, server_default="borrador"),
        sa.Column("aerolinea", sa.String(100)),
        sa.Column("numero_vuelo", sa.String(20)),
        sa.Column("codigo_referencia", sa.String(40)),
        sa.Column("imagen_url", sa.String(255)),
        sa.Column("venta_independiente", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("origen_pais", sa.String(100)),
        sa.Column("origen_ciudad", sa.String(100), nullable=False),
        sa.Column("origen_aeropuerto", sa.String(150)),
        sa.Column("origen_iata", sa.String(3)),
        sa.Column("origen_zona_horaria", sa.String(60)),
        sa.Column("destino_pais", sa.String(100)),
        sa.Column("destino_ciudad", sa.String(100), nullable=False),
        sa.Column("destino_aeropuerto", sa.String(150)),
        sa.Column("destino_iata", sa.String(3)),
        sa.Column("destino_zona_horaria", sa.String(60)),
        sa.Column("tipo_trayecto", sa.String(20), nullable=False, server_default="ida_regreso"),
        sa.Column("fecha_salida", sa.Date(), nullable=False),
        sa.Column("hora_salida", sa.Time()),
        sa.Column("fecha_llegada", sa.Date()),
        sa.Column("hora_llegada", sa.Time()),
        sa.Column("fecha_regreso", sa.Date()),
        sa.Column("hora_regreso", sa.Time()),
        sa.Column("fecha_llegada_regreso", sa.Date()),
        sa.Column("hora_llegada_regreso", sa.Time()),
        sa.Column("duracion_estimada", sa.String(40)),
        sa.Column("clase", sa.String(20)),
        sa.Column("escalas", sa.Integer()),
        sa.Column("aeropuertos_conexion", sa.String(255)),
        sa.Column("horarios_conexion", sa.Text()),
        sa.Column("equipaje_mano", sa.String(150)),
        sa.Column("equipaje_bodega", sa.String(150)),
        sa.Column("condiciones_cambio", sa.Text()),
        sa.Column("condiciones_cancelacion", sa.Text()),
        sa.Column("restricciones", sa.Text()),
        sa.Column("informacion_adicional", sa.Text()),
        sa.Column("precio_adulto", sa.Numeric(12, 2), nullable=False),
        sa.Column("precio_nino", sa.Numeric(12, 2)),
        sa.Column("precio_infante", sa.Numeric(12, 2)),
        sa.Column("impuestos_incluidos", sa.Boolean()),
        sa.Column("cargos_adicionales", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("descripcion_cargos", sa.String(255)),
        sa.Column("cupos", sa.Integer()),
        sa.Column("vigencia_hasta", sa.Date()),
        sa.Column("condiciones_comerciales", sa.Text()),
        sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.Column("fecha_actualizacion", sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.CheckConstraint(
            "estado IN ('borrador', 'publicada', 'pausada', 'agotada', 'finalizada')", name="ck_oferta_vuelo_estado"
        ),
        sa.CheckConstraint("tipo_trayecto IN ('solo_ida', 'ida_regreso', 'multiples')", name="ck_oferta_vuelo_trayecto"),
        sa.CheckConstraint(
            "clase IS NULL OR clase IN ('economica', 'premium_economy', 'ejecutiva', 'primera')",
            name="ck_oferta_vuelo_clase",
        ),
        sa.CheckConstraint("precio_adulto >= 0", name="ck_oferta_vuelo_precio_adulto"),
        sa.CheckConstraint("precio_nino IS NULL OR precio_nino >= 0", name="ck_oferta_vuelo_precio_nino"),
        sa.CheckConstraint("precio_infante IS NULL OR precio_infante >= 0", name="ck_oferta_vuelo_precio_infante"),
        sa.CheckConstraint("cargos_adicionales >= 0", name="ck_oferta_vuelo_cargos"),
        sa.CheckConstraint("cupos IS NULL OR cupos >= 0", name="ck_oferta_vuelo_cupos"),
        sa.CheckConstraint("escalas IS NULL OR escalas >= 0", name="ck_oferta_vuelo_escalas"),
    )
    op.create_index("ix_ofertas_vuelo_id_oferta", "ofertas_vuelo", ["id_oferta"])
    op.create_index("ix_ofertas_vuelo_estado", "ofertas_vuelo", ["estado"])
    op.create_index("ix_ofertas_vuelo_fecha_salida", "ofertas_vuelo", ["fecha_salida"])

    op.create_table(
        "paquete_vuelos",
        sa.Column(
            "id_paquete", sa.Integer(), sa.ForeignKey("paquetes.id_paquete", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "id_oferta", sa.Integer(), sa.ForeignKey("ofertas_vuelo.id_oferta", ondelete="CASCADE"), primary_key=True
        ),
    )

    # --- Paquete: ficha comercial ---
    with op.batch_alter_table("paquetes") as batch:
        batch.add_column(sa.Column("noches", sa.Integer()))
        batch.add_column(sa.Column("destino_ciudad", sa.String(100)))
        batch.add_column(sa.Column("destino_pais", sa.String(100)))
        batch.add_column(sa.Column("destinos_secundarios", sa.String(255)))
        batch.add_column(sa.Column("categoria", sa.String(60)))
        batch.add_column(sa.Column("vigencia_desde", sa.Date()))
        batch.add_column(sa.Column("vigencia_hasta", sa.Date()))
        batch.add_column(sa.Column("modalidad_alojamiento", sa.String(20), nullable=False, server_default="sin"))
        batch.add_column(sa.Column("modalidad_vuelo", sa.String(20), nullable=False, server_default="sin"))
        batch.add_column(sa.Column("unidad_precio", sa.String(20), nullable=False, server_default="por_persona"))
        batch.add_column(sa.Column("precio_nino", sa.Numeric(10, 2)))
        batch.add_column(sa.Column("precio_infante", sa.Numeric(10, 2)))
        batch.add_column(sa.Column("min_viajeros", sa.Integer()))
        batch.add_column(sa.Column("max_viajeros", sa.Integer()))
        batch.create_check_constraint("ck_paquete_noches", "noches IS NULL OR noches >= 0")
        batch.create_check_constraint("ck_paquete_mod_aloj", "modalidad_alojamiento IN ('sin', 'incluido', 'opcional')")
        batch.create_check_constraint(
            "ck_paquete_mod_vuelo", "modalidad_vuelo IN ('sin', 'incluido', 'opcional', 'cotizacion')"
        )
        batch.create_check_constraint("ck_paquete_unidad_precio", "unidad_precio IN ('por_persona', 'por_paquete')")
        batch.create_check_constraint("ck_paquete_precio_nino", "precio_nino IS NULL OR precio_nino >= 0")
        batch.create_check_constraint("ck_paquete_precio_infante", "precio_infante IS NULL OR precio_infante >= 0")
        batch.create_check_constraint("ck_paquete_min", "min_viajeros IS NULL OR min_viajeros > 0")
        batch.create_check_constraint("ck_paquete_max", "max_viajeros IS NULL OR max_viajeros > 0")

    # Los paquetes con hoteles vinculados se mostraban como "hoteles
    # incluidos": se conserva ese significado.
    op.execute(
        "UPDATE paquetes SET modalidad_alojamiento = 'incluido' "
        "WHERE id_paquete IN (SELECT DISTINCT id_paquete FROM paquete_hotel)"
    )

    op.create_table(
        "itinerario_paquete",
        sa.Column("id_dia", sa.Integer(), primary_key=True),
        sa.Column(
            "id_paquete", sa.Integer(), sa.ForeignKey("paquetes.id_paquete", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("dia", sa.Integer(), nullable=False),
        sa.Column("titulo", sa.String(150), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("actividades", sa.Text()),
        sa.Column("horario", sa.String(120)),
        sa.Column("lugar", sa.String(150)),
        sa.Column("informacion_adicional", sa.Text()),
        sa.CheckConstraint("dia > 0", name="ck_itinerario_dia"),
    )
    op.create_index("ix_itinerario_paquete_id_dia", "itinerario_paquete", ["id_dia"])
    op.create_index("ix_itinerario_paquete_id_paquete", "itinerario_paquete", ["id_paquete"])

    op.create_table(
        "paquete_inclusiones",
        sa.Column("id_inclusion", sa.Integer(), primary_key=True),
        sa.Column(
            "id_paquete", sa.Integer(), sa.ForeignKey("paquetes.id_paquete", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("tipo", sa.String(12), nullable=False),
        sa.Column("categoria", sa.String(30), nullable=False),
        sa.Column("descripcion", sa.String(500), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("tipo IN ('incluye', 'no_incluye')", name="ck_inclusion_tipo"),
        sa.CheckConstraint(
            "categoria IN ('alojamiento', 'desayuno', 'alimentacion', 'transporte_terrestre', 'transporte_aereo', "
            "'actividades', 'entradas', 'guia', 'traslados', 'seguro', 'gastos_personales', 'equipaje', "
            "'impuestos', 'otro')",
            name="ck_inclusion_categoria",
        ),
    )
    op.create_index("ix_paquete_inclusiones_id_inclusion", "paquete_inclusiones", ["id_inclusion"])
    op.create_index("ix_paquete_inclusiones_id_paquete", "paquete_inclusiones", ["id_paquete"])

    op.create_table(
        "salidas_paquete",
        sa.Column("id_salida", sa.Integer(), primary_key=True),
        sa.Column(
            "id_paquete", sa.Integer(), sa.ForeignKey("paquetes.id_paquete", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("fecha_salida", sa.Date(), nullable=False),
        sa.Column("fecha_regreso", sa.Date()),
        sa.Column("cupos", sa.Integer()),
        sa.Column("estado", sa.String(10), nullable=False, server_default="abierta"),
        sa.Column("notas", sa.String(255)),
        sa.CheckConstraint("cupos IS NULL OR cupos >= 0", name="ck_salida_cupos"),
        sa.CheckConstraint("fecha_regreso IS NULL OR fecha_regreso >= fecha_salida", name="ck_salida_fechas"),
        sa.CheckConstraint("estado IN ('abierta', 'cerrada')", name="ck_salida_estado"),
    )
    op.create_index("ix_salidas_paquete_id_salida", "salidas_paquete", ["id_salida"])
    op.create_index("ix_salidas_paquete_id_paquete", "salidas_paquete", ["id_paquete"])

    # --- Reserva: producto, viajeros por tipo, vuelo, notas y snapshot ---
    with op.batch_alter_table("reservas") as batch:
        batch.add_column(sa.Column("tipo_producto", sa.String(10)))
        batch.add_column(sa.Column("adultos", sa.Integer()))
        batch.add_column(sa.Column("ninos", sa.Integer()))
        batch.add_column(sa.Column("infantes", sa.Integer()))
        batch.add_column(sa.Column("id_salida", sa.Integer()))
        batch.add_column(sa.Column("id_oferta_vuelo", sa.Integer()))
        batch.add_column(sa.Column("estado_vuelo", sa.String(25)))
        batch.add_column(sa.Column("solicitudes_especiales", sa.Text()))
        batch.add_column(sa.Column("notas_internas", sa.Text()))
        batch.add_column(sa.Column("snapshot_producto", sa.JSON()))
        batch.create_foreign_key(
            "fk_reserva_salida", "salidas_paquete", ["id_salida"], ["id_salida"], ondelete="SET NULL"
        )
        batch.create_foreign_key(
            "fk_reserva_oferta_vuelo", "ofertas_vuelo", ["id_oferta_vuelo"], ["id_oferta"], ondelete="SET NULL"
        )
        batch.create_check_constraint(
            "ck_reserva_tipo", "tipo_producto IS NULL OR tipo_producto IN ('hotel', 'paquete', 'vuelo')"
        )
        batch.create_check_constraint("ck_reserva_adultos", "adultos IS NULL OR adultos >= 0")
        batch.create_check_constraint("ck_reserva_ninos", "ninos IS NULL OR ninos >= 0")
        batch.create_check_constraint("ck_reserva_infantes", "infantes IS NULL OR infantes >= 0")
    op.create_index("ix_reservas_id_salida", "reservas", ["id_salida"])
    op.create_index("ix_reservas_id_oferta_vuelo", "reservas", ["id_oferta_vuelo"])

    op.create_table(
        "reserva_conceptos",
        sa.Column("id_concepto", sa.Integer(), primary_key=True),
        sa.Column(
            "id_reserva", sa.Integer(), sa.ForeignKey("reservas.id_reserva", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("tipo", sa.String(25), nullable=False),
        sa.Column("descripcion", sa.String(255), nullable=False),
        sa.Column("cantidad", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("precio_unitario", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("incluido", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("id_habitacion", sa.Integer(), sa.ForeignKey("habitaciones.id_habitacion", ondelete="SET NULL")),
        sa.Column("id_oferta_vuelo", sa.Integer(), sa.ForeignKey("ofertas_vuelo.id_oferta", ondelete="SET NULL")),
        sa.Column("id_servicio", sa.Integer(), sa.ForeignKey("servicios.id_servicio", ondelete="SET NULL")),
        sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.CheckConstraint(
            "tipo IN ('paquete', 'habitacion', 'alojamiento_incluido', 'vuelo', 'vuelo_incluido', "
            "'vuelo_cotizacion', 'servicio_opcional', 'cargo', 'impuesto', 'descuento')",
            name="ck_concepto_tipo",
        ),
    )
    op.create_index("ix_reserva_conceptos_id_concepto", "reserva_conceptos", ["id_concepto"])
    op.create_index("ix_reserva_conceptos_id_reserva", "reserva_conceptos", ["id_reserva"])

    op.create_table(
        "viajeros_reserva",
        sa.Column("id_viajero", sa.Integer(), primary_key=True),
        sa.Column(
            "id_reserva", sa.Integer(), sa.ForeignKey("reservas.id_reserva", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("nombres", sa.String(100), nullable=False),
        sa.Column("apellidos", sa.String(100), nullable=False),
        sa.Column("fecha_nacimiento", sa.Date()),
        sa.Column("nacionalidad", sa.String(60)),
        sa.Column("tipo_documento", sa.String(30)),
        sa.Column("numero_documento", sa.String(30)),
        sa.Column("es_titular", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint("tipo IN ('adulto', 'nino', 'infante')", name="ck_viajero_tipo"),
    )
    op.create_index("ix_viajeros_reserva_id_viajero", "viajeros_reserva", ["id_viajero"])
    op.create_index("ix_viajeros_reserva_id_reserva", "viajeros_reserva", ["id_reserva"])


def downgrade() -> None:
    op.drop_index("ix_viajeros_reserva_id_reserva", table_name="viajeros_reserva")
    op.drop_index("ix_viajeros_reserva_id_viajero", table_name="viajeros_reserva")
    op.drop_table("viajeros_reserva")
    op.drop_index("ix_reserva_conceptos_id_reserva", table_name="reserva_conceptos")
    op.drop_index("ix_reserva_conceptos_id_concepto", table_name="reserva_conceptos")
    op.drop_table("reserva_conceptos")

    op.drop_index("ix_reservas_id_oferta_vuelo", table_name="reservas")
    op.drop_index("ix_reservas_id_salida", table_name="reservas")
    with op.batch_alter_table("reservas") as batch:
        batch.drop_constraint("ck_reserva_infantes", type_="check")
        batch.drop_constraint("ck_reserva_ninos", type_="check")
        batch.drop_constraint("ck_reserva_adultos", type_="check")
        batch.drop_constraint("ck_reserva_tipo", type_="check")
        batch.drop_constraint("fk_reserva_oferta_vuelo", type_="foreignkey")
        batch.drop_constraint("fk_reserva_salida", type_="foreignkey")
        for col in (
            "snapshot_producto",
            "notas_internas",
            "solicitudes_especiales",
            "estado_vuelo",
            "id_oferta_vuelo",
            "id_salida",
            "infantes",
            "ninos",
            "adultos",
            "tipo_producto",
        ):
            batch.drop_column(col)

    op.drop_index("ix_salidas_paquete_id_paquete", table_name="salidas_paquete")
    op.drop_index("ix_salidas_paquete_id_salida", table_name="salidas_paquete")
    op.drop_table("salidas_paquete")
    op.drop_index("ix_paquete_inclusiones_id_paquete", table_name="paquete_inclusiones")
    op.drop_index("ix_paquete_inclusiones_id_inclusion", table_name="paquete_inclusiones")
    op.drop_table("paquete_inclusiones")
    op.drop_index("ix_itinerario_paquete_id_paquete", table_name="itinerario_paquete")
    op.drop_index("ix_itinerario_paquete_id_dia", table_name="itinerario_paquete")
    op.drop_table("itinerario_paquete")

    with op.batch_alter_table("paquetes") as batch:
        for ck in (
            "ck_paquete_max",
            "ck_paquete_min",
            "ck_paquete_precio_infante",
            "ck_paquete_precio_nino",
            "ck_paquete_unidad_precio",
            "ck_paquete_mod_vuelo",
            "ck_paquete_mod_aloj",
            "ck_paquete_noches",
        ):
            batch.drop_constraint(ck, type_="check")
        for col in (
            "max_viajeros",
            "min_viajeros",
            "precio_infante",
            "precio_nino",
            "unidad_precio",
            "modalidad_vuelo",
            "modalidad_alojamiento",
            "vigencia_hasta",
            "vigencia_desde",
            "categoria",
            "destinos_secundarios",
            "destino_pais",
            "destino_ciudad",
            "noches",
        ):
            batch.drop_column(col)

    op.drop_table("paquete_vuelos")
    op.drop_index("ix_ofertas_vuelo_fecha_salida", table_name="ofertas_vuelo")
    op.drop_index("ix_ofertas_vuelo_estado", table_name="ofertas_vuelo")
    op.drop_index("ix_ofertas_vuelo_id_oferta", table_name="ofertas_vuelo")
    op.drop_table("ofertas_vuelo")
