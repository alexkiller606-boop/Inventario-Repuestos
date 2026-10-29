-- ============================================================================
-- BASE DE DATOS: MOTO REPUESTOS PAPI BETO
-- ============================================================================
-- Motor:        MySQL 8.x / MariaDB 10.x  (InnoDB)
-- Proyecto:     Cátedra de Bases de Datos – UNERMB
-- Autor:        Grupo Investigador
-- Fecha:        2026-01-07
-- Descripción:  Script unificado que contiene:
--               ► Tablas operativas del negocio (6)
--               ► Subsistema de Seguridad RBAC Jerárquico (5 + 2 + 1)
--               ► Tabla de auditoría (1)
--               ► Datos semilla (seed) de seguridad y operativos
--               ► Transacciones ACID de ejemplo
-- ============================================================================

-- ────────────────────────────────────────────────
-- 0. CREACIÓN Y SELECCIÓN DE LA BASE DE DATOS
-- ────────────────────────────────────────────────
DROP DATABASE IF EXISTS moto_repuestos_papi_beto;
CREATE DATABASE moto_repuestos_papi_beto
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE moto_repuestos_papi_beto;

-- Forzar motor InnoDB por defecto (soporte transaccional ACID)
SET default_storage_engine = InnoDB;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║          PARTE I  –  SUBSISTEMA DE SEGURIDAD  (RBAC JERÁRQUICO)        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Orden de creación respetuoso de las dependencias FK:
--   Nivel 1 (Base):        usuario, rol, modulo, vistas, permisos
--   Nivel 2 (Intermedia):  r_usuario_rol, r_modulo_rol
--   Nivel 3 (Granular):    vistas_permiso
--   Auditoría:             auditoria_logs

-- ────────────────────────────────────────────────
-- 1.1  TABLA: usuario
-- ────────────────────────────────────────────────
-- Almacena las credenciales y el estado de cada usuario del sistema.
-- El campo password_hash guarda el hash (nunca texto plano).
CREATE TABLE usuario (
    id              INT             NOT NULL AUTO_INCREMENT,
    nombre          VARCHAR(120)    NOT NULL,
    email           VARCHAR(180)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_creacion  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_usuario       PRIMARY KEY (id),
    CONSTRAINT uq_usuario_email UNIQUE (email)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 1.2  TABLA: rol
-- ────────────────────────────────────────────────
-- Define los roles jerárquicos del sistema (Admin, Vendedor, etc.).
CREATE TABLE rol (
    id              INT             NOT NULL AUTO_INCREMENT,
    nombre_rol      VARCHAR(60)     NOT NULL,
    descripcion     VARCHAR(255)    NULL,

    CONSTRAINT pk_rol             PRIMARY KEY (id),
    CONSTRAINT uq_rol_nombre      UNIQUE (nombre_rol)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 1.3  TABLA: modulo
-- ────────────────────────────────────────────────
-- Cada módulo agrupa funcionalidades del sistema (Inventario, Ventas, etc.).
CREATE TABLE modulo (
    id              INT             NOT NULL AUTO_INCREMENT,
    nombre_modulo   VARCHAR(80)     NOT NULL,
    descripcion     VARCHAR(255)    NULL,
    icono           VARCHAR(60)     NULL,
    orden           INT             NOT NULL DEFAULT 0,

    CONSTRAINT pk_modulo          PRIMARY KEY (id),
    CONSTRAINT uq_modulo_nombre   UNIQUE (nombre_modulo)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 1.4  TABLA: vistas
-- ────────────────────────────────────────────────
-- Representa las pantallas / rutas del frontend a las que se controla acceso.
CREATE TABLE vistas (
    id              INT             NOT NULL AUTO_INCREMENT,
    nombre_vista    VARCHAR(100)    NOT NULL,
    ruta_acceso     VARCHAR(255)    NOT NULL,
    descripcion     VARCHAR(255)    NULL,

    CONSTRAINT pk_vistas            PRIMARY KEY (id),
    CONSTRAINT uq_vistas_ruta       UNIQUE (ruta_acceso)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 1.5  TABLA: permisos
-- ────────────────────────────────────────────────
-- Catálogo de acciones atómicas (crear, leer, actualizar, eliminar, exportar…).
CREATE TABLE permisos (
    id              INT             NOT NULL AUTO_INCREMENT,
    nombre_permiso  VARCHAR(60)     NOT NULL,
    descripcion     VARCHAR(255)    NULL,

    CONSTRAINT pk_permisos          PRIMARY KEY (id),
    CONSTRAINT uq_permisos_nombre   UNIQUE (nombre_permiso)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 1.6  TABLA INTERMEDIA: r_usuario_rol
-- ────────────────────────────────────────────────
-- Asocia N usuarios con M roles (relación muchos-a-muchos).
-- ON DELETE CASCADE en usuario: si se elimina el usuario, se pierde la asignación.
-- ON DELETE RESTRICT en rol: impide borrar un rol que tenga usuarios asignados.
CREATE TABLE r_usuario_rol (
    id              INT             NOT NULL AUTO_INCREMENT,
    usuario_id      INT             NOT NULL,
    rol_id          INT             NOT NULL,

    CONSTRAINT pk_r_usuario_rol     PRIMARY KEY (id),
    CONSTRAINT fk_rur_usuario       FOREIGN KEY (usuario_id)
                                    REFERENCES usuario (id)
                                    ON DELETE CASCADE
                                    ON UPDATE CASCADE,
    CONSTRAINT fk_rur_rol           FOREIGN KEY (rol_id)
                                    REFERENCES rol (id)
                                    ON DELETE RESTRICT
                                    ON UPDATE CASCADE,
    CONSTRAINT uq_usuario_rol       UNIQUE (usuario_id, rol_id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 1.7  TABLA INTERMEDIA: r_modulo_rol
-- ────────────────────────────────────────────────
-- Determina qué módulos están habilitados para cada rol.
-- ON DELETE CASCADE en rol: si se elimina el rol, se borran sus asignaciones.
-- ON DELETE RESTRICT en modulo: protege los módulos referenciados.
CREATE TABLE r_modulo_rol (
    id              INT             NOT NULL AUTO_INCREMENT,
    rol_id          INT             NOT NULL,
    modulo_id       INT             NOT NULL,
    habilitado      BOOLEAN         NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_r_modulo_rol      PRIMARY KEY (id),
    CONSTRAINT fk_rmr_rol           FOREIGN KEY (rol_id)
                                    REFERENCES rol (id)
                                    ON DELETE CASCADE
                                    ON UPDATE CASCADE,
    CONSTRAINT fk_rmr_modulo        FOREIGN KEY (modulo_id)
                                    REFERENCES modulo (id)
                                    ON DELETE RESTRICT
                                    ON UPDATE CASCADE,
    CONSTRAINT uq_rol_modulo        UNIQUE (rol_id, modulo_id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 1.8  TABLA DE AUTORIZACIÓN GRANULAR: vistas_permiso
-- ────────────────────────────────────────────────
-- Define, para cada combinación (rol→módulo), qué permisos tiene
-- sobre cada vista específica.  Es el nivel más fino de control.
CREATE TABLE vistas_permiso (
    id                  INT         NOT NULL AUTO_INCREMENT,
    r_modulo_rol_id     INT         NOT NULL,
    vista_id            INT         NOT NULL,
    permiso_id          INT         NOT NULL,
    permitido           BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT pk_vistas_permiso    PRIMARY KEY (id),
    CONSTRAINT fk_vp_modulo_rol     FOREIGN KEY (r_modulo_rol_id)
                                    REFERENCES r_modulo_rol (id)
                                    ON DELETE CASCADE
                                    ON UPDATE CASCADE,
    CONSTRAINT fk_vp_vista          FOREIGN KEY (vista_id)
                                    REFERENCES vistas (id)
                                    ON DELETE CASCADE
                                    ON UPDATE CASCADE,
    CONSTRAINT fk_vp_permiso        FOREIGN KEY (permiso_id)
                                    REFERENCES permisos (id)
                                    ON DELETE CASCADE
                                    ON UPDATE CASCADE,
    CONSTRAINT uq_vp_unica         UNIQUE (r_modulo_rol_id, vista_id, permiso_id)
) ENGINE=InnoDB;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║          PARTE II  –  TABLAS OPERATIVAS DEL NEGOCIO                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Tablas del dominio comercial de Moto Repuestos Papi Beto.

-- ────────────────────────────────────────────────
-- 2.1  TABLA: proveedores
-- ────────────────────────────────────────────────
CREATE TABLE proveedores (
    id              INT             NOT NULL AUTO_INCREMENT,
    nombre          VARCHAR(150)    NOT NULL,
    rif             VARCHAR(20)     NOT NULL,
    telefono        VARCHAR(20)     NULL,
    email           VARCHAR(180)    NULL,
    direccion       VARCHAR(255)    NULL,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_creacion  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_proveedores       PRIMARY KEY (id),
    CONSTRAINT uq_proveedores_rif   UNIQUE (rif)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 2.2  TABLA: categorias
-- ────────────────────────────────────────────────
CREATE TABLE categorias (
    id              INT             NOT NULL AUTO_INCREMENT,
    nombre          VARCHAR(80)     NOT NULL,
    descripcion     VARCHAR(255)    NULL,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_categorias        PRIMARY KEY (id),
    CONSTRAINT uq_categorias_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 2.3  TABLA: productos
-- ────────────────────────────────────────────────
-- Cada producto pertenece a una categoría y a un proveedor.
CREATE TABLE productos (
    id              INT             NOT NULL AUTO_INCREMENT,
    codigo          VARCHAR(30)     NOT NULL,
    nombre          VARCHAR(150)    NOT NULL,
    descripcion     VARCHAR(255)    NULL,
    marca           VARCHAR(80)     NULL,
    precio_compra   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    precio_venta    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    stock           INT             NOT NULL DEFAULT 0,
    stock_minimo    INT             NOT NULL DEFAULT 5,
    categoria_id    INT             NULL,
    proveedor_id    INT             NULL,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_creacion  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_productos             PRIMARY KEY (id),
    CONSTRAINT uq_productos_codigo      UNIQUE (codigo),
    CONSTRAINT fk_productos_categoria   FOREIGN KEY (categoria_id)
                                        REFERENCES categorias (id)
                                        ON DELETE SET NULL
                                        ON UPDATE CASCADE,
    CONSTRAINT fk_productos_proveedor   FOREIGN KEY (proveedor_id)
                                        REFERENCES proveedores (id)
                                        ON DELETE SET NULL
                                        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 2.4  TABLA: clientes
-- ────────────────────────────────────────────────
CREATE TABLE clientes (
    id              INT             NOT NULL AUTO_INCREMENT,
    nombre          VARCHAR(150)    NOT NULL,
    cedula          VARCHAR(20)     NOT NULL,
    telefono        VARCHAR(20)     NULL,
    email           VARCHAR(180)    NULL,
    direccion       VARCHAR(255)    NULL,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_creacion  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_clientes          PRIMARY KEY (id),
    CONSTRAINT uq_clientes_cedula   UNIQUE (cedula)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 2.5  TABLA: ventas
-- ────────────────────────────────────────────────
-- Cada venta referencia al cliente, y al usuario responsable
-- que la registró (vinculación con el subsistema RBAC).
CREATE TABLE ventas (
    id              INT             NOT NULL AUTO_INCREMENT,
    numero_factura  VARCHAR(30)     NOT NULL,
    cliente_id      INT             NULL,
    usuario_id      INT             NULL,              -- ◄ FK hacia usuario (RBAC)
    fecha_venta     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    impuesto        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    total           DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    observaciones   VARCHAR(255)    NULL,
    estado          ENUM('completada','anulada','pendiente')
                                    NOT NULL DEFAULT 'completada',

    CONSTRAINT pk_ventas                PRIMARY KEY (id),
    CONSTRAINT uq_ventas_factura        UNIQUE (numero_factura),
    CONSTRAINT fk_ventas_cliente        FOREIGN KEY (cliente_id)
                                        REFERENCES clientes (id)
                                        ON DELETE SET NULL
                                        ON UPDATE CASCADE,
    CONSTRAINT fk_ventas_usuario        FOREIGN KEY (usuario_id)
                                        REFERENCES usuario (id)
                                        ON DELETE SET NULL
                                        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────
-- 2.6  TABLA: detalle_venta
-- ────────────────────────────────────────────────
-- Líneas de cada factura (relación 1:N con ventas y N:1 con productos).
CREATE TABLE detalle_venta (
    id              INT             NOT NULL AUTO_INCREMENT,
    venta_id        INT             NOT NULL,
    producto_id     INT             NOT NULL,
    cantidad        INT             NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    subtotal        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,

    CONSTRAINT pk_detalle_venta             PRIMARY KEY (id),
    CONSTRAINT fk_detalle_venta_venta       FOREIGN KEY (venta_id)
                                            REFERENCES ventas (id)
                                            ON DELETE CASCADE
                                            ON UPDATE CASCADE,
    CONSTRAINT fk_detalle_venta_producto    FOREIGN KEY (producto_id)
                                            REFERENCES productos (id)
                                            ON DELETE RESTRICT
                                            ON UPDATE CASCADE
) ENGINE=InnoDB;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║          PARTE III  –  TABLA DE AUDITORÍA                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ────────────────────────────────────────────────
-- 3.1  TABLA: auditoria_logs
-- ────────────────────────────────────────────────
-- Registra cada acción relevante del sistema para trazabilidad.
CREATE TABLE auditoria_logs (
    id              INT             NOT NULL AUTO_INCREMENT,
    usuario_id      INT             NULL,
    accion          VARCHAR(100)    NOT NULL,
    tabla_afectada  VARCHAR(80)     NOT NULL,
    registro_id     INT             NULL,
    datos_anteriores JSON           NULL,       -- Snapshot antes del cambio
    datos_nuevos     JSON           NULL,       -- Snapshot después del cambio
    ip_address      VARCHAR(45)     NULL,
    fecha_hora      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_auditoria_logs        PRIMARY KEY (id),
    CONSTRAINT fk_auditoria_usuario     FOREIGN KEY (usuario_id)
                                        REFERENCES usuario (id)
                                        ON DELETE SET NULL
                                        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Índice para consultas frecuentes de auditoría por fecha y tabla
CREATE INDEX idx_auditoria_fecha   ON auditoria_logs (fecha_hora);
CREATE INDEX idx_auditoria_tabla   ON auditoria_logs (tabla_afectada);
CREATE INDEX idx_auditoria_usuario ON auditoria_logs (usuario_id);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║          PARTE IV  –  DATOS SEMILLA  (SEED DATA)                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Datos iniciales mínimos para que el sistema sea funcional desde el arranque.

-- ────────────────────────────────────────────────
-- 4.1  ROLES DEL SISTEMA
-- ────────────────────────────────────────────────
INSERT INTO rol (nombre_rol, descripcion) VALUES
('Administrador',   'Acceso total al sistema, gestión de usuarios y configuración'),
('Vendedor',        'Acceso al módulo de ventas, consulta de inventario'),
('Almacenista',     'Gestión de inventario, recepción de mercancía'),
('Auditor',         'Solo lectura de reportes y registros de auditoría'),
('Invitado',        'Acceso mínimo, solo consulta de productos');

-- ────────────────────────────────────────────────
-- 4.2  MÓDULOS DEL SISTEMA
-- ────────────────────────────────────────────────
INSERT INTO modulo (nombre_modulo, descripcion, icono, orden) VALUES
('Dashboard',       'Panel principal con indicadores',              '📊', 1),
('Inventario',      'Gestión de productos y stock',                 '📦', 2),
('Ventas',          'Registro y consulta de ventas',                '🛒', 3),
('Clientes',        'Gestión de cartera de clientes',               '👥', 4),
('Proveedores',     'Gestión de proveedores',                       '🏭', 5),
('Reportes',        'Generación de reportes y estadísticas',        '📈', 6),
('Seguridad',       'Gestión de usuarios, roles y permisos',        '🔐', 7),
('Auditoría',       'Consulta de logs de auditoría',                '📋', 8);

-- ────────────────────────────────────────────────
-- 4.3  VISTAS (PANTALLAS / RUTAS)
-- ────────────────────────────────────────────────
INSERT INTO vistas (nombre_vista, ruta_acceso, descripcion) VALUES
('Inicio',                  '/dashboard',                   'Vista principal del dashboard'),
('Lista de Productos',      '/inventario/productos',        'Listado y búsqueda de productos'),
('Agregar Producto',        '/inventario/productos/nuevo',  'Formulario de nuevo producto'),
('Editar Producto',         '/inventario/productos/editar', 'Formulario de edición de producto'),
('Registro de Venta',       '/ventas/nueva',                'Formulario de nueva venta'),
('Historial de Ventas',     '/ventas/historial',            'Consulta de ventas realizadas'),
('Lista de Clientes',       '/clientes',                    'Listado de clientes'),
('Lista de Proveedores',    '/proveedores',                 'Listado de proveedores'),
('Gestión de Usuarios',     '/seguridad/usuarios',          'ABM de usuarios del sistema'),
('Gestión de Roles',        '/seguridad/roles',             'ABM de roles y asignación'),
('Logs de Auditoría',       '/auditoria/logs',              'Consulta de registros de auditoría'),
('Reportes de Ventas',      '/reportes/ventas',             'Reportes consolidados de ventas'),
('Reportes de Inventario',  '/reportes/inventario',         'Reportes de existencia y movimiento');

-- ────────────────────────────────────────────────
-- 4.4  PERMISOS (ACCIONES ATÓMICAS)
-- ────────────────────────────────────────────────
INSERT INTO permisos (nombre_permiso, descripcion) VALUES
('crear',       'Permite crear nuevos registros'),
('leer',        'Permite consultar / listar registros'),
('actualizar',  'Permite modificar registros existentes'),
('eliminar',    'Permite eliminar registros'),
('exportar',    'Permite exportar datos a CSV / PDF'),
('importar',    'Permite importar datos masivamente'),
('anular',      'Permite anular transacciones (ventas)');

-- ────────────────────────────────────────────────
-- 4.5  USUARIOS DE PRUEBA
-- ────────────────────────────────────────────────
-- Nota: Los hashes son ficticios. En producción deben generarse con
--       bcrypt, Argon2 u otro algoritmo seguro desde el backend.
INSERT INTO usuario (nombre, email, password_hash, activo) VALUES
('Pedro Betancourt',    'admin@motorepuestos.com',      SHA2('Admin2024#',256),    TRUE),
('María González',      'ventas@motorepuestos.com',     SHA2('Ventas2024#',256),   TRUE),
('José Rodríguez',      'almacen@motorepuestos.com',    SHA2('Almacen2024#',256),  TRUE),
('Ana Martínez',        'auditor@motorepuestos.com',    SHA2('Auditor2024#',256),  TRUE);

-- ────────────────────────────────────────────────
-- 4.6  ASIGNACIÓN USUARIO ↔ ROL
-- ────────────────────────────────────────────────
INSERT INTO r_usuario_rol (usuario_id, rol_id) VALUES
(1, 1),   -- Pedro  → Administrador
(2, 2),   -- María  → Vendedor
(3, 3),   -- José   → Almacenista
(4, 4);   -- Ana    → Auditor

-- ────────────────────────────────────────────────
-- 4.7  ASIGNACIÓN ROL ↔ MÓDULO  (r_modulo_rol)
-- ────────────────────────────────────────────────
-- Administrador (rol 1) → todos los módulos habilitados
INSERT INTO r_modulo_rol (rol_id, modulo_id, habilitado) VALUES
(1, 1, TRUE), (1, 2, TRUE), (1, 3, TRUE), (1, 4, TRUE),
(1, 5, TRUE), (1, 6, TRUE), (1, 7, TRUE), (1, 8, TRUE);

-- Vendedor (rol 2) → Dashboard, Ventas, Clientes
INSERT INTO r_modulo_rol (rol_id, modulo_id, habilitado) VALUES
(2, 1, TRUE), (2, 3, TRUE), (2, 4, TRUE);

-- Almacenista (rol 3) → Dashboard, Inventario, Proveedores
INSERT INTO r_modulo_rol (rol_id, modulo_id, habilitado) VALUES
(3, 1, TRUE), (3, 2, TRUE), (3, 5, TRUE);

-- Auditor (rol 4) → Dashboard, Reportes, Auditoría
INSERT INTO r_modulo_rol (rol_id, modulo_id, habilitado) VALUES
(4, 1, TRUE), (4, 6, TRUE), (4, 8, TRUE);

-- ────────────────────────────────────────────────
-- 4.8  PERMISOS GRANULARES POR VISTA  (vistas_permiso)
-- ────────────────────────────────────────────────
-- Administrador (r_modulo_rol ids 1-8): permisos completos en todas sus vistas

-- Admin → Módulo Dashboard (rmr_id=1) → Vista "Inicio" (vista 1) → leer (2)
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(1, 1, 2, TRUE);

-- Admin → Módulo Inventario (rmr_id=2) → Vistas de productos → CRUD completo
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(2, 2, 1, TRUE), (2, 2, 2, TRUE), (2, 2, 3, TRUE), (2, 2, 4, TRUE), (2, 2, 5, TRUE),
(2, 3, 1, TRUE),
(2, 4, 3, TRUE);

-- Admin → Módulo Ventas (rmr_id=3) → Vistas de ventas → todos los permisos
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(3, 5, 1, TRUE), (3, 5, 2, TRUE),
(3, 6, 2, TRUE), (3, 6, 5, TRUE), (3, 6, 7, TRUE);

-- Admin → Módulo Seguridad (rmr_id=7) → Gestión usuarios y roles
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(7, 9,  1, TRUE), (7, 9,  2, TRUE), (7, 9,  3, TRUE), (7, 9,  4, TRUE),
(7, 10, 1, TRUE), (7, 10, 2, TRUE), (7, 10, 3, TRUE), (7, 10, 4, TRUE);

-- Admin → Módulo Auditoría (rmr_id=8) → Solo lectura de logs
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(8, 11, 2, TRUE), (8, 11, 5, TRUE);

-- Vendedor → Dashboard (rmr_id=9) → leer
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(9, 1, 2, TRUE);

-- Vendedor → Ventas (rmr_id=10) → crear y leer ventas
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(10, 5, 1, TRUE), (10, 5, 2, TRUE),
(10, 6, 2, TRUE);

-- Vendedor → Clientes (rmr_id=11) → crear, leer, actualizar
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(11, 7, 1, TRUE), (11, 7, 2, TRUE), (11, 7, 3, TRUE);

-- Almacenista → Dashboard (rmr_id=12) → leer
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(12, 1, 2, TRUE);

-- Almacenista → Inventario (rmr_id=13) → CRUD productos
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(13, 2, 1, TRUE), (13, 2, 2, TRUE), (13, 2, 3, TRUE),
(13, 3, 1, TRUE),
(13, 4, 3, TRUE);

-- Almacenista → Proveedores (rmr_id=14) → leer y actualizar
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(14, 8, 2, TRUE), (14, 8, 3, TRUE);

-- Auditor → Dashboard (rmr_id=15) → leer
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(15, 1, 2, TRUE);

-- Auditor → Reportes (rmr_id=16) → leer y exportar
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(16, 12, 2, TRUE), (16, 12, 5, TRUE),
(16, 13, 2, TRUE), (16, 13, 5, TRUE);

-- Auditor → Auditoría (rmr_id=17) → leer y exportar logs
INSERT INTO vistas_permiso (r_modulo_rol_id, vista_id, permiso_id, permitido) VALUES
(17, 11, 2, TRUE), (17, 11, 5, TRUE);


-- ────────────────────────────────────────────────
-- 4.9  DATOS SEMILLA OPERATIVOS
-- ────────────────────────────────────────────────

-- Proveedores de ejemplo
INSERT INTO proveedores (nombre, rif, telefono, email, direccion) VALUES
('Distribuidora Motos del Zulia',   'J-12345678-9', '0261-7001234', 'ventas@motozulia.com',   'Av. 5 de Julio, Maracaibo'),
('Repuestos Universales C.A.',      'J-98765432-1', '0261-7005678', 'info@repuniversal.com',  'Calle 72, Maracaibo'),
('ImportMotos Venezuela',           'J-11223344-5', '0212-5551234', 'contacto@importmotos.ve','Caracas, Dtto. Capital');

-- Categorías de repuestos
INSERT INTO categorias (nombre, descripcion) VALUES
('Motor',           'Piezas internas y externas del motor'),
('Frenos',          'Pastillas, discos, líquido de frenos'),
('Transmisión',     'Cadenas, piñones, kit de arrastre'),
('Electricidad',    'Bujías, reguladores, luces LED'),
('Suspensión',      'Amortiguadores, resortes, bujes'),
('Filtros',         'Filtros de aceite, aire y combustible'),
('Carrocería',      'Carenados, espejos, maniguetas');

-- Productos (repuestos)
INSERT INTO productos (codigo, nombre, descripcion, marca, precio_compra, precio_venta, stock, stock_minimo, categoria_id, proveedor_id) VALUES
('MTO-001', 'Filtro de aceite universal',       'Filtro compatible con motores 150-250cc',   'Bajaj',    3.50,   6.00,   45, 10, 6, 1),
('MTO-002', 'Kit de arrastre 428H',             'Cadena + piñón + corona',                   'DID',     18.00,  32.00,   20,  5, 3, 2),
('MTO-003', 'Pastillas de freno delanteras',    'Semi-metálicas, alto rendimiento',          'EBC',      5.00,   9.50,   60, 15, 2, 2),
('MTO-004', 'Bujía NGK CR7HSA',                 'Bujía estándar para motos 4T',              'NGK',      2.00,   4.50,  100, 20, 4, 1),
('MTO-005', 'Amortiguador trasero 330mm',       'Gas, regulable en 5 posiciones',            'YSS',     25.00,  45.00,   12,  3, 5, 3),
('MTO-006', 'Espejo retrovisor cromado (par)',  'Universal, rosca M10',                      'Genérico', 4.00,   8.00,   35, 10, 7, 1),
('MTO-007', 'Regulador de voltaje 12V',         'Compatible Honda/Yamaha 125-150cc',         'Genérico', 7.50,  14.00,   18,  5, 4, 3),
('MTO-008', 'Filtro de aire cónico',            'Alto flujo, 42mm',                          'K&N',      8.00,  15.00,   25,  5, 6, 2),
('MTO-009', 'Pistón completo 150cc STD',        'Con anillos y pasador',                     'Bajaj',   12.00,  22.00,   15,  5, 1, 1),
('MTO-010', 'Líquido de frenos DOT4 500ml',     'Punto de ebullición 260°C',                 'Motul',    6.00,  11.00,   40, 10, 2, 2);

-- Clientes de ejemplo
INSERT INTO clientes (nombre, cedula, telefono, email, direccion) VALUES
('Carlos Méndez',       'V-25123456',   '0414-6001234', 'carlos.mendez@gmail.com',  'Barrio La Victoria, Maracaibo'),
('Luis Ferrer',         'V-26789012',   '0424-6005678', 'luis.ferrer@hotmail.com',   'Urb. La Lago, Maracaibo'),
('Rosa Hernández',      'V-24567890',   '0412-6009012', 'rosa.hdez@gmail.com',      'Av. Bella Vista, Maracaibo'),
('Miguel Ángel Parra',  'V-27345678',   '0416-6003456', 'maparra@gmail.com',        'Sector Santa Lucía, Maracaibo'),
('Daniela Rincón',      'V-28901234',   '0426-6007890', 'dani.rincon@gmail.com',    'San Francisco, Zulia');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║      PARTE V  –  TRANSACCIONES ACID DE EJEMPLO                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Demostración de una transacción multi-tabla que:
--   1. Registra una venta (encabezado)
--   2. Registra las líneas de detalle
--   3. Descuenta el stock de cada producto vendido
--   4. Asienta el registro en auditoria_logs
-- Si cualquier paso falla, se ejecuta ROLLBACK y nada se persiste.

-- ────────────────────────────────────────────────
-- TRANSACCIÓN 1: Venta exitosa (COMMIT)
-- ────────────────────────────────────────────────
-- Escenario: María (usuario_id=2, Vendedora) le vende a Carlos Méndez:
--   • 2 × Filtro de aceite universal   (MTO-001, $6.00 c/u)
--   • 1 × Kit de arrastre 428H         (MTO-002, $32.00 c/u)
--   Subtotal = $44.00 | IVA 16% = $7.04 | Total = $51.04

DELIMITER $$

-- Procedimiento reutilizable para registrar ventas de forma transaccional
CREATE PROCEDURE sp_registrar_venta (
    IN  p_numero_factura    VARCHAR(30),
    IN  p_cliente_id        INT,
    IN  p_usuario_id        INT,
    IN  p_observaciones     VARCHAR(255)
)
BEGIN
    DECLARE v_venta_id      INT;
    DECLARE v_subtotal      DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_impuesto      DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_total         DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_error         BOOLEAN DEFAULT FALSE;

    -- Handler: ante cualquier excepción SQL, marca error para ROLLBACK
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;

    START TRANSACTION;

        -- Paso 1: Insertar encabezado de la venta (totales se actualizan después)
        INSERT INTO ventas (numero_factura, cliente_id, usuario_id, observaciones)
        VALUES (p_numero_factura, p_cliente_id, p_usuario_id, p_observaciones);

        SET v_venta_id = LAST_INSERT_ID();

        -- Paso 2: Insertar líneas de detalle y descontar stock
        -- Línea 1: 2 × Filtro de aceite (producto_id=1)
        INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (v_venta_id, 1, 2, 6.00, 12.00);

        UPDATE productos SET stock = stock - 2 WHERE id = 1 AND stock >= 2;
        IF ROW_COUNT() = 0 THEN SET v_error = TRUE; END IF;

        -- Línea 2: 1 × Kit de arrastre (producto_id=2)
        INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (v_venta_id, 2, 1, 32.00, 32.00);

        UPDATE productos SET stock = stock - 1 WHERE id = 2 AND stock >= 1;
        IF ROW_COUNT() = 0 THEN SET v_error = TRUE; END IF;

        -- Paso 3: Calcular totales
        SELECT SUM(subtotal) INTO v_subtotal FROM detalle_venta WHERE venta_id = v_venta_id;
        SET v_impuesto = ROUND(v_subtotal * 0.16, 2);
        SET v_total    = v_subtotal + v_impuesto;

        UPDATE ventas
           SET subtotal  = v_subtotal,
               impuesto  = v_impuesto,
               total     = v_total
         WHERE id = v_venta_id;

        -- Paso 4: Registrar en auditoría
        INSERT INTO auditoria_logs (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos)
        VALUES (
            p_usuario_id,
            'INSERT - Venta registrada',
            'ventas',
            v_venta_id,
            JSON_OBJECT(
                'factura',      p_numero_factura,
                'cliente_id',   p_cliente_id,
                'subtotal',     v_subtotal,
                'impuesto',     v_impuesto,
                'total',        v_total
            )
        );

    -- Decisión: confirmar o revertir
    IF v_error THEN
        ROLLBACK;
        -- Registrar el intento fallido en auditoría (fuera de la transacción revertida)
        INSERT INTO auditoria_logs (usuario_id, accion, tabla_afectada, registro_id)
        VALUES (p_usuario_id, 'ROLLBACK - Venta fallida (stock insuficiente)', 'ventas', NULL);

        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Error: stock insuficiente. La transacción fue revertida (ROLLBACK).';
    ELSE
        COMMIT;
    END IF;

END$$

DELIMITER ;

-- Ejecutar la transacción de ejemplo
CALL sp_registrar_venta('FAC-2026-0001', 1, 2, 'Primera venta de prueba del sistema');


-- ────────────────────────────────────────────────
-- TRANSACCIÓN 2: Venta directa con BEGIN/COMMIT (sin procedimiento)
-- ────────────────────────────────────────────────
-- Escenario: Pedro (Admin, usuario_id=1) vende a Daniela Rincón:
--   • 3 × Bujía NGK CR7HSA              (MTO-004, $4.50 c/u)
--   • 1 × Espejo retrovisor cromado      (MTO-006, $8.00 c/u)
--   Subtotal = $21.50 | IVA 16% = $3.44 | Total = $24.94

START TRANSACTION;

    -- Encabezado de venta
    INSERT INTO ventas (numero_factura, cliente_id, usuario_id, subtotal, impuesto, total, observaciones)
    VALUES ('FAC-2026-0002', 5, 1, 21.50, 3.44, 24.94, 'Venta directa de ejemplo');

    SET @venta2_id = LAST_INSERT_ID();

    -- Detalle línea 1: 3 × Bujía
    INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    VALUES (@venta2_id, 4, 3, 4.50, 13.50);

    UPDATE productos SET stock = stock - 3 WHERE id = 4;

    -- Detalle línea 2: 1 × Espejo
    INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    VALUES (@venta2_id, 6, 1, 8.00, 8.00);

    UPDATE productos SET stock = stock - 1 WHERE id = 6;

    -- Auditoría
    INSERT INTO auditoria_logs (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos)
    VALUES (1, 'INSERT - Venta registrada', 'ventas', @venta2_id,
        JSON_OBJECT('factura','FAC-2026-0002','total',24.94));

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║      PARTE VI  –  VISTAS ÚTILES DE CONSULTA                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ────────────────────────────────────────────────
-- Vista: Permisos efectivos de cada usuario
-- ────────────────────────────────────────────────
-- Muestra la ruta COMPLETA: usuario → rol → módulo → vista → permiso
CREATE OR REPLACE VIEW v_permisos_efectivos AS
SELECT
    u.id            AS usuario_id,
    u.nombre        AS usuario_nombre,
    u.email         AS usuario_email,
    r.nombre_rol,
    m.nombre_modulo,
    v.nombre_vista,
    v.ruta_acceso,
    p.nombre_permiso,
    vp.permitido
FROM usuario u
INNER JOIN r_usuario_rol    ur  ON ur.usuario_id      = u.id
INNER JOIN rol              r   ON r.id               = ur.rol_id
INNER JOIN r_modulo_rol     mr  ON mr.rol_id          = r.id
INNER JOIN modulo           m   ON m.id               = mr.modulo_id
INNER JOIN vistas_permiso   vp  ON vp.r_modulo_rol_id = mr.id
INNER JOIN vistas           v   ON v.id               = vp.vista_id
INNER JOIN permisos         p   ON p.id               = vp.permiso_id
WHERE u.activo = TRUE
  AND mr.habilitado = TRUE
  AND vp.permitido  = TRUE;

-- ────────────────────────────────────────────────
-- Vista: Resumen de ventas con datos del cliente y vendedor
-- ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_resumen_ventas AS
SELECT
    v.id            AS venta_id,
    v.numero_factura,
    v.fecha_venta,
    c.nombre        AS cliente,
    c.cedula        AS cedula_cliente,
    u.nombre        AS vendedor,
    v.subtotal,
    v.impuesto,
    v.total,
    v.estado
FROM ventas v
LEFT JOIN clientes c ON c.id = v.cliente_id
LEFT JOIN usuario  u ON u.id = v.usuario_id;

-- ────────────────────────────────────────────────
-- Vista: Productos con stock bajo el mínimo
-- ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_stock_bajo AS
SELECT
    p.id,
    p.codigo,
    p.nombre,
    p.marca,
    p.stock,
    p.stock_minimo,
    (p.stock_minimo - p.stock) AS unidades_faltantes,
    cat.nombre AS categoria,
    prov.nombre AS proveedor
FROM productos p
LEFT JOIN categorias  cat  ON cat.id  = p.categoria_id
LEFT JOIN proveedores prov ON prov.id = p.proveedor_id
WHERE p.stock < p.stock_minimo
  AND p.activo = TRUE;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║      FIN DEL SCRIPT                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Para ejecutar en phpMyAdmin:
--   1. Abrir phpMyAdmin → pestaña "SQL"
--   2. Pegar todo este script
--   3. Clic en "Ejecutar" / "Go"
--
-- Verificación rápida después de ejecutar:
--   SELECT * FROM v_permisos_efectivos WHERE usuario_nombre = 'María González';
--   SELECT * FROM v_resumen_ventas;
--   SELECT * FROM v_stock_bajo;
--   SELECT * FROM auditoria_logs ORDER BY fecha_hora DESC;
-- ============================================================================
