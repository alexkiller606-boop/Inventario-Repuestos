/* ============================================
   CAPA DE DATOS — INVENTARIO
   ============================================
   Conecta con las tablas reales de Supabase:
   - productos (con marca en texto, categoria_id, proveedor_id)
   - categorias
   - proveedores
   - auditoria_logs (con usuario_id entero)
   ============================================ */

import { supabase } from './supabaseClient.js';

/* ──────────────────────────────────────────────
   PRODUCTOS (REPUESTOS)
   ────────────────────────────────────────────── */

/**
 * Obtiene todos los productos activos con categoría, proveedor y marca.
 * @param {string} [busqueda] - Término opcional de búsqueda
 * @returns {Promise<{data: Array, error: string|null}>}
 */
export async function obtenerProductos(busqueda = '') {
  if (!supabase) return { data: [], error: 'Supabase no está configurado' };

  let query = supabase
    .from('productos')
    .select(`
      id, codigo, nombre, descripcion, marca,
      precio_compra, precio_venta, stock, stock_minimo,
      categoria_id, proveedor_id,
      activo, fecha_creacion,
      categorias ( id, nombre ),
      proveedores ( id, nombre )
    `)
    .eq('activo', true)
    .order('nombre', { ascending: true });

  const filtro = busqueda.trim();
  if (filtro) {
    query = query.or(`codigo.ilike.%${filtro}%,nombre.ilike.%${filtro}%,marca.ilike.%${filtro}%`);
  }

  const { data, error } = await query;

  if (error) {
    // Si la consulta anidada falla por relaciones en schema cache, reintentar directo a productos
    console.warn('Consulta anidada de productos falló, intentando consulta directa:', error.message);
    let fallbackQuery = supabase
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (filtro) {
      fallbackQuery = fallbackQuery.or(`codigo.ilike.%${filtro}%,nombre.ilike.%${filtro}%,marca.ilike.%${filtro}%`);
    }

    const fallbackRes = await fallbackQuery;
    if (fallbackRes.error) return { data: [], error: fallbackRes.error.message };

    const productosFallback = (fallbackRes.data || []).map(p => ({
      ...p,
      categoria: '—',
      proveedor: '—',
      marca: p.marca || '—',
    }));
    return { data: productosFallback, error: null };
  }

  // Aplanar la respuesta para la interfaz
  const productos = (data || []).map(p => ({
    ...p,
    categoria: p.categorias?.nombre || '—',
    categoria_id: p.categoria_id || p.categorias?.id || null,
    proveedor: p.proveedores?.nombre || '—',
    proveedor_id: p.proveedor_id || p.proveedores?.id || null,
    marca: p.marca || '—',
  }));

  return { data: productos, error: null };
}

/**
 * Obtiene un producto por su ID.
 * @param {number} id
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function obtenerProductoPorId(id) {
  if (!supabase) return { data: null, error: 'Supabase no está configurado' };

  const { data, error } = await supabase
    .from('productos')
    .select(`
      *, 
      categorias ( id, nombre ),
      proveedores ( id, nombre )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    const fallback = await supabase.from('productos').select('*').eq('id', id).maybeSingle();
    if (fallback.error) return { data: null, error: fallback.error.message };
    if (!fallback.data) return { data: null, error: 'Producto no encontrado' };
    return {
      data: {
        ...fallback.data,
        categoria: '—',
        proveedor: '—',
        marca: fallback.data.marca || '—',
      },
      error: null,
    };
  }

  if (!data) return { data: null, error: 'Producto no encontrado' };

  return {
    data: {
      ...data,
      categoria: data.categorias?.nombre || '—',
      categoria_id: data.categoria_id || data.categorias?.id || null,
      proveedor: data.proveedores?.nombre || '—',
      proveedor_id: data.proveedor_id || data.proveedores?.id || null,
      marca: data.marca || '—',
    },
    error: null,
  };
}

/**
 * Crea un nuevo producto respetando los campos reales de la tabla 'productos'.
 * @param {object} producto
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function crearProducto(producto) {
  if (!supabase) return { data: null, error: 'Supabase no está configurado' };

  const nuevo = {
    codigo: producto.codigo.trim(),
    nombre: producto.nombre.trim(),
    descripcion: producto.descripcion?.trim() || null,
    marca: producto.marca?.trim() || null,
    categoria_id: producto.categoria_id ? parseInt(producto.categoria_id) : null,
    proveedor_id: producto.proveedor_id ? parseInt(producto.proveedor_id) : null,
    precio_compra: parseFloat(producto.precio_compra) || 0,
    precio_venta: parseFloat(producto.precio_venta) || 0,
    stock: parseInt(producto.stock) || 0,
    stock_minimo: parseInt(producto.stock_minimo) || 5,
  };

  const { data, error } = await supabase
    .from('productos')
    .insert(nuevo)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: 'Ya existe un producto con ese código' };
    }
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * Actualiza un producto existente sin referencias a columnas inexistentes como updated_at.
 * @param {number} id
 * @param {object} cambios
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function actualizarProducto(id, cambios) {
  if (!supabase) return { data: null, error: 'Supabase no está configurado' };

  const updateData = {};

  if (cambios.codigo !== undefined) updateData.codigo = cambios.codigo.trim();
  if (cambios.nombre !== undefined) updateData.nombre = cambios.nombre.trim();
  if (cambios.descripcion !== undefined) updateData.descripcion = cambios.descripcion?.trim() || null;
  if (cambios.marca !== undefined) updateData.marca = cambios.marca?.trim() || null;
  if (cambios.categoria_id !== undefined) {
    updateData.categoria_id = cambios.categoria_id ? parseInt(cambios.categoria_id) : null;
  }
  if (cambios.proveedor_id !== undefined) {
    updateData.proveedor_id = cambios.proveedor_id ? parseInt(cambios.proveedor_id) : null;
  }
  if (cambios.precio_compra !== undefined) updateData.precio_compra = parseFloat(cambios.precio_compra) || 0;
  if (cambios.precio_venta !== undefined) updateData.precio_venta = parseFloat(cambios.precio_venta) || 0;
  if (cambios.stock !== undefined) updateData.stock = parseInt(cambios.stock) || 0;
  if (cambios.stock_minimo !== undefined) updateData.stock_minimo = parseInt(cambios.stock_minimo) || 5;

  const { data, error } = await supabase
    .from('productos')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: 'Ya existe un producto con ese código' };
    }
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * Elimina un producto (soft delete: marca activo = false).
 * @param {number} id
 * @returns {Promise<{error: string|null}>}
 */
export async function eliminarProducto(id) {
  if (!supabase) return { error: 'Supabase no está configurado' };

  const { error } = await supabase
    .from('productos')
    .update({ activo: false })
    .eq('id', id);

  if (error) return { error: error.message };
  return { error: null };
}

/* ──────────────────────────────────────────────
   CATEGORÍAS
   ────────────────────────────────────────────── */

/**
 * Obtiene todas las categorías activas.
 * @returns {Promise<{data: Array, error: string|null}>}
 */
export async function obtenerCategorias() {
  if (!supabase) return { data: [], error: 'Supabase no está configurado' };

  const { data, error } = await supabase
    .from('categorias')
    .select('id, nombre, descripcion')
    .eq('activo', true)
    .order('nombre');

  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

/* ──────────────────────────────────────────────
   PROVEEDORES
   ────────────────────────────────────────────── */

/**
 * Obtiene todos los proveedores activos de la base de datos real.
 * @returns {Promise<{data: Array, error: string|null}>}
 */
export async function obtenerProveedores() {
  if (!supabase) return { data: [], error: 'Supabase no está configurado' };

  const { data, error } = await supabase
    .from('proveedores')
    .select('id, nombre, rif, telefono, email, activo')
    .eq('activo', true)
    .order('nombre');

  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

/* ──────────────────────────────────────────────
   MARCAS
   ────────────────────────────────────────────── */

/**
 * Obtiene las marcas únicas almacenadas directamente en la tabla productos.
 * En la base de datos actual no existe una tabla independiente 'marcas'.
 * @returns {Promise<{data: Array, error: string|null}>}
 */
export async function obtenerMarcas() {
  if (!supabase) return { data: [], error: 'Supabase no está configurado' };

  const { data, error } = await supabase
    .from('productos')
    .select('marca')
    .not('marca', 'is', null)
    .eq('activo', true);

  if (error) {
    return { data: [], error: null };
  }

  const unicas = [...new Set((data || []).map(p => p.marca?.trim()).filter(Boolean))].sort();
  return { data: unicas.map(m => ({ id: m, nombre: m })), error: null };
}

/* ──────────────────────────────────────────────
   MOVIMIENTOS DE INVENTARIO
   ────────────────────────────────────────────── */

/**
 * Informa el estado de movimientos de inventario.
 * La tabla 'movimientos_inventario' y la función RPC 'registrar_movimiento' no existen en la base de datos actual.
 * @param {number} productoId
 * @param {string} tipo
 * @param {number} cantidad
 * @param {string} [motivo]
 * @returns {Promise<{data: null, error: string}>}
 */
export async function registrarMovimiento(productoId, tipo, cantidad, motivo = '') {
  return {
    data: null,
    error: 'La funcionalidad de movimientos de inventario no está disponible en la base de datos actual (no existe la tabla movimientos_inventario ni la función RPC registrar_movimiento).',
  };
}

/**
 * Informa el estado del historial de movimientos.
 * La vista 'v_movimientos_recientes' no existe en la base de datos actual.
 * @param {number} [limite=50]
 * @returns {Promise<{data: Array, error: string}>}
 */
export async function obtenerMovimientos(limite = 50) {
  return {
    data: [],
    error: 'El módulo de movimientos de inventario (v_movimientos_recientes) no existe en el esquema activo de la base de datos.',
  };
}

/* ──────────────────────────────────────────────
   ESTADÍSTICAS DEL DASHBOARD
   ────────────────────────────────────────────── */

/**
 * Calcula estadísticas del inventario desde la tabla productos.
 * @returns {Promise<{stats: object, error: string|null}>}
 */
export async function obtenerEstadisticas() {
  if (!supabase) {
    return {
      stats: { total: 0, valor: 0, stockBajo: 0, marcas: 0 },
      error: 'Supabase no está configurado',
    };
  }

  const { data: productos, error } = await supabase
    .from('productos')
    .select('stock, stock_minimo, precio_venta, marca')
    .eq('activo', true);

  if (error) {
    return {
      stats: { total: 0, valor: 0, stockBajo: 0, marcas: 0 },
      error: error.message,
    };
  }

  const lista = productos || [];
  const total = lista.length;
  const valor = lista.reduce((sum, p) => sum + ((parseFloat(p.stock) || 0) * (parseFloat(p.precio_venta) || 0)), 0);
  const stockBajo = lista.filter(p => (parseInt(p.stock) || 0) < (parseInt(p.stock_minimo) || 0)).length;
  const marcas = new Set(lista.map(p => p.marca?.trim()).filter(Boolean)).size;

  return {
    stats: { total, valor, stockBajo, marcas },
    error: null,
  };
}

/* ──────────────────────────────────────────────
   AUDITORÍA
   ────────────────────────────────────────────── */

/**
 * Registra una acción en la tabla de auditoría auditoria_logs.
 * usuario_id es entero referenciando usuario.id (no UUID).
 * @param {string} accion
 * @param {string} tabla
 * @param {number|null} registroId
 * @param {object|null} datosAnteriores
 * @param {object|null} datosNuevos
 * @param {number|null} [usuarioId]
 * @returns {Promise<void>}
 */
export async function registrarAuditoria(accion, tabla, registroId = null, datosAnteriores = null, datosNuevos = null, usuarioId = null) {
  if (!supabase) return;

  try {
    let uid = usuarioId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: u } = await supabase
          .from('usuario')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        uid = u?.id || null;
      }
    }

    await supabase.from('auditoria_logs').insert({
      usuario_id: uid,
      accion,
      tabla_afectada: tabla,
      registro_id: registroId,
      datos_anteriores: datosAnteriores,
      datos_nuevos: datosNuevos,
    });
  } catch (e) {
    console.warn('Error al registrar auditoría:', e.message);
  }
}

