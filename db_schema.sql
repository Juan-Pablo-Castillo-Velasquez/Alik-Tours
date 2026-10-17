CREATE TABLE IF NOT EXISTS hoteles (
    id_hotel SERIAL PRIMARY KEY,
    nombre_hotel VARCHAR(100) NOT NULL,
    calificacion INTEGER CHECK (calificacion BETWEEN 1 AND 5),
    direccion VARCHAR(255),
    ciudad VARCHAR(100),
    pais VARCHAR(100),
    codigo_postal VARCHAR(20),
    correo_electronico VARCHAR(100),
    telefono VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS caracteristicas_hotel (
    id_caracteristica SERIAL PRIMARY KEY,
    nombre_caracteristica VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS hotel_caracteristicas (
    id_hotel INTEGER NOT NULL,
    id_caracteristica INTEGER NOT NULL,
    disponible BOOLEAN DEFAULT TRUE,

    PRIMARY KEY (id_hotel, id_caracteristica),

    FOREIGN KEY (id_hotel)
        REFERENCES hoteles(id_hotel)
        ON DELETE CASCADE,

    FOREIGN KEY (id_caracteristica)
        REFERENCES caracteristicas_hotel(id_caracteristica)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tipo_habitacion (
    id_tipo_habitacion SERIAL PRIMARY KEY,
    nombre_tipo VARCHAR(50) NOT NULL,
    descripcion VARCHAR(200),
    capacidad_personas INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS habitaciones (
    id_habitacion SERIAL PRIMARY KEY,

    id_hotel INTEGER NOT NULL,

    id_tipo_habitacion INTEGER NOT NULL,

    numero_habitacion VARCHAR(20) NOT NULL,

    precio_noche NUMERIC(10,2) NOT NULL
        CHECK (precio_noche >= 0),

    estado VARCHAR(20) NOT NULL
        CHECK (
            estado IN (
                'disponible',
                'ocupada',
                'mantenimiento'
            )
        ),

    UNIQUE(id_hotel, numero_habitacion),

    FOREIGN KEY (id_hotel)
        REFERENCES hoteles(id_hotel)
        ON DELETE CASCADE,

    FOREIGN KEY (id_tipo_habitacion)
        REFERENCES tipo_habitacion(id_tipo_habitacion)
);

CREATE TABLE IF NOT EXISTS clientes (
    id_cliente SERIAL PRIMARY KEY,

    nombre VARCHAR(100) NOT NULL,

    apellido VARCHAR(100) NOT NULL,

    cedula VARCHAR(20) UNIQUE NOT NULL,

    correo VARCHAR(100) UNIQUE,

    celular VARCHAR(20),

    direccion VARCHAR(255),

    ciudad VARCHAR(100),

    pais VARCHAR(100),

    fecha_nacimiento DATE,

    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS preferencias_cliente (
    id_preferencia SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL UNIQUE,
    intereses TEXT[],
    compania VARCHAR(20),
    presupuesto VARCHAR(20),
    clima VARCHAR(20),
    ritmo VARCHAR(20),
    transporte VARCHAR(20),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS empleados (
    id_empleado SERIAL PRIMARY KEY,

    nombre VARCHAR(100) NOT NULL,

    apellido VARCHAR(100) NOT NULL,

    cedula VARCHAR(20) UNIQUE NOT NULL,

    correo_electronico VARCHAR(100) UNIQUE,

    celular VARCHAR(20),

    direccion VARCHAR(255),

    ciudad VARCHAR(100),

    pais VARCHAR(100),

    fecha_nacimiento DATE,

    fecha_contratacion DATE,

    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS roles (
    id_rol SERIAL PRIMARY KEY,

    nombre_rol VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    correo_electronico VARCHAR(99) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    id_cliente INTEGER UNIQUE,
    id_empleado INTEGER UNIQUE,
    activo BOOLEAN DEFAULT TRUE,
    verificado BOOLEAN DEFAULT FALSE,
    foto_perfil VARCHAR(255),
    ultimo_login TIMESTAMP,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente)
        REFERENCES clientes(id_cliente)
        ON DELETE CASCADE,
    FOREIGN KEY (id_empleado)
        REFERENCES empleados(id_empleado)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS usuarios_roles (
    id_usuario INTEGER NOT NULL,
    id_rol INTEGER NOT NULL,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario, id_rol),
    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE,
    FOREIGN KEY (id_rol)
        REFERENCES roles(id_rol)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sesiones_usuario (
    id_sesion SERIAL PRIMARY KEY,

    id_usuario INTEGER NOT NULL,

    refresh_token TEXT NOT NULL,

    direccion_ip VARCHAR(50),

    user_agent TEXT,

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    fecha_expiracion TIMESTAMP,

    activa BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recuperacion_password (
    id_recuperacion SERIAL PRIMARY KEY,

    id_usuario INTEGER NOT NULL,

    token_recuperacion TEXT NOT NULL,

    usado BOOLEAN DEFAULT FALSE,

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    fecha_expiracion TIMESTAMP NOT NULL,

    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS destinos (
    id_destino SERIAL PRIMARY KEY,

    nombre_destino VARCHAR(100) NOT NULL,

    descripcion TEXT,

    ciudad VARCHAR(100),

    pais VARCHAR(100),

    temporada_alta_inicio DATE,

    temporada_alta_fin DATE
);

CREATE TABLE IF NOT EXISTS categoria_servicio (
    id_categoria SERIAL PRIMARY KEY,

    nombre_categoria VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS servicios (
    id_servicio SERIAL PRIMARY KEY,

    nombre_servicio VARCHAR(100) NOT NULL,

    descripcion TEXT,

    id_categoria INTEGER,

    id_destino INTEGER,

    duracion_horas NUMERIC(4,1),

    precio_base NUMERIC(10,2)
        CHECK (precio_base >= 0),

    capacidad_maxima INTEGER
        CHECK (capacidad_maxima > 0),

    FOREIGN KEY (id_categoria)
        REFERENCES categoria_servicio(id_categoria),

    FOREIGN KEY (id_destino)
        REFERENCES destinos(id_destino)
);

CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor SERIAL PRIMARY KEY,

    nombre_proveedor VARCHAR(100) NOT NULL,

    tipo_proveedor VARCHAR(50),

    contacto VARCHAR(100),

    telefono VARCHAR(20),

    correo_electronico VARCHAR(100),

    direccion VARCHAR(255),

    ciudad VARCHAR(100),

    pais VARCHAR(100),

    comision_porcentaje NUMERIC(5,2)
);

CREATE TABLE IF NOT EXISTS servicio_proveedor (
    id_servicio INTEGER NOT NULL,

    id_proveedor INTEGER NOT NULL,

    precio_proveedor NUMERIC(10,2),

    es_proveedor_principal BOOLEAN DEFAULT FALSE,

    PRIMARY KEY (id_servicio, id_proveedor),

    FOREIGN KEY (id_servicio)
        REFERENCES servicios(id_servicio)
        ON DELETE CASCADE,

    FOREIGN KEY (id_proveedor)
        REFERENCES proveedores(id_proveedor)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS paquetes (
    id_paquete SERIAL PRIMARY KEY,

    nombre_paquete VARCHAR(100) NOT NULL,

    descripcion TEXT,

    duracion_dias INTEGER,

    precio_base NUMERIC(10,2)
        CHECK (precio_base >= 0),

    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS paquete_servicios (
    id_paquete INTEGER NOT NULL,

    id_servicio INTEGER NOT NULL,

    dia_actividad INTEGER,

    incluido BOOLEAN DEFAULT TRUE,

    PRIMARY KEY (id_paquete, id_servicio),

    FOREIGN KEY (id_paquete)
        REFERENCES paquetes(id_paquete)
        ON DELETE CASCADE,

    FOREIGN KEY (id_servicio)
        REFERENCES servicios(id_servicio)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS paquete_hotel (
    id_paquete INTEGER NOT NULL,

    id_hotel INTEGER NOT NULL,

    noches_incluidas INTEGER,

    PRIMARY KEY (id_paquete, id_hotel),

    FOREIGN KEY (id_paquete)
        REFERENCES paquetes(id_paquete)
        ON DELETE CASCADE,

    FOREIGN KEY (id_hotel)
        REFERENCES hoteles(id_hotel)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reservas (
    id_reserva SERIAL PRIMARY KEY,

    id_cliente INTEGER NOT NULL,

    id_empleado INTEGER,

    id_paquete INTEGER,

    fecha_reserva TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    fecha_inicio DATE,

    fecha_fin DATE,

    numero_personas INTEGER
        CHECK (numero_personas > 0),

    estado VARCHAR(20)
        CHECK (
            estado IN (
                'pendiente',
                'confirmada',
                'cancelada',
                'finalizada'
            )
        ),

    FOREIGN KEY (id_cliente)
        REFERENCES clientes(id_cliente),

    FOREIGN KEY (id_empleado)
        REFERENCES empleados(id_empleado)
        ON DELETE SET NULL,

    FOREIGN KEY (id_paquete)
        REFERENCES paquetes(id_paquete)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reserva_habitaciones (
    id_reserva INTEGER NOT NULL,

    id_habitacion INTEGER NOT NULL,

    fecha_checkin DATE,

    fecha_checkout DATE,

    precio_acordado NUMERIC(10,2),

    PRIMARY KEY (id_reserva, id_habitacion),

    FOREIGN KEY (id_reserva)
        REFERENCES reservas(id_reserva)
        ON DELETE CASCADE,

    FOREIGN KEY (id_habitacion)
        REFERENCES habitaciones(id_habitacion)
);

CREATE TABLE IF NOT EXISTS reserva_servicios (
    id_reserva INTEGER NOT NULL,

    id_servicio INTEGER NOT NULL,

    fecha_servicio DATE,

    numero_personas INTEGER,

    precio_acordado NUMERIC(10,2),

    PRIMARY KEY (id_reserva, id_servicio),

    FOREIGN KEY (id_reserva)
        REFERENCES reservas(id_reserva)
        ON DELETE CASCADE,

    FOREIGN KEY (id_servicio)
        REFERENCES servicios(id_servicio)
);

CREATE TABLE IF NOT EXISTS metodos_pago (
    id_metodo SERIAL PRIMARY KEY,

    nombre_metodo VARCHAR(50) NOT NULL,

    -- Código estable en snake_case usado por el backend para decidir el
    -- flujo de pago sin comparar el nombre en español — Alembic
    -- d4c8a1f39b02_metodos_pago_codigo_y_estados_pago.py
    codigo VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS pagos (
    id_pago SERIAL PRIMARY KEY,

    id_reserva INTEGER NOT NULL,

    id_metodo_pago INTEGER NOT NULL,

    monto NUMERIC(10,2) NOT NULL
        CHECK (monto >= 0),

    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    referencia VARCHAR(100),

    -- Alembic c8e2f5a91d47_add_factura_a_pagos.py
    numero_factura VARCHAR(20) UNIQUE,
    comprobante_url VARCHAR(255),

    estado VARCHAR(20)
        CHECK (
            estado IN (
                'pendiente',
                'procesando',
                'pagado',
                'rechazado',
                'cancelado'
            )
        ),

    -- Decidido al iniciar el pago (valores de prueba de tarjeta/celular/
    -- documento), resuelto al confirmar — Alembic
    -- d4c8a1f39b02_metodos_pago_codigo_y_estados_pago.py
    simular_rechazo BOOLEAN NOT NULL DEFAULT FALSE,

    FOREIGN KEY (id_reserva)
        REFERENCES reservas(id_reserva),

    FOREIGN KEY (id_metodo_pago)
        REFERENCES metodos_pago(id_metodo)
);

CREATE TABLE IF NOT EXISTS historial_reservas (
    id_historial SERIAL PRIMARY KEY,

    id_reserva INTEGER NOT NULL,

    estado_anterior VARCHAR(20),

    estado_nuevo VARCHAR(20),

    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    id_empleado_responsable INTEGER,

    comentarios TEXT,

    FOREIGN KEY (id_reserva)
        REFERENCES reservas(id_reserva)
        ON DELETE CASCADE,

    FOREIGN KEY (id_empleado_responsable)
        REFERENCES empleados(id_empleado)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reservas_cliente
ON reservas(id_cliente);

CREATE INDEX IF NOT EXISTS idx_reservas_estado
ON reservas(estado);

CREATE INDEX IF NOT EXISTS idx_habitaciones_hotel
ON habitaciones(id_hotel);

CREATE INDEX IF NOT EXISTS idx_usuarios_username
ON usuarios(username);

CREATE INDEX IF NOT EXISTS idx_usuarios_correo
ON usuarios(correo_electronico);
CREATE TABLE IF NOT EXISTS resenas (
    id_resena SERIAL PRIMARY KEY,
    id_reserva INT NOT NULL REFERENCES reservas(id_reserva) ON DELETE CASCADE,
    id_cliente INT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    id_hotel INT NOT NULL REFERENCES hoteles(id_hotel) ON DELETE CASCADE,
    calificacion INT NOT NULL CHECK (calificacion >= 1 AND calificacion <= 5),
    comentario TEXT NOT NULL,
    foto_url VARCHAR(500),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS solicitudes_cancelacion (
    id_solicitud SERIAL PRIMARY KEY,
    id_reserva INTEGER NOT NULL,
    id_cliente INTEGER NOT NULL,
 
    motivo VARCHAR(100) NOT NULL,
    motivo_detalle TEXT,
 
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
 
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion TIMESTAMP,
    id_empleado_resolutor INTEGER,
    comentario_resolucion TEXT,
 
    FOREIGN KEY (id_reserva)
        REFERENCES reservas(id_reserva)
        ON DELETE CASCADE,
    FOREIGN KEY (id_cliente)
        REFERENCES clientes(id_cliente)
        ON DELETE CASCADE,
    FOREIGN KEY (id_empleado_resolutor)
        REFERENCES empleados(id_empleado)
        ON DELETE SET NULL
);
 
-- Evita que un cliente mande dos solicitudes "pendiente" para la misma
-- reserva (el botón del frontend ya se oculta tras enviar, pero esto
-- protege la integridad a nivel de BD por si acaso).
CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitud_cancelacion_pendiente_unica
    ON solicitudes_cancelacion (id_reserva)
    WHERE estado = 'pendiente';
 
CREATE INDEX IF NOT EXISTS idx_solicitudes_cancelacion_cliente
    ON solicitudes_cancelacion(id_cliente);
 
CREATE INDEX IF NOT EXISTS idx_solicitudes_cancelacion_estado
    ON solicitudes_cancelacion(estado);

-- ─────────────────────────────────────────────────────────────────────────
-- Tablas añadidas en la sincronización de Fase 1 del plan de mejora
-- (2026-08-29): ya existían como migraciones de Alembic aplicadas, pero
-- nunca se habían reflejado en este archivo de referencia.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS metodos_pago_guardados (
    id_metodo_guardado SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL,

    alias VARCHAR(50) NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    ultimos4 VARCHAR(4),
    clave_hash VARCHAR(255) NOT NULL,
    predeterminado BOOLEAN NOT NULL DEFAULT FALSE,

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_cliente)
        REFERENCES clientes(id_cliente)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_metodos_pago_guardados_id_metodo_guardado
    ON metodos_pago_guardados(id_metodo_guardado);

CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id_config SERIAL PRIMARY KEY,

    clave VARCHAR(100) NOT NULL UNIQUE,
    valor TEXT,
    descripcion VARCHAR(255),

    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notificaciones (
    id_notificacion SERIAL PRIMARY KEY,

    tipo VARCHAR(30) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT,
    id_referencia INTEGER,
    leido BOOLEAN NOT NULL DEFAULT FALSE,

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_notificaciones_leido
    ON notificaciones(leido);

CREATE TABLE IF NOT EXISTS solicitudes_corporativas (
    id_solicitud SERIAL PRIMARY KEY,

    nombre_empresa VARCHAR(150) NOT NULL,
    numero_empleados VARCHAR(20),
    nombre_contacto VARCHAR(100) NOT NULL,
    email_corporativo VARCHAR(150) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    mensaje TEXT,

    estado VARCHAR(20) NOT NULL DEFAULT 'nuevo'
        CHECK (estado IN ('nuevo', 'contactado', 'cerrado', 'descartado')),

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favoritos (
    id_favorito SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL,
    id_hotel INTEGER NOT NULL,

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_cliente)
        REFERENCES clientes(id_cliente)
        ON DELETE CASCADE,

    FOREIGN KEY (id_hotel)
        REFERENCES hoteles(id_hotel)
        ON DELETE CASCADE,

    UNIQUE (id_cliente, id_hotel)
);

CREATE INDEX IF NOT EXISTS ix_favoritos_id_favorito
    ON favoritos(id_favorito);

INSERT INTO roles (nombre_rol)
VALUES
('admin'),
('cliente'),
('empleado')
ON CONFLICT (nombre_rol) DO NOTHING;

INSERT INTO roles (nombre_rol) VALUES 
('supervisor'), ('gerente'), ('agente_ventas'), ('soporte'), 
('guia_turistico'), ('auditor'), ('marketing')
ON CONFLICT (nombre_rol) DO NOTHING;

-- Nombres sin tilde para igualar exactamente el seed real de Alembic
-- (523e6283e58b_seed_datos_demo.py) — db_schema.sql tenía tildes, un
-- segundo drift encontrado en la sincronización de Fase 1, además de la
-- columna `codigo` que faltaba (ver d4c8a1f39b02_metodos_pago_codigo_y_estados_pago.py).
INSERT INTO metodos_pago (nombre_metodo, codigo) VALUES 
('Tarjeta de Credito', 'tarjeta_credito'), ('Tarjeta de Debito', 'tarjeta_debito'), ('Efectivo', 'efectivo'), ('Transferencia Bancaria', 'transferencia'), 
('PayPal', 'paypal'), ('Criptomonedas', 'cripto'), ('Nequi', 'nequi'), ('Daviplata', 'daviplata'), ('PSE', 'pse'), ('Cheque', 'cheque');

INSERT INTO hoteles (nombre_hotel, calificacion, direccion, ciudad, pais, codigo_postal, correo_electronico, telefono) VALUES
('Hotel Paraíso', 5, 'Calle 1 # 2-3', 'Bogotá', 'Colombia', '110111', 'contacto@paraiso.com', '+573001234567'),
('Resort Sol y Arena', 4, 'Av. Marítima 45', 'Cartagena', 'Colombia', '130001', 'info@solyarena.com', '+573009876543'),
('Montaña Mágica', 3, 'Vía al Parque', 'Medellín', 'Colombia', '050001', 'reservas@montana.com', '+573101112233'),
('Gran Hotel Centro', 5, 'Carrera 7 # 14-20', 'Bogotá', 'Colombia', '110221', 'gerencia@granhotel.com', '+573204445566'),
('Cabañas del Bosque', 2, 'Km 5 Vía Salento', 'Salento', 'Colombia', '631020', 'hola@bosque.com', '+573115556677'),
('Plaza Mayor Hotel', 4, 'Plaza Central', 'Villa de Leyva', 'Colombia', '154001', 'info@plazamayor.com', '+573128889900'),
('Boutique Santa Marta', 5, 'Centro Histórico', 'Santa Marta', 'Colombia', '470004', 'boutique@santamarta.com', '+573142223344'),
('EcoLodge Tayrona', 3, 'Entrada Parque Tayrona', 'Santa Marta', 'Colombia', '470005', 'eco@tayrona.com', '+573153334455'),
('Hotel Imperial', 4, 'Av. El Poblado', 'Medellín', 'Colombia', '050021', 'imperial@hotel.com', '+573167778899'),
('Cali Pachanguero H.', 3, 'Barrio Granada', 'Cali', 'Colombia', '760001', 'reservas@calih.com', '+573178889900');

INSERT INTO caracteristicas_hotel (nombre_caracteristica) VALUES
('Piscina al aire libre'), ('Gimnasio'), ('Spa y masajes'), ('Restaurante buffet'),
('Parqueadero gratuito'), ('Pet Friendly'), ('Casino'), ('Guardería'),
('Traslado al aeropuerto'), ('Bar en la azotea');

INSERT INTO hotel_caracteristicas (id_hotel, id_caracteristica, disponible) VALUES
(1, 1, TRUE), (1, 2, TRUE), (2, 1, TRUE), (2, 3, TRUE), (3, 5, TRUE),
(4, 2, TRUE), (4, 4, TRUE), (5, 6, TRUE), (6, 5, TRUE), (7, 3, TRUE),
(8, 6, TRUE), (9, 7, TRUE), (10, 10, TRUE), (1, 9, FALSE), (2, 8, TRUE);

INSERT INTO tipo_habitacion (nombre_tipo, descripcion, capacidad_personas) VALUES
('Sencilla', 'Habitación para una persona con cama individual.', 1),
('Doble', 'Habitación con cama matrimonial.', 2),
('Twin', 'Habitación con dos camas individuales.', 2),
('Familiar', 'Habitación amplia para familias.', 4),
('Suite', 'Suite de lujo con sala de estar.', 2),
('Presidencial', 'La mejor habitación del hotel, máximo lujo.', 2),
('Cuádruple', 'Cuatro camas individuales.', 4),
('Cabaña', 'Cabaña independiente en la naturaleza.', 5),
('Penthouse', 'Apartamento en el último piso con vista.', 4),
('Económica', 'Habitación básica sin ventanas grandes.', 2);

INSERT INTO habitaciones (id_hotel, id_tipo_habitacion, numero_habitacion, precio_noche, estado) VALUES
(1, 1, '101', 150000.00, 'disponible'),
(1, 5, '501', 450000.00, 'ocupada'),
(2, 2, '201', 200000.00, 'disponible'),
(2, 4, '301', 350000.00, 'mantenimiento'),
(3, 8, 'C-1', 180000.00, 'disponible'),
(4, 6, '1001', 850000.00, 'ocupada'),
(5, 10, '10', 90000.00, 'disponible'),
(6, 3, '205', 160000.00, 'disponible'),
(7, 5, '305', 500000.00, 'ocupada'),
(8, 8, 'E-5', 220000.00, 'mantenimiento');

INSERT INTO clientes (nombre, apellido, cedula, correo, celular, direccion, ciudad, pais, fecha_nacimiento) VALUES
('Juan', 'Pérez', '1000111222', 'juan.perez@email.com', '3001111111', 'Calle 10 # 20-30', 'Bogotá', 'Colombia', '1990-05-15'),
('María', 'Gómez', '1000222333', 'maria.gomez@email.com', '3002222222', 'Carrera 15 # 40-50', 'Medellín', 'Colombia', '1985-08-20'),
('Carlos', 'López', '1000333444', 'carlos.lopez@email.com', '3003333333', 'Av. Siempre Viva 123', 'Cali', 'Colombia', '1992-11-10'),
('Ana', 'Martínez', '1000444555', 'ana.martinez@email.com', '3004444444', 'Calle 50 # 10-10', 'Barranquilla', 'Colombia', '1988-03-25'),
('Luis', 'Rodríguez', '1000555666', 'luis.rodriguez@email.com', '3005555555', 'Transversal 5 # 3-2', 'Cartagena', 'Colombia', '1995-07-08'),
('Laura', 'Fernández', '1000666777', 'laura.fernandez@email.com', '3006666666', 'Diagonal 20 # 15-5', 'Bucaramanga', 'Colombia', '1991-12-12'),
('Pedro', 'Sánchez', '1000777888', 'pedro.sanchez@email.com', '3007777777', 'Carrera 8 # 12-34', 'Pereira', 'Colombia', '1980-01-30'),
('Sofía', 'Díaz', '1000888999', 'sofia.diaz@email.com', '3008888888', 'Calle Principal 1', 'Manizales', 'Colombia', '1993-09-18'),
('Diego', 'Ramírez', '1000999000', 'diego.ramirez@email.com', '3009999999', 'Conjunto Los Pinos', 'Armenia', 'Colombia', '1987-04-05'),
('Valentina', 'Torres', '1000000111', 'valentina.torres@email.com', '3000000000', 'Avenida del Río', 'Santa Marta', 'Colombia', '1998-06-22');

INSERT INTO empleados (nombre, apellido, cedula, correo_electronico, celular, direccion, ciudad, pais, fecha_nacimiento, fecha_contratacion) VALUES
('Andrés', 'Castro', '2000111222', 'andres.castro@alektours.com', '3101111111', 'Calle 1 # 1-1', 'Bogotá', 'Colombia', '1985-01-10', '2020-02-15'),
('Camila', 'Vargas', '2000222333', 'camila.vargas@alektours.com', '3102222222', 'Calle 2 # 2-2', 'Bogotá', 'Colombia', '1990-02-20', '2021-03-10'),
('Javier', 'Rojas', '2000333444', 'javier.rojas@alektours.com', '3103333333', 'Calle 3 # 3-3', 'Bogotá', 'Colombia', '1988-05-15', '2019-08-01'),
('Natalia', 'Molina', '2000444555', 'natalia.molina@alektours.com', '3104444444', 'Calle 4 # 4-4', 'Medellín', 'Colombia', '1992-09-25', '2022-01-10'),
('Felipe', 'Guzmán', '2000555666', 'felipe.guzman@alektours.com', '3105555555', 'Calle 5 # 5-5', 'Cartagena', 'Colombia', '1987-11-30', '2018-05-20'),
('Daniela', 'Ríos', '2000666777', 'daniela.rios@alektours.com', '3106666666', 'Calle 6 # 6-6', 'Cali', 'Colombia', '1995-04-12', '2023-06-15'),
('Óscar', 'Silva', '2000777888', 'oscar.silva@alektours.com', '3107777777', 'Calle 7 # 7-7', 'Bogotá', 'Colombia', '1980-08-08', '2015-10-10'),
('Mónica', 'Herrera', '2000888999', 'monica.herrera@alektours.com', '3108888888', 'Calle 8 # 8-8', 'Bogotá', 'Colombia', '1993-12-05', '2021-11-20'),
('Héctor', 'Peña', '2000999000', 'hector.pena@alektours.com', '3109999999', 'Calle 9 # 9-9', 'Medellín', 'Colombia', '1989-07-22', '2020-09-05'),
('Paola', 'Cruz', '2000000111', 'paola.cruz@alektours.com', '3100000000', 'Calle 10 # 10-10', 'Bogotá', 'Colombia', '1991-03-18', '2022-04-01');

-- Contraseña real para todos los usuarios semilla de abajo: Cliente1234!
-- (hash bcrypt generado con la misma función que usa el backend, app.core.security.hash_password)
INSERT INTO usuarios (username, correo_electronico, password_hash, id_cliente, id_empleado, verificado) VALUES
('juanp', 'juan.perez@email.com', '$2b$12$x7WABj1Ze4HuICVZwatKv.OIIRDSGvH0lrnI39i8fP2ZT.WN9cxKC', 1, NULL, TRUE),
('mariag', 'maria.gomez@email.com', '$2b$12$x7WABj1Ze4HuICVZwatKv.OIIRDSGvH0lrnI39i8fP2ZT.WN9cxKC', 2, NULL, TRUE),
('carlosl', 'carlos.lopez@email.com', '$2b$12$x7WABj1Ze4HuICVZwatKv.OIIRDSGvH0lrnI39i8fP2ZT.WN9cxKC', 3, NULL, FALSE),
('anam', 'ana.martinez@email.com', '$2b$12$x7WABj1Ze4HuICVZwatKv.OIIRDSGvH0lrnI39i8fP2ZT.WN9cxKC', 4, NULL, TRUE),
('luisr', 'luis.rodriguez@email.com', '$2b$12$x7WABj1Ze4HuICVZwatKv.OIIRDSGvH0lrnI39i8fP2ZT.WN9cxKC', 5, NULL, TRUE),
('andresc', 'andres.castro@alektours.com', '$2b$12$x7WABj1Ze4HuICVZwatKv.OIIRDSGvH0lrnI39i8fP2ZT.WN9cxKC', NULL, 1, TRUE),
('camilav', 'camila.vargas@alektours.com', '$2b$12$x7WABj1Ze4HuICVZwatKv.OIIRDSGvH0lrnI39i8fP2ZT.WN9cxKC', NULL, 2, TRUE),
('javierr', 'javier.rojas@alektours.com', '$2b$12$x7WABj1Ze4HuICVZwatKv.OIIRDSGvH0lrnI39i8fP2ZT.WN9cxKC', NULL, 3, TRUE),
('nataliam', 'natalia.molina@alektours.com', '$2b$12$x7WABj1Ze4HuICVZwatKv.OIIRDSGvH0lrnI39i8fP2ZT.WN9cxKC', NULL, 4, TRUE),
('felipeg', 'felipe.guzman@alektours.com', '$2b$12$x7WABj1Ze4HuICVZwatKv.OIIRDSGvH0lrnI39i8fP2ZT.WN9cxKC', NULL, 5, TRUE),
-- Admin de prueba por defecto. Contraseña real: Admin1234!
('admin', 'admin@alektours.com', '$2b$12$f2DaXti0iugxsf45u9humuEPGOHR6LT6zkfBKC8k75NtcRPeBcLPO', NULL, NULL, TRUE);

-- Roles para los usuarios semilla de arriba (antes no tenían ninguno, por
-- lo que ningún ProtectedRoute/require_admin los reconocía correctamente).
-- id_rol: 1=admin, 2=cliente, 3=empleado (ver seed de `roles` más arriba).
INSERT INTO usuarios_roles (id_usuario, id_rol) VALUES
(1, 2), (2, 2), (3, 2), (4, 2), (5, 2),   -- clientes
(6, 3), (7, 3), (8, 3), (9, 3), (10, 3),  -- empleados
(11, 1);                                  -- admin de prueba

INSERT INTO sesiones_usuario (id_usuario, refresh_token, direccion_ip, user_agent, fecha_expiracion) VALUES
(1, 'token_abc1', '192.168.1.1', 'Mozilla/5.0 Windows', '2026-12-31 23:59:59'),
(2, 'token_abc2', '192.168.1.2', 'Safari/537.36 Mac', '2026-12-31 23:59:59'),
(3, 'token_abc3', '192.168.1.3', 'Chrome/91.0 Android', '2026-12-31 23:59:59'),
(4, 'token_abc4', '192.168.1.4', 'Mozilla/5.0 Linux', '2026-12-31 23:59:59'),
(5, 'token_abc5', '192.168.1.5', 'Edge/91.0 Windows', '2026-12-31 23:59:59'),
(6, 'token_abc6', '10.0.0.1', 'Mozilla/5.0 Windows', '2026-12-31 23:59:59'),
(7, 'token_abc7', '10.0.0.2', 'Safari/537.36 Mac', '2026-12-31 23:59:59'),
(8, 'token_abc8', '10.0.0.3', 'Chrome/91.0 iOS', '2026-12-31 23:59:59'),
(9, 'token_abc9', '10.0.0.4', 'Mozilla/5.0 Windows', '2026-12-31 23:59:59'),
(10, 'token_abc10', '10.0.0.5', 'Edge/91.0 Mac', '2026-12-31 23:59:59');

INSERT INTO recuperacion_password (id_usuario, token_recuperacion, usado, fecha_expiracion) VALUES
(1, 'rec_token_1', FALSE, '2026-07-01 10:00:00'),
(2, 'rec_token_2', TRUE, '2026-01-01 10:00:00'),
(3, 'rec_token_3', FALSE, '2026-07-02 10:00:00'),
(4, 'rec_token_4', TRUE, '2026-02-15 10:00:00'),
(5, 'rec_token_5', FALSE, '2026-07-05 10:00:00'),
(6, 'rec_token_6', TRUE, '2025-11-20 10:00:00'),
(7, 'rec_token_7', FALSE, '2026-08-10 10:00:00'),
(8, 'rec_token_8', TRUE, '2026-03-25 10:00:00'),
(9, 'rec_token_9', FALSE, '2026-09-12 10:00:00'),
(10, 'rec_token_10', TRUE, '2025-12-05 10:00:00');

INSERT INTO destinos (nombre_destino, descripcion, ciudad, pais, temporada_alta_inicio, temporada_alta_fin) VALUES
('Muralla Histórica', 'Centro histórico amurallado.', 'Cartagena', 'Colombia', '2026-12-01', '2027-01-31'),
('Parque Tayrona', 'Reserva natural con playas vírgenes.', 'Santa Marta', 'Colombia', '2026-12-15', '2027-01-15'),
('Piedra del Peñol', 'Monolito gigante con vista al embalse.', 'Guatapé', 'Colombia', '2026-06-15', '2026-08-15'),
('Santuario de Monserrate', 'Iglesia en la cima de la montaña.', 'Bogotá', 'Colombia', '2026-03-25', '2026-04-05'),
('Valle del Cocora', 'Hogar de la palma de cera.', 'Salento', 'Colombia', '2026-12-20', '2027-01-20'),
('Desierto de la Tatacoa', 'Zona árida con observatorio astronómico.', 'Villavieja', 'Colombia', '2026-06-01', '2026-07-31'),
('Caño Cristales', 'El río de los cinco colores.', 'La Macarena', 'Colombia', '2026-07-01', '2026-11-30'),
('Isla de San Andrés', 'Mar de los siete colores.', 'San Andrés', 'Colombia', '2026-12-01', '2027-02-28'),
('Santuario de Las Lajas', 'Iglesia construida sobre el cañón.', 'Ipiales', 'Colombia', '2026-03-20', '2026-04-10'),
('Museo del Oro', 'Colección de orfebrería prehispánica.', 'Bogotá', 'Colombia', '2026-06-01', '2026-08-01');

INSERT INTO categoria_servicio (nombre_categoria) VALUES
('Tour Guiado'), ('Transporte'), ('Aventura y Deportes'), ('Gastronomía'), 
('Cultura y Museos'), ('Relajación y Spa'), ('Vida Nocturna'), ('Fotografía'),
('Ecoturismo'), ('Compras');

INSERT INTO servicios (nombre_servicio, descripcion, id_categoria, id_destino, duracion_horas, precio_base, capacidad_maxima) VALUES
('City Tour Histórico', 'Recorrido por la ciudad amurallada.', 1, 1, 3.5, 80000.00, 20),
('Caminata Ecológica Tayrona', 'Senderismo hasta Cabo San Juan.', 9, 2, 6.0, 120000.00, 15),
('Escalada Peñol', 'Subida a los 740 escalones.', 3, 3, 2.0, 45000.00, 50),
('Teleférico Monserrate', 'Subida y bajada en teleférico.', 2, 4, 1.5, 25000.00, 100),
('Cabalgata Cocora', 'Paseo en caballo por el valle.', 9, 5, 2.5, 60000.00, 10),
('Tour Astronómico', 'Observación de estrellas en el desierto.', 1, 6, 2.0, 35000.00, 25),
('Safari Fotográfico Macarena', 'Tour en lancha y caminata.', 8, 7, 8.0, 250000.00, 12),
('Buceo San Andrés', 'Inmersión para principiantes.', 3, 8, 4.0, 180000.00, 6),
('Tour Religioso Las Lajas', 'Visita guiada al santuario.', 5, 9, 3.0, 40000.00, 30),
('Entrada VIP Museo', 'Acceso sin filas y guía privado.', 5, 10, 2.5, 90000.00, 5);

INSERT INTO proveedores (nombre_proveedor, tipo_proveedor, contacto, telefono, correo_electronico, direccion, ciudad, pais, comision_porcentaje) VALUES
('Transportes Caribe', 'Transporte', 'Luis Ramos', '3001112233', 'luis@transcaribe.com', 'Calle 10', 'Cartagena', 'Colombia', 15.00),
('Guías Nativos', 'Guianza', 'Pedro Pataquiva', '3002223344', 'pedro@guias.com', 'Calle 11', 'Santa Marta', 'Colombia', 20.00),
('Aventuras Extremas', 'Recreación', 'Ana Roa', '3003334455', 'ana@aventuras.com', 'Calle 12', 'Medellín', 'Colombia', 10.00),
('Monserrate Tour SAS', 'Operador', 'Juan Díaz', '3004445566', 'juan@montour.com', 'Calle 13', 'Bogotá', 'Colombia', 12.50),
('Caballos del Quindío', 'Recreación', 'Carlos Ruiz', '3005556677', 'carlos@caballos.com', 'Calle 14', 'Salento', 'Colombia', 18.00),
('Tatacoa Stars', 'Guianza', 'María Luz', '3006667788', 'maria@stars.com', 'Calle 15', 'Villavieja', 'Colombia', 15.00),
('Cristales Eco', 'Operador', 'Jorge Pan', '3007778899', 'jorge@eco.com', 'Calle 16', 'La Macarena', 'Colombia', 25.00),
('Dive Master SA', 'Recreación', 'Sofia Mar', '3008889900', 'sofia@dive.com', 'Calle 17', 'San Andrés', 'Colombia', 20.00),
('Sur Turismo', 'Operador', 'Diego Sur', '3009990011', 'diego@sur.com', 'Calle 18', 'Ipiales', 'Colombia', 10.00),
('Cultura Capital', 'Guianza', 'Laura Ley', '3000001122', 'laura@cultura.com', 'Calle 19', 'Bogotá', 'Colombia', 15.00);

INSERT INTO servicio_proveedor (id_servicio, id_proveedor, precio_proveedor, es_proveedor_principal) VALUES
(1, 1, 65000.00, TRUE), (2, 2, 95000.00, TRUE), (3, 3, 35000.00, TRUE),
(4, 4, 20000.00, TRUE), (5, 5, 45000.00, TRUE), (6, 6, 28000.00, TRUE),
(7, 7, 180000.00, TRUE), (8, 8, 140000.00, TRUE), (9, 9, 32000.00, TRUE),
(10, 10, 75000.00, TRUE);

INSERT INTO paquetes (nombre_paquete, descripcion, duracion_dias, precio_base, activo) VALUES
('Magia del Caribe', 'Recorrido por Cartagena y Santa Marta.', 5, 1200000.00, TRUE),
('Aventura Paisa', 'Medellín, Peñol y Guatapé.', 4, 850000.00, TRUE),
('Bogotá Cultural', 'Museos, Monserrate y gastronomía.', 3, 500000.00, TRUE),
('Eje Cafetero Total', 'Salento, Cocora y fincas cafeteras.', 4, 900000.00, TRUE),
('Maravillas Ocultas', 'Tatacoa y Caño Cristales.', 6, 1800000.00, TRUE),
('San Andrés Premium', 'Buceo y relax total.', 5, 1500000.00, TRUE),
('Sur de Colombia', 'Pasto, Las Lajas y Laguna de la Cocha.', 4, 750000.00, TRUE),
('Ruta del Sol', 'Costa caribeña completa.', 7, 2100000.00, TRUE),
('Escapada Romántica', 'Fin de semana en cabaña con spa.', 2, 600000.00, TRUE),
('Full Adrenalina', 'Deportes extremos en Santander.', 4, 950000.00, TRUE);

INSERT INTO paquete_servicios (id_paquete, id_servicio, dia_actividad, incluido) VALUES
(1, 1, 1, TRUE), (1, 2, 3, TRUE), (2, 3, 2, TRUE), (3, 4, 1, TRUE),
(3, 10, 2, TRUE), (4, 5, 2, TRUE), (5, 6, 1, TRUE), (5, 7, 4, TRUE),
(6, 8, 2, TRUE), (7, 9, 2, TRUE);

INSERT INTO paquete_hotel (id_paquete, id_hotel, noches_incluidas) VALUES
(1, 2, 2), (1, 8, 2), (2, 9, 3), (3, 4, 2),
(4, 5, 3), (5, 10, 1), (6, 7, 4), (7, 10, 3),
(8, 2, 3), (9, 3, 1);

INSERT INTO reservas (id_cliente, id_empleado, id_paquete, fecha_inicio, fecha_fin, numero_personas, estado) VALUES
(1, 1, 1, '2026-07-10', '2026-07-15', 2, 'confirmada'),
(2, 2, 2, '2026-08-01', '2026-08-05', 4, 'pendiente'),
(3, 3, 3, '2026-06-20', '2026-06-23', 1, 'finalizada'),
(4, 4, 4, '2026-09-10', '2026-09-14', 2, 'confirmada'),
(5, 5, 5, '2026-10-05', '2026-10-11', 2, 'cancelada'),
(6, 1, 6, '2026-11-15', '2026-11-20', 2, 'confirmada'),
(7, 2, 7, '2026-12-01', '2026-12-05', 4, 'pendiente'),
(8, 3, 8, '2027-01-10', '2027-01-17', 2, 'confirmada'),
(9, 4, 9, '2026-07-25', '2026-07-27', 2, 'finalizada'),
(10, 5, 10, '2026-08-15', '2026-08-19', 3, 'confirmada');

INSERT INTO reserva_habitaciones (id_reserva, id_habitacion, fecha_checkin, fecha_checkout, precio_acordado) VALUES
(1, 3, '2026-07-10', '2026-07-12', 400000.00),
(2, 4, '2026-08-01', '2026-08-05', 1400000.00),
(3, 6, '2026-06-20', '2026-06-23', 2550000.00),
(4, 5, '2026-09-10', '2026-09-14', 720000.00),
(5, 7, '2026-10-05', '2026-10-07', 180000.00),
(6, 9, '2026-11-15', '2026-11-20', 2500000.00),
(7, 10, '2027-01-10', '2027-01-17', 1540000.00),
(8, 3, '2027-01-10', '2027-01-13', 600000.00),
(9, 8, '2026-07-25', '2026-07-27', 320000.00),
(10, 1, '2026-08-15', '2026-08-19', 600000.00);

INSERT INTO reserva_servicios (id_reserva, id_servicio, fecha_servicio, numero_personas, precio_acordado) VALUES
(1, 1, '2026-07-11', 2, 160000.00),
(2, 3, '2026-08-02', 4, 180000.00),
(3, 4, '2026-06-21', 1, 25000.00),
(3, 10, '2026-06-22', 1, 90000.00),
(4, 5, '2026-09-12', 2, 120000.00),
(5, 6, '2026-10-06', 2, 70000.00),
(6, 8, '2026-11-17', 2, 360000.00),
(7, 9, '2026-12-03', 4, 160000.00),
(9, 6, '2026-07-26', 2, 70000.00),
(10, 2, '2026-08-17', 3, 360000.00);

INSERT INTO pagos (id_reserva, id_metodo_pago, monto, referencia, estado) VALUES
(1, 1, 1200000.00, 'REF-001', 'pagado'),
(2, 4, 425000.00, 'REF-002', 'pendiente'),
(3, 3, 500000.00, 'REF-003', 'pagado'),
(4, 1, 900000.00, 'REF-004', 'pagado'),
(5, 2, 1800000.00, 'REF-005', 'rechazado'),
(6, 5, 1500000.00, 'REF-006', 'pagado'),
(7, 4, 375000.00, 'REF-007', 'pendiente'),
(8, 1, 2100000.00, 'REF-008', 'pagado'),
(9, 7, 600000.00, 'REF-009', 'pagado'),
(10, 9, 950000.00, 'REF-010', 'pagado');

INSERT INTO historial_reservas (id_reserva, estado_anterior, estado_nuevo, id_empleado_responsable, comentarios) VALUES
(1, 'pendiente', 'confirmada', 1, 'Pago recibido con éxito.'),
(2, NULL, 'pendiente', 2, 'Cliente solicitó prorroga para el pago.'),
(3, 'confirmada', 'finalizada', 3, 'El cliente completó su viaje satisfactoriamente.'),
(4, 'pendiente', 'confirmada', 4, 'Transferencia validada por contabilidad.'),
(5, 'confirmada', 'cancelada', 5, 'Cancelación por motivos de salud del cliente.'),
(6, 'pendiente', 'confirmada', 1, 'Pago por PayPal aprobado.'),
(7, NULL, 'pendiente', 2, 'Reserva creada en el sistema.'),
(8, 'pendiente', 'confirmada', 3, 'Tarjeta de crédito procesada.'),
(9, 'confirmada', 'finalizada', 4, 'Viaje finalizado sin novedades.'),
(10, 'pendiente', 'confirmada', 5, 'Pago por PSE ingresado.');

ALTER TABLE reservas
  ADD COLUMN canal_origen VARCHAR(20) DEFAULT 'web'
  CHECK (canal_origen IN ('web', 'empleado', 'telefono'));

CREATE OR REPLACE VIEW vista_paquetes_populares AS
SELECT
    p.id_paquete,
    p.nombre_paquete,
    p.descripcion,
    p.duracion_dias,
    p.precio_base,
    p.activo,
    COUNT(r.id_reserva) AS total_reservas,
    ROUND(AVG(CASE WHEN pa.estado = 'pagado' THEN 1.0 ELSE 0.0 END) * 5, 1) AS calificacion_estimada
FROM paquetes p
LEFT JOIN reservas r ON r.id_paquete = p.id_paquete
LEFT JOIN pagos pa ON pa.id_reserva = r.id_reserva
WHERE p.activo = TRUE
GROUP BY p.id_paquete
ORDER BY total_reservas DESC, calificacion_estimada DESC;

CREATE TABLE IF NOT EXISTS banners_publicitarios (
    id_banner SERIAL PRIMARY KEY,

    titulo VARCHAR(150) NOT NULL,
    descripcion_corta VARCHAR(300),
    imagen_url VARCHAR(255) NOT NULL,
    texto_boton VARCHAR(50),
    link_destino VARCHAR(255),

    fecha_inicio DATE,
    fecha_fin DATE,

    orden INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);