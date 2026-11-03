/* ============================================
   COMPONENTE: Dashboard del Inventario
   ============================================
   Evolución del main.js original.
   Ahora usa Supabase en lugar de localStorage
   y muestra controles según el rol del usuario.
   ============================================ */

import {
  obtenerProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  obtenerEstadisticas,
  obtenerCategorias,
  obtenerMarcas,
  registrarMovimiento,
  obtenerMovimientos,
  registrarAuditoria,
} from './inventario.js';
import { tienePermisoEnPerfil } from './auth.js';
import { renderizarSeguridad } from './seguridadUI.js';


function iconoUI(tipo, clase = '') {
  const paths = {
    motorcycle: '<path d="M5 17h2l3-6h4l3 6h2"/><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="m10 11-2-3H5m8 3 2-3h3"/>',
    package: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/>',
    warning: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
    edit: '<path d="m15 5 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15l-.8 5Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
    entry: '<path d="M12 3v12m-5-5 5 5 5-5"/><path d="M4 19h16"/>',
    exit: '<path d="M12 15V3m-5 5 5-5 5 5"/><path d="M4 19h16"/>',
    wrench: '<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 12l-3-3 3.7-2.7Z"/>',
    shield: '<path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    logout: '<path d="M10 17l5-5-5-5m5 5H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>'
  };
  return '<svg class="ui-icon ' + clase + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[tipo] || paths.package) + '</svg>';
}

// Estado de la aplicación
let productosActuales = [];
let categoriasLista = [];
let marcasLista = [];
let modoEdicion = false;
let idEditando = null;
let idEliminar = null;
let perfilUsuario = null;

// Funciones auxiliares para verificar roles respetando mayúsculas y minúsculas
function rolNormalizado(rol) {
  return (rol || '').toLowerCase().trim();
}
function puedeEditarInventario(rol) {
  return tienePermisoEnPerfil(perfilUsuario, '/inventario/productos', 'crear') || tienePermisoEnPerfil(perfilUsuario, '/inventario/productos', 'actualizar');
}
function esAdministrador(rol) {
  return tienePermisoEnPerfil(perfilUsuario, '/movimientos/ajustes', 'crear');
}
function puedeRegistrarMovimientos() {
  return tienePermisoEnPerfil(perfilUsuario, '/movimientos/entradas', 'crear') || tienePermisoEnPerfil(perfilUsuario, '/movimientos/salidas', 'crear') || tienePermisoEnPerfil(perfilUsuario, '/movimientos/ajustes', 'crear');
}

/**
 * Renderiza el dashboard completo.
 * @param {object} profile - Perfil del usuario autenticado
 * @param {function} onLogout - Callback para cerrar sesión
 */
export function renderizarDashboard(profile, onLogout) {
  perfilUsuario = profile;
  const puedeEditar = puedeEditarInventario(profile.rol);
  const esAdmin = esAdministrador(profile.rol);

  const app = document.querySelector('#app');
  app.innerHTML = `
    <!-- ENCABEZADO DEL DASHBOARD -->
    <header class="header">
      <div class="header-top">
        <div>
          <h1>${iconoUI('motorcycle', 'brand-icon')} MotoRepuestos — Sistema de Inventario</h1>
          <p>Gestión completa de repuestos para motocicletas</p>
        </div>
        <div class="header-user">
          <span class="user-badge" title="${escapeHtml(profile.rol_descripcion || profile.rol)}">
            ${iconoRol(profile.rol)} ${escapeHtml(profile.nombre)}
            <small>(${escapeHtml((profile.roles_nombres || [profile.rol]).join(', '))})</small>
          </span>
          <button id="btn-logout" class="btn btn-logout" title="Cerrar sesión">
            ${iconoUI('logout')} Salir
          </button>
        </div>
      </div>
    </header>

    <!-- PESTAÑAS DE NAVEGACIÓN -->
    <nav class="tabs-nav">
      <button class="tab-btn active" data-tab="inventario">${iconoUI('package')} Inventario</button>
      ${tienePermisoEnPerfil(profile, '/movimientos/entradas', 'leer') || tienePermisoEnPerfil(profile, '/movimientos/salidas', 'leer') ? `<button class="tab-btn" data-tab="movimientos">${iconoUI('list')} Movimientos</button>` : ''}
      ${puedeRegistrarMovimientos() ? `<button class="tab-btn" data-tab="stock">${iconoUI('refresh')} Entrada y salida</button>` : ''}
      ${tienePermisoEnPerfil(profile, '/seguridad/roles', 'leer') ? '<button class="tab-btn" data-tab="seguridad"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg> Roles y permisos</button>' : ''}
    </nav>

    <!-- CONTENIDO POR PESTAÑA -->
    <div id="tab-content">
      <!-- Se carga dinámicamente -->
    </div>

    <!-- MODAL DE CONFIRMACIÓN (reutilizado) -->
    <div id="modal-confirmar" class="modal">
      <div class="modal-contenido">
        <h3>${iconoUI('warning')} Confirmar eliminación</h3>
        <p>¿Está seguro de que desea desactivar este repuesto? Puede reactivarlo después.</p>
        <div class="modal-botones">
          <button id="btn-confirmar-eliminar" class="btn btn-eliminar">Desactivar</button>
          <button id="btn-cancelar-eliminar" class="btn btn-cancelar">Cancelar</button>
        </div>
      </div>
    </div>

    <!-- MODAL MOVIMIENTO DE INVENTARIO -->
    <div id="modal-movimiento" class="modal">
      <div class="modal-contenido modal-movimiento-contenido">
        <h3 id="modal-mov-titulo">Registrar Movimiento</h3>
        <form id="form-movimiento">
          <input type="hidden" id="mov-producto-id" />
          <div class="form-group">
            <label>Producto</label>
            <input type="text" id="mov-producto-nombre" disabled />
          </div>
          <div class="form-group">
            <label>Stock actual</label>
            <input type="text" id="mov-stock-actual" disabled />
          </div>
          <div class="form-group">
            <label for="mov-tipo">Tipo de movimiento *</label>
            <select id="mov-tipo" required>
              <option value="">Seleccione...</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              ${esAdmin ? '<option value="ajuste">Ajuste</option>' : ''}
            </select>
          </div>
          <div class="form-group">
            <label for="mov-cantidad">Cantidad *</label>
            <input type="number" id="mov-cantidad" min="1" required />
          </div>
          <div class="form-group">
            <label for="mov-motivo">Motivo</label>
            <input type="text" id="mov-motivo" placeholder="Ej: Compra proveedor / Venta cliente" />
          </div>
          <div class="modal-botones">
            <button type="submit" class="btn btn-principal">Registrar</button>
            <button type="button" id="btn-cancelar-movimiento" class="btn btn-cancelar">Cancelar</button>
          </div>
          <div id="mov-mensaje" class="mensaje"></div>
        </form>
      </div>
    </div>
  `;

  // Cargar datos iniciales
  cargarDatosIniciales();

  // Evento: cerrar sesión
  document.getElementById('btn-logout')?.addEventListener('click', onLogout);

  // Eventos del modal de eliminación
  document.getElementById('btn-confirmar-eliminar')?.addEventListener('click', confirmarEliminar);
  document.getElementById('btn-cancelar-eliminar')?.addEventListener('click', cerrarModalEliminar);
  document.getElementById('modal-confirmar')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-confirmar') cerrarModalEliminar();
  });

  // Eventos del modal de movimiento
  document.getElementById('btn-cancelar-movimiento')?.addEventListener('click', cerrarModalMovimiento);
  document.getElementById('modal-movimiento')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-movimiento') cerrarModalMovimiento();
  });
  document.getElementById('form-movimiento')?.addEventListener('submit', manejarMovimiento);

  // Pestañas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cargarPestaña(btn.dataset.tab);
    });
  });

  // Cargar pestaña inicial
  cargarPestaña('inventario');
}

/**
 * Carga datos de referencia al inicio y actualiza las listas desplegables.
 */
async function cargarDatosIniciales() {
  const [catRes, marcRes] = await Promise.all([
    obtenerCategorias(),
    obtenerMarcas(),
  ]);
  categoriasLista = catRes.data || [];
  marcasLista = marcRes.data || [];
  actualizarOpcionesFormulario();
}

/**
 * Actualiza las opciones de categorías y marcas en el formulario si ya está montado en el DOM.
 */
function actualizarOpcionesFormulario() {
  const selectCat = document.getElementById('categoria_id');
  if (selectCat && categoriasLista.length > 0) {
    const valorActual = selectCat.value;
    selectCat.innerHTML = `
      <option value="">Sin categoría</option>
      ${categoriasLista.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('')}
    `;
    if (valorActual) selectCat.value = valorActual;
  }

  const datalistMarcas = document.getElementById('lista-marcas');
  if (datalistMarcas && marcasLista.length > 0) {
    datalistMarcas.innerHTML = marcasLista
      .map(m => `<option value="${escapeHtml(m.nombre)}"></option>`)
      .join('');
  }
}

/**
 * Carga el contenido según la pestaña seleccionada.
 */
async function cargarPestaña(tab) {
  const contenedor = document.getElementById('tab-content');

  if (tab === 'seguridad') {
    if (!tienePermisoEnPerfil(perfilUsuario, '/seguridad/roles', 'leer')) {
      contenedor.innerHTML = '<p class="mensaje error">No tienes permiso para administrar roles.</p>';
      return;
    }
    await renderizarSeguridad(contenedor);
  } else if (tab === 'inventario') {
    if (!tienePermisoEnPerfil(perfilUsuario, '/inventario/productos', 'leer')) {
      contenedor.innerHTML = '<p class="mensaje error">No tienes permiso para consultar el inventario.</p>';
      return;
    }
    await renderizarTabInventario(contenedor);
  } else if (tab === 'movimientos') {
    if (!tienePermisoEnPerfil(perfilUsuario, '/movimientos/entradas', 'leer') && !tienePermisoEnPerfil(perfilUsuario, '/movimientos/salidas', 'leer')) {
      contenedor.innerHTML = '<p class="mensaje error">No tienes permiso para consultar movimientos.</p>';
      return;
    }
    await renderizarTabMovimientos(contenedor);
  } else if (tab === 'stock') {
    if (!puedeRegistrarMovimientos()) {
      contenedor.innerHTML = '<p class="mensaje error">No tienes permiso para registrar movimientos.</p>';
      return;
    }
    await renderizarTabRegistroMovimiento(contenedor);
  }
}


/* ══════════════════════════════════════════════
   PESTAÑA: INVENTARIO
   ══════════════════════════════════════════════ */

async function renderizarTabInventario(contenedor) {
  const puedeEditar = puedeEditarInventario(perfilUsuario?.rol);

  contenedor.innerHTML = `
    <!-- ESTADÍSTICAS RÁPIDAS -->
    <section class="stats">
      <div class="stat-card">
        <h3>${iconoUI('package')} Total de repuestos</h3>
        <p id="stat-total">—</p>
      </div>
      <div class="stat-card">
        <h3>${iconoUI('list')} Valor del inventario</h3>
        <p id="stat-valor">—</p>
      </div>
      <div class="stat-card stat-card-alerta">
        <h3>${iconoUI('warning')} Stock bajo</h3>
        <p id="stat-bajo">—</p>
      </div>
      <div class="stat-card">
        <h3>${iconoUI('package')} Marcas</h3>
        <p id="stat-marcas">—</p>
      </div>
    </section>

    <!-- PANEL PRINCIPAL -->
    <div class="panel">
      ${puedeEditar ? `
      <!-- FORMULARIO DE REGISTRO -->
      <aside class="card">
        <h2 id="titulo-form">${iconoUI('plus')} Agregar repuesto</h2>
        <form id="form-repuesto">
          <div class="form-group">
            <label for="codigo">Código *</label>
            <input type="text" id="codigo" name="codigo" placeholder="Ej: MTO-001" required />
          </div>
          <div class="form-group">
            <label for="nombre">Nombre del Repuesto *</label>
            <input type="text" id="nombre" name="nombre" placeholder="Ej: Filtro de aceite" required />
          </div>
          <div class="form-group">
            <label for="descripcion">Descripción</label>
            <input type="text" id="descripcion" name="descripcion" placeholder="Descripción breve" />
          </div>
          <div class="form-group">
            <label for="categoria_id">Categoría</label>
            <select id="categoria_id" name="categoria_id">
              <option value="">Sin categoría</option>
              ${categoriasLista.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="marca">Marca</label>
            <input type="text" id="marca" name="marca" placeholder="Ej: Honda, Yamaha, Bajaj" list="lista-marcas" autocomplete="off" />
            <datalist id="lista-marcas">
              ${marcasLista.map(m => `<option value="${escapeHtml(m.nombre)}"></option>`).join('')}
            </datalist>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="precio_compra">Precio Compra ($)</label>
              <input type="number" id="precio_compra" name="precio_compra" step="0.01" min="0" placeholder="0.00" />
            </div>
            <div class="form-group">
              <label for="precio_venta">Precio Venta ($) *</label>
              <input type="number" id="precio_venta" name="precio_venta" step="0.01" min="0" placeholder="0.00" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="stock">Stock Inicial *</label>
              <input type="number" id="stock" name="stock" min="0" placeholder="0" required />
            </div>
            <div class="form-group">
              <label for="stock_minimo">Stock Mínimo</label>
              <input type="number" id="stock_minimo" name="stock_minimo" min="0" value="5" />
            </div>
          </div>

          <div id="form-buttons">
            <button type="submit" class="btn btn-principal" id="btn-guardar">
              ${iconoUI('plus')} Agregar repuesto
            </button>
          </div>
          <div class="form-actions" id="edit-buttons" style="display: none;">
            <button type="submit" class="btn btn-principal">Guardar Cambios</button>
            <button type="button" class="btn btn-cancelar" id="btn-cancelar">Cancelar</button>
          </div>

          <div id="mensaje" class="mensaje"></div>
        </form>
      </aside>
      ` : ''}

      <!-- TABLA DE REPUESTOS -->
      <main class="card ${!puedeEditar ? 'card-full' : ''}">
        <h2>${iconoUI('list')} Lista de repuestos</h2>
        <div class="buscador-container">
          <input type="text" id="buscador" class="buscador" placeholder="Buscar por código o nombre..." />
        </div>
        <div class="tabla-container">
          <table class="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Marca</th>
                <th>Stock</th>
                <th>Precio</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-body">
              <tr class="sin-datos"><td colspan="7">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  `;

  // 1. Configurar eventos inmediatamente después de inyectar el HTML en el DOM
  configurarEventosInventario();

  // 2. Cargar datos desde la base de datos
  await refrescarInventario();
}

/**
 * Refresca productos + estadísticas desde la BD.
 */
async function refrescarInventario(busqueda = '') {
  const [prodRes, statsRes] = await Promise.all([
    obtenerProductos(busqueda),
    obtenerEstadisticas(),
  ]);

  if (prodRes.error) {
    console.error('Error al cargar productos:', prodRes.error);
  }
  productosActuales = prodRes.data;
  renderizarTabla(productosActuales);

  if (!statsRes.error) {
    actualizarEstadisticas(statsRes.stats);
  }
}

/**
 * Configura los event listeners de la pestaña inventario de forma segura.
 */
function configurarEventosInventario() {
  const puedeEditar = puedeEditarInventario(perfilUsuario?.rol);

  // Buscador
  const buscador = document.getElementById('buscador');
  let debounceTimer;
  if (buscador) {
    buscador.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        refrescarInventario(e.target.value);
      }, 300);
    });
  }

  // Formulario (si puede editar)
  if (puedeEditar) {
    const form = document.getElementById('form-repuesto');
    if (form) {
      form.addEventListener('submit', manejarSubmitProducto);
    }

    document.getElementById('btn-cancelar')?.addEventListener('click', cancelarEdicion);
  }

  // Botones de la tabla
  const tablaBody = document.getElementById('tabla-body');
  if (tablaBody) {
    tablaBody.addEventListener('click', manejarAccionTabla);
  }
}

/**
 * Maneja el envío del formulario de producto (crear/editar).
 */
async function manejarSubmitProducto(e) {
  e.preventDefault();

  const datos = {
    codigo: document.getElementById('codigo').value.trim(),
    nombre: document.getElementById('nombre').value.trim(),
    descripcion: document.getElementById('descripcion')?.value.trim() || '',
    categoria_id: document.getElementById('categoria_id')?.value || null,
    marca: document.getElementById('marca')?.value.trim() || null,
    precio_compra: document.getElementById('precio_compra')?.value || 0,
    precio_venta: document.getElementById('precio_venta').value,
    stock_minimo: document.getElementById('stock_minimo')?.value || 5,
  };

  if (!modoEdicion) datos.stock = document.getElementById('stock')?.value || 0;

  if (!datos.codigo || !datos.nombre || !datos.precio_venta) {
    mostrarMensaje('Completa los campos obligatorios (*)', 'error');
    return;
  }

  const btnGuardar = document.getElementById('btn-guardar');
  if (btnGuardar) btnGuardar.disabled = true;

  if (modoEdicion && idEditando) {
    const { error } = await actualizarProducto(idEditando, datos);
    if (error) {
      mostrarMensaje(`Error: ${error}`, 'error');
    } else {
      await registrarAuditoria('UPDATE', 'productos', idEditando, null, datos);
      mostrarMensaje('Repuesto actualizado correctamente', 'exito');
      cancelarEdicion();
    }
  } else {
    const { data, error } = await crearProducto(datos);
    if (error) {
      mostrarMensaje(`Error: ${error}`, 'error');
    } else {
      await registrarAuditoria('INSERT', 'productos', data?.id, null, datos);
      mostrarMensaje('Repuesto agregado correctamente', 'exito');
      limpiarFormulario();
    }
  }

  if (btnGuardar) btnGuardar.disabled = false;
  await refrescarInventario();
}

/**
 * Maneja clics en los botones de la tabla.
 */
function manejarAccionTabla(e) {
  const boton = e.target.closest('[data-accion]');
  if (!boton) return;

  const accion = boton.dataset.accion;
  const id = parseInt(boton.dataset.id);

  if (accion === 'editar') {
    const producto = productosActuales.find(p => p.id === id);
    if (producto) cargarFormularioEdicion(producto);
  } else if (accion === 'eliminar') {
    abrirModalEliminar(id);
  } else if (accion === 'movimiento') {
    const producto = productosActuales.find(p => p.id === id);
    if (producto) abrirModalMovimiento(producto);
  }
}


/* ══════════════════════════════════════════════
   PESTAÑA: REGISTRAR ENTRADAS Y SALIDAS
   ══════════════════════════════════════════════ */

async function renderizarTabRegistroMovimiento(contenedor) {
  const puedeEntrada = tienePermisoEnPerfil(perfilUsuario, '/movimientos/entradas', 'crear');
  const puedeSalida = tienePermisoEnPerfil(perfilUsuario, '/movimientos/salidas', 'crear');
  const puedeAjuste = tienePermisoEnPerfil(perfilUsuario, '/movimientos/ajustes', 'crear');
  const { data: productos, error } = await obtenerProductos();
  if (error) {
    contenedor.innerHTML = `<div class="card"><p class="mensaje error">No se pudieron cargar los repuestos: ${escapeHtml(error)}</p></div>`;
    return;
  }
  const opciones = (productos || []).map(p =>
    `<option value="${p.id}" data-stock="${p.stock}" data-codigo="${escapeHtml(p.codigo)}" data-nombre="${escapeHtml(p.nombre)}">${escapeHtml(p.codigo)} — ${escapeHtml(p.nombre)} (Stock: ${p.stock})</option>`
  ).join('');

  contenedor.innerHTML = `
    <section class="movement-intro">
      <div><span class="eyebrow">CONTROL DE EXISTENCIAS</span><h2>Registrar movimiento</h2>
      <p>Selecciona un repuesto existente y registra la mercancía que entra o sale. El stock se actualizará automáticamente.</p></div>
      <div class="movement-shortcuts"><span>Entrada suma unidades</span><span>Salida descuenta unidades</span></div>
    </section>
    <div class="movement-layout">
      <form id="form-registro-movimiento" class="card movement-form">
        <div class="form-group">
          <label for="mov-buscar-producto">Buscar repuesto</label>
          <input id="mov-buscar-producto" type="search" placeholder="Escribe código o nombre para filtrar..." autocomplete="off">
        </div>
        <div class="form-group">
          <label for="mov-select-producto">Repuesto *</label>
          <select id="mov-select-producto" required><option value="">Selecciona un repuesto...</option>${opciones}</select>
        </div>
        <div class="movement-stock" aria-live="polite">
          <span>Existencia actual</span><strong id="mov-stock-actual-tab">—</strong><small id="mov-codigo-actual">Selecciona un producto</small>
        </div>
        <div class="form-group">
          <label for="mov-tipo-tab">Tipo de movimiento *</label>
          <select id="mov-tipo-tab" required>
            <option value="">Selecciona...</option>
            ${puedeEntrada ? '<option value="entrada">Entrada de mercancía</option>' : ''}
            ${puedeSalida ? '<option value="salida">Salida de mercancía</option>' : ''}
            ${puedeAjuste ? '<option value="ajuste">Ajuste de existencia</option>' : ''}
          </select>
        </div>
        <div class="form-group">
          <label for="mov-cantidad-tab" id="mov-cantidad-label">Cantidad *</label>
          <input id="mov-cantidad-tab" type="number" min="1" step="1" placeholder="Ej. 5" required>
          <div class="quantity-shortcuts" aria-label="Cantidades rápidas">
            <button type="button" data-quantity="1">+1</button><button type="button" data-quantity="5">+5</button><button type="button" data-quantity="10">+10</button>
          </div>
        </div>
        <div class="form-group">
          <label for="mov-motivo-tab">Motivo o referencia</label>
          <input id="mov-motivo-tab" type="text" maxlength="255" placeholder="Ej. Compra a proveedor, venta, devolución...">
        </div>
        <div class="movement-preview" id="mov-preview" aria-live="polite">El stock resultante aparecerá aquí al completar los datos.</div>
        <div class="form-actions">
          <button type="submit" class="btn btn-principal" id="btn-guardar-movimiento">Registrar movimiento</button>
          <button type="reset" class="btn btn-cancelar">Limpiar</button>
        </div>
        <div id="mov-tab-mensaje" class="mensaje" role="status"></div>
      </form>
      <aside class="card movement-help">
        <h3>Antes de registrar</h3>
        <ul><li>Una entrada aumenta las unidades disponibles.</li><li>Una salida descuenta unidades y no permite stock negativo.</li><li>Un ajuste establece la existencia real contada; úsalo solo si tienes permiso.</li></ul>
        <div class="movement-tip"><strong>Consejo</strong><p>Escribe el motivo para que el historial permita identificar por qué cambió la existencia.</p></div>
        <button type="button" class="btn btn-cancelar" id="btn-ver-historial">Ver historial de movimientos →</button>
      </aside>
    </div>
  `;

  const form = document.getElementById('form-registro-movimiento');
  const select = document.getElementById('mov-select-producto');
  const search = document.getElementById('mov-buscar-producto');
  const tipo = document.getElementById('mov-tipo-tab');
  const cantidad = document.getElementById('mov-cantidad-tab');
  const stockEl = document.getElementById('mov-stock-actual-tab');
  const preview = document.getElementById('mov-preview');

  const actualizarPreview = () => {
    const opt = select.selectedOptions[0];
    const stock = Number(opt?.dataset.stock);
    const qty = Number(cantidad.value);
    stockEl.textContent = opt?.value ? stock.toLocaleString('es-VE') + ' unidades' : '—';
    document.getElementById('mov-codigo-actual').textContent = opt?.value ? opt.dataset.codigo + ' · ' + opt.dataset.nombre : 'Selecciona un producto';
    if (!opt?.value || !tipo.value || !Number.isInteger(qty) || qty <= 0) {
      preview.textContent = 'El stock resultante aparecerá aquí al completar los datos.';
      preview.className = 'movement-preview';
      return;
    }
    const nuevo = tipo.value === 'entrada' ? stock + qty : tipo.value === 'salida' ? stock - qty : qty;
    preview.textContent = nuevo < 0 ? 'Stock insuficiente: no puedes dejar existencia negativa.' : `Existencia después del movimiento: ${nuevo} unidades`;
    preview.className = 'movement-preview ' + (nuevo < 0 ? 'is-error' : 'is-ready');
  };
  select.addEventListener('change', actualizarPreview);
  tipo.addEventListener('change', () => {
    document.getElementById('mov-cantidad-label').textContent = tipo.value === 'ajuste' ? 'Nueva existencia total *' : 'Cantidad de unidades *';
    actualizarPreview();
  });
  cantidad.addEventListener('input', actualizarPreview);
  search.addEventListener('input', () => {
    const q = search.value.toLocaleLowerCase();
    [...select.options].forEach((opt, index) => {
      if (!index) return;
      opt.hidden = !opt.textContent.toLocaleLowerCase().includes(q);
    });
    const selected = select.selectedOptions[0];
    if (selected?.hidden) select.value = '';
    actualizarPreview();
  });
  contenedor.querySelectorAll('[data-quantity]').forEach(btn => btn.addEventListener('click', () => {
    cantidad.value = (Number(cantidad.value) || 0) + Number(btn.dataset.quantity);
    actualizarPreview();
  }));
  document.getElementById('btn-ver-historial').addEventListener('click', () => {
    document.querySelector('[data-tab="movimientos"]')?.click();
  });
  form.addEventListener('reset', () => setTimeout(actualizarPreview, 0));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = Number(select.value);
    const movementType = tipo.value;
    const qty = Number(cantidad.value);
    if (!productId || !movementType || !Number.isInteger(qty) || qty <= 0) return;
    const submit = document.getElementById('btn-guardar-movimiento');
    const msg = document.getElementById('mov-tab-mensaje');
    submit.disabled = true;
    submit.textContent = 'Registrando...';
    const result = await registrarMovimiento(productId, movementType, qty, document.getElementById('mov-motivo-tab').value);
    if (result.error) {
      mostrarMensajeEnElemento(msg, result.error, 'error');
    } else {
      mostrarMensajeEnElemento(msg, `Movimiento guardado. Existencia actualizada: ${result.data.stock_nuevo} unidades.`, 'exito');
      form.reset();
      await cargarDatosIniciales();
    }
    submit.disabled = false;
    submit.textContent = 'Registrar movimiento';
  });
  actualizarPreview();
}

/* ══════════════════════════════════════════════
   PESTAÑA: MOVIMIENTOS
   ══════════════════════════════════════════════ */

async function renderizarTabMovimientos(contenedor) {
  contenedor.innerHTML = `
    <div class="card card-full">
      <div class="history-heading"><div><span class="eyebrow">TRAZABILIDAD</span><h2>${iconoUI('list')} Historial de movimientos</h2><p>Consulta cada cambio de existencia registrado en el sistema.</p></div>
      <button type="button" id="btn-actualizar-historial" class="btn btn-cancelar">↻ Actualizar</button></div>
      <div class="history-tools">
        <input type="search" id="buscar-movimiento" class="buscador" placeholder="Buscar por código, producto, usuario o motivo...">
        <select id="filtro-tipo-movimiento"><option value="">Todos los movimientos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option><option value="ajuste">Ajustes</option></select>
      </div>
      <div class="tabla-container">
        <table class="tabla">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Cantidad</th><th>Stock anterior</th><th>Stock nuevo</th><th>Motivo</th><th>Usuario</th></tr></thead>
          <tbody id="tabla-movimientos"><tr class="sin-datos"><td colspan="8">Cargando...</td></tr></tbody>
        </table>
      </div>
      <p class="history-count" id="contador-movimientos"></p>
    </div>
  `;
  const tbody = document.getElementById('tabla-movimientos');
  let movimientos = [];
  const pintar = () => {
    const q = document.getElementById('buscar-movimiento').value.trim().toLocaleLowerCase();
    const tipo = document.getElementById('filtro-tipo-movimiento').value;
    const filtrados = movimientos.filter(m => (!tipo || m.tipo === tipo) &&
      [m.producto_codigo,m.producto_nombre,m.usuario_nombre,m.motivo,m.tipo].some(v => String(v || '').toLocaleLowerCase().includes(q)));
    document.getElementById('contador-movimientos').textContent = `${filtrados.length} de ${movimientos.length} movimientos`;
    if (!filtrados.length) {
      tbody.innerHTML = `<tr class="sin-datos"><td colspan="8">${movimientos.length ? 'No hay resultados para esos filtros.' : 'Todavía no hay movimientos registrados.'}</td></tr>`;
      return;
    }
    tbody.innerHTML = filtrados.map(m => `
      <tr>
        <td>${formatearFecha(m.created_at)}</td>
        <td><span class="badge badge-${m.tipo}">${tipoEtiqueta(m.tipo)}</span></td>
        <td><strong>${escapeHtml(m.producto_codigo)}</strong> — ${escapeHtml(m.producto_nombre)}</td>
        <td>${m.cantidad}</td><td>${m.stock_anterior}</td><td>${m.stock_nuevo}</td>
        <td>${escapeHtml(m.motivo || '—')}</td><td>${escapeHtml(m.usuario_nombre || '—')}</td>
      </tr>`).join('');
  };
  const cargar = async () => {
    tbody.innerHTML = '<tr class="sin-datos"><td colspan="8">Cargando movimientos...</td></tr>';
    const { data, error } = await obtenerMovimientos();
    if (error) {
      tbody.innerHTML = `<tr class="sin-datos"><td colspan="8"><span class="mensaje error">No se pudo consultar el historial: ${escapeHtml(error)}</span></td></tr>`;
      return;
    }
    movimientos = data || [];
    pintar();
  };
  document.getElementById('buscar-movimiento').addEventListener('input', pintar);
  document.getElementById('filtro-tipo-movimiento').addEventListener('change', pintar);
  document.getElementById('btn-actualizar-historial').addEventListener('click', cargar);
  await cargar();
}

/* ══════════════════════════════════════════════
   RENDERIZADO DE TABLA DE PRODUCTOS
   ══════════════════════════════════════════════ */

function renderizarTabla(datos) {
  const tbody = document.getElementById('tabla-body');
  if (!tbody) return;

  const puedeEditar = puedeEditarInventario(perfilUsuario?.rol);
  const esAdmin = esAdministrador(perfilUsuario?.rol);

  if (!datos || datos.length === 0) {
    tbody.innerHTML = `
      <tr class="sin-datos">
        <td colspan="7">No hay repuestos registrados o no se encontraron resultados.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = datos.map(r => `
    <tr class="${r.stock < r.stock_minimo ? 'fila-alerta' : ''}">
      <td><strong>${escapeHtml(r.codigo)}</strong></td>
      <td>${escapeHtml(r.nombre)}</td>
      <td>${escapeHtml(r.categoria)}</td>
      <td>${escapeHtml(r.marca)}</td>
      <td>
        <span class="${r.stock < r.stock_minimo ? 'stock-bajo' : 'stock-ok'}">
          ${r.stock}
          ${r.stock < r.stock_minimo ? ` ${iconoUI('warning', 'stock-warning')}` : ''}
        </span>
        <small class="stock-min">min: ${r.stock_minimo}</small>
      </td>
      <td>${formatearPrecio(r.precio_venta)}</td>
      <td class="acciones">
        ${puedeEditar ? `
          <button class="btn btn-small btn-movimiento" data-id="${r.id}" data-accion="movimiento" title="Registrar entrada/salida">
            ${iconoUI('refresh')}
          </button>
          <button class="btn btn-editar" data-id="${r.id}" data-accion="editar" title="Editar">
            ${iconoUI('edit')}
          </button>
        ` : ''}
        ${esAdmin ? `
          <button class="btn btn-eliminar" data-id="${r.id}" data-accion="eliminar" title="Desactivar">
            ${iconoUI('trash')}
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}


/* ══════════════════════════════════════════════
   ESTADÍSTICAS
   ══════════════════════════════════════════════ */

function actualizarEstadisticas(stats) {
  const elTotal = document.getElementById('stat-total');
  const elValor = document.getElementById('stat-valor');
  const elBajo = document.getElementById('stat-bajo');
  const elMarcas = document.getElementById('stat-marcas');

  if (elTotal) elTotal.textContent = stats.total;
  if (elValor) elValor.textContent = formatearPrecio(stats.valor);
  if (elBajo) {
    elBajo.textContent = stats.stockBajo;
    if (stats.stockBajo > 0) {
      elBajo.closest('.stat-card')?.classList.add('stat-card-alerta-activo');
    }
  }
  if (elMarcas) elMarcas.textContent = stats.marcas;
}


/* ══════════════════════════════════════════════
   FORMULARIO: EDICIÓN / CANCELAR
   ══════════════════════════════════════════════ */

function cargarFormularioEdicion(producto) {
  const campos = {
    codigo: producto.codigo,
    nombre: producto.nombre,
    descripcion: producto.descripcion || '',
    categoria_id: producto.categoria_id || '',
    marca: producto.marca || '',
    precio_compra: producto.precio_compra,
    precio_venta: producto.precio_venta,
    stock: producto.stock,
    stock_minimo: producto.stock_minimo,
  };

  Object.entries(campos).forEach(([key, val]) => {
    const el = document.getElementById(key);
    if (el) el.value = val;
  });

  const stockInput = document.getElementById('stock');
  if (stockInput) {
    stockInput.disabled = true;
    stockInput.title = 'Para modificar existencias, registra una entrada, salida o ajuste en el módulo de movimientos.';
  }

  modoEdicion = true;
  idEditando = producto.id;

  const tituloForm = document.getElementById('titulo-form');
  if (tituloForm) tituloForm.textContent = 'Editar Repuesto';

  const formButtons = document.getElementById('form-buttons');
  const editButtons = document.getElementById('edit-buttons');
  if (formButtons) formButtons.style.display = 'none';
  if (editButtons) editButtons.style.display = 'flex';

  document.querySelector('.card')?.scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicion() {
  modoEdicion = false;
  idEditando = null;
  limpiarFormulario();

  const stockInput = document.getElementById('stock');
  if (stockInput) {
    stockInput.disabled = false;
    stockInput.title = '';
  }

  const tituloForm = document.getElementById('titulo-form');
  if (tituloForm) tituloForm.textContent = 'Agregar Repuesto';

  const formButtons = document.getElementById('form-buttons');
  const editButtons = document.getElementById('edit-buttons');
  if (formButtons) formButtons.style.display = 'block';
  if (editButtons) editButtons.style.display = 'none';
}

function limpiarFormulario() {
  const form = document.getElementById('form-repuesto');
  if (form) form.reset();
  const stockMin = document.getElementById('stock_minimo');
  if (stockMin) stockMin.value = '5';
}


/* ══════════════════════════════════════════════
   MODALES
   ══════════════════════════════════════════════ */

function abrirModalEliminar(id) {
  idEliminar = id;
  document.getElementById('modal-confirmar')?.classList.add('activo');
}

function cerrarModalEliminar() {
  idEliminar = null;
  document.getElementById('modal-confirmar')?.classList.remove('activo');
}

async function confirmarEliminar() {
  if (!idEliminar) return;

  const { error } = await eliminarProducto(idEliminar);

  if (error) {
    mostrarMensaje(`Error: ${error}`, 'error');
  } else {
    await registrarAuditoria('DELETE (soft)', 'productos', idEliminar);
    mostrarMensaje('Repuesto desactivado correctamente', 'exito');
  }

  cerrarModalEliminar();
  await refrescarInventario();
}

function abrirModalMovimiento(producto) {
  document.getElementById('mov-producto-id').value = producto.id;
  document.getElementById('mov-producto-nombre').value = `${producto.codigo} — ${producto.nombre}`;
  document.getElementById('mov-stock-actual').value = producto.stock;
  document.getElementById('mov-tipo').value = '';
  document.getElementById('mov-cantidad').value = '';
  document.getElementById('mov-motivo').value = '';

  // Vendedor solo puede salidas
  if (perfilUsuario.rol === 'vendedor') {
    const tipoSelect = document.getElementById('mov-tipo');
    tipoSelect.innerHTML = '<option value="salida" selected>Salida</option>';
  }

  document.getElementById('modal-movimiento')?.classList.add('activo');
}

function cerrarModalMovimiento() {
  document.getElementById('modal-movimiento')?.classList.remove('activo');
}

async function manejarMovimiento(e) {
  e.preventDefault();

  const productoId = parseInt(document.getElementById('mov-producto-id').value);
  const tipo = document.getElementById('mov-tipo').value;
  const cantidad = parseInt(document.getElementById('mov-cantidad').value);
  const motivo = document.getElementById('mov-motivo').value.trim();
  const msgEl = document.getElementById('mov-mensaje');

  if (!tipo || !cantidad || cantidad <= 0) {
    mostrarMensajeEnElemento(msgEl, 'Completa tipo y cantidad', 'error');
    return;
  }

  const { data, error } = await registrarMovimiento(productoId, tipo, cantidad, motivo);

  if (error) {
    mostrarMensajeEnElemento(msgEl, `Error: ${error}`, 'error');
    return;
  }

  mostrarMensajeEnElemento(msgEl, `${iconoUI('check')} Movimiento registrado. Nuevo stock: ${data.stock_nuevo}`, 'exito');

  setTimeout(() => {
    cerrarModalMovimiento();
    refrescarInventario();
  }, 1000);
}


/* ══════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════ */

function formatearPrecio(valor) {
  const num = parseFloat(valor) || 0;
  return '$' + num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function escapeHtml(texto) {
  if (!texto) return '';
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function formatearFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-VE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function iconoRol(rol) {
  const rolLower = (rol || '').toLowerCase().trim();
  const iconos = { administrador: 'shield', almacenista: 'package', vendedor: 'user', auditor: 'list', invitado: 'user' };
  return iconoUI(iconos[rolLower] || 'user', 'role-icon');
}

function tipoEtiqueta(tipo) {
  const etiquetas = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' };
  return etiquetas[tipo] || tipo;
}

function mostrarMensaje(texto, tipo) {
  const mensaje = document.getElementById('mensaje');
  if (!mensaje) return;
  mostrarMensajeEnElemento(mensaje, texto, tipo);
}

function mostrarMensajeEnElemento(el, texto, tipo) {
  if (!el) return;
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
  setTimeout(() => { el.className = 'mensaje'; }, 4000);
}
