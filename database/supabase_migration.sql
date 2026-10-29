-- ============================================================================
-- MOTO REPUESTOS PAPI BETO — Migración para Supabase (PostgreSQL)
-- ============================================================================
-- Instrucciones:
--   1. Abrir el SQL Editor de tu proyecto en Supabase (https://supabase.com/dashboard)
--   2. Pegar TODO este script
--   3. Clic en "Run" / "Ejecutar"
--   4. Verificar que no haya errores
-- ============================================================================
-- IMPORTANTE: Este script NO elimina bases de datos ni tablas existentes.
--             Usa CREATE TABLE IF NOT EXISTS para ser seguro.
-- ============================================================================


-- ────────────────────────────────────────────────
-- 1. TABLA: roles
-- ────────────────────────────────────────────────
-- Catálogo de roles del sistema.
CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL          PRIMARY KEY,
    nombre      VARCHAR(60)     NOT NULL UNIQUE,
    descripcion VARCHAR(255),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Datos semilla: roles fundamentales
INSERT INTO roles (nombre, descripcion) VALUES
    ('administrador', 'Acceso total al sistema, gestión de usuarios y configuración'),
    ('almacenista',   'Gestión de inventario, entradas y salidas de mercancía'),
    ('vendedor',      'Consulta de inventario, registro de salidas por venta')
ON CONFLICT (nombre) DO NOTHING;


-- ────────────────────────────────────────────────
-- 2. TABLA: profiles
-- ────────────────────────────────────────────────
-- Extiende auth.users de Supabase con datos de negocio.
-- user_id referencia el UUID que Supabase Auth crea al registrar un usuario.
CREATE TABLE IF NOT EXISTS profiles (
    id          SERIAL          PRIMARY KEY,
    user_id     UUID            NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre      VARCHAR(150)    NOT NULL,
    email       VARCHAR(180)    NOT NULL,
    rol_id      INT             NOT NULL DEFAULT 3 REFERENCES roles(id),
    activo      BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Índice para búsquedas por rol
CREATE INDEX IF NOT EXISTS idx_profiles_rol ON profiles(rol_id);


-- ────────────────────────────────────────────────
-- 3. TABLA: categorias
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
    id          SERIAL          PRIMARY KEY,
    nombre      VARCHAR(80)     NOT NULL UNIQUE,
    descripcion VARCHAR(255),
    activo      BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Categorías semilla
INSERT INTO categorias (nombre, descripcion) VALUES
    ('Motor',       'Piezas internas y externas del motor'),
    ('Frenos',      'Pastillas, discos, líquido de frenos'),
    ('Transmisión', 'Cadenas, piñones, kit de arrastre'),
    ('Electricidad', 'Bujías, reguladores, luces LED'),
    ('Suspensión',  'Amortiguadores, resortes, bujes'),
    ('Filtros',     'Filtros de aceite, aire y combustible'),
    ('Carrocería',  'Carenados, espejos, maniguetas')
ON CONFLICT (nombre) DO NOTHING;


-- ────────────────────────────────────────────────
-- 4. TABLA: marcas
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marcas (
    id          SERIAL          PRIMARY KEY,
    nombre      VARCHAR(80)     NOT NULL UNIQUE,
    activo      BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Marcas semilla
INSERT INTO marcas (nombre) VALUES
    ('Bajaj'), ('Honda'), ('Yamaha'), ('Suzuki'),
    ('DID'), ('EBC'), ('NGK'), ('YSS'),
    ('K&N'), ('Motul'), ('Genérico')
ON CONFLICT (nombre) DO NOTHING;


-- ────────────────────────────────────────────────
-- 5. TABLA: productos (repuestos)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
    id              SERIAL          PRIMARY KEY,
    codigo          VARCHAR(30)     NOT NULL UNIQUE,
    nombre          VARCHAR(150)    NOT NULL,
    descripcion     VARCHAR(255),
    categoria_id    INT             REFERENCES categorias(id) ON DELETE SET NULL,
    marca_id        INT             REFERENCES marcas(id) ON DELETE SET NULL,
    precio_compra   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    precio_venta    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    stock           INT             NOT NULL DEFAULT 0,
    stock_minimo    INT             NOT NULL DEFAULT 5,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_marca ON productos(marca_id);
CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo);


-- ────────────────────────────────────────────────
-- 6. TABLA: movimientos_inventario
-- ────────────────────────────────────────────────
-- Registra cada entrada o salida de stock con trazabilidad completa.
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id              SERIAL          PRIMARY KEY,
    producto_id     INT             NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    user_id         UUID            NOT NULL REFERENCES auth.users(id),
    tipo            VARCHAR(20)     NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
    cantidad        INT             NOT NULL CHECK (cantidad > 0),
    stock_anterior  INT             NOT NULL,
    stock_nuevo     INT             NOT NULL,
    motivo          VARCHAR(255),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_inventario(created_at);
CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON movimientos_inventario(user_id);


-- ────────────────────────────────────────────────
-- 7. TABLA: auditoria_logs
-- ────────────────────────────────────────────────
-- Registro inmutable de todas las acciones del sistema.
CREATE TABLE IF NOT EXISTS auditoria_logs (
    id              SERIAL          PRIMARY KEY,
    user_id         UUID            REFERENCES auth.users(id) ON DELETE SET NULL,
    accion          VARCHAR(100)    NOT NULL,
    tabla_afectada  VARCHAR(80)     NOT NULL,
    registro_id     INT,
    datos_anteriores JSONB,
    datos_nuevos    JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria_logs(tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria_logs(user_id);


-- ────────────────────────────────────────────────
-- 8. PRODUCTOS SEMILLA
-- ────────────────────────────────────────────────
INSERT INTO productos (codigo, nombre, descripcion, categoria_id, marca_id, precio_compra, precio_venta, stock, stock_minimo) VALUES
    ('MTO-001', 'Filtro de aceite universal',     'Filtro compatible con motores 150-250cc', 6, 1,  3.50,  6.00, 45, 10),
    ('MTO-002', 'Kit de arrastre 428H',           'Cadena + piñón + corona',                 3, 5, 18.00, 32.00, 20,  5),
    ('MTO-003', 'Pastillas de freno delanteras',   'Semi-metálicas, alto rendimiento',        2, 6,  5.00,  9.50, 60, 15),
    ('MTO-004', 'Bujía NGK CR7HSA',               'Bujía estándar para motos 4T',            4, 7,  2.00,  4.50, 100, 20),
    ('MTO-005', 'Amortiguador trasero 330mm',      'Gas, regulable en 5 posiciones',          5, 8, 25.00, 45.00, 12,  3),
    ('MTO-006', 'Espejo retrovisor cromado (par)', 'Universal, rosca M10',                    7, 11, 4.00,  8.00, 35, 10),
    ('MTO-007', 'Regulador de voltaje 12V',        'Compatible Honda/Yamaha 125-150cc',       4, 11, 7.50, 14.00, 18,  5),
    ('MTO-008', 'Filtro de aire cónico',           'Alto flujo, 42mm',                        6, 9,  8.00, 15.00, 25,  5),
    ('MTO-009', 'Pistón completo 150cc STD',       'Con anillos y pasador',                   1, 1, 12.00, 22.00, 15,  5),
    ('MTO-010', 'Líquido de frenos DOT4 500ml',    'Punto de ebullición 260°C',               2, 10, 6.00, 11.00, 40, 10)
ON CONFLICT (codigo) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║          SEGURIDAD: ROW LEVEL SECURITY (RLS)                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Habilitamos RLS en todas las tablas para que Supabase controle acceso.
-- Las políticas verifican el rol del usuario autenticado consultando profiles.

ALTER TABLE roles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias              ENABLE ROW LEVEL SECURITY;
ALTER TABLE marcas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario  ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_logs          ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────
-- Función auxiliar: obtener el rol del usuario autenticado
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT r.nombre
    FROM profiles p
    INNER JOIN roles r ON r.id = p.rol_id
    WHERE p.user_id = auth.uid()
    LIMIT 1;
$$;


-- ────────────────────────────────────────────────
-- Función auxiliar: verificar si el usuario está activo
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_user_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (SELECT activo FROM profiles WHERE user_id = auth.uid()),
        FALSE
    );
$$;


-- ────────────────────────────────────────────────
-- POLÍTICAS RLS: roles (solo lectura para todos los autenticados)
-- ────────────────────────────────────────────────
CREATE POLICY "roles_select_authenticated"
    ON roles FOR SELECT
    TO authenticated
    USING (TRUE);


-- ────────────────────────────────────────────────
-- POLÍTICAS RLS: profiles
-- ────────────────────────────────────────────────
-- Cada usuario puede ver su propio perfil
CREATE POLICY "profiles_select_own"
    ON profiles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Los administradores pueden ver todos los perfiles
CREATE POLICY "profiles_select_admin"
    ON profiles FOR SELECT
    TO authenticated
    USING (get_user_role() = 'administrador');

-- Solo los administradores pueden modificar perfiles
CREATE POLICY "profiles_update_admin"
    ON profiles FOR UPDATE
    TO authenticated
    USING (get_user_role() = 'administrador');

-- Permitir inserción durante el registro (el trigger lo maneja)
CREATE POLICY "profiles_insert_service"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());


-- ────────────────────────────────────────────────
-- POLÍTICAS RLS: categorias
-- ────────────────────────────────────────────────
-- Todos los autenticados activos pueden leer
CREATE POLICY "categorias_select"
    ON categorias FOR SELECT
    TO authenticated
    USING (is_user_active());

-- Solo admin y almacenista pueden crear/modificar
CREATE POLICY "categorias_insert"
    ON categorias FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() IN ('administrador', 'almacenista'));

CREATE POLICY "categorias_update"
    ON categorias FOR UPDATE
    TO authenticated
    USING (get_user_role() IN ('administrador', 'almacenista'));


-- ────────────────────────────────────────────────
-- POLÍTICAS RLS: marcas
-- ────────────────────────────────────────────────
CREATE POLICY "marcas_select"
    ON marcas FOR SELECT
    TO authenticated
    USING (is_user_active());

CREATE POLICY "marcas_insert"
    ON marcas FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() IN ('administrador', 'almacenista'));

CREATE POLICY "marcas_update"
    ON marcas FOR UPDATE
    TO authenticated
    USING (get_user_role() IN ('administrador', 'almacenista'));


-- ────────────────────────────────────────────────
-- POLÍTICAS RLS: productos
-- ────────────────────────────────────────────────
-- Todos los autenticados activos pueden leer productos
CREATE POLICY "productos_select"
    ON productos FOR SELECT
    TO authenticated
    USING (is_user_active());

-- Admin y almacenista pueden crear productos
CREATE POLICY "productos_insert"
    ON productos FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() IN ('administrador', 'almacenista'));

-- Admin y almacenista pueden modificar productos
CREATE POLICY "productos_update"
    ON productos FOR UPDATE
    TO authenticated
    USING (get_user_role() IN ('administrador', 'almacenista'));

-- Solo admin puede eliminar productos (soft delete preferido)
CREATE POLICY "productos_delete"
    ON productos FOR DELETE
    TO authenticated
    USING (get_user_role() = 'administrador');


-- ────────────────────────────────────────────────
-- POLÍTICAS RLS: movimientos_inventario
-- ────────────────────────────────────────────────
-- Todos los autenticados activos pueden ver movimientos
CREATE POLICY "movimientos_select"
    ON movimientos_inventario FOR SELECT
    TO authenticated
    USING (is_user_active());

-- Admin, almacenista y vendedor pueden registrar movimientos
-- (vendedor solo salidas — eso se valida en la app y en la función RPC)
CREATE POLICY "movimientos_insert"
    ON movimientos_inventario FOR INSERT
    TO authenticated
    WITH CHECK (is_user_active());


-- ────────────────────────────────────────────────
-- POLÍTICAS RLS: auditoria_logs
-- ────────────────────────────────────────────────
-- Solo admin puede ver los logs de auditoría
CREATE POLICY "auditoria_select_admin"
    ON auditoria_logs FOR SELECT
    TO authenticated
    USING (get_user_role() = 'administrador');

-- Todos los autenticados pueden insertar (el sistema escribe logs)
CREATE POLICY "auditoria_insert"
    ON auditoria_logs FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║          FUNCIONES RPC (Operaciones seguras del lado del servidor)     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ────────────────────────────────────────────────
-- RPC: Registrar movimiento de inventario de forma atómica
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registrar_movimiento(
    p_producto_id   INT,
    p_tipo          VARCHAR(20),
    p_cantidad      INT,
    p_motivo        VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock_actual  INT;
    v_stock_nuevo   INT;
    v_user_role     TEXT;
    v_mov_id        INT;
BEGIN
    -- Verificar que el usuario está activo
    IF NOT is_user_active() THEN
        RAISE EXCEPTION 'Usuario inactivo o no autorizado';
    END IF;

    -- Obtener rol
    v_user_role := get_user_role();

    -- Validar permisos: vendedor solo puede hacer salidas
    IF v_user_role = 'vendedor' AND p_tipo != 'salida' THEN
        RAISE EXCEPTION 'El vendedor solo puede registrar salidas';
    END IF;

    -- Validar que el producto existe y obtener stock actual CON BLOQUEO
    SELECT stock INTO v_stock_actual
    FROM productos
    WHERE id = p_producto_id AND activo = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado o inactivo';
    END IF;

    -- Calcular nuevo stock
    IF p_tipo = 'entrada' THEN
        v_stock_nuevo := v_stock_actual + p_cantidad;
    ELSIF p_tipo = 'salida' THEN
        v_stock_nuevo := v_stock_actual - p_cantidad;
        IF v_stock_nuevo < 0 THEN
            RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', v_stock_actual, p_cantidad;
        END IF;
    ELSIF p_tipo = 'ajuste' THEN
        v_stock_nuevo := p_cantidad; -- En ajuste, la cantidad ES el nuevo stock
    ELSE
        RAISE EXCEPTION 'Tipo de movimiento no válido: %', p_tipo;
    END IF;

    -- Actualizar stock del producto
    UPDATE productos
    SET stock = v_stock_nuevo, updated_at = now()
    WHERE id = p_producto_id;

    -- Registrar movimiento
    INSERT INTO movimientos_inventario (producto_id, user_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
    VALUES (p_producto_id, auth.uid(), p_tipo, p_cantidad, v_stock_actual, v_stock_nuevo, p_motivo)
    RETURNING id INTO v_mov_id;

    -- Registrar en auditoría
    INSERT INTO auditoria_logs (user_id, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos)
    VALUES (
        auth.uid(),
        'MOVIMIENTO_INVENTARIO',
        'productos',
        p_producto_id,
        jsonb_build_object('stock', v_stock_actual),
        jsonb_build_object('stock', v_stock_nuevo, 'tipo', p_tipo, 'cantidad', p_cantidad, 'motivo', p_motivo)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'movimiento_id', v_mov_id,
        'stock_anterior', v_stock_actual,
        'stock_nuevo', v_stock_nuevo
    );
END;
$$;


-- ────────────────────────────────────────────────
-- TRIGGER: Crear perfil automáticamente al registrar usuario
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO profiles (user_id, nombre, email, rol_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'nombre', NEW.email),
        NEW.email,
        COALESCE(
            (SELECT id FROM roles WHERE nombre = COALESCE(NEW.raw_user_meta_data ->> 'rol', 'vendedor')),
            3
        )
    );
    RETURN NEW;
END;
$$;

-- Crear el trigger en auth.users (solo si no existe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║          VISTAS ÚTILES DE CONSULTA                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Vista: Productos con datos de categoría y marca
CREATE OR REPLACE VIEW v_productos_completos AS
SELECT
    p.id,
    p.codigo,
    p.nombre,
    p.descripcion,
    c.nombre    AS categoria,
    m.nombre    AS marca,
    p.precio_compra,
    p.precio_venta,
    p.stock,
    p.stock_minimo,
    p.activo,
    p.created_at,
    p.updated_at,
    (p.stock < p.stock_minimo) AS stock_bajo
FROM productos p
LEFT JOIN categorias c ON c.id = p.categoria_id
LEFT JOIN marcas m ON m.id = p.marca_id;


-- Vista: Productos con stock bajo
CREATE OR REPLACE VIEW v_stock_bajo AS
SELECT *
FROM v_productos_completos
WHERE stock < stock_minimo AND activo = TRUE;


-- Vista: Últimos movimientos con datos del producto y usuario
CREATE OR REPLACE VIEW v_movimientos_recientes AS
SELECT
    mi.id,
    mi.tipo,
    mi.cantidad,
    mi.stock_anterior,
    mi.stock_nuevo,
    mi.motivo,
    mi.created_at,
    p.codigo    AS producto_codigo,
    p.nombre    AS producto_nombre,
    pr.nombre   AS usuario_nombre
FROM movimientos_inventario mi
INNER JOIN productos p ON p.id = mi.producto_id
LEFT JOIN profiles pr ON pr.user_id = mi.user_id
ORDER BY mi.created_at DESC;


-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================
-- Después de ejecutar este script, crea el primer administrador con:
--   Ver archivo SETUP.md para instrucciones detalladas.
-- ============================================================================
