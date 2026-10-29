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
  return ['administrador', 'almacenista'].includes(rolNormalizado(rol));
}
function esAdministrador(rol) {
  return rolNormalizado(rol) === 'administrador';
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
          <h1>🏍️ MotoRepuestos — Sistema de Inventario</h1>
          <p>Gestión completa de repuestos para motocicletas</p>
        </div>
        <div class="header-user">
          <span class="user-badge" title="${escapeHtml(profile.rol_descripcion || profile.rol)}">
            ${iconoRol(profile.rol)} ${escapeHtml(profile.nombre)}
            <small>(${escapeHtml(profile.rol)})</small>
          </span>
          <button id="btn-logout" class="btn btn-logout" title="Cerrar sesión">
            Salir ⏻
          </button>
        </div>
      </div>
    </header>

    <!-- PESTAÑAS DE NAVEGACIÓN -->
    <nav class="tabs-nav">
      <button class="tab-btn active" data-tab="inventario">📦 Inventario</button>
      <button class="tab-btn" data-tab="movimientos">📋 Movimientos</button>
      ${puedeEditar ? '<button class="tab-btn" data-tab="stock">🔄 Entrada/Salida</button>' : ''}
    </nav>

    <!-- CONTENIDO POR PESTAÑA -->
    <div id="tab-content">
      <!-- Se carga dinámicamente -->
    </div>

    <!-- MODAL DE CONFIRMACIÓN (reutilizado) -->
    <div id="modal-confirmar" class="modal">
      <div class="modal-contenido">
        <h3>⚠️ Confirmar Eliminación</h3>
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
              <option value="entrada">📥 Entrada</option>
              <option value="salida">📤 Salida</option>
              ${esAdmin ? '<option value="ajuste">🔧 Ajuste</option>' : ''}
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

  if (tab === 'inventario') {
    await renderizarTabInventario(contenedor);
  } else if (tab === 'movimientos') {
    await renderizarTabMovimientos(contenedor);
  } else if (tab === 'stock') {
    await renderizarTabInventario(contenedor); // Misma vista, pero con foco en stock
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
        <h3>Total Repuestos</h3>
        <p id="stat-total">—</p>
      </div>
      <div class="stat-card">
        <h3>Valor del Inventario</h3>
        <p id="stat-valor">—</p>
      </div>
      <div class="stat-card stat-card-alerta">
        <h3>Stock Bajo</h3>
        <p id="stat-bajo">—</p>
      </div>
      <div class="stat-card">
        <h3>Marcas</h3>
        <p id="stat-marcas">—</p>
      </div>
    </section>

    <!-- PANEL PRINCIPAL -->
    <div class="panel">
      ${puedeEditar ? `
      <!-- FORMULARIO DE REGISTRO -->
      <aside class="card">
        <h2 id="titulo-form">Agregar Repuesto</h2>
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
              + Agregar Repuesto
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
        <h2>Lista de Repuestos</h2>
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
    stock: document.getElementById('stock')?.value || 0,
    stock_minimo: document.getElementById('stock_minimo')?.value || 5,
  };

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
   PESTAÑA: MOVIMIENTOS
   ══════════════════════════════════════════════ */

async function renderizarTabMovimientos(contenedor) {
  contenedor.innerHTML = `
    <div class="card card-full">
      <h2>📋 Historial de Movimientos</h2>
      <div class="tabla-container">
        <table class="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Stock Anterior</th>
              <th>Stock Nuevo</th>
              <th>Motivo</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody id="tabla-movimientos">
            <tr class="sin-datos"><td colspan="8">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const { data, error } = await obtenerMovimientos();

  const tbody = document.getElementById('tabla-movimientos');

  if (error) {
    tbody.innerHTML = `
      <tr class="sin-datos">
        <td colspan="8">
          <div style="padding: 1.5rem; text-align: center;">
            <p style="font-weight: 600; margin-bottom: 0.5rem; color: #4a5568;">ℹ️ Módulo no disponible en la base de datos actual</p>
            <p style="font-size: 0.9rem; color: #718096; margin: 0;">${escapeHtml(error)}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr class="sin-datos"><td colspan="8">No hay movimientos registrados aún.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(m => `
    <tr>
      <td>${formatearFecha(m.created_at)}</td>
      <td><span class="badge badge-${m.tipo}">${tipoEtiqueta(m.tipo)}</span></td>
      <td><strong>${escapeHtml(m.producto_codigo)}</strong> — ${escapeHtml(m.producto_nombre)}</td>
      <td>${m.cantidad}</td>
      <td>${m.stock_anterior}</td>
      <td>${m.stock_nuevo}</td>
      <td>${escapeHtml(m.motivo || '—')}</td>
      <td>${escapeHtml(m.usuario_nombre || '—')}</td>
    </tr>
  `).join('');
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
          ${r.stock < r.stock_minimo ? ' ⚠️' : ''}
        </span>
        <small class="stock-min">min: ${r.stock_minimo}</small>
      </td>
      <td>${formatearPrecio(r.precio_venta)}</td>
      <td class="acciones">
        ${puedeEditar ? `
          <button class="btn btn-small btn-movimiento" data-id="${r.id}" data-accion="movimiento" title="Registrar entrada/salida">
            🔄
          </button>
          <button class="btn btn-editar" data-id="${r.id}" data-accion="editar" title="Editar">
            ✏️
          </button>
        ` : ''}
        ${esAdmin ? `
          <button class="btn btn-eliminar" data-id="${r.id}" data-accion="eliminar" title="Desactivar">
            🗑️
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
    stockInput.disabled = false;
    stockInput.title = 'Ajusta el stock del repuesto';
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
    tipoSelect.innerHTML = '<option value="salida" selected>📤 Salida</option>';
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

  mostrarMensajeEnElemento(msgEl, `✅ Movimiento registrado. Nuevo stock: ${data.stock_nuevo}`, 'exito');

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
  const iconos = { administrador: '👑', almacenista: '📦', vendedor: '🛒', auditor: '📋', invitado: '👤' };
  return iconos[rolLower] || '👤';
}

function tipoEtiqueta(tipo) {
  const etiquetas = { entrada: '📥 Entrada', salida: '📤 Salida', ajuste: '🔧 Ajuste' };
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
